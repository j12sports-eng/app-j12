#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// The root override is used only by isolated contract fixtures.
const ROOT = process.env.CI_SECRET_SCAN_ROOT
  ? path.resolve(process.env.CI_SECRET_SCAN_ROOT)
  : path.resolve(__dirname, "../..");
const files = Array.from(
  new Set(
    execFileSync(
      "git",
      [
        "-c",
        "core.quotepath=false",
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
      ],
      { cwd: ROOT },
    )
      .toString("utf8")
      .split("\0")
      .filter(Boolean),
  ),
);
const findings = [];
const forbiddenPaths = [
  /(^|\/)\.env($|\.)/i,
  /(^|\/)certs?\//i,
  /\.(pem|key|p12|pfx|crt|cer)$/i,
  /(^|\/)(id_rsa|id_ed25519)$/i,
  /\.(dump)(\.gz)?$/i,
  /(^|\/)(backup|dump)[^/]*\.sql(\.gz)?$/i,
];
const allowedEnvExamples = new Set([
  ".env.example",
  ".env.production.example",
  ".env.api.production.example",
  "backend/.env.example",
  "config/hml/hml.env.example",
  "config/hml/external-financial.env.example",
]);

for (const file of files) {
  const normalized = file.replaceAll("\\", "/");
  if (
    forbiddenPaths.some((pattern) => pattern.test(normalized)) &&
    !allowedEnvExamples.has(normalized)
  )
    findings.push({ file: normalized, type: "forbidden-sensitive-path" });
  const full = path.join(ROOT, file);
  const stat = fs.statSync(full);
  if (stat.size > 2 * 1024 * 1024 || isBinary(full)) continue;
  const content = fs.readFileSync(full, "utf8");
  scanContent(normalized, content, findings);
}

const report = { filesScanned: files.length, findings };
fs.mkdirSync(path.join(ROOT, "artifacts/ci"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "artifacts/ci/secret-scan.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(
  `${JSON.stringify({ filesScanned: files.length, findings: findings.length })}\n`,
);
if (findings.length) {
  process.stderr.write(`${JSON.stringify(findings, null, 2)}\n`);
  process.exit(1);
}

function scanContent(file, content, output) {
  const isTestFile = /\.(test|spec)\.[cm]?[jt]sx?$/.test(file);
  const patterns = [
    ["github-token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
    ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ];
  for (const [type, pattern] of patterns) if (pattern.test(content)) output.push({ file, type });
  const privateKeys =
    content.match(
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    ) || [];
  for (const block of privateKeys)
    if (!(isTestFile && /PRIVATE KEY-----(?:\s|\\n)*fixture-only(?:\s|\\n)*-----END/i.test(block)))
      output.push({ file, type: "private-key" });
  const credentialUrls =
    content.match(/\b(?:mysql|postgres(?:ql)?):\/\/[^\s:/]+:[^\s@/<>{}]+@[^\s/]+/gi) || [];
  for (const url of credentialUrls)
    if (!/\/\/user:pass@host$/i.test(url)) output.push({ file, type: "credential-url" });
  const assignment =
    /^\s*(?:export[ \t]+)?(JWT_SECRET|DB_PASSWORD|INTER_CLIENT_SECRET|RESEND_API_KEY|N8N_SERVICE_TOKEN|BOTCONVERSA_API_KEY)[ \t]*=[ \t]*([^\r\n#]*)$/gim;
  for (const match of content.matchAll(assignment)) {
    const value = match[2].replace(/^['"]|['"]$/g, "");
    const fixture = isTestFile && /^fixture-only/i.test(value);
    if (
      value &&
      !fixture &&
      !/^<.*>$/.test(value) &&
      !/^(false|disabled|example|replace|test)/i.test(value)
    )
      output.push({ file, type: "assigned-secret", variable: match[1] });
  }
}
function isBinary(file) {
  const buffer = Buffer.alloc(512);
  const descriptor = fs.openSync(file, "r");
  const bytes = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
  fs.closeSync(descriptor);
  for (let index = 0; index < bytes; index += 1) if (buffer[index] === 0) return true;
  return false;
}
