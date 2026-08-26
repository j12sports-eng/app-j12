const mysql = require("mysql2/promise");
const path = require("node:path");
const dotenv = require("dotenv");
const { createDatabaseConnectivity } = require("./database-connectivity.js");
const {
  ENROLLMENT_REGISTRY_STATE_SQL,
  MAX_ENROLLMENT_SEQUENCE,
  MIN_ENROLLMENT_SEQUENCE,
  allocateEnrollmentSequence,
  buildEnrollmentNumberPreview,
  createEnrollmentNumberError,
  extractEnrollmentSequence,
  extractLegacyRegistrySequence,
  getModernEnrollmentRegistryState,
  isModernEnrollmentRegistryRow,
  partitionEnrollmentRowsForRegistry,
} = require("./enrollment-number.js");
const { createNoopDdlResult, createRuntimeDdlPolicy } = require("./runtime-ddl-policy.js");
const { logger } = require("../observability/structured-logger.js");

dotenv.config({
  path: [path.resolve(__dirname, "../../../.env"), path.resolve(__dirname, "../../.env")],
});

// ====================================
// VALIDAÃ‡ÃƒO DE CREDENCIAIS
// ====================================
function parseDatabaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return {};

  try {
    const url = new URL(raw);
    return {
      host: url.hostname,
      user: decodeURIComponent(url.username || ""),
      password: decodeURIComponent(url.password || ""),
      database: url.pathname.replace(/^\/+/, ""),
      port: url.port ? Number(url.port) : 3306,
    };
  } catch (error) {
    console.error("[ERROR] DATABASE_URL invalida:", error?.message || error);
    return {};
  }
}

const DATABASE_URL_CONFIG = parseDatabaseUrl(process.env.DATABASE_URL);
const DB_HOST = process.env.DB_HOST || DATABASE_URL_CONFIG.host || "108.167.168.27";
const DB_USER = process.env.DB_USER || DATABASE_URL_CONFIG.user || "bestt486_appj12";
const DB_PASSWORD = process.env.DB_PASSWORD || DATABASE_URL_CONFIG.password || "";
const DB_NAME = process.env.DB_NAME || DATABASE_URL_CONFIG.database || "bestt486_appj12";
const DB_PORT = Number(process.env.DB_PORT || DATABASE_URL_CONFIG.port || 3306);

console.log("[DB] Validando credenciais do banco de dados...");
if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.error("[ERROR] Credenciais do banco incompletas!");
  console.error(`[DB] HOST: ${DB_HOST ? "âœ“" : "âœ—"}`);
  console.error(`[DB] USER: ${DB_USER ? "âœ“" : "âœ—"}`);
  console.error(`[DB] NAME: ${DB_NAME ? "âœ“" : "âœ—"}`);
  console.error(`[DB] PASS: ${DB_PASSWORD ? "âœ“" : "âœ—"}`);
  process.exit(1);
}
console.log("[DB] âœ“ Credenciais validadas com sucesso");
console.log(`[DB] Host: ${DB_HOST}:${DB_PORT}`);
console.log(`[DB] Database: ${DB_NAME}`);
console.log(`[DB] User: ${DB_USER}`);

const MYSQL_CONFIG = {
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: DB_PORT,

  // ====================================
  // POOL DE CONEXÃƒO OTIMIZADO
  // ====================================
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 20),
  queueLimit: 0,

  // ====================================
  // TIMEOUTS AUMENTADOS PARA HOSTGATOR
  // ====================================
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 60000), // 60 segundos
  socketPath: undefined,

  // ====================================
  // KEEP-ALIVE E RECONEXÃƒO
  // ====================================
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000, // 30 segundos

  // ====================================
  // CONFIGURAÃ‡ÃƒO DO CHARSET
  // ====================================
  charset: "utf8mb4",
  dateStrings: true,

  // ====================================
  // SSL/TLS (desativar para HostGator)
  // ====================================
  ssl: process.env.DB_USE_SSL === "true" ? "Amazon RDS" : undefined,
};

console.log(`[DB] ConfiguraÃ§Ã£o do pool:`);
console.log(`  - Connection Limit: ${MYSQL_CONFIG.connectionLimit}`);
console.log(`  - Connect Timeout: ${MYSQL_CONFIG.connectTimeout}ms`);
console.log(`  - Keep-Alive: ${MYSQL_CONFIG.enableKeepAlive}`);
console.log(`  - Keep-Alive Delay: ${MYSQL_CONFIG.keepAliveInitialDelay}ms`);

let pool = null;
function createPool() {
  console.log("[DB] Criando novo pool de conexÃµes...");
  return mysql.createPool(MYSQL_CONFIG);
}

pool = createPool();

// Production runtime is validation-only for schema. The canonical migration
// runner opts in explicitly before importing this module.
const rawPoolQuery = pool.query.bind(pool);
const rawPoolExecute = pool.execute.bind(pool);
const rawPoolGetConnection = pool.getConnection.bind(pool);
const runtimeDdlPolicy = createRuntimeDdlPolicy({
  environment: process.env.NODE_ENV,
  migrationContext: process.env.J12_MIGRATION_RUNNER_CONTEXT,
  async inspectTable(tableName) {
    const [rows] = await rawPoolExecute(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
      [tableName],
    );
    return Number(rows?.[0]?.total || 0) > 0;
  },
});

async function executeWithRuntimeDdlPolicy(execute, sql, args) {
  const decision = await runtimeDdlPolicy.beforeExecute(sql);
  if (!decision.execute) return [createNoopDdlResult(), []];
  return execute(sql, ...args);
}

function guardConnectionDdl(connection) {
  if (connection.__j12RuntimeDdlGuarded) return connection;
  const rawExecute = connection.execute.bind(connection);
  const rawQuery = connection.query.bind(connection);
  connection.execute = (sql, ...args) => executeWithRuntimeDdlPolicy(rawExecute, sql, args);
  connection.query = (sql, ...args) => executeWithRuntimeDdlPolicy(rawQuery, sql, args);
  Object.defineProperty(connection, "__j12RuntimeDdlGuarded", { value: true });
  return connection;
}

pool.execute = (sql, ...args) => executeWithRuntimeDdlPolicy(rawPoolExecute, sql, args);
pool.query = (sql, ...args) => executeWithRuntimeDdlPolicy(rawPoolQuery, sql, args);
pool.getConnection = async (...args) => guardConnectionDdl(await rawPoolGetConnection(...args));

function sanitizeIdentifier(value) {
  const normalized = String(value ?? "").trim();
  if (!/^[a-zA-Z0-9_]+$/.test(normalized)) {
    throw new Error(`Identificador SQL invalido: ${value}`);
  }
  return normalized;
}

function text(value, max = 65535) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function nullableText(value, max = 65535) {
  const normalized = text(value, max);
  return normalized || null;
}

function uniqueValues(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stringifyJson(value) {
  return JSON.stringify(value ?? null);
}

function normalizeDocument(value) {
  if (!value || typeof value !== "object") return null;

  const candidate = value;
  const name = text(candidate.name, 255);
  if (!name) return null;

  const size = Number(candidate.size ?? 0);

  return {
    name,
    size: Number.isFinite(size) ? size : 0,
    type: text(candidate.type, 191),
    uploadedAt: nullableText(candidate.uploadedAt, 40),
    expiresAt: nullableText(candidate.expiresAt, 10),
  };
}

function normalizeEnrollmentRegistryStatus(value) {
  const normalized = text(value, 30).toLowerCase();

  if (normalized === "inativo") return "inativo";
  if (normalized === "excluido") return "excluido";
  if (normalized === "reservado") return "reservado";
  if (normalized === "experimental") return "experimental";
  return "ativo";
}

function isReusableEnrollmentRegistryStatus(status) {
  return status === "inativo" || status === "excluido";
}

function getEnrollmentStatusPriority(status) {
  if (status === "ativo" || status === "experimental") return 4;
  if (status === "reservado") return 3;
  if (status === "inativo") return 2;
  if (status === "excluido") return 1;
  return 0;
}

async function upsertEnrollmentNumberRegistry(connection, enrollment) {
  const explicitSequence = enrollment?.enrollmentSequence ?? enrollment?.sequence;
  const numero =
    explicitSequence === undefined || explicitSequence === null
      ? extractEnrollmentSequence(enrollment?.numeroMatricula ?? enrollment?.numero_matricula)
      : extractLegacyRegistrySequence(explicitSequence);

  if (numero === null) {
    throw createEnrollmentNumberError(
      "ENROLLMENT_NUMBER_INVALID",
      "Numero publico ou sequencia de matricula invalida.",
      400,
    );
  }

  const status = normalizeEnrollmentRegistryStatus(enrollment?.status);
  const releasedAt = isReusableEnrollmentRegistryStatus(status)
    ? new Date().toISOString().slice(0, 19).replace("T", " ")
    : null;

  await connection.execute(
    `
      INSERT INTO j12_matricula_numeros (
        numero,
        aluno_id,
        aluno_nome,
        status,
        last_assigned_at,
        released_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      ON DUPLICATE KEY UPDATE
        aluno_id = VALUES(aluno_id),
        aluno_nome = VALUES(aluno_nome),
        status = VALUES(status),
        last_assigned_at = CASE
          WHEN VALUES(status) IN ('ativo', 'experimental', 'reservado')
            THEN CURRENT_TIMESTAMP
          ELSE last_assigned_at
        END,
        released_at = CASE
          WHEN VALUES(status) IN ('inativo', 'excluido')
            THEN COALESCE(VALUES(released_at), CURRENT_TIMESTAMP)
          ELSE NULL
        END
    `,
    [
      numero,
      nullableText(enrollment?.alunoId, 64),
      nullableText(enrollment?.alunoNome, 191),
      status,
      releasedAt,
    ],
  );

  return numero;
}

async function getNextEnrollmentNumberPreview(options = {}) {
  const queryFn = options.queryFn ?? query;
  const syncFn = options.syncFn ?? syncEnrollmentNumberRegistry;
  const effectiveDate = options.effectiveDate ?? new Date();
  const readRegistryRows = async () => {
    const rows = await queryFn(ENROLLMENT_REGISTRY_STATE_SQL, [
      MIN_ENROLLMENT_SEQUENCE,
      MAX_ENROLLMENT_SEQUENCE,
    ]);
    return Array.isArray(rows) ? rows : [];
  };

  let registryRows = await readRegistryRows();
  if (getModernEnrollmentRegistryState(registryRows).modernRows.length === 0) {
    await syncFn();
    registryRows = await readRegistryRows();
  }

  return buildEnrollmentNumberPreview({
    registryRows,
    effectiveDate,
  });
}

function buildMatriculaSnapshotFromLegacyRow(row) {
  const raw = safeJsonParse(row.matricula_json, {});
  const dadosAluno = raw?.dadosAluno ?? {};
  const responsavel = raw?.responsavel ?? {};
  const endereco = raw?.endereco ?? {};
  const documentos = raw?.documentos ?? {};
  const esportivas = raw?.esportivas ?? {};
  const saude = raw?.saude ?? {};
  const estrategicas = raw?.estrategicas ?? {};

  return {
    dadosAluno: {
      numeroMatricula: text(dadosAluno.numeroMatricula || row.numero_matricula, 50),
      nomeCompleto: text(dadosAluno.nomeCompleto || row.nome, 191),
      dataNascimento: text(dadosAluno.dataNascimento || row.data_nascimento, 10),
      idade: text(dadosAluno.idade, 10),
      cpf: text(dadosAluno.cpf || row.cpf, 20),
      rg: text(dadosAluno.rg || row.rg, 30),
      sexo: text(dadosAluno.sexo || row.sexo, 30),
      colegio: text(dadosAluno.colegio, 191),
      periodoEscolar: text(dadosAluno.periodoEscolar, 50),
    },
    responsavel: {
      nomeCompleto: text(responsavel.nomeCompleto || row.responsavel, 191),
      cpf: text(responsavel.cpf || row.responsavel_cpf, 20),
      rg: text(responsavel.rg, 30),
      whatsapp: text(
        responsavel.whatsapp || row.responsavel_whatsapp || row.telefone_responsavel,
        50,
      ),
      email: text(responsavel.email || row.responsavel_email || row.email, 191),
      parentesco: text(responsavel.parentesco, 100),
    },
    endereco: {
      cep: text(endereco.cep, 20),
      rua: text(endereco.rua, 191),
      numero: text(endereco.numero, 30),
      complemento: text(endereco.complemento, 191),
      bairro: text(endereco.bairro, 191),
      cidade: text(endereco.cidade, 191),
      estado: text(endereco.estado, 50),
    },
    documentos: {
      fotoPerfilAluno: normalizeDocument(documentos.fotoPerfilAluno),
      rgCpfAluno: normalizeDocument(documentos.rgCpfAluno),
      rgCpfResponsavel: normalizeDocument(documentos.rgCpfResponsavel),
      comprovanteEndereco: normalizeDocument(documentos.comprovanteEndereco),
      atestadoMedico: normalizeDocument(documentos.atestadoMedico),
    },
    esportivas: {
      modalidades: uniqueValues(
        esportivas.modalidades?.length ? esportivas.modalidades : [row.modalidade],
      ),
      unidades: uniqueValues(
        esportivas.unidades?.length ? esportivas.unidades : safeJsonParse(row.unidades_json, []),
      ),
      horarios: uniqueValues(
        esportivas.horarios?.length ? esportivas.horarios : safeJsonParse(row.horarios_json, []),
      ),
      turmas: uniqueValues(
        esportivas.turmas?.length
          ? esportivas.turmas
          : [...safeJsonParse(row.turmas_json, []), row.turma].filter(Boolean),
      ),
      nivel: text(esportivas.nivel, 100),
      treinouAntes: text(esportivas.treinouAntes, 100),
      caracteristica: text(esportivas.caracteristica, 191),
      objetivo: text(esportivas.objetivo, 191),
    },
    saude: {
      restricaoMedica: text(saude.restricaoMedica, 191),
      medicamentos: text(saude.medicamentos, 191),
      alergias: text(saude.alergias, 191),
      lesoes: text(saude.lesoes, 191),
      planoSaude: text(saude.planoSaude, 191),
      observacoesImportantes: text(saude.observacoesImportantes, 1000),
    },
    estrategicas: {
      comoConheceu: text(estrategicas.comoConheceu || row.origem_cadastro, 191),
      indicacaoQuem: text(estrategicas.indicacaoQuem, 191),
      observacoesGerais: text(estrategicas.observacoesGerais, 1000),
    },
  };
}

async function persistJ12SectionsFromLegacyRow(connection, row) {
  const matricula = buildMatriculaSnapshotFromLegacyRow(row);
  const modalidades = uniqueValues(matricula.esportivas.modalidades);
  const unidades = uniqueValues(matricula.esportivas.unidades);
  const horarios = uniqueValues(matricula.esportivas.horarios);
  const turmas = uniqueValues(matricula.esportivas.turmas);
  const planos = uniqueValues(safeJsonParse(row.planos_json, row.plano ? [row.plano] : []));

  await connection.execute(
    `
      INSERT INTO j12_alunos (
        id,
        numero_matricula,
        nome_completo,
        data_nascimento,
        idade,
        cpf,
        rg,
        sexo,
        colegio,
        periodo_escolar,
        email_contato,
        telefone_contato,
        status,
        matricula_em,
        modalidade_principal,
        turma_principal,
        plano_principal,
        planos_json,
        origem_cadastro,
        matricula_publica_protocolo,
        financeiro_json,
        matricula_snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        numero_matricula = VALUES(numero_matricula),
        nome_completo = VALUES(nome_completo),
        data_nascimento = VALUES(data_nascimento),
        idade = VALUES(idade),
        cpf = VALUES(cpf),
        rg = VALUES(rg),
        sexo = VALUES(sexo),
        colegio = VALUES(colegio),
        periodo_escolar = VALUES(periodo_escolar),
        email_contato = VALUES(email_contato),
        telefone_contato = VALUES(telefone_contato),
        status = VALUES(status),
        matricula_em = VALUES(matricula_em),
        modalidade_principal = VALUES(modalidade_principal),
        turma_principal = VALUES(turma_principal),
        plano_principal = VALUES(plano_principal),
        planos_json = VALUES(planos_json),
        origem_cadastro = VALUES(origem_cadastro),
        matricula_publica_protocolo = VALUES(matricula_publica_protocolo),
        financeiro_json = VALUES(financeiro_json),
        matricula_snapshot_json = VALUES(matricula_snapshot_json)
    `,
    [
      row.id,
      nullableText(matricula.dadosAluno.numeroMatricula, 50),
      text(matricula.dadosAluno.nomeCompleto || row.nome, 191),
      nullableText(matricula.dadosAluno.dataNascimento, 10),
      nullableText(matricula.dadosAluno.idade, 10),
      nullableText(matricula.dadosAluno.cpf, 20),
      nullableText(matricula.dadosAluno.rg, 30),
      nullableText(matricula.dadosAluno.sexo, 30),
      nullableText(matricula.dadosAluno.colegio, 191),
      nullableText(matricula.dadosAluno.periodoEscolar, 50),
      nullableText(row.email, 191) || nullableText(matricula.responsavel.email, 191),
      nullableText(row.telefone, 50) || nullableText(matricula.responsavel.whatsapp, 50),
      nullableText(row.status, 50) || "ativo",
      nullableText(row.matricula_em, 10),
      nullableText(row.modalidade, 191) || nullableText(modalidades[0], 191),
      nullableText(row.turma, 191) || nullableText(turmas[0], 191),
      nullableText(row.plano, 191) || nullableText(planos[0], 191),
      stringifyJson(planos),
      nullableText(row.origem_cadastro, 100),
      nullableText(row.matricula_publica_protocolo, 100),
      row.financeiro_json ? String(row.financeiro_json) : null,
      stringifyJson(matricula),
    ],
  );

  await connection.execute(
    `
      INSERT INTO j12_alunos_responsaveis (
        aluno_id,
        nome_completo,
        cpf,
        rg,
        whatsapp,
        email,
        parentesco
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nome_completo = VALUES(nome_completo),
        cpf = VALUES(cpf),
        rg = VALUES(rg),
        whatsapp = VALUES(whatsapp),
        email = VALUES(email),
        parentesco = VALUES(parentesco)
    `,
    [
      row.id,
      nullableText(matricula.responsavel.nomeCompleto, 191),
      nullableText(matricula.responsavel.cpf, 20),
      nullableText(matricula.responsavel.rg, 30),
      nullableText(matricula.responsavel.whatsapp, 50),
      nullableText(matricula.responsavel.email, 191),
      nullableText(matricula.responsavel.parentesco, 100),
    ],
  );

  await connection.execute(
    `
      INSERT INTO j12_alunos_enderecos (
        aluno_id,
        cep,
        rua,
        numero,
        complemento,
        bairro,
        cidade,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        cep = VALUES(cep),
        rua = VALUES(rua),
        numero = VALUES(numero),
        complemento = VALUES(complemento),
        bairro = VALUES(bairro),
        cidade = VALUES(cidade),
        estado = VALUES(estado)
    `,
    [
      row.id,
      nullableText(matricula.endereco.cep, 20),
      nullableText(matricula.endereco.rua, 191),
      nullableText(matricula.endereco.numero, 30),
      nullableText(matricula.endereco.complemento, 191),
      nullableText(matricula.endereco.bairro, 191),
      nullableText(matricula.endereco.cidade, 191),
      nullableText(matricula.endereco.estado, 50),
    ],
  );

  await connection.execute(
    `
      INSERT INTO j12_alunos_documentos (
        aluno_id,
        foto_perfil_aluno_json,
        rg_cpf_aluno_json,
        rg_cpf_responsavel_json,
        comprovante_endereco_json,
        atestado_medico_json
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        foto_perfil_aluno_json = VALUES(foto_perfil_aluno_json),
        rg_cpf_aluno_json = VALUES(rg_cpf_aluno_json),
        rg_cpf_responsavel_json = VALUES(rg_cpf_responsavel_json),
        comprovante_endereco_json = VALUES(comprovante_endereco_json),
        atestado_medico_json = VALUES(atestado_medico_json)
    `,
    [
      row.id,
      stringifyJson(matricula.documentos.fotoPerfilAluno),
      stringifyJson(matricula.documentos.rgCpfAluno),
      stringifyJson(matricula.documentos.rgCpfResponsavel),
      stringifyJson(matricula.documentos.comprovanteEndereco),
      stringifyJson(matricula.documentos.atestadoMedico),
    ],
  );

  await connection.execute(
    `
      INSERT INTO j12_alunos_esportes (
        aluno_id,
        modalidades_json,
        unidades_json,
        horarios_json,
        turmas_json,
        nivel,
        treinou_antes,
        caracteristica,
        objetivo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        modalidades_json = VALUES(modalidades_json),
        unidades_json = VALUES(unidades_json),
        horarios_json = VALUES(horarios_json),
        turmas_json = VALUES(turmas_json),
        nivel = VALUES(nivel),
        treinou_antes = VALUES(treinou_antes),
        caracteristica = VALUES(caracteristica),
        objetivo = VALUES(objetivo)
    `,
    [
      row.id,
      stringifyJson(modalidades),
      stringifyJson(unidades),
      stringifyJson(horarios),
      stringifyJson(turmas),
      nullableText(matricula.esportivas.nivel, 100),
      nullableText(matricula.esportivas.treinouAntes, 100),
      nullableText(matricula.esportivas.caracteristica, 191),
      nullableText(matricula.esportivas.objetivo, 191),
    ],
  );

  await connection.execute(
    `
      INSERT INTO j12_alunos_saude (
        aluno_id,
        restricao_medica,
        medicamentos,
        alergias,
        lesoes,
        plano_saude,
        observacoes_importantes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        restricao_medica = VALUES(restricao_medica),
        medicamentos = VALUES(medicamentos),
        alergias = VALUES(alergias),
        lesoes = VALUES(lesoes),
        plano_saude = VALUES(plano_saude),
        observacoes_importantes = VALUES(observacoes_importantes)
    `,
    [
      row.id,
      nullableText(matricula.saude.restricaoMedica, 191),
      nullableText(matricula.saude.medicamentos, 191),
      nullableText(matricula.saude.alergias, 191),
      nullableText(matricula.saude.lesoes, 191),
      nullableText(matricula.saude.planoSaude, 191),
      nullableText(matricula.saude.observacoesImportantes, 1000),
    ],
  );

  await connection.execute(
    `
      INSERT INTO j12_alunos_estrategico (
        aluno_id,
        como_conheceu,
        indicacao_quem,
        observacoes_gerais
      ) VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        como_conheceu = VALUES(como_conheceu),
        indicacao_quem = VALUES(indicacao_quem),
        observacoes_gerais = VALUES(observacoes_gerais)
    `,
    [
      row.id,
      nullableText(matricula.estrategicas.comoConheceu, 191),
      nullableText(matricula.estrategicas.indicacaoQuem, 191),
      nullableText(matricula.estrategicas.observacoesGerais, 1000),
    ],
  );
}

const databaseConnectivity = createDatabaseConnectivity({
  pool,
  maxAttempts: process.env.DB_MAX_RECONNECT_ATTEMPTS,
});
const testConnection = databaseConnectivity.testConnection;

async function query(sql, params = []) {
  let connection = null;
  const startedAt = process.hrtime.bigint();
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(sql, params);
    logger.info("database.query.completed", {
      durationMs: elapsedMilliseconds(startedAt),
      operation: sqlOperation(sql),
      sql: sqlPreview(sql),
    });
    return rows;
  } catch (error) {
    logger.error("database.query.failed", {
      code: error?.code,
      durationMs: elapsedMilliseconds(startedAt),
      error,
      operation: sqlOperation(sql),
      sql: sqlPreview(sql),
      errno: error?.errno,
    });

    // Reconectar em caso de erro de conexÃ£o perdida
    if (
      error?.code === "PROTOCOL_CONNECTION_LOST" ||
      error?.code === "PROTOCOL_ERROR" ||
      error?.code === "ER_QUERY_INTERRUPTED" ||
      error?.errno === 1041
    ) {
      logger.warn("database.connection.reconnect", { code: error?.code, errno: error?.errno });
      if (pool && typeof pool.clearOldest === "function") {
        pool.clearOldest?.();
      }
    }

    throw error;
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        logger.warn("database.connection.release_failed", { error: releaseError });
      }
    }
  }
}

function elapsedMilliseconds(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function sqlOperation(sql) {
  return (
    String(sql || "")
      .trim()
      .split(/\s+/, 1)[0]
      ?.toUpperCase() || "UNKNOWN"
  );
}

function sqlPreview(sql) {
  return String(sql || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

async function tableExists(tableName) {
  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?
    `,
    [tableName],
  );

  return Number(rows?.[0]?.total || 0) > 0;
}

async function ensureColumn(tableName, columnName, definition) {
  const safeTable = sanitizeIdentifier(tableName);
  const rows = await query(
    `SHOW COLUMNS FROM \`${safeTable}\` LIKE ${mysql.escape(String(columnName ?? ""))}`,
  );
  if (Array.isArray(rows) && rows.length > 0) return;
  await query(
    `ALTER TABLE \`${safeTable}\` ADD COLUMN \`${sanitizeIdentifier(columnName)}\` ${definition}`,
  );
}

async function ensureIndex(tableName, indexName, definition) {
  const safeTable = sanitizeIdentifier(tableName);
  const rows = await query(
    `SHOW INDEX FROM \`${safeTable}\` WHERE Key_name = ${mysql.escape(String(indexName ?? ""))}`,
  );
  if (Array.isArray(rows) && rows.length > 0) return;
  await query(`ALTER TABLE \`${safeTable}\` ADD ${definition}`);
}

async function ensureForeignKeyDropped(tableName, constraintName) {
  const safeTable = sanitizeIdentifier(tableName);
  const safeConstraint = sanitizeIdentifier(constraintName);
  const rows = await query(
    `
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        AND CONSTRAINT_NAME = ?
    `,
    [safeTable, safeConstraint],
  );

  if (!Array.isArray(rows) || rows.length === 0) return;
  await query(`ALTER TABLE \`${safeTable}\` DROP FOREIGN KEY \`${safeConstraint}\``);
}

async function transaction(work) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

let authSchemaReady = false;
let authSchemaPromise = null;

async function ensureAuthSchema() {
  if (authSchemaReady) return true;

  if (authSchemaPromise) {
    return authSchemaPromise;
  }

  authSchemaPromise = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS j12_usuarios (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        nome VARCHAR(191) NOT NULL,
        email VARCHAR(191) NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        perfil VARCHAR(50) NOT NULL DEFAULT 'aluno',
        aluno_id VARCHAR(64) NULL,
        professor_id VARCHAR(64) NULL,
        responsavel_id VARCHAR(64) NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'ativo',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_j12_usuarios_email (email),
        INDEX idx_j12_usuarios_perfil (perfil),
        INDEX idx_j12_usuarios_aluno (aluno_id),
        INDEX idx_j12_usuarios_professor (professor_id),
        INDEX idx_j12_usuarios_responsavel (responsavel_id)
      )
    `);
    await ensureColumn("j12_usuarios", "nome", "VARCHAR(191) NULL");
    await ensureColumn("j12_usuarios", "email", "VARCHAR(191) NULL");
    await ensureColumn("j12_usuarios", "senha_hash", "VARCHAR(255) NULL");
    await ensureColumn("j12_usuarios", "perfil", "VARCHAR(50) NOT NULL DEFAULT 'aluno'");
    await ensureColumn("j12_usuarios", "aluno_id", "VARCHAR(64) NULL");
    await ensureColumn("j12_usuarios", "professor_id", "VARCHAR(64) NULL");
    await ensureColumn("j12_usuarios", "responsavel_id", "VARCHAR(64) NULL");
    await ensureColumn("j12_usuarios", "status", "VARCHAR(30) NOT NULL DEFAULT 'ativo'");
    await ensureColumn("j12_usuarios", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    await ensureColumn(
      "j12_usuarios",
      "updated_at",
      "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    );
    await ensureIndex(
      "j12_usuarios",
      "idx_j12_usuarios_perfil",
      "INDEX `idx_j12_usuarios_perfil` (`perfil`)",
    );
    await ensureIndex(
      "j12_usuarios",
      "idx_j12_usuarios_aluno",
      "INDEX `idx_j12_usuarios_aluno` (`aluno_id`)",
    );
    await ensureIndex(
      "j12_usuarios",
      "idx_j12_usuarios_professor",
      "INDEX `idx_j12_usuarios_professor` (`professor_id`)",
    );
    await ensureIndex(
      "j12_usuarios",
      "idx_j12_usuarios_responsavel",
      "INDEX `idx_j12_usuarios_responsavel` (`responsavel_id`)",
    );

    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(191) NOT NULL,
        email VARCHAR(191) NOT NULL,
        login VARCHAR(191) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        password_salt VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        aluno_id VARCHAR(64) NULL,
        professor_id VARCHAR(64) NULL,
        responsavel_id VARCHAR(64) NULL,
        linked_aluno_id VARCHAR(64) NULL,
        class_scope_json LONGTEXT NULL,
        phone_whatsapp VARCHAR(50) NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'ativo',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await ensureColumn("users", "name", "VARCHAR(191) NULL");
    await ensureColumn("users", "email", "VARCHAR(191) NULL");
    await ensureColumn("users", "login", "VARCHAR(191) NULL");
    await ensureColumn("users", "password_hash", "VARCHAR(255) NULL");
    await ensureColumn("users", "password_salt", "VARCHAR(255) NULL");
    await ensureColumn("users", "role", "VARCHAR(50) NOT NULL DEFAULT 'aluno'");
    await ensureColumn("users", "aluno_id", "VARCHAR(64) NULL");
    await ensureColumn("users", "professor_id", "VARCHAR(64) NULL");
    await ensureColumn("users", "responsavel_id", "VARCHAR(64) NULL");
    await ensureColumn("users", "linked_aluno_id", "VARCHAR(64) NULL");
    await ensureColumn("users", "class_scope_json", "LONGTEXT NULL");
    await ensureColumn("users", "phone_whatsapp", "VARCHAR(50) NULL");
    await ensureColumn("users", "status", "VARCHAR(30) NOT NULL DEFAULT 'ativo'");
    await ensureColumn("users", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    await ensureColumn(
      "users",
      "updated_at",
      "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    );
    await ensureIndex("users", "uniq_users_email", "UNIQUE INDEX `uniq_users_email` (`email`)");
    await ensureIndex("users", "uniq_users_login", "UNIQUE INDEX `uniq_users_login` (`login`)");
    await ensureIndex("users", "idx_users_role", "INDEX `idx_users_role` (`role`)");
    await ensureIndex("users", "idx_users_aluno", "INDEX `idx_users_aluno` (`aluno_id`)");
    await ensureIndex(
      "users",
      "idx_users_professor",
      "INDEX `idx_users_professor` (`professor_id`)",
    );
    await ensureIndex(
      "users",
      "idx_users_responsavel",
      "INDEX `idx_users_responsavel` (`responsavel_id`)",
    );

    await query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        token VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        last_seen_at DATETIME NULL,
        INDEX idx_sessions_user (user_id),
        INDEX idx_sessions_expires (expires_at)
      )
    `);
    await ensureColumn("user_sessions", "user_id", "VARCHAR(64) NULL");
    await ensureColumn(
      "user_sessions",
      "created_at",
      "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
    );
    await ensureColumn("user_sessions", "expires_at", "DATETIME NULL");
    await ensureColumn("user_sessions", "last_seen_at", "DATETIME NULL");

    await query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        channel VARCHAR(30) NOT NULL DEFAULT 'email',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        INDEX idx_password_reset_user (user_id),
        INDEX idx_password_reset_expires (expires_at)
      )
    `);
    await ensureColumn("password_reset_tokens", "user_id", "VARCHAR(64) NULL");
    await ensureColumn("password_reset_tokens", "channel", "VARCHAR(30) NOT NULL DEFAULT 'email'");
    await ensureColumn(
      "password_reset_tokens",
      "created_at",
      "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
    );
    await ensureColumn("password_reset_tokens", "expires_at", "DATETIME NULL");
    await ensureColumn("password_reset_tokens", "used_at", "DATETIME NULL");

    authSchemaReady = true;
    return true;
  })().finally(() => {
    authSchemaPromise = null;
  });

  return authSchemaPromise;
}

async function ensureSchema() {
  await ensureAuthSchema();

  await query(`
    CREATE TABLE IF NOT EXISTS alunos (
      id VARCHAR(64) PRIMARY KEY,
      nome VARCHAR(191) NOT NULL,
      email VARCHAR(191) NULL,
      telefone VARCHAR(50) NULL,
      data_nascimento DATE NULL,
      responsavel VARCHAR(191) NULL,
      telefone_responsavel VARCHAR(50) NULL,
      modalidade VARCHAR(191) NULL,
      turma VARCHAR(191) NULL,
      plano VARCHAR(191) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'ativo',
      matricula_em DATE NULL,
      numero_matricula VARCHAR(50) NULL,
      cpf VARCHAR(20) NULL,
      rg VARCHAR(30) NULL,
      sexo VARCHAR(30) NULL,
      origem_cadastro VARCHAR(100) NULL,
      matricula_publica_protocolo VARCHAR(100) NULL,
      unidades_json LONGTEXT NULL,
      turmas_json LONGTEXT NULL,
      planos_json LONGTEXT NULL,
      horarios_json LONGTEXT NULL,
      matricula_json LONGTEXT NULL,
      financeiro_json LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("alunos", "foto_url", "VARCHAR(500) NULL");
  await ensureColumn("alunos", "responsavel_cpf", "VARCHAR(20) NULL");
  await ensureColumn("alunos", "responsavel_email", "VARCHAR(191) NULL");
  await ensureColumn("alunos", "responsavel_whatsapp", "VARCHAR(50) NULL");

  await query(`
    CREATE TABLE IF NOT EXISTS j12_alunos (
      id VARCHAR(64) PRIMARY KEY,
      numero_matricula VARCHAR(50) NULL,
      nome_completo VARCHAR(191) NOT NULL,
      data_nascimento DATE NULL,
      idade VARCHAR(10) NULL,
      cpf VARCHAR(20) NULL,
      rg VARCHAR(30) NULL,
      sexo VARCHAR(30) NULL,
      colegio VARCHAR(191) NULL,
      periodo_escolar VARCHAR(50) NULL,
      email_contato VARCHAR(191) NULL,
      telefone_contato VARCHAR(50) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'ativo',
      matricula_em DATE NULL,
      modalidade_principal VARCHAR(191) NULL,
      turma_principal VARCHAR(191) NULL,
      plano_principal VARCHAR(191) NULL,
      planos_json LONGTEXT NULL,
      origem_cadastro VARCHAR(100) NULL,
      matricula_publica_protocolo VARCHAR(100) NULL,
      financeiro_json LONGTEXT NULL,
      matricula_snapshot_json LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await ensureIndex(
    "j12_alunos",
    "idx_j12_alunos_nome",
    "INDEX `idx_j12_alunos_nome` (`nome_completo`)",
  );
  await ensureIndex(
    "j12_alunos",
    "idx_j12_alunos_numero",
    "INDEX `idx_j12_alunos_numero` (`numero_matricula`)",
  );
  await ensureIndex(
    "j12_alunos",
    "idx_j12_alunos_status",
    "INDEX `idx_j12_alunos_status` (`status`)",
  );
  await ensureColumn("j12_alunos", "responsavel", "VARCHAR(191) NULL");
  await ensureColumn("j12_alunos", "telefone_responsavel", "VARCHAR(50) NULL");
  await ensureColumn("j12_alunos", "plano_id", "VARCHAR(64) NULL");
  await ensureColumn("j12_alunos", "plano_valor", "DECIMAL(12,2) NULL");
  await ensureColumn("j12_alunos", "unidade_principal", "VARCHAR(191) NULL");
  await ensureColumn("j12_alunos", "dias_horarios_json", "LONGTEXT NULL");
  await ensureColumn("j12_alunos", "turma_id", "INT NULL");
  await ensureColumn("j12_alunos", "unidade_id", "INT NULL");
  await ensureColumn("j12_alunos", "modalidade_id", "INT NULL");
  await ensureColumn("j12_alunos", "responsavel_id", "INT NULL");
  await ensureIndex(
    "j12_alunos",
    "idx_j12_alunos_plano_id",
    "INDEX `idx_j12_alunos_plano_id` (`plano_id`)",
  );
  await ensureIndex(
    "j12_alunos",
    "idx_j12_alunos_turma_id",
    "INDEX `idx_j12_alunos_turma_id` (`turma_id`)",
  );
  await ensureIndex(
    "j12_alunos",
    "idx_j12_alunos_unidade_id",
    "INDEX `idx_j12_alunos_unidade_id` (`unidade_id`)",
  );
  await ensureIndex(
    "j12_alunos",
    "idx_j12_alunos_modalidade_id",
    "INDEX `idx_j12_alunos_modalidade_id` (`modalidade_id`)",
  );
  await ensureIndex(
    "j12_alunos",
    "idx_j12_alunos_responsavel_id",
    "INDEX `idx_j12_alunos_responsavel_id` (`responsavel_id`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS j12_planos (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(191) NOT NULL,
      valor DECIMAL(12,2) NOT NULL DEFAULT 0,
      modalidade VARCHAR(191) NULL,
      unidade VARCHAR(191) NULL,
      dias_horarios VARCHAR(255) NULL,
      frequencia VARCHAR(100) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'ativo',
      categoria VARCHAR(50) NULL,
      descricao TEXT NULL,
      preco_mensal DECIMAL(12,2) NULL,
      taxa_matricula DECIMAL(12,2) NULL,
      fidelidade_meses INT NULL,
      aulas_por_semana INT NULL,
      modalidades_json LONGTEXT NULL,
      tags_json LONGTEXT NULL,
      contrato_vinculado TINYINT(1) NOT NULL DEFAULT 1,
      aceita_upgrade TINYINT(1) NOT NULL DEFAULT 1,
      destaque_comercial TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await ensureColumn("j12_planos", "dias_horarios", "VARCHAR(255) NULL");
  await ensureColumn("j12_planos", "frequencia", "VARCHAR(100) NULL");
  await ensureColumn("j12_planos", "categoria", "VARCHAR(50) NULL");
  await ensureColumn("j12_planos", "descricao", "TEXT NULL");
  await ensureColumn("j12_planos", "preco_mensal", "DECIMAL(12,2) NULL");
  await ensureColumn("j12_planos", "taxa_matricula", "DECIMAL(12,2) NULL");
  await ensureColumn("j12_planos", "fidelidade_meses", "INT NULL");
  await ensureColumn("j12_planos", "aulas_por_semana", "INT NULL");
  await ensureColumn("j12_planos", "modalidades_json", "LONGTEXT NULL");
  await ensureColumn("j12_planos", "tags_json", "LONGTEXT NULL");
  await ensureColumn("j12_planos", "contrato_vinculado", "TINYINT(1) NOT NULL DEFAULT 1");
  await ensureColumn("j12_planos", "aceita_upgrade", "TINYINT(1) NOT NULL DEFAULT 1");
  await ensureColumn("j12_planos", "destaque_comercial", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureIndex("j12_planos", "idx_j12_planos_nome", "INDEX `idx_j12_planos_nome` (`nome`)");
  await ensureIndex(
    "j12_planos",
    "idx_j12_planos_status",
    "INDEX `idx_j12_planos_status` (`status`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS j12_modalidades (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(191) NOT NULL,
      descricao TEXT NULL,
      destaque VARCHAR(191) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'ativo',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await ensureColumn("j12_modalidades", "descricao", "TEXT NULL");
  await ensureColumn("j12_modalidades", "destaque", "VARCHAR(191) NULL");
  await ensureIndex(
    "j12_modalidades",
    "idx_j12_modalidades_nome",
    "INDEX `idx_j12_modalidades_nome` (`nome`)",
  );
  await ensureIndex(
    "j12_modalidades",
    "idx_j12_modalidades_status",
    "INDEX `idx_j12_modalidades_status` (`status`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS j12_unidades (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(191) NOT NULL,
      endereco VARCHAR(255) NULL,
      cidade VARCHAR(191) NULL,
      estado VARCHAR(50) NULL,
      telefone VARCHAR(50) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'ativo',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await ensureColumn("j12_unidades", "telefone", "VARCHAR(50) NULL");
  await ensureIndex(
    "j12_unidades",
    "idx_j12_unidades_nome",
    "INDEX `idx_j12_unidades_nome` (`nome`)",
  );
  await ensureIndex(
    "j12_unidades",
    "idx_j12_unidades_status",
    "INDEX `idx_j12_unidades_status` (`status`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS j12_responsaveis (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(191) NOT NULL,
      cpf VARCHAR(20) NULL,
      telefone VARCHAR(50) NULL,
      email VARCHAR(191) NULL,
      endereco VARCHAR(255) NULL,
      rg VARCHAR(30) NULL,
      parentesco VARCHAR(100) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await ensureColumn("j12_responsaveis", "rg", "VARCHAR(30) NULL");
  await ensureColumn("j12_responsaveis", "parentesco", "VARCHAR(100) NULL");
  await ensureIndex(
    "j12_responsaveis",
    "idx_j12_responsaveis_nome",
    "INDEX `idx_j12_responsaveis_nome` (`nome`)",
  );
  await ensureIndex(
    "j12_responsaveis",
    "idx_j12_responsaveis_cpf",
    "INDEX `idx_j12_responsaveis_cpf` (`cpf`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS j12_responsavel_alunos (
      responsavel_id VARCHAR(64) NOT NULL,
      aluno_id VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (responsavel_id, aluno_id),
      INDEX idx_j12_responsavel_alunos_aluno (aluno_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS j12_professores (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(191) NOT NULL,
      telefone VARCHAR(50) NULL,
      email VARCHAR(191) NULL,
      valor_hora DECIMAL(12,2) NULL,
      cpf VARCHAR(20) NULL,
      cref VARCHAR(50) NULL,
      modalidades_json LONGTEXT NULL,
      unidades_json LONGTEXT NULL,
      turmas_json LONGTEXT NULL,
      jornada_professor VARCHAR(191) NULL,
      tipo_contrato VARCHAR(100) NULL,
      valor_contrato DECIMAL(12,2) NULL,
      forma_pagamento_professor VARCHAR(50) NULL,
      data_inicio_contrato DATE NULL,
      observacoes_contrato TEXT NULL,
      contrato_json LONGTEXT NULL,
      historico_contratos_json LONGTEXT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'ativo',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await ensureColumn("j12_professores", "cpf", "VARCHAR(20) NULL");
  await ensureColumn("j12_professores", "cref", "VARCHAR(50) NULL");
  await ensureColumn("j12_professores", "modalidades_json", "LONGTEXT NULL");
  await ensureColumn("j12_professores", "unidades_json", "LONGTEXT NULL");
  await ensureColumn("j12_professores", "turmas_json", "LONGTEXT NULL");
  await ensureColumn("j12_professores", "jornada_professor", "VARCHAR(191) NULL");
  await ensureColumn("j12_professores", "tipo_contrato", "VARCHAR(100) NULL");
  await ensureColumn("j12_professores", "valor_contrato", "DECIMAL(12,2) NULL");
  await ensureColumn("j12_professores", "forma_pagamento_professor", "VARCHAR(50) NULL");
  await ensureColumn("j12_professores", "data_inicio_contrato", "DATE NULL");
  await ensureColumn("j12_professores", "observacoes_contrato", "TEXT NULL");
  await ensureColumn("j12_professores", "contrato_json", "LONGTEXT NULL");
  await ensureColumn("j12_professores", "historico_contratos_json", "LONGTEXT NULL");
  await ensureIndex(
    "j12_professores",
    "idx_j12_professores_nome",
    "INDEX `idx_j12_professores_nome` (`nome`)",
  );
  await ensureIndex(
    "j12_professores",
    "idx_j12_professores_status",
    "INDEX `idx_j12_professores_status` (`status`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS j12_turmas (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(191) NOT NULL,
      modalidade VARCHAR(191) NULL,
      unidade VARCHAR(191) NULL,
      professor_id BIGINT NULL,
      professor_nome VARCHAR(191) NULL,
      modalidade_id BIGINT NULL,
      unidade_id BIGINT NULL,
      dias_semana VARCHAR(191) NULL,
      dias_semana_json LONGTEXT NULL,
      horario VARCHAR(50) NULL,
      horario_inicio VARCHAR(20) NULL,
      horario_fim VARCHAR(20) NULL,
      capacidade INT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'ativa',
      aluno_ids_json LONGTEXT NULL,
      presencas_json LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await ensureColumn("j12_turmas", "professor_nome", "VARCHAR(191) NULL");
  await ensureColumn("j12_turmas", "modalidade_id", "INT NULL");
  await ensureColumn("j12_turmas", "unidade_id", "INT NULL");
  await ensureColumn("j12_turmas", "dias_semana_json", "LONGTEXT NULL");
  await ensureColumn("j12_turmas", "horario_inicio", "VARCHAR(20) NULL");
  await ensureColumn("j12_turmas", "horario_fim", "VARCHAR(20) NULL");
  await ensureColumn("j12_turmas", "aluno_ids_json", "LONGTEXT NULL");
  await ensureColumn("j12_turmas", "presencas_json", "LONGTEXT NULL");
  await ensureIndex("j12_turmas", "idx_j12_turmas_nome", "INDEX `idx_j12_turmas_nome` (`nome`)");
  await ensureIndex(
    "j12_turmas",
    "idx_j12_turmas_status",
    "INDEX `idx_j12_turmas_status` (`status`)",
  );
  await ensureIndex(
    "j12_turmas",
    "idx_j12_turmas_professor_id",
    "INDEX `idx_j12_turmas_professor_id` (`professor_id`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS j12_alunos_responsaveis (
      aluno_id VARCHAR(64) PRIMARY KEY,
      nome_completo VARCHAR(191) NULL,
      cpf VARCHAR(20) NULL,
      rg VARCHAR(30) NULL,
      whatsapp VARCHAR(50) NULL,
      email VARCHAR(191) NULL,
      parentesco VARCHAR(100) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS j12_alunos_enderecos (
      aluno_id VARCHAR(64) PRIMARY KEY,
      cep VARCHAR(20) NULL,
      rua VARCHAR(191) NULL,
      numero VARCHAR(30) NULL,
      complemento VARCHAR(191) NULL,
      bairro VARCHAR(191) NULL,
      cidade VARCHAR(191) NULL,
      estado VARCHAR(50) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS j12_alunos_documentos (
      aluno_id VARCHAR(64) PRIMARY KEY,
      foto_perfil_aluno_json LONGTEXT NULL,
      rg_cpf_aluno_json LONGTEXT NULL,
      rg_cpf_responsavel_json LONGTEXT NULL,
      comprovante_endereco_json LONGTEXT NULL,
      autorizacao_imagem_json LONGTEXT NULL,
      atestado_medico_json LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await ensureColumn("j12_alunos_documentos", "autorizacao_imagem_json", "LONGTEXT NULL");

  await query(`
    CREATE TABLE IF NOT EXISTS j12_alunos_esportes (
      aluno_id VARCHAR(64) PRIMARY KEY,
      modalidades_json LONGTEXT NULL,
      unidades_json LONGTEXT NULL,
      horarios_json LONGTEXT NULL,
      turmas_json LONGTEXT NULL,
      nivel VARCHAR(100) NULL,
      treinou_antes VARCHAR(100) NULL,
      caracteristica VARCHAR(191) NULL,
      objetivo VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS j12_alunos_saude (
      aluno_id VARCHAR(64) PRIMARY KEY,
      restricao_medica VARCHAR(191) NULL,
      medicamentos VARCHAR(191) NULL,
      alergias VARCHAR(191) NULL,
      lesoes VARCHAR(191) NULL,
      plano_saude VARCHAR(191) NULL,
      observacoes_importantes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS j12_alunos_estrategico (
      aluno_id VARCHAR(64) PRIMARY KEY,
      como_conheceu VARCHAR(191) NULL,
      indicacao_quem VARCHAR(191) NULL,
      observacoes_gerais TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS j12_matricula_numeros (
      numero INT PRIMARY KEY,
      aluno_id VARCHAR(64) NULL,
      aluno_nome VARCHAR(191) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'ativo',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      last_assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      released_at DATETIME NULL
    )
  `);
  await ensureIndex(
    "j12_matricula_numeros",
    "idx_j12_matricula_numeros_status",
    "INDEX `idx_j12_matricula_numeros_status` (`status`)",
  );
  await ensureIndex(
    "j12_matricula_numeros",
    "idx_j12_matricula_numeros_aluno",
    "INDEX `idx_j12_matricula_numeros_aluno` (`aluno_id`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS j12_matriculas_publicas (
      id VARCHAR(64) PRIMARY KEY,
      protocolo VARCHAR(100) NOT NULL,
      numero_matricula VARCHAR(50) NOT NULL,
      aluno_id VARCHAR(64) NOT NULL,
      nome_aluno VARCHAR(191) NOT NULL,
      nome_responsavel VARCHAR(191) NOT NULL,
      email_responsavel VARCHAR(191) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'recebida',
      payload_json LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      synced_at DATETIME NULL
    )
  `);
  await ensureIndex(
    "j12_matriculas_publicas",
    "idx_j12_matriculas_publicas_protocolo",
    "UNIQUE INDEX `idx_j12_matriculas_publicas_protocolo` (`protocolo`)",
  );
  await ensureIndex(
    "j12_matriculas_publicas",
    "idx_j12_matriculas_publicas_numero",
    "INDEX `idx_j12_matriculas_publicas_numero` (`numero_matricula`)",
  );
  await ensureIndex(
    "j12_matriculas_publicas",
    "idx_j12_matriculas_publicas_aluno",
    "INDEX `idx_j12_matriculas_publicas_aluno` (`aluno_id`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS financeiro (
      id VARCHAR(64) PRIMARY KEY,
      aluno_id VARCHAR(64) NOT NULL,
      aluno_nome VARCHAR(191) NOT NULL,
      descricao TEXT NOT NULL,
      tipo VARCHAR(50) NOT NULL,
      valor DECIMAL(12,2) NOT NULL,
      vencimento DATE NOT NULL,
      pago_em DATE NULL,
      forma_pagamento VARCHAR(50) NULL,
      observacao TEXT NULL,
      responsavel_financeiro VARCHAR(191) NULL,
      responsavel_cpf VARCHAR(20) NULL,
      telefone_whatsapp VARCHAR(50) NULL,
      email VARCHAR(191) NULL,
      unidade VARCHAR(191) NULL,
      modalidade VARCHAR(191) NULL,
      turma VARCHAR(191) NULL,
      plano_id VARCHAR(64) NULL,
      plano_nome VARCHAR(191) NULL,
      periodicidade VARCHAR(30) NULL,
      competencia VARCHAR(32) NULL,
      valor_original DECIMAL(12,2) NULL,
      desconto_valor DECIMAL(12,2) NULL,
      desconto_percentual DECIMAL(10,2) NULL,
      bolsa_valor DECIMAL(12,2) NULL,
      bolsa_percentual DECIMAL(10,2) NULL,
      multa_percentual DECIMAL(10,2) NULL,
      juros_dia_percentual DECIMAL(10,2) NULL,
      valor_final DECIMAL(12,2) NULL,
      data_geracao DATE NULL,
      data_pagamento DATE NULL,
      status VARCHAR(30) NULL,
      tipo_cobranca VARCHAR(30) NULL,
      origem VARCHAR(30) NULL,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      alterado_em DATETIME NULL,
      alterado_por VARCHAR(191) NULL,
      cancelamento_motivo TEXT NULL,
      desconto_motivo TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_financeiro_aluno (aluno_id),
      INDEX idx_financeiro_competencia (competencia),
      INDEX idx_financeiro_status (status)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS j12_financeiro_cobrancas (
      id VARCHAR(64) PRIMARY KEY,
      aluno_id VARCHAR(64) NOT NULL,
      numero_matricula VARCHAR(50) NULL,
      nome_aluno VARCHAR(191) NOT NULL,
      competencia VARCHAR(7) NOT NULL,
      descricao VARCHAR(191) NOT NULL,
      tipo VARCHAR(50) NOT NULL DEFAULT 'mensalidade',
      valor DECIMAL(10,2) NOT NULL,
      vencimento DATE NOT NULL,
      status ENUM('pendente', 'pago', 'atrasado', 'cancelado') NOT NULL DEFAULT 'pendente',
      origem VARCHAR(50) NOT NULL DEFAULT 'automatico',
      periodicidade VARCHAR(30) NULL,
      plano_id VARCHAR(64) NULL,
      plano_nome VARCHAR(191) NULL,
      modalidade VARCHAR(191) NULL,
      turma VARCHAR(191) NULL,
      unidade VARCHAR(191) NULL,
      responsavel_financeiro VARCHAR(191) NULL,
      responsavel_cpf VARCHAR(20) NULL,
      telefone_whatsapp VARCHAR(50) NULL,
      email VARCHAR(191) NULL,
      observacao TEXT NULL,
      pago_em DATE NULL,
      forma_pagamento VARCHAR(50) NULL,
      data_geracao DATE NULL,
      data_pagamento DATE NULL,
      valor_original DECIMAL(10,2) NULL,
      desconto_valor DECIMAL(10,2) NULL,
      desconto_percentual DECIMAL(10,2) NULL,
      bolsa_valor DECIMAL(10,2) NULL,
      bolsa_percentual DECIMAL(10,2) NULL,
      multa_percentual DECIMAL(10,2) NULL,
      juros_dia_percentual DECIMAL(10,2) NULL,
      valor_final DECIMAL(10,2) NULL,
      tipo_cobranca VARCHAR(30) NOT NULL DEFAULT 'recorrente',
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      alterado_em DATETIME NULL,
      alterado_por VARCHAR(191) NULL,
      cancelamento_motivo TEXT NULL,
      desconto_motivo TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await ensureColumn(
    "j12_financeiro_cobrancas",
    "tipo",
    "VARCHAR(50) NOT NULL DEFAULT 'mensalidade'",
  );
  await ensureIndex(
    "j12_financeiro_cobrancas",
    "idx_j12_financeiro_aluno",
    "INDEX `idx_j12_financeiro_aluno` (`aluno_id`)",
  );
  await ensureIndex(
    "j12_financeiro_cobrancas",
    "idx_j12_financeiro_competencia",
    "INDEX `idx_j12_financeiro_competencia` (`competencia`)",
  );
  await ensureIndex(
    "j12_financeiro_cobrancas",
    "idx_j12_financeiro_status",
    "INDEX `idx_j12_financeiro_status` (`status`)",
  );
  await ensureIndex(
    "j12_financeiro_cobrancas",
    "idx_j12_financeiro_vencimento",
    "INDEX `idx_j12_financeiro_vencimento` (`vencimento`)",
  );
  await ensureIndex(
    "j12_financeiro_cobrancas",
    "idx_j12_financeiro_status_vencimento",
    "INDEX `idx_j12_financeiro_status_vencimento` (`status`, `vencimento`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS j12_mensalidades (
      id VARCHAR(64) PRIMARY KEY,
      cobranca_id VARCHAR(64) NOT NULL,
      aluno_id VARCHAR(64) NOT NULL,
      plano_id VARCHAR(64) NULL,
      turma VARCHAR(191) NULL,
      referencia VARCHAR(7) NOT NULL,
      valor DECIMAL(10,2) NOT NULL,
      data_vencimento DATE NOT NULL,
      data_pagamento DATE NULL,
      forma_pagamento VARCHAR(50) NULL,
      status ENUM('pendente', 'pago', 'atrasado', 'cancelado') NOT NULL DEFAULT 'pendente',
      observacao TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await ensureForeignKeyDropped("j12_mensalidades", "j12_mensalidades_ibfk_1");
  await ensureForeignKeyDropped("j12_mensalidades", "j12_mensalidades_ibfk_2");
  await ensureColumn("j12_mensalidades", "cobranca_id", "VARCHAR(64) NOT NULL");
  await ensureColumn("j12_mensalidades", "aluno_id", "VARCHAR(64) NOT NULL");
  await ensureColumn("j12_mensalidades", "plano_id", "VARCHAR(64) NULL");
  await ensureColumn("j12_mensalidades", "turma", "VARCHAR(191) NULL");
  await ensureColumn("j12_mensalidades", "referencia", "VARCHAR(7) NOT NULL");
  await ensureColumn("j12_mensalidades", "valor", "DECIMAL(10,2) NOT NULL DEFAULT 0");
  await ensureColumn("j12_mensalidades", "data_vencimento", "DATE NOT NULL");
  await ensureColumn("j12_mensalidades", "data_pagamento", "DATE NULL");
  await ensureColumn("j12_mensalidades", "forma_pagamento", "VARCHAR(50) NULL");
  await ensureColumn(
    "j12_mensalidades",
    "status",
    "ENUM('pendente', 'pago', 'atrasado', 'cancelado') NOT NULL DEFAULT 'pendente'",
  );
  await ensureColumn("j12_mensalidades", "observacao", "TEXT NULL");
  await ensureIndex(
    "j12_mensalidades",
    "idx_j12_mensalidades_cobranca",
    "UNIQUE INDEX `idx_j12_mensalidades_cobranca` (`cobranca_id`)",
  );
  await ensureIndex(
    "j12_mensalidades",
    "idx_j12_mensalidades_aluno",
    "INDEX `idx_j12_mensalidades_aluno` (`aluno_id`)",
  );
  await ensureIndex(
    "j12_mensalidades",
    "idx_j12_mensalidades_referencia",
    "INDEX `idx_j12_mensalidades_referencia` (`referencia`)",
  );
  await ensureIndex(
    "j12_mensalidades",
    "idx_j12_mensalidades_status",
    "INDEX `idx_j12_mensalidades_status` (`status`)",
  );
  await ensureIndex(
    "j12_mensalidades",
    "idx_j12_mensalidades_status_vencimento",
    "INDEX `idx_j12_mensalidades_status_vencimento` (`status`, `data_vencimento`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS j12_pagamentos (
      id VARCHAR(64) PRIMARY KEY,
      mensalidade_id VARCHAR(64) NOT NULL,
      cobranca_id VARCHAR(64) NOT NULL,
      aluno_id VARCHAR(64) NOT NULL,
      valor DECIMAL(10,2) NOT NULL,
      forma_pagamento VARCHAR(50) NULL,
      data_pagamento DATE NOT NULL,
      observacao TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await ensureForeignKeyDropped("j12_pagamentos", "j12_pagamentos_ibfk_1");
  await ensureForeignKeyDropped("j12_pagamentos", "j12_pagamentos_ibfk_2");
  await ensureColumn("j12_pagamentos", "mensalidade_id", "VARCHAR(64) NOT NULL");
  await ensureColumn("j12_pagamentos", "cobranca_id", "VARCHAR(64) NOT NULL");
  await ensureColumn("j12_pagamentos", "aluno_id", "VARCHAR(64) NOT NULL");
  await ensureColumn("j12_pagamentos", "valor", "DECIMAL(10,2) NOT NULL DEFAULT 0");
  await ensureColumn("j12_pagamentos", "forma_pagamento", "VARCHAR(50) NULL");
  await ensureColumn("j12_pagamentos", "data_pagamento", "DATE NOT NULL");
  await ensureColumn("j12_pagamentos", "observacao", "TEXT NULL");
  await ensureIndex(
    "j12_pagamentos",
    "idx_j12_pagamentos_mensalidade",
    "UNIQUE INDEX `idx_j12_pagamentos_mensalidade` (`mensalidade_id`)",
  );
  await ensureIndex(
    "j12_pagamentos",
    "idx_j12_pagamentos_cobranca",
    "UNIQUE INDEX `idx_j12_pagamentos_cobranca` (`cobranca_id`)",
  );
  await ensureIndex(
    "j12_pagamentos",
    "idx_j12_pagamentos_aluno",
    "INDEX `idx_j12_pagamentos_aluno` (`aluno_id`)",
  );
  await ensureIndex(
    "j12_pagamentos",
    "idx_j12_pagamentos_data",
    "INDEX `idx_j12_pagamentos_data` (`data_pagamento`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS financial_payments (
      id VARCHAR(64) PRIMARY KEY,
      student_id VARCHAR(64) NULL,
      responsible_id VARCHAR(64) NULL,
      mensalidade_id VARCHAR(64) NULL,
      charge_id VARCHAR(64) NULL,
      txid VARCHAR(35) NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      status ENUM('PENDENTE', 'PROCESSANDO', 'PAGO', 'ATRASADO', 'VENCIDO', 'CANCELADO') NOT NULL DEFAULT 'PENDENTE',
      due_date DATE NULL,
      paid_at DATETIME NULL,
      payment_method VARCHAR(50) NULL,
      pix_payload LONGTEXT NULL,
      pix_copy_paste LONGTEXT NULL,
      qr_code LONGTEXT NULL,
      e2eid VARCHAR(191) NULL,
      inter_transaction_id VARCHAR(191) NULL,
      webhook_payload LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_financial_payments_txid (txid),
      INDEX idx_financial_payments_student (student_id),
      INDEX idx_financial_payments_responsible (responsible_id),
      INDEX idx_financial_payments_mensalidade (mensalidade_id),
      INDEX idx_financial_payments_charge (charge_id),
      INDEX idx_financial_payments_status (status)
    )
  `);
  await ensureColumn("financial_payments", "student_id", "VARCHAR(64) NULL");
  await ensureColumn("financial_payments", "responsible_id", "VARCHAR(64) NULL");
  await ensureColumn("financial_payments", "mensalidade_id", "VARCHAR(64) NULL");
  await ensureColumn("financial_payments", "charge_id", "VARCHAR(64) NULL");
  await ensureColumn("financial_payments", "txid", "VARCHAR(35) NULL");
  await ensureColumn("financial_payments", "amount", "DECIMAL(10,2) NOT NULL DEFAULT 0");
  await ensureColumn(
    "financial_payments",
    "status",
    "ENUM('PENDENTE', 'PROCESSANDO', 'PAGO', 'ATRASADO', 'VENCIDO', 'CANCELADO') NOT NULL DEFAULT 'PENDENTE'",
  );
  await ensureColumn("financial_payments", "due_date", "DATE NULL");
  await ensureColumn("financial_payments", "paid_at", "DATETIME NULL");
  await ensureColumn("financial_payments", "payment_method", "VARCHAR(50) NULL");
  await ensureColumn("financial_payments", "pix_payload", "LONGTEXT NULL");
  await ensureColumn("financial_payments", "pix_copy_paste", "LONGTEXT NULL");
  await ensureColumn("financial_payments", "qr_code", "LONGTEXT NULL");
  await ensureColumn("financial_payments", "e2eid", "VARCHAR(191) NULL");
  await ensureColumn("financial_payments", "inter_transaction_id", "VARCHAR(191) NULL");
  await ensureColumn("financial_payments", "webhook_payload", "LONGTEXT NULL");
  await ensureIndex(
    "financial_payments",
    "uniq_financial_payments_txid",
    "UNIQUE INDEX `uniq_financial_payments_txid` (`txid`)",
  );
  await ensureIndex(
    "financial_payments",
    "idx_financial_payments_student",
    "INDEX `idx_financial_payments_student` (`student_id`)",
  );
  await ensureIndex(
    "financial_payments",
    "idx_financial_payments_responsible",
    "INDEX `idx_financial_payments_responsible` (`responsible_id`)",
  );
  await ensureIndex(
    "financial_payments",
    "idx_financial_payments_mensalidade",
    "INDEX `idx_financial_payments_mensalidade` (`mensalidade_id`)",
  );
  await ensureIndex(
    "financial_payments",
    "idx_financial_payments_charge",
    "INDEX `idx_financial_payments_charge` (`charge_id`)",
  );
  await ensureIndex(
    "financial_payments",
    "idx_financial_payments_status",
    "INDEX `idx_financial_payments_status` (`status`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS inter_webhook_events (
      id VARCHAR(64) PRIMARY KEY,
      event_hash VARCHAR(64) NOT NULL,
      txid VARCHAR(35) NULL,
      e2eid VARCHAR(191) NULL,
      payload LONGTEXT NULL,
      processed TINYINT(1) NOT NULL DEFAULT 0,
      error TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_inter_webhook_events_hash (event_hash),
      INDEX idx_inter_webhook_events_txid (txid),
      INDEX idx_inter_webhook_events_e2eid (e2eid)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      email VARCHAR(191) NOT NULL,
      login VARCHAR(191) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      password_salt VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      aluno_id VARCHAR(64) NULL,
      professor_id VARCHAR(64) NULL,
      responsavel_id VARCHAR(64) NULL,
      linked_aluno_id VARCHAR(64) NULL,
      class_scope_json LONGTEXT NULL,
      phone_whatsapp VARCHAR(50) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'ativo',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await ensureColumn("users", "aluno_id", "VARCHAR(64) NULL");
  await ensureColumn("users", "professor_id", "VARCHAR(64) NULL");
  await ensureColumn("users", "responsavel_id", "VARCHAR(64) NULL");
  await ensureColumn("users", "linked_aluno_id", "VARCHAR(64) NULL");
  await ensureColumn("users", "class_scope_json", "LONGTEXT NULL");
  await ensureColumn("users", "phone_whatsapp", "VARCHAR(50) NULL");
  await ensureColumn("users", "status", "VARCHAR(30) NOT NULL DEFAULT 'ativo'");
  await ensureIndex("users", "uniq_users_email", "UNIQUE INDEX `uniq_users_email` (`email`)");
  await ensureIndex("users", "uniq_users_login", "UNIQUE INDEX `uniq_users_login` (`login`)");
  await ensureIndex("users", "idx_users_role", "INDEX `idx_users_role` (`role`)");
  await ensureIndex("users", "idx_users_aluno", "INDEX `idx_users_aluno` (`aluno_id`)");
  await ensureIndex("users", "idx_users_professor", "INDEX `idx_users_professor` (`professor_id`)");
  await ensureIndex(
    "users",
    "idx_users_responsavel",
    "INDEX `idx_users_responsavel` (`responsavel_id`)",
  );

  // Backfill nao destrutivo: preserva responsavel_id/linked_aluno_id antigos e alimenta o vinculo N:N.
  await query(`
    INSERT IGNORE INTO j12_responsavel_alunos (responsavel_id, aluno_id)
    SELECT CAST(responsavel_id AS CHAR), CAST(id AS CHAR)
    FROM j12_alunos
    WHERE responsavel_id IS NOT NULL AND CAST(responsavel_id AS CHAR) <> ''
  `);
  await query(`
    INSERT IGNORE INTO j12_responsavel_alunos (responsavel_id, aluno_id)
    SELECT
      COALESCE(NULLIF(CAST(responsavel_id AS CHAR), ''), CAST(id AS CHAR)),
      CAST(linked_aluno_id AS CHAR)
    FROM users
    WHERE role = 'responsavel'
      AND linked_aluno_id IS NOT NULL
      AND CAST(linked_aluno_id AS CHAR) <> ''
  `);
  if (await tableExists("j12_usuarios")) {
    await query(`
      INSERT IGNORE INTO j12_responsavel_alunos (responsavel_id, aluno_id)
      SELECT
        COALESCE(NULLIF(CAST(responsavel_id AS CHAR), ''), CAST(id AS CHAR)),
        CAST(aluno_id AS CHAR)
      FROM j12_usuarios
      WHERE perfil = 'responsavel'
        AND aluno_id IS NOT NULL
        AND CAST(aluno_id AS CHAR) <> ''
    `);
  }

  await query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      token VARCHAR(128) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      last_seen_at DATETIME NULL,
      INDEX idx_sessions_user (user_id),
      INDEX idx_sessions_expires (expires_at)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token VARCHAR(128) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      channel VARCHAR(30) NOT NULL DEFAULT 'email',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      INDEX idx_password_reset_user (user_id),
      INDEX idx_password_reset_expires (expires_at)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS student_presencas (
      id VARCHAR(64) PRIMARY KEY,
      aluno_id VARCHAR(64) NOT NULL,
      turma VARCHAR(191) NOT NULL,
      modalidade VARCHAR(191) NULL,
      data_aula DATE NOT NULL,
      presente TINYINT(1) NOT NULL DEFAULT 0,
      observacao TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_student_presencas_aluno (aluno_id),
      INDEX idx_student_presencas_data (data_aula)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS student_contracts (
      id VARCHAR(64) PRIMARY KEY,
      aluno_id VARCHAR(64) NOT NULL,
      tipo_documento VARCHAR(50) NOT NULL,
      titulo VARCHAR(191) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pendente',
      arquivo_pdf VARCHAR(500) NULL,
      template_html LONGTEXT NULL,
      data_emissao DATE NULL,
      data_assinatura DATE NULL,
      observacoes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_student_contracts_aluno (aluno_id),
      INDEX idx_student_contracts_status (status)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS student_notifications (
      id VARCHAR(64) PRIMARY KEY,
      aluno_id VARCHAR(64) NOT NULL,
      titulo VARCHAR(191) NOT NULL,
      mensagem TEXT NOT NULL,
      canal VARCHAR(30) NOT NULL DEFAULT 'painel',
      tipo VARCHAR(30) NOT NULL DEFAULT 'info',
      lida TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_student_notifications_aluno (aluno_id),
      INDEX idx_student_notifications_created (created_at)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS j12_collection_snapshots (
      collection_name VARCHAR(80) PRIMARY KEY,
      data_json LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function getCollectionSnapshot(collectionName) {
  const rows = await query(
    `
      SELECT collection_name, data_json, updated_at
      FROM j12_collection_snapshots
      WHERE collection_name = ?
      LIMIT 1
    `,
    [text(collectionName, 80)],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return {
    name: String(rows[0].collection_name),
    data: safeJsonParse(rows[0].data_json, null),
    updatedAt: rows[0].updated_at,
  };
}

async function upsertCollectionSnapshot(collectionName, data) {
  const name = text(collectionName, 80);
  const payload = stringifyJson(data);

  await query(
    `
      INSERT INTO j12_collection_snapshots (collection_name, data_json)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE
        data_json = VALUES(data_json),
        updated_at = CURRENT_TIMESTAMP
    `,
    [name, payload],
  );

  const snapshot = await getCollectionSnapshot(name);
  return snapshot ?? { name, data, updatedAt: null };
}

async function syncJ12TablesFromLegacy() {
  const hasLegacyTable = await tableExists("alunos");
  const hasJ12Table = await tableExists("j12_alunos");

  if (!hasLegacyTable || !hasJ12Table) {
    return { synced: 0, skipped: true, reason: "schema-missing" };
  }

  const j12CountRows = await query("SELECT COUNT(*) AS total FROM j12_alunos");
  const legacyCountRows = await query("SELECT COUNT(*) AS total FROM alunos");
  const j12Total = Number(j12CountRows?.[0]?.total || 0);
  const legacyTotal = Number(legacyCountRows?.[0]?.total || 0);

  if (j12Total > 0 || legacyTotal === 0) {
    return {
      synced: 0,
      skipped: true,
      reason: j12Total > 0 ? "j12-has-data" : "legacy-empty",
    };
  }

  const legacyRows = await query("SELECT * FROM alunos ORDER BY created_at ASC, nome ASC");

  await transaction(async (connection) => {
    for (const row of legacyRows) {
      await persistJ12SectionsFromLegacyRow(connection, row);
    }
  });

  console.log(
    `[mysql] Estrutura J12 inicializada com ${legacyTotal} aluno(s) a partir do cadastro atual.`,
  );

  return { synced: legacyTotal, skipped: false, reason: null };
}

async function syncJ12FinanceFromLegacy() {
  const hasLegacyTable = await tableExists("financeiro");
  const hasJ12Table = await tableExists("j12_financeiro_cobrancas");

  if (!hasLegacyTable || !hasJ12Table) {
    return { synced: 0, skipped: true, reason: "missing-table" };
  }

  const j12CountRows = await query("SELECT COUNT(*) AS total FROM j12_financeiro_cobrancas");
  const legacyCountRows = await query("SELECT COUNT(*) AS total FROM financeiro");
  const j12Total = Number(j12CountRows?.[0]?.total || 0);
  const legacyTotal = Number(legacyCountRows?.[0]?.total || 0);

  if (j12Total > 0) {
    return { synced: 0, skipped: true, reason: "already-synced" };
  }

  if (legacyTotal === 0) {
    return { synced: 0, skipped: true, reason: "legacy-empty" };
  }

  const result = await query(
    `
      INSERT INTO j12_financeiro_cobrancas (
        id,
        aluno_id,
        numero_matricula,
        nome_aluno,
        competencia,
        descricao,
        tipo,
        valor,
        vencimento,
        status,
        origem,
        periodicidade,
        plano_id,
        plano_nome,
        modalidade,
        turma,
        unidade,
        responsavel_financeiro,
        responsavel_cpf,
        telefone_whatsapp,
        email,
        observacao,
        pago_em,
        forma_pagamento,
        data_geracao,
        data_pagamento,
        valor_original,
        desconto_valor,
        desconto_percentual,
        bolsa_valor,
        bolsa_percentual,
        multa_percentual,
        juros_dia_percentual,
        valor_final,
        tipo_cobranca,
        ativo,
        alterado_em,
        alterado_por,
        cancelamento_motivo,
        desconto_motivo,
        created_at,
        updated_at
      )
      SELECT
        financeiro.id,
        financeiro.aluno_id,
        alunos.numero_matricula,
        COALESCE(financeiro.aluno_nome, alunos.nome, 'Aluno'),
        CASE
          WHEN financeiro.competencia REGEXP '^[0-9]{4}-[0-9]{2}$'
            THEN financeiro.competencia
          WHEN financeiro.competencia REGEXP '^[0-9]{4}-[0-9]{2}:'
            THEN SUBSTRING(financeiro.competencia, 1, 7)
          ELSE DATE_FORMAT(financeiro.vencimento, '%Y-%m')
        END,
        LEFT(financeiro.descricao, 191),
        COALESCE(financeiro.tipo, 'mensalidade'),
        COALESCE(financeiro.valor_final, financeiro.valor, 0),
        financeiro.vencimento,
        CASE
          WHEN LOWER(COALESCE(financeiro.status, 'pendente')) = 'pago' THEN 'pago'
          WHEN LOWER(COALESCE(financeiro.status, 'pendente')) IN ('cancelada', 'cancelado') THEN 'cancelado'
          WHEN LOWER(COALESCE(financeiro.status, 'pendente')) IN ('vencido', 'atrasado') THEN 'atrasado'
          ELSE 'pendente'
        END,
        CASE
          WHEN LOWER(COALESCE(financeiro.origem, 'manual')) = 'automatica' THEN 'automatico'
          ELSE COALESCE(financeiro.origem, 'manual')
        END,
        financeiro.periodicidade,
        financeiro.plano_id,
        financeiro.plano_nome,
        financeiro.modalidade,
        financeiro.turma,
        financeiro.unidade,
        financeiro.responsavel_financeiro,
        financeiro.responsavel_cpf,
        financeiro.telefone_whatsapp,
        financeiro.email,
        financeiro.observacao,
        financeiro.pago_em,
        financeiro.forma_pagamento,
        financeiro.data_geracao,
        financeiro.data_pagamento,
        financeiro.valor_original,
        financeiro.desconto_valor,
        financeiro.desconto_percentual,
        financeiro.bolsa_valor,
        financeiro.bolsa_percentual,
        financeiro.multa_percentual,
        financeiro.juros_dia_percentual,
        financeiro.valor_final,
        COALESCE(financeiro.tipo_cobranca, 'avulsa'),
        COALESCE(financeiro.ativo, 1),
        financeiro.alterado_em,
        financeiro.alterado_por,
        financeiro.cancelamento_motivo,
        financeiro.desconto_motivo,
        financeiro.created_at,
        financeiro.updated_at
      FROM financeiro
      LEFT JOIN alunos ON alunos.id = financeiro.aluno_id
    `,
  );

  return { synced: Number(result?.affectedRows || legacyTotal), skipped: false, reason: null };
}

async function syncEnrollmentNumberRegistry() {
  const hasJ12Table = await tableExists("j12_alunos");
  const hasRegistryTable = await tableExists("j12_matricula_numeros");

  if (!hasJ12Table || !hasRegistryTable) {
    return { synced: 0, skipped: true, reason: "schema-missing" };
  }

  const rows = await query(`
    SELECT id, numero_matricula, nome_completo, status
    FROM j12_alunos
    WHERE numero_matricula IS NOT NULL AND numero_matricula <> ''
    ORDER BY updated_at DESC, created_at DESC
  `);

  const registryEntries = new Map();
  const { modernRows, historicalRows, invalidRows } = partitionEnrollmentRowsForRegistry(rows);
  const ignoredHistorical = historicalRows.length;
  const ignoredInvalid = invalidRows.length;
  const existingRegistryRows = await query(ENROLLMENT_REGISTRY_STATE_SQL, [
    MIN_ENROLLMENT_SEQUENCE,
    MAX_ENROLLMENT_SEQUENCE,
  ]);
  const existingRegistryBySequence = new Map(
    (Array.isArray(existingRegistryRows) ? existingRegistryRows : []).map((row) => [
      Number(row.numero),
      row,
    ]),
  );
  let ignoredRegistryCollisions = 0;

  for (const { row, sequence: numero } of modernRows) {
    const existingRegistryRow = existingRegistryBySequence.get(numero);
    if (existingRegistryRow && !isModernEnrollmentRegistryRow(existingRegistryRow)) {
      ignoredRegistryCollisions += 1;
      continue;
    }

    const entry = {
      enrollmentSequence: numero,
      alunoId: row.id,
      alunoNome: row.nome_completo,
      status: normalizeEnrollmentRegistryStatus(row.status),
    };

    const existing = registryEntries.get(numero);
    if (
      !existing ||
      getEnrollmentStatusPriority(entry.status) >= getEnrollmentStatusPriority(existing.status)
    ) {
      registryEntries.set(numero, entry);
    }
  }

  if (registryEntries.size === 0) {
    return {
      synced: 0,
      skipped: true,
      reason: "j12-empty",
      ignoredHistorical,
      ignoredInvalid,
      ignoredRegistryCollisions,
    };
  }

  await transaction(async (connection) => {
    for (const entry of registryEntries.values()) {
      await upsertEnrollmentNumberRegistry(connection, entry);
    }
  });

  console.log(`[mysql] Registro de matriculas sincronizado com ${registryEntries.size} numero(s).`);

  return {
    synced: registryEntries.size,
    skipped: false,
    reason: null,
    ignoredHistorical,
    ignoredInvalid,
    ignoredRegistryCollisions,
  };
}

// Disabled by default to avoid permanent background traffic and failure amplification.
const databaseKeepaliveTimer = databaseConnectivity.startKeepalive({
  enabled: String(process.env.DB_KEEPALIVE_ENABLED || "").toLowerCase() === "true",
  intervalMs: process.env.DB_KEEPALIVE_INTERVAL_MS,
});

function stopDatabaseJobs() {
  if (databaseKeepaliveTimer) clearInterval(databaseKeepaliveTimer);
}

module.exports = {
  MYSQL_CONFIG,
  pool,
  stopDatabaseJobs,
  query,
  tableExists,
  transaction,
  ensureAuthSchema,
  ensureSchema,
  testConnection,
  syncJ12TablesFromLegacy,
  syncJ12FinanceFromLegacy,
  syncEnrollmentNumberRegistry,
  getNextEnrollmentNumberPreview,
  allocateEnrollmentSequence,
  upsertEnrollmentNumberRegistry,
  getCollectionSnapshot,
  upsertCollectionSnapshot,
};
