const EMAIL_PROVIDER = (
  process.env.EMAIL_PROVIDER ||
  (process.env.RESEND_API_KEY ? "resend" : "disabled")
).toLowerCase();

const RESEND_API_URL = "https://api.resend.com/emails";

function getFromAddress() {
  const email = process.env.RESEND_FROM_EMAIL?.trim();
  if (!email) return null;

  const name = process.env.RESEND_FROM_NAME?.trim();
  return name ? `${name} <${email}>` : email;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPasswordResetEmail({ to, resetUrl, expiresAt }) {
  const safeUrl = escapeHtml(resetUrl);
  const safeTo = escapeHtml(to);
  const expires = new Date(expiresAt).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return {
    subject: "J12 Sports - Redefinicao de senha",
    text: [
      `Ola, ${to}.`,
      "",
      "Recebemos uma solicitacao para redefinir sua senha na J12 Sports.",
      `Use o link abaixo para criar uma nova senha: ${resetUrl}`,
      "",
      `Este link expira em ${expires}.`,
      "Se voce nao solicitou esta alteracao, ignore este e-mail.",
    ].join("\n"),
    html: `
      <div style="background:#050505;padding:32px 16px;font-family:Arial,sans-serif;color:#f5f5f5;">
        <div style="max-width:560px;margin:0 auto;border:1px solid rgba(255,255,255,0.08);background:#111111;border-radius:24px;overflow:hidden;">
          <div style="padding:28px 28px 18px;background:linear-gradient(135deg,#ff6b00,#ff4500);">
            <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;font-weight:700;opacity:0.9;">
              J12 Sports
            </div>
            <h1 style="margin:16px 0 8px;font-size:28px;line-height:1.1;">
              Redefinicao de senha
            </h1>
            <p style="margin:0;font-size:14px;opacity:0.92;">
              Pedido de recuperacao para <strong>${safeTo}</strong>
            </p>
          </div>

          <div style="padding:28px;">
            <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#d6d6d6;">
              Recebemos uma solicitacao para redefinir a senha da sua conta na J12 Sports.
              Para continuar com seguranca, use o botao abaixo:
            </p>

            <div style="margin:28px 0;">
              <a
                href="${safeUrl}"
                style="display:inline-block;padding:14px 22px;border-radius:16px;background:linear-gradient(135deg,#ff6b00,#ff4500);color:#ffffff;text-decoration:none;font-weight:700;"
              >
                Criar nova senha
              </a>
            </div>

            <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#d6d6d6;">
              Se preferir, copie e cole este link no navegador:
            </p>
            <p style="margin:0 0 18px;word-break:break-word;font-size:13px;line-height:1.7;color:#ffb07e;">
              ${safeUrl}
            </p>

            <div style="margin-top:20px;padding:16px;border:1px solid rgba(255,255,255,0.08);border-radius:18px;background:#0a0a0a;">
              <p style="margin:0 0 8px;font-size:13px;color:#f5f5f5;font-weight:700;">Aviso de seguranca</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#b7b7b7;">
                Este link expira em <strong>${escapeHtml(expires)}</strong>. Se voce nao solicitou a redefinicao,
                ignore este e-mail.
              </p>
            </div>
          </div>
        </div>
      </div>
    `,
  };
}

async function sendWithResend({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = getFromAddress();

  if (!apiKey || !from) {
    throw new Error(
      "Configuracao de e-mail incompleta. Defina RESEND_API_KEY e RESEND_FROM_EMAIL.",
    );
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  const bodyText = await response.text();
  const data = bodyText ? JSON.parse(bodyText) : {};

  if (!response.ok) {
    throw new Error(data?.message || "Falha ao enviar e-mail pela Resend.");
  }

  return {
    provider: "resend",
    messageId: data.id ?? null,
  };
}

export function emailDeliveryEnabled() {
  return EMAIL_PROVIDER !== "disabled";
}

export async function sendPasswordResetEmail({ to, resetUrl, expiresAt }) {
  const content = buildPasswordResetEmail({ to, resetUrl, expiresAt });

  if (EMAIL_PROVIDER === "resend") {
    return sendWithResend({ to, ...content });
  }

  console.warn(
    `[email] envio real desabilitado. Configure EMAIL_PROVIDER=resend para enviar o e-mail de recuperacao para ${to}.`,
  );

  return {
    provider: "disabled",
    previewUrl: resetUrl,
  };
}
