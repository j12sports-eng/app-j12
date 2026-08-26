const { canManageSystem, resolveScopedStudentId } = require("../../auth.js");
const { deactivateStudentUsers, syncStudentUsers } = require("../../services/student-users.js");
const {
  deactivateResponsavelUsersByStudent,
  syncResponsavelUsers,
} = require("../../services/linked-users.js");
const { generateMonthlyChargeForStudent } = require("../../services/student-finance.js");
const {
  createId,
  sanitizeIsoDate,
  sanitizeNullableString,
  sanitizeString,
  stringifyJson,
} = require("../../routes/helpers.js");
const {
  allocateEnrollmentSequence,
  query,
  transaction,
  upsertEnrollmentNumberRegistry,
} = require("../config/db.js");
const {
  ENROLLMENT_NUMBER_KINDS,
  classifyEnrollmentNumber,
  createEnrollmentNumberError,
  formatEnrollmentNumber,
} = require("../config/enrollment-number.js");

function text(value, max = 65535) {
  return sanitizeString(value, max);
}

function nullableText(value, max = 65535) {
  return sanitizeNullableString(value, max);
}

function numeric(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value ?? fallback;

  try {
    const parsed = JSON.parse(String(value));
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function uniqueValues(values) {
  if (!Array.isArray(values)) return [];

  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function normalizeArrayField(value) {
  if (Array.isArray(value)) {
    return uniqueValues(value);
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return [];

    if (
      (normalized.startsWith("[") && normalized.endsWith("]")) ||
      (normalized.startsWith("{") && normalized.endsWith("}"))
    ) {
      try {
        const parsed = JSON.parse(normalized);
        return Array.isArray(parsed) ? uniqueValues(parsed) : [];
      } catch {
        return uniqueValues(normalized.split(/[;,|]/g));
      }
    }

    return uniqueValues(normalized.split(/[;,|]/g));
  }

  return value == null ? [] : [String(value)];
}

function normalizeStudentStatus(value) {
  const normalized = text(value, 30).toLowerCase();
  if (normalized === "inativo") return "inativo";
  if (normalized === "experimental") return "experimental";
  return "ativo";
}

function ensureAlunoName(payload = {}) {
  const nome = text(
    payload.nome ||
      payload.nome_completo ||
      payload.nomeCompleto ||
      payload.matricula?.dadosAluno?.nomeCompleto,
    191,
  );

  if (!nome) {
    const error = new Error("Nome do aluno e obrigatorio.");
    error.statusCode = 400;
    throw error;
  }

  return nome;
}

function buildMatriculaSnapshot(payload = {}) {
  const matricula = safeJsonParse(
    payload.matricula ?? payload.matricula_snapshot_json ?? payload.matricula_json,
    {},
  );
  const dadosAluno = matricula?.dadosAluno ?? {};
  const responsavel = matricula?.responsavel ?? {};
  const endereco = matricula?.endereco ?? {};
  const documentos = matricula?.documentos ?? {};
  const esportivas = matricula?.esportivas ?? {};
  const saude = matricula?.saude ?? {};
  const estrategicas = matricula?.estrategicas ?? {};

  const modalidades = uniqueValues([
    ...normalizeArrayField(esportivas.modalidades),
    ...normalizeArrayField(payload.modalidades ?? payload.modalidades_json),
    payload.modalidade,
    payload.modalidade_principal,
  ]);
  const turmas = uniqueValues([
    ...normalizeArrayField(esportivas.turmas),
    ...normalizeArrayField(payload.turmas ?? payload.turmas_json),
    payload.turma,
    payload.turma_principal,
  ]);
  const unidades = uniqueValues([
    ...normalizeArrayField(esportivas.unidades),
    ...normalizeArrayField(payload.unidades ?? payload.unidades_json),
    payload.unidade,
    payload.unidade_principal,
  ]);
  const horarios = uniqueValues([
    ...normalizeArrayField(esportivas.horarios),
    ...normalizeArrayField(payload.horarios ?? payload.horarios_json),
    ...normalizeArrayField(payload.dias_horarios ?? payload.dias_horarios_json),
  ]);

  return {
    dadosAluno: {
      numeroMatricula: text(
        payload.numeroMatricula ?? payload.numero_matricula ?? dadosAluno.numeroMatricula,
        50,
      ),
      nomeCompleto:
        text(
          payload.nome ?? payload.nome_completo ?? payload.nomeCompleto ?? dadosAluno.nomeCompleto,
          191,
        ) || ensureAlunoName(payload),
      dataNascimento:
        sanitizeIsoDate(
          payload.dataNascimento ?? payload.data_nascimento ?? dadosAluno.dataNascimento,
        ) || "",
      idade: text(payload.idade ?? dadosAluno.idade, 10),
      cpf: text(payload.cpf ?? dadosAluno.cpf, 20),
      rg: text(payload.rg ?? dadosAluno.rg, 30),
      sexo: text(payload.sexo ?? dadosAluno.sexo, 30),
      colegio: text(payload.colegio ?? dadosAluno.colegio, 191),
      periodoEscolar: text(
        payload.periodoEscolar ?? payload.periodo_escolar ?? dadosAluno.periodoEscolar,
        50,
      ),
    },
    responsavel: {
      nomeCompleto: text(
        payload.responsavel ?? payload.responsavel_nome ?? responsavel.nomeCompleto,
        191,
      ),
      cpf: text(payload.responsavelCpf ?? payload.responsavel_cpf ?? responsavel.cpf, 20),
      rg: text(payload.responsavelRg ?? responsavel.rg, 30),
      whatsapp: text(
        payload.telefoneResponsavel ??
          payload.telefone_responsavel ??
          payload.responsavel_whatsapp ??
          responsavel.whatsapp,
        50,
      ),
      email: text(
        payload.responsavelEmail ??
          payload.responsavel_email ??
          responsavel.email ??
          payload.email ??
          payload.email_contato,
        191,
      ),
      parentesco: text(payload.parentesco ?? responsavel.parentesco, 100),
    },
    endereco: {
      cep: text(payload.cep ?? endereco.cep, 20),
      rua: text(payload.rua ?? endereco.rua, 191),
      numero: text(payload.numero ?? endereco.numero, 30),
      complemento: text(payload.complemento ?? endereco.complemento, 191),
      bairro: text(payload.bairro ?? endereco.bairro, 191),
      cidade: text(payload.cidade ?? endereco.cidade, 191),
      estado: text(payload.estado ?? endereco.estado, 50),
    },
    documentos: {
      fotoPerfilAluno: documentos.fotoPerfilAluno ?? null,
      rgCpfAluno: documentos.rgCpfAluno ?? null,
      rgCpfResponsavel: documentos.rgCpfResponsavel ?? null,
      comprovanteEndereco: documentos.comprovanteEndereco ?? null,
      atestadoMedico: documentos.atestadoMedico ?? null,
    },
    esportivas: {
      modalidades,
      unidades,
      horarios,
      turmas,
      nivel: text(payload.nivel ?? esportivas.nivel, 100),
      treinouAntes: text(
        payload.treinouAntes ?? payload.treinou_antes ?? esportivas.treinouAntes,
        100,
      ),
      caracteristica: text(payload.caracteristica ?? esportivas.caracteristica, 191),
      objetivo: text(payload.objetivo ?? esportivas.objetivo, 191),
    },
    saude: {
      restricaoMedica: text(
        payload.restricaoMedica ?? payload.restricao_medica ?? saude.restricaoMedica,
        191,
      ),
      medicamentos: text(payload.medicamentos ?? saude.medicamentos, 191),
      alergias: text(payload.alergias ?? saude.alergias, 191),
      lesoes: text(payload.lesoes ?? saude.lesoes, 191),
      planoSaude: text(payload.planoSaude ?? payload.plano_saude ?? saude.planoSaude, 191),
      observacoesImportantes: text(
        payload.observacoesImportantes ??
          payload.observacoes_importantes ??
          saude.observacoesImportantes,
        1000,
      ),
    },
    estrategicas: {
      comoConheceu: text(
        payload.comoConheceu ??
          payload.como_conheceu ??
          payload.origemCadastro ??
          payload.origem_cadastro ??
          estrategicas.comoConheceu,
        191,
      ),
      indicacaoQuem: text(
        payload.indicacaoQuem ?? payload.indicacao_quem ?? estrategicas.indicacaoQuem,
        191,
      ),
      observacoesGerais: text(
        payload.observacoesGerais ?? payload.observacoes_gerais ?? estrategicas.observacoesGerais,
        1000,
      ),
    },
  };
}

function normalizeAlunoPayload(payload = {}, existingId = null) {
  const matricula = buildMatriculaSnapshot(payload);

  return {
    id: existingId || text(payload.id, 64) || createId("a"),
    nome: ensureAlunoName(payload),
    dataNascimento:
      sanitizeIsoDate(
        payload.dataNascimento ?? payload.data_nascimento ?? matricula.dadosAluno.dataNascimento,
      ) || null,
    idade: nullableText(payload.idade ?? matricula.dadosAluno.idade, 10),
    cpf: nullableText(payload.cpf ?? matricula.dadosAluno.cpf, 20),
    rg: nullableText(payload.rg ?? matricula.dadosAluno.rg, 30),
    sexo: nullableText(payload.sexo ?? matricula.dadosAluno.sexo, 30),
    colegio: nullableText(payload.colegio ?? matricula.dadosAluno.colegio, 191),
    periodoEscolar: nullableText(
      payload.periodoEscolar ?? payload.periodo_escolar ?? matricula.dadosAluno.periodoEscolar,
      50,
    ),
    email: nullableText(payload.email ?? payload.email_contato ?? matricula.responsavel.email, 191),
    telefone: nullableText(
      payload.telefone ?? payload.telefone_contato ?? matricula.responsavel.whatsapp,
      50,
    ),
    responsavel: nullableText(
      payload.responsavel ?? payload.responsavel_nome ?? matricula.responsavel.nomeCompleto,
      191,
    ),
    telefoneResponsavel: nullableText(
      payload.telefoneResponsavel ??
        payload.telefone_responsavel ??
        payload.responsavel_whatsapp ??
        matricula.responsavel.whatsapp,
      50,
    ),
    modalidade: nullableText(
      payload.modalidade ?? payload.modalidade_principal ?? matricula.esportivas.modalidades[0],
      191,
    ),
    turma: nullableText(
      payload.turma ?? payload.turma_principal ?? matricula.esportivas.turmas[0],
      191,
    ),
    plano: nullableText(
      payload.plano ?? payload.plano_principal ?? payload.planoNome ?? payload.plano_nome,
      191,
    ),
    numeroMatricula: nullableText(
      payload.numeroMatricula ?? payload.numero_matricula ?? matricula.dadosAluno.numeroMatricula,
      50,
    ),
    status: normalizeStudentStatus(payload.status),
    matriculaEm:
      sanitizeIsoDate(payload.matriculaEm ?? payload.matricula_em ?? payload.created_at) ||
      new Date().toISOString().slice(0, 10),
    turmas: uniqueValues(matricula.esportivas.turmas),
    unidades: uniqueValues(matricula.esportivas.unidades),
    horarios: uniqueValues(matricula.esportivas.horarios),
    planos: uniqueValues([
      ...normalizeArrayField(payload.planos ?? payload.planos_json),
      payload.plano,
      payload.plano_principal,
      payload.planoNome,
      payload.plano_nome,
    ]),
    planoId: nullableText(payload.planoId ?? payload.plano_id, 64),
    planoValor: numeric(payload.planoValor ?? payload.plano_valor, 0) || null,
    unidade: nullableText(
      payload.unidade ?? payload.unidade_principal ?? matricula.esportivas.unidades[0],
      191,
    ),
    diasHorarios: uniqueValues([
      ...normalizeArrayField(payload.diasHorarios),
      ...normalizeArrayField(payload.dias_horarios),
      ...normalizeArrayField(payload.dias_horarios_json),
      ...matricula.esportivas.horarios,
    ]),
    origemCadastro: nullableText(payload.origemCadastro ?? payload.origem_cadastro, 100),
    matriculaPublicaProtocolo: nullableText(
      payload.matriculaPublicaProtocolo ?? payload.matricula_publica_protocolo,
      100,
    ),
    matricula,
    financeiro: safeJsonParse(payload.financeiro ?? payload.financeiro_json, null),
  };
}

async function resolvePlanoForAluno(connection, aluno) {
  const desiredPlanId = text(aluno.planoId, 64);
  const desiredPlanName = text(aluno.plano, 191);

  if (desiredPlanId) {
    const [rows] = await connection.execute(
      `
        SELECT *
        FROM j12_planos
        WHERE id = ?
        LIMIT 1
      `,
      [desiredPlanId],
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0];
    }
  }

  if (!desiredPlanName) return null;

  const [rows] = await connection.execute(
    `
      SELECT *
      FROM j12_planos
      WHERE LOWER(nome) = LOWER(?)
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    `,
    [desiredPlanName],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

function buildFinanceiroConfig(aluno, plano, matricula) {
  const current = safeJsonParse(aluno.financeiro, {});
  const planName = text(current.planoNome ?? aluno.plano ?? plano?.nome, 191);
  const planId = text(current.planoId ?? aluno.planoId ?? plano?.id, 64);
  const valorPlano = numeric(
    current.valorPlano ?? aluno.planoValor ?? plano?.preco_mensal ?? plano?.valor,
    0,
  );

  return {
    planoId: planId || null,
    planoNome: planName || null,
    valorPlano: valorPlano > 0 ? valorPlano : null,
    periodicidade: text(current.periodicidade, 30) || "mensal",
    diaVencimento:
      Number.isFinite(Number(current.diaVencimento)) && Number(current.diaVencimento) > 0
        ? Math.trunc(Number(current.diaVencimento))
        : 10,
    dataInicioFinanceiro: sanitizeIsoDate(current.dataInicioFinanceiro) || aluno.matriculaEm,
    descontoValor: numeric(current.descontoValor, 0) || null,
    descontoPercentual: numeric(current.descontoPercentual, 0) || null,
    bolsaValor: numeric(current.bolsaValor, 0) || null,
    bolsaPercentual: numeric(current.bolsaPercentual, 0) || null,
    multaPercentual: numeric(current.multaPercentual, 0) || null,
    jurosDiaPercentual: numeric(current.jurosDiaPercentual, 0) || null,
    cobrancaAutomatica: current.cobrancaAutomatica !== false,
    recorrenciaAtiva: current.recorrenciaAtiva !== false,
    cobrancaProporcional: Boolean(current.cobrancaProporcional),
    observacoes: nullableText(current.observacoes, 65535),
    unidade: nullableText(
      current.unidade ?? aluno.unidade ?? matricula.esportivas.unidades[0],
      191,
    ),
    modalidade: nullableText(
      current.modalidade ?? aluno.modalidade ?? matricula.esportivas.modalidades[0],
      191,
    ),
    diasHorarios: uniqueValues([
      ...normalizeArrayField(current.diasHorarios),
      ...matricula.esportivas.horarios,
    ]),
  };
}

async function persistAluno(connection, aluno) {
  const suppliedEnrollmentNumber = text(aluno.numeroMatricula, 50);
  let enrollment;
  let enrollmentSequence;

  if (suppliedEnrollmentNumber) {
    const classification = classifyEnrollmentNumber(suppliedEnrollmentNumber);
    if (classification.kind === ENROLLMENT_NUMBER_KINDS.MODERN) {
      enrollmentSequence = classification.sequence;
      enrollment = suppliedEnrollmentNumber;
    } else if (classification.kind === ENROLLMENT_NUMBER_KINDS.HISTORICAL_NUMERIC) {
      const [existingRows] = await connection.execute(
        "SELECT numero_matricula FROM j12_alunos WHERE id = ? LIMIT 1",
        [aluno.id],
      );
      const existingEnrollmentNumber = text(existingRows?.[0]?.numero_matricula, 50);
      if (existingEnrollmentNumber !== suppliedEnrollmentNumber) {
        throw createEnrollmentNumberError(
          "HISTORICAL_ENROLLMENT_NUMBER_IMMUTABLE",
          "Identificador historico de matricula nao pode ser atribuido a um novo aluno.",
          400,
        );
      }

      enrollmentSequence = null;
      enrollment = suppliedEnrollmentNumber;
    } else {
      throw createEnrollmentNumberError(
        "ENROLLMENT_NUMBER_INVALID",
        "Numero publico de matricula invalido.",
        400,
      );
    }
  } else {
    const reservation = await allocateEnrollmentSequence(connection);
    enrollmentSequence = reservation.sequence;
    enrollment = formatEnrollmentNumber(enrollmentSequence, aluno.matriculaEm);
  }

  const plano = await resolvePlanoForAluno(connection, aluno);
  const matricula = buildMatriculaSnapshot({
    ...aluno,
    numeroMatricula: enrollment,
    matricula: aluno.matricula,
  });
  const modalidades = uniqueValues(
    matricula.esportivas.modalidades.length > 0
      ? matricula.esportivas.modalidades
      : [aluno.modalidade],
  );
  const turmas = uniqueValues(
    matricula.esportivas.turmas.length > 0 ? matricula.esportivas.turmas : [aluno.turma],
  );
  const unidades = uniqueValues(
    matricula.esportivas.unidades.length > 0 ? matricula.esportivas.unidades : [aluno.unidade],
  );
  const horarios = uniqueValues(
    matricula.esportivas.horarios.length > 0 ? matricula.esportivas.horarios : aluno.diasHorarios,
  );
  const planos = uniqueValues(
    aluno.planos.length > 0 ? [...aluno.planos, plano?.nome] : [aluno.plano, plano?.nome],
  );
  const planoNome = nullableText(aluno.plano ?? plano?.nome, 191);
  const planoId = nullableText(aluno.planoId ?? plano?.id, 64);
  const planoValor = numeric(aluno.planoValor ?? plano?.preco_mensal ?? plano?.valor, 0) || null;
  const financeiro = buildFinanceiroConfig(
    {
      ...aluno,
      plano: planoNome,
      planoId,
      planoValor,
    },
    plano,
    matricula,
  );

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
        responsavel,
        telefone_responsavel,
        status,
        matricula_em,
        modalidade_principal,
        turma_principal,
        plano_principal,
        planos_json,
        origem_cadastro,
        matricula_publica_protocolo,
        financeiro_json,
        matricula_snapshot_json,
        plano_id,
        plano_valor,
        unidade_principal,
        dias_horarios_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        responsavel = VALUES(responsavel),
        telefone_responsavel = VALUES(telefone_responsavel),
        status = VALUES(status),
        matricula_em = VALUES(matricula_em),
        modalidade_principal = VALUES(modalidade_principal),
        turma_principal = VALUES(turma_principal),
        plano_principal = VALUES(plano_principal),
        planos_json = VALUES(planos_json),
        origem_cadastro = VALUES(origem_cadastro),
        matricula_publica_protocolo = VALUES(matricula_publica_protocolo),
        financeiro_json = VALUES(financeiro_json),
        matricula_snapshot_json = VALUES(matricula_snapshot_json),
        plano_id = VALUES(plano_id),
        plano_valor = VALUES(plano_valor),
        unidade_principal = VALUES(unidade_principal),
        dias_horarios_json = VALUES(dias_horarios_json)
    `,
    [
      aluno.id,
      enrollment,
      aluno.nome,
      aluno.dataNascimento,
      aluno.idade,
      aluno.cpf,
      aluno.rg,
      aluno.sexo,
      aluno.colegio,
      aluno.periodoEscolar,
      aluno.email,
      aluno.telefone,
      aluno.responsavel,
      aluno.telefoneResponsavel,
      aluno.status,
      aluno.matriculaEm,
      nullableText(aluno.modalidade ?? modalidades[0], 191),
      nullableText(aluno.turma ?? turmas[0], 191),
      planoNome,
      stringifyJson(planos),
      aluno.origemCadastro,
      aluno.matriculaPublicaProtocolo,
      stringifyJson(financeiro),
      stringifyJson({
        ...matricula,
        esportivas: {
          ...matricula.esportivas,
          modalidades,
          unidades,
          horarios,
          turmas,
        },
      }),
      planoId,
      planoValor,
      nullableText(aluno.unidade ?? unidades[0], 191),
      stringifyJson(horarios),
    ],
  );

  if (enrollmentSequence !== null) {
    await upsertEnrollmentNumberRegistry(connection, {
      enrollmentSequence,
      alunoId: aluno.id,
      alunoNome: aluno.nome,
      status: aluno.status,
    });
  }

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
      aluno.id,
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
      aluno.id,
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
      aluno.id,
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
      aluno.id,
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
      aluno.id,
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
      aluno.id,
      nullableText(matricula.estrategicas.comoConheceu, 191),
      nullableText(matricula.estrategicas.indicacaoQuem, 191),
      nullableText(matricula.estrategicas.observacoesGerais, 1000),
    ],
  );

  return {
    id: aluno.id,
    numeroMatricula: enrollment,
    planoId,
    planoNome,
    planoValor,
  };
}

async function loadStudentRows(options = {}) {
  const params = [];
  const conditions = [];

  if (options.studentId) {
    conditions.push("aluno.id = ?");
    params.push(String(options.studentId));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await query(
    `
      SELECT
        aluno.*,
        aluno.nome_completo AS nome,
        aluno.email_contato AS email,
        aluno.telefone_contato AS telefone,
        resp.nome_completo AS responsavel_nome,
        resp.cpf AS responsavel_cpf,
        resp.rg AS responsavel_rg,
        resp.whatsapp AS responsavel_whatsapp,
        resp.email AS responsavel_email,
        resp.parentesco AS responsavel_parentesco,
        endereco.cep,
        endereco.rua,
        endereco.numero,
        endereco.complemento,
        endereco.bairro,
        endereco.cidade,
        endereco.estado,
        docs.foto_perfil_aluno_json,
        docs.rg_cpf_aluno_json,
        docs.rg_cpf_responsavel_json,
        docs.comprovante_endereco_json,
        docs.atestado_medico_json,
        esporte.modalidades_json,
        esporte.unidades_json,
        esporte.horarios_json,
        esporte.turmas_json,
        esporte.nivel,
        esporte.treinou_antes,
        esporte.caracteristica,
        esporte.objetivo,
        saude.restricao_medica,
        saude.medicamentos,
        saude.alergias,
        saude.lesoes,
        saude.plano_saude,
        saude.observacoes_importantes,
        estr.como_conheceu,
        estr.indicacao_quem,
        estr.observacoes_gerais
      FROM j12_alunos aluno
      LEFT JOIN j12_alunos_responsaveis resp ON resp.aluno_id = aluno.id
      LEFT JOIN j12_alunos_enderecos endereco ON endereco.aluno_id = aluno.id
      LEFT JOIN j12_alunos_documentos docs ON docs.aluno_id = aluno.id
      LEFT JOIN j12_alunos_esportes esporte ON esporte.aluno_id = aluno.id
      LEFT JOIN j12_alunos_saude saude ON saude.aluno_id = aluno.id
      LEFT JOIN j12_alunos_estrategico estr ON estr.aluno_id = aluno.id
      ${whereClause}
      ORDER BY aluno.updated_at DESC, aluno.created_at DESC, aluno.nome_completo ASC
    `,
    params,
  );

  return {
    rows: Array.isArray(rows) ? rows : [],
  };
}

async function findStudentRowById(studentId) {
  const { rows } = await loadStudentRows({ studentId });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function getAlunos(req, res, next) {
  try {
    if (!req.auth || canManageSystem(req.auth)) {
      const { rows } = await loadStudentRows();
      return res.json(rows);
    }

    const studentId = resolveScopedStudentId(req.auth);
    if (!studentId) {
      return res.status(403).json({ message: "Usuario sem aluno vinculado." });
    }

    const row = await findStudentRowById(studentId);
    return res.json(row ? [row] : []);
  } catch (error) {
    next(error);
  }
}

async function getAlunoById(req, res, next) {
  try {
    const studentId = text(req.params.id, 64);
    if (!studentId) {
      return res.status(400).json({ message: "ID do aluno invalido." });
    }

    if (req.auth && !canManageSystem(req.auth)) {
      const scopedStudentId = resolveScopedStudentId(req.auth);
      if (!scopedStudentId || String(scopedStudentId) !== studentId) {
        return res.status(403).json({ message: "Acesso negado a este aluno." });
      }
    }

    const row = await findStudentRowById(studentId);
    if (!row) {
      return res.status(404).json({ message: "Aluno nao encontrado." });
    }

    return res.json(row);
  } catch (error) {
    next(error);
  }
}

async function createAluno(req, res, next) {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para cadastrar aluno." });
    }

    const aluno = normalizeAlunoPayload(req.body ?? {});

    await transaction(async (connection) => {
      await persistAluno(connection, aluno);
    });

    await syncStudentUsers({ onlyStudentId: aluno.id });
    await syncResponsavelUsers({ onlyStudentId: aluno.id });

    try {
      await generateMonthlyChargeForStudent(aluno.id, {
        actorName: req.auth?.nome || req.auth?.email || "admin",
      });
    } catch (error) {
      console.warn(
        `[alunos] Falha ao gerar mensalidade inicial para ${aluno.id}:`,
        error?.message || error,
      );
    }

    const saved = await findStudentRowById(aluno.id);
    return res.status(201).json(saved ?? { id: aluno.id });
  } catch (error) {
    next(error);
  }
}

async function updateAluno(req, res, next) {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para atualizar aluno." });
    }

    const studentId = text(req.params.id, 64);
    if (!studentId) {
      return res.status(400).json({ message: "ID do aluno invalido." });
    }

    const current = await findStudentRowById(studentId);
    if (!current) {
      return res.status(404).json({ message: "Aluno nao encontrado." });
    }

    const aluno = normalizeAlunoPayload(
      {
        ...current,
        ...req.body,
        id: studentId,
      },
      studentId,
    );

    await transaction(async (connection) => {
      await persistAluno(connection, aluno);
    });

    await syncStudentUsers({ onlyStudentId: studentId });
    await syncResponsavelUsers({ onlyStudentId: studentId });

    const saved = await findStudentRowById(studentId);
    return res.json(saved ?? { id: studentId });
  } catch (error) {
    next(error);
  }
}

async function deleteAluno(req, res, next) {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para excluir aluno." });
    }

    const studentId = text(req.params.id, 64);
    if (!studentId) {
      return res.status(400).json({ message: "ID do aluno invalido." });
    }

    const current = await query(
      "SELECT id, numero_matricula FROM j12_alunos WHERE id = ? LIMIT 1",
      [studentId],
    );
    if (!Array.isArray(current) || current.length === 0) {
      return res.status(404).json({ message: "Aluno nao encontrado." });
    }

    await transaction(async (connection) => {
      const relatedTables = [
        "j12_alunos_responsaveis",
        "j12_alunos_enderecos",
        "j12_alunos_documentos",
        "j12_alunos_esportes",
        "j12_alunos_saude",
        "j12_alunos_estrategico",
        "j12_financeiro_cobrancas",
        "student_presencas",
        "student_contracts",
        "student_notifications",
      ];

      for (const tableName of relatedTables) {
        await connection.execute(`DELETE FROM ${tableName} WHERE aluno_id = ?`, [studentId]);
      }

      await connection.execute(
        `
          DELETE FROM j12_matriculas_publicas
          WHERE aluno_id = ?
        `,
        [studentId],
      );

      if (
        classifyEnrollmentNumber(current[0].numero_matricula).kind ===
        ENROLLMENT_NUMBER_KINDS.MODERN
      ) {
        await upsertEnrollmentNumberRegistry(connection, {
          numeroMatricula: current[0].numero_matricula,
          alunoId: studentId,
          alunoNome: null,
          status: "excluido",
        });
      }

      await connection.execute("DELETE FROM j12_alunos WHERE id = ?", [studentId]);
    });

    await deactivateStudentUsers(studentId);
    await deactivateResponsavelUsersByStudent(studentId);

    return res.json({
      ok: true,
      message: "Aluno excluido com sucesso.",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  normalizeAlunoPayload,
  buildMatriculaSnapshot,
  loadStudentRows,
  persistAluno,
  getAlunos,
  getAlunoById,
  createAluno,
  updateAluno,
  deleteAluno,
};
