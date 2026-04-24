const { canManageSystem, resolveScopedStudentId } = require("../../auth");
const {
  parseJson,
  sanitizeIsoDate,
  sanitizeNullableString,
  sanitizeString,
  stringifyJson,
  createId,
} = require("../../routes/helpers");
const {
  query,
  transaction,
  tableExists,
  upsertEnrollmentNumberRegistry,
} = require("../config/db");

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

function text(value, max = 65535) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function nullableText(value, max = 65535) {
  const normalized = text(value, max);
  return normalized || null;
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

function buildEmptyMatricula() {
  return {
    dadosAluno: {
      numeroMatricula: "",
      nomeCompleto: "",
      dataNascimento: "",
      idade: "",
      cpf: "",
      rg: "",
      sexo: "",
      colegio: "",
      periodoEscolar: "",
    },
    responsavel: {
      nomeCompleto: "",
      cpf: "",
      rg: "",
      whatsapp: "",
      email: "",
      parentesco: "",
    },
    endereco: {
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
    },
    documentos: {
      fotoPerfilAluno: null,
      rgCpfAluno: null,
      rgCpfResponsavel: null,
      comprovanteEndereco: null,
      atestadoMedico: null,
    },
    esportivas: {
      modalidades: [],
      unidades: [],
      horarios: [],
      turmas: [],
      nivel: "",
      treinouAntes: "",
      caracteristica: "",
      objetivo: "",
    },
    saude: {
      restricaoMedica: "",
      medicamentos: "",
      alergias: "",
      lesoes: "",
      planoSaude: "",
      observacoesImportantes: "",
    },
    estrategicas: {
      comoConheceu: "",
      indicacaoQuem: "",
      observacoesGerais: "",
    },
  };
}

function normalizeComparable(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function getProfessorScopedStudents(rows, user) {
  const classScope = Array.isArray(user?.classScope) ? user.classScope : [];
  const normalizedScope = new Set(
    classScope.map((item) => normalizeComparable(item)).filter(Boolean),
  );

  if (normalizedScope.size === 0 && !user?.teacherId) {
    return [];
  }

  return rows.filter((row) => {
    const turmaNames = [...(row.turmas ?? []), row.turma]
      .map((item) => normalizeComparable(item))
      .filter(Boolean);

    return normalizedScope.size > 0 && turmaNames.some((item) => normalizedScope.has(item));
  });
}

function normalizeAlunoPayload(payload, existingId) {
  const nome = sanitizeString(payload.nome, 191);

  if (!nome) {
    const error = new Error("Nome do aluno e obrigatorio.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id: sanitizeString(existingId || payload.id, 64) || createId("a"),
    nome,
    email: sanitizeNullableString(payload.email, 191),
    telefone: sanitizeNullableString(payload.telefone, 50),
    dataNascimento: sanitizeIsoDate(payload.dataNascimento),
    responsavel: sanitizeNullableString(payload.responsavel, 191),
    telefoneResponsavel: sanitizeNullableString(payload.telefoneResponsavel, 50),
    modalidade: sanitizeNullableString(payload.modalidade, 191),
    unidades: uniqueValues(payload.unidades),
    turmas: uniqueValues(payload.turmas),
    planos: uniqueValues(payload.planos),
    horarios: uniqueValues(payload.horarios),
    turma: sanitizeNullableString(payload.turma, 191),
    plano: sanitizeNullableString(payload.plano, 191),
    status: sanitizeString(payload.status || "ativo", 50) || "ativo",
    matriculaEm: sanitizeIsoDate(payload.matriculaEm) || new Date().toISOString().slice(0, 10),
    numeroMatricula: sanitizeNullableString(payload.numeroMatricula, 50),
    cpf: sanitizeNullableString(payload.cpf, 20),
    rg: sanitizeNullableString(payload.rg, 30),
    sexo: sanitizeNullableString(payload.sexo, 30),
    matricula: payload.matricula ?? null,
    financeiro: payload.financeiro ?? null,
    origemCadastro: sanitizeNullableString(payload.origemCadastro, 100),
    matriculaPublicaProtocolo: sanitizeNullableString(payload.matriculaPublicaProtocolo, 100),
  };
}

function buildMatriculaSnapshotFromAluno(aluno) {
  const fallback = buildEmptyMatricula();
  const raw = aluno?.matricula ?? {};

  return {
    dadosAluno: {
      ...fallback.dadosAluno,
      numeroMatricula: text(raw?.dadosAluno?.numeroMatricula || aluno.numeroMatricula, 50),
      nomeCompleto: text(raw?.dadosAluno?.nomeCompleto || aluno.nome, 191),
      dataNascimento: text(raw?.dadosAluno?.dataNascimento || aluno.dataNascimento, 10),
      idade: text(raw?.dadosAluno?.idade, 10),
      cpf: text(raw?.dadosAluno?.cpf || aluno.cpf, 20),
      rg: text(raw?.dadosAluno?.rg || aluno.rg, 30),
      sexo: text(raw?.dadosAluno?.sexo || aluno.sexo, 30),
      colegio: text(raw?.dadosAluno?.colegio, 191),
      periodoEscolar: text(raw?.dadosAluno?.periodoEscolar, 50),
    },
    responsavel: {
      ...fallback.responsavel,
      nomeCompleto: text(raw?.responsavel?.nomeCompleto || aluno.responsavel, 191),
      cpf: text(raw?.responsavel?.cpf, 20),
      rg: text(raw?.responsavel?.rg, 30),
      whatsapp: text(raw?.responsavel?.whatsapp || aluno.telefoneResponsavel, 50),
      email: text(raw?.responsavel?.email || aluno.email, 191),
      parentesco: text(raw?.responsavel?.parentesco, 100),
    },
    endereco: {
      ...fallback.endereco,
      cep: text(raw?.endereco?.cep, 20),
      rua: text(raw?.endereco?.rua, 191),
      numero: text(raw?.endereco?.numero, 30),
      complemento: text(raw?.endereco?.complemento, 191),
      bairro: text(raw?.endereco?.bairro, 191),
      cidade: text(raw?.endereco?.cidade, 191),
      estado: text(raw?.endereco?.estado, 50),
    },
    documentos: {
      fotoPerfilAluno: normalizeDocument(raw?.documentos?.fotoPerfilAluno),
      rgCpfAluno: normalizeDocument(raw?.documentos?.rgCpfAluno),
      rgCpfResponsavel: normalizeDocument(raw?.documentos?.rgCpfResponsavel),
      comprovanteEndereco: normalizeDocument(raw?.documentos?.comprovanteEndereco),
      atestadoMedico: normalizeDocument(raw?.documentos?.atestadoMedico),
    },
    esportivas: {
      ...fallback.esportivas,
      modalidades: uniqueValues(
        raw?.esportivas?.modalidades?.length ? raw.esportivas.modalidades : [aluno.modalidade],
      ),
      unidades: uniqueValues(
        raw?.esportivas?.unidades?.length ? raw.esportivas.unidades : aluno.unidades,
      ),
      horarios: uniqueValues(
        raw?.esportivas?.horarios?.length ? raw.esportivas.horarios : aluno.horarios,
      ),
      turmas: uniqueValues(raw?.esportivas?.turmas?.length ? raw.esportivas.turmas : aluno.turmas),
      nivel: text(raw?.esportivas?.nivel, 100),
      treinouAntes: text(raw?.esportivas?.treinouAntes, 100),
      caracteristica: text(raw?.esportivas?.caracteristica, 191),
      objetivo: text(raw?.esportivas?.objetivo, 191),
    },
    saude: {
      ...fallback.saude,
      restricaoMedica: text(raw?.saude?.restricaoMedica, 191),
      medicamentos: text(raw?.saude?.medicamentos, 191),
      alergias: text(raw?.saude?.alergias, 191),
      lesoes: text(raw?.saude?.lesoes, 191),
      planoSaude: text(raw?.saude?.planoSaude, 191),
      observacoesImportantes: text(raw?.saude?.observacoesImportantes, 1000),
    },
    estrategicas: {
      ...fallback.estrategicas,
      comoConheceu: text(raw?.estrategicas?.comoConheceu || aluno.origemCadastro, 191),
      indicacaoQuem: text(raw?.estrategicas?.indicacaoQuem, 191),
      observacoesGerais: text(raw?.estrategicas?.observacoesGerais, 1000),
    },
  };
}

function mapJoinedRowsToAluno(base, related) {
  const responsavel = related.responsaveis.get(base.id);
  const endereco = related.enderecos.get(base.id);
  const documentos = related.documentos.get(base.id);
  const esportes = related.esportes.get(base.id);
  const saude = related.saude.get(base.id);
  const estrategico = related.estrategico.get(base.id);
  const planos = uniqueValues(parseJson(base.planos_json, base.plano_principal ? [base.plano_principal] : []));
  const modalidades = uniqueValues(parseJson(esportes?.modalidades_json, base.modalidade_principal ? [base.modalidade_principal] : []));
  const unidades = uniqueValues(parseJson(esportes?.unidades_json, []));
  const horarios = uniqueValues(parseJson(esportes?.horarios_json, []));
  const turmas = uniqueValues(parseJson(esportes?.turmas_json, base.turma_principal ? [base.turma_principal] : []));

  const matricula = {
    dadosAluno: {
      numeroMatricula: base.numero_matricula ?? "",
      nomeCompleto: base.nome_completo ?? "",
      dataNascimento: base.data_nascimento ?? "",
      idade: base.idade ?? "",
      cpf: base.cpf ?? "",
      rg: base.rg ?? "",
      sexo: base.sexo ?? "",
      colegio: base.colegio ?? "",
      periodoEscolar: base.periodo_escolar ?? "",
    },
    responsavel: {
      nomeCompleto: responsavel?.nome_completo ?? "",
      cpf: responsavel?.cpf ?? "",
      rg: responsavel?.rg ?? "",
      whatsapp: responsavel?.whatsapp ?? "",
      email: responsavel?.email ?? "",
      parentesco: responsavel?.parentesco ?? "",
    },
    endereco: {
      cep: endereco?.cep ?? "",
      rua: endereco?.rua ?? "",
      numero: endereco?.numero ?? "",
      complemento: endereco?.complemento ?? "",
      bairro: endereco?.bairro ?? "",
      cidade: endereco?.cidade ?? "",
      estado: endereco?.estado ?? "",
    },
    documentos: {
      fotoPerfilAluno: parseJson(documentos?.foto_perfil_aluno_json, null),
      rgCpfAluno: parseJson(documentos?.rg_cpf_aluno_json, null),
      rgCpfResponsavel: parseJson(documentos?.rg_cpf_responsavel_json, null),
      comprovanteEndereco: parseJson(documentos?.comprovante_endereco_json, null),
      atestadoMedico: parseJson(documentos?.atestado_medico_json, null),
    },
    esportivas: {
      modalidades,
      unidades,
      horarios,
      turmas,
      nivel: esportes?.nivel ?? "",
      treinouAntes: esportes?.treinou_antes ?? "",
      caracteristica: esportes?.caracteristica ?? "",
      objetivo: esportes?.objetivo ?? "",
    },
    saude: {
      restricaoMedica: saude?.restricao_medica ?? "",
      medicamentos: saude?.medicamentos ?? "",
      alergias: saude?.alergias ?? "",
      lesoes: saude?.lesoes ?? "",
      planoSaude: saude?.plano_saude ?? "",
      observacoesImportantes: saude?.observacoes_importantes ?? "",
    },
    estrategicas: {
      comoConheceu: estrategico?.como_conheceu ?? "",
      indicacaoQuem: estrategico?.indicacao_quem ?? "",
      observacoesGerais: estrategico?.observacoes_gerais ?? "",
    },
  };

  return {
    id: base.id,
    nome: base.nome_completo ?? "",
    email: base.email_contato ?? responsavel?.email ?? "",
    telefone: base.telefone_contato ?? responsavel?.whatsapp ?? "",
    dataNascimento: base.data_nascimento ?? "",
    responsavel: responsavel?.nome_completo ?? "",
    telefoneResponsavel: responsavel?.whatsapp ?? "",
    modalidade: base.modalidade_principal ?? modalidades[0] ?? "",
    unidades,
    turmas,
    planos,
    horarios,
    turma: base.turma_principal ?? turmas[0] ?? "",
    plano: base.plano_principal ?? planos[0] ?? "",
    status: base.status ?? "ativo",
    matriculaEm: base.matricula_em ?? "",
    numeroMatricula: base.numero_matricula ?? "",
    cpf: base.cpf ?? "",
    rg: base.rg ?? "",
    sexo: base.sexo ?? "",
    matricula,
    financeiro: parseJson(base.financeiro_json, null),
    origemCadastro: base.origem_cadastro ?? "",
    matriculaPublicaProtocolo: base.matricula_publica_protocolo ?? "",
  };
}

async function loadStudentRows() {
  const hasJ12Tables = await tableExists("j12_alunos");

  if (hasJ12Tables) {
    const baseRows = await query(
      "SELECT * FROM j12_alunos ORDER BY updated_at DESC, nome_completo ASC",
    );

    if (Array.isArray(baseRows) && baseRows.length > 0) {
      const [
        responsavelRows,
        enderecoRows,
        documentoRows,
        esporteRows,
        saudeRows,
        estrategicoRows,
      ] = await Promise.all([
        query("SELECT * FROM j12_alunos_responsaveis"),
        query("SELECT * FROM j12_alunos_enderecos"),
        query("SELECT * FROM j12_alunos_documentos"),
        query("SELECT * FROM j12_alunos_esportes"),
        query("SELECT * FROM j12_alunos_saude"),
        query("SELECT * FROM j12_alunos_estrategico"),
      ]);

      const related = {
        responsaveis: new Map((responsavelRows || []).map((row) => [row.aluno_id, row])),
        enderecos: new Map((enderecoRows || []).map((row) => [row.aluno_id, row])),
        documentos: new Map((documentoRows || []).map((row) => [row.aluno_id, row])),
        esportes: new Map((esporteRows || []).map((row) => [row.aluno_id, row])),
        saude: new Map((saudeRows || []).map((row) => [row.aluno_id, row])),
        estrategico: new Map((estrategicoRows || []).map((row) => [row.aluno_id, row])),
      };

      return {
        source: "j12_alunos",
        rows: baseRows.map((row) => mapJoinedRowsToAluno(row, related)),
      };
    }
  }

  const legacyRows = await query("SELECT * FROM alunos ORDER BY updated_at DESC, nome ASC");
  return {
    source: "alunos",
    rows: Array.isArray(legacyRows)
      ? legacyRows.map((row) => ({
          id: row.id,
          nome: row.nome,
          email: row.email ?? "",
          telefone: row.telefone ?? "",
          dataNascimento: row.data_nascimento ?? "",
          responsavel: row.responsavel ?? "",
          telefoneResponsavel: row.telefone_responsavel ?? "",
          modalidade: row.modalidade ?? "",
          unidades: parseJson(row.unidades_json, []),
          turmas: parseJson(row.turmas_json, []),
          planos: parseJson(row.planos_json, []),
          horarios: parseJson(row.horarios_json, []),
          turma: row.turma ?? "",
          plano: row.plano ?? "",
          status: row.status ?? "ativo",
          matriculaEm: row.matricula_em ?? "",
          numeroMatricula: row.numero_matricula ?? "",
          cpf: row.cpf ?? "",
          rg: row.rg ?? "",
          sexo: row.sexo ?? "",
          matricula: parseJson(row.matricula_json, null),
          financeiro: parseJson(row.financeiro_json, null),
          origemCadastro: row.origem_cadastro ?? "",
          matriculaPublicaProtocolo: row.matricula_publica_protocolo ?? "",
        }))
      : [],
  };
}

async function persistAluno(connection, aluno) {
  const matricula = buildMatriculaSnapshotFromAluno(aluno);
  const modalidades = uniqueValues(matricula.esportivas.modalidades);
  const unidades = uniqueValues(matricula.esportivas.unidades);
  const horarios = uniqueValues(matricula.esportivas.horarios);
  const turmas = uniqueValues(matricula.esportivas.turmas);
  const planos = uniqueValues(aluno.planos?.length ? aluno.planos : aluno.plano ? [aluno.plano] : []);

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
      aluno.id,
      nullableText(matricula.dadosAluno.numeroMatricula, 50) || aluno.numeroMatricula,
      aluno.nome,
      aluno.dataNascimento,
      nullableText(matricula.dadosAluno.idade, 10),
      nullableText(matricula.dadosAluno.cpf, 20) || aluno.cpf,
      nullableText(matricula.dadosAluno.rg, 30) || aluno.rg,
      nullableText(matricula.dadosAluno.sexo, 30) || aluno.sexo,
      nullableText(matricula.dadosAluno.colegio, 191),
      nullableText(matricula.dadosAluno.periodoEscolar, 50),
      aluno.email || nullableText(matricula.responsavel.email, 191),
      aluno.telefone || nullableText(matricula.responsavel.whatsapp, 50),
      aluno.status,
      aluno.matriculaEm,
      aluno.modalidade || nullableText(modalidades[0], 191),
      aluno.turma || nullableText(turmas[0], 191),
      aluno.plano || nullableText(planos[0], 191),
      stringifyJson(planos),
      aluno.origemCadastro,
      aluno.matriculaPublicaProtocolo,
      stringifyJson(aluno.financeiro),
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
      aluno.id,
      nullableText(matricula.responsavel.nomeCompleto, 191) || aluno.responsavel,
      nullableText(matricula.responsavel.cpf, 20),
      nullableText(matricula.responsavel.rg, 30),
      nullableText(matricula.responsavel.whatsapp, 50) || aluno.telefoneResponsavel,
      nullableText(matricula.responsavel.email, 191) || aluno.email,
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

  await connection.execute(
    `
      INSERT INTO alunos (
        id,
        nome,
        email,
        telefone,
        data_nascimento,
        responsavel,
        telefone_responsavel,
        modalidade,
        turma,
        plano,
        status,
        matricula_em,
        numero_matricula,
        cpf,
        rg,
        sexo,
        origem_cadastro,
        matricula_publica_protocolo,
        unidades_json,
        turmas_json,
        planos_json,
        horarios_json,
        matricula_json,
        financeiro_json,
        responsavel_cpf,
        responsavel_email,
        responsavel_whatsapp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nome = VALUES(nome),
        email = VALUES(email),
        telefone = VALUES(telefone),
        data_nascimento = VALUES(data_nascimento),
        responsavel = VALUES(responsavel),
        telefone_responsavel = VALUES(telefone_responsavel),
        modalidade = VALUES(modalidade),
        turma = VALUES(turma),
        plano = VALUES(plano),
        status = VALUES(status),
        matricula_em = VALUES(matricula_em),
        numero_matricula = VALUES(numero_matricula),
        cpf = VALUES(cpf),
        rg = VALUES(rg),
        sexo = VALUES(sexo),
        origem_cadastro = VALUES(origem_cadastro),
        matricula_publica_protocolo = VALUES(matricula_publica_protocolo),
        unidades_json = VALUES(unidades_json),
        turmas_json = VALUES(turmas_json),
        planos_json = VALUES(planos_json),
        horarios_json = VALUES(horarios_json),
        matricula_json = VALUES(matricula_json),
        financeiro_json = VALUES(financeiro_json),
        responsavel_cpf = VALUES(responsavel_cpf),
        responsavel_email = VALUES(responsavel_email),
        responsavel_whatsapp = VALUES(responsavel_whatsapp)
    `,
    [
      aluno.id,
      aluno.nome,
      aluno.email,
      aluno.telefone,
      aluno.dataNascimento,
      aluno.responsavel,
      aluno.telefoneResponsavel,
      aluno.modalidade,
      aluno.turma,
      aluno.plano,
      aluno.status,
      aluno.matriculaEm,
      aluno.numeroMatricula,
      aluno.cpf,
      aluno.rg,
      aluno.sexo,
      aluno.origemCadastro,
      aluno.matriculaPublicaProtocolo,
      stringifyJson(unidades),
      stringifyJson(turmas),
      stringifyJson(planos),
      stringifyJson(horarios),
      stringifyJson(matricula),
      stringifyJson(aluno.financeiro),
      nullableText(matricula.responsavel.cpf, 20),
      nullableText(matricula.responsavel.email, 191),
      nullableText(matricula.responsavel.whatsapp, 50),
    ],
  );

  await upsertEnrollmentNumberRegistry(connection, {
    numeroMatricula: aluno.numeroMatricula,
    alunoId: aluno.id,
    alunoNome: aluno.nome,
    status: aluno.status,
  });
}

async function getAlunos(req, res, next) {
  try {
    const { rows, source } = await loadStudentRows();
    const list = Array.isArray(rows) ? rows : [];
    console.log(`[alunos] ${list.length} registro(s) carregado(s) de ${source}.`);

    if (!req.auth || canManageSystem(req.auth)) {
      return res.json(list);
    }

    if (req.auth.role === "professor") {
      return res.json(getProfessorScopedStudents(list, req.auth));
    }

    const studentId = resolveScopedStudentId(req.auth);
    if (!studentId) {
      return res.status(403).json({ message: "Seu perfil nao possui um aluno vinculado." });
    }

    return res.json(list.filter((row) => String(row.id) === String(studentId)));
  } catch (error) {
    next(error);
  }
}

async function createAluno(req, res, next) {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem cadastrar alunos." });
    }

    const aluno = normalizeAlunoPayload(req.body);

    await transaction(async (connection) => {
      await persistAluno(connection, aluno);
    });

    console.log(`[alunos] Aluno criado com sucesso: ${aluno.id}.`);
    res.status(201).json(aluno);
  } catch (error) {
    next(error);
  }
}

async function updateAluno(req, res, next) {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem editar alunos." });
    }

    const aluno = normalizeAlunoPayload(req.body, req.params.id);

    await transaction(async (connection) => {
      await persistAluno(connection, aluno);
    });

    console.log(`[alunos] Aluno atualizado com sucesso: ${aluno.id}.`);
    res.json(aluno);
  } catch (error) {
    next(error);
  }
}

async function deleteAluno(req, res, next) {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem excluir alunos." });
    }

    const alunoId = sanitizeString(req.params.id, 64);

    await transaction(async (connection) => {
      const [currentRows] = await connection.execute(
        "SELECT numero_matricula, nome_completo FROM j12_alunos WHERE id = ? LIMIT 1",
        [alunoId],
      );

      await connection.execute("DELETE FROM j12_alunos_estrategico WHERE aluno_id = ?", [alunoId]);
      await connection.execute("DELETE FROM j12_alunos_saude WHERE aluno_id = ?", [alunoId]);
      await connection.execute("DELETE FROM j12_alunos_esportes WHERE aluno_id = ?", [alunoId]);
      await connection.execute("DELETE FROM j12_alunos_documentos WHERE aluno_id = ?", [alunoId]);
      await connection.execute("DELETE FROM j12_alunos_enderecos WHERE aluno_id = ?", [alunoId]);
      await connection.execute("DELETE FROM j12_alunos_responsaveis WHERE aluno_id = ?", [alunoId]);
      await connection.execute("DELETE FROM j12_alunos WHERE id = ?", [alunoId]);
      await connection.execute("DELETE FROM alunos WHERE id = ?", [alunoId]);

      if (Array.isArray(currentRows) && currentRows.length > 0) {
        await upsertEnrollmentNumberRegistry(connection, {
          numeroMatricula: currentRows[0].numero_matricula,
          alunoId: null,
          alunoNome: currentRows[0].nome_completo,
          status: "excluido",
        });
      }
    });

    console.log(`[alunos] Aluno removido com sucesso: ${alunoId}.`);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAlunos,
  createAluno,
  updateAluno,
  deleteAluno,
  persistAluno,
};
