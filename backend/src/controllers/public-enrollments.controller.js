const { randomUUID } = require("node:crypto");
const {
  allocateEnrollmentNumber,
  getNextEnrollmentNumberPreview,
  transaction,
  upsertEnrollmentNumberRegistry,
} = require("../config/db");
const { persistAluno } = require("./alunos.controller");
const {
  createId,
  sanitizeIsoDate,
  sanitizeString,
  stringifyJson,
} = require("../../routes/helpers");

function text(value, max = 65535) {
  return sanitizeString(value, max);
}

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
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

function buildProtocol() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `MAT-${datePart}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function toMysqlDateTime(value = new Date()) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function normalizeDocument(value) {
  if (!value || typeof value !== "object") return null;

  const name = text(value.name, 255);
  if (!name) return null;

  const size = Number(value.size ?? 0);

  return {
    name,
    size: Number.isFinite(size) ? size : 0,
    type: text(value.type, 191),
    uploadedAt: text(value.uploadedAt, 40) || undefined,
    expiresAt: text(value.expiresAt, 10) || null,
  };
}

function buildMatriculaFromPayload(payload) {
  return {
    dadosAluno: {
      numeroMatricula: text(payload?.dadosAluno?.numeroMatricula, 50),
      nomeCompleto: text(payload?.dadosAluno?.nomeCompleto, 191),
      dataNascimento: text(payload?.dadosAluno?.dataNascimento, 10),
      idade: text(payload?.dadosAluno?.idade, 10),
      cpf: text(payload?.dadosAluno?.cpf, 20),
      rg: text(payload?.dadosAluno?.rg, 30),
      sexo: text(payload?.dadosAluno?.sexo, 30),
      colegio: text(payload?.dadosAluno?.colegio, 191),
      periodoEscolar: text(payload?.dadosAluno?.periodoEscolar, 50),
    },
    responsavel: {
      nomeCompleto: text(payload?.responsavel?.nomeCompleto, 191),
      cpf: text(payload?.responsavel?.cpf, 20),
      rg: text(payload?.responsavel?.rg, 30),
      whatsapp: text(payload?.responsavel?.whatsapp, 50),
      email: text(payload?.responsavel?.email, 191),
      parentesco: text(payload?.responsavel?.parentesco, 100),
    },
    endereco: {
      cep: text(payload?.endereco?.cep, 20),
      rua: text(payload?.endereco?.rua, 191),
      numero: text(payload?.endereco?.numero, 30),
      complemento: text(payload?.endereco?.complemento, 191),
      bairro: text(payload?.endereco?.bairro, 191),
      cidade: text(payload?.endereco?.cidade, 191),
      estado: text(payload?.endereco?.estado, 50),
    },
    documentos: {
      fotoPerfilAluno: normalizeDocument(payload?.documentos?.fotoPerfilAluno),
      rgCpfAluno: normalizeDocument(payload?.documentos?.rgCpfAluno),
      rgCpfResponsavel: normalizeDocument(payload?.documentos?.rgCpfResponsavel),
      comprovanteEndereco: normalizeDocument(payload?.documentos?.comprovanteEndereco),
      atestadoMedico: normalizeDocument(payload?.documentos?.atestadoMedico),
    },
    esportivas: {
      modalidades: uniqueValues(payload?.esportivas?.modalidades),
      unidades: uniqueValues(payload?.esportivas?.unidades),
      horarios: uniqueValues(payload?.esportivas?.horarios),
      turmas: uniqueValues(payload?.esportivas?.turmas),
      nivel: text(payload?.esportivas?.nivel, 100),
      treinouAntes: text(payload?.esportivas?.treinouAntes, 100),
      caracteristica: text(payload?.esportivas?.caracteristica, 191),
      objetivo: text(payload?.esportivas?.objetivo, 191),
    },
    saude: {
      restricaoMedica: text(payload?.saude?.restricaoMedica, 191),
      medicamentos: text(payload?.saude?.medicamentos, 191),
      alergias: text(payload?.saude?.alergias, 191),
      lesoes: text(payload?.saude?.lesoes, 191),
      planoSaude: text(payload?.saude?.planoSaude, 191),
      observacoesImportantes: text(payload?.saude?.observacoesImportantes, 1000),
    },
    estrategicas: {
      comoConheceu: text(payload?.estrategicas?.comoConheceu, 191),
      indicacaoQuem: text(payload?.estrategicas?.indicacaoQuem, 191),
      observacoesGerais: text(payload?.estrategicas?.observacoesGerais, 1000),
    },
  };
}

function validatePublicEnrollment(matricula) {
  const requiredValues = [
    matricula?.dadosAluno?.nomeCompleto,
    matricula?.dadosAluno?.dataNascimento,
    matricula?.dadosAluno?.cpf,
    matricula?.dadosAluno?.rg,
    matricula?.dadosAluno?.sexo,
    matricula?.dadosAluno?.colegio,
    matricula?.dadosAluno?.periodoEscolar,
    matricula?.responsavel?.nomeCompleto,
    matricula?.responsavel?.cpf,
    matricula?.responsavel?.rg,
    matricula?.responsavel?.whatsapp,
    matricula?.responsavel?.email,
    matricula?.responsavel?.parentesco,
    matricula?.endereco?.cep,
    matricula?.endereco?.rua,
    matricula?.endereco?.numero,
    matricula?.endereco?.bairro,
    matricula?.endereco?.cidade,
    matricula?.endereco?.estado,
    matricula?.esportivas?.nivel,
    matricula?.esportivas?.treinouAntes,
    matricula?.esportivas?.caracteristica,
    matricula?.esportivas?.objetivo,
    matricula?.saude?.restricaoMedica,
    matricula?.saude?.medicamentos,
    matricula?.saude?.alergias,
    matricula?.saude?.lesoes,
    matricula?.saude?.planoSaude,
    matricula?.saude?.observacoesImportantes,
    matricula?.estrategicas?.comoConheceu,
    matricula?.estrategicas?.indicacaoQuem,
    matricula?.estrategicas?.observacoesGerais,
  ];

  if (requiredValues.some((value) => !String(value ?? "").trim())) {
    return "Preencha os dados obrigatorios da matricula.";
  }

  if (digitsOnly(matricula?.dadosAluno?.cpf).length !== 11) {
    return "Digite um CPF valido para o aluno.";
  }

  if (digitsOnly(matricula?.responsavel?.cpf).length !== 11) {
    return "Digite um CPF valido para o responsavel.";
  }

  if (digitsOnly(matricula?.endereco?.cep).length !== 8) {
    return "Digite um CEP valido com 8 numeros.";
  }

  if (digitsOnly(matricula?.responsavel?.whatsapp).length < 10) {
    return "Digite um WhatsApp valido com DDD.";
  }

  if (sanitizeIsoDate(matricula?.dadosAluno?.dataNascimento) === null) {
    return "Informe uma data de nascimento valida.";
  }

  if (matricula?.esportivas?.modalidades?.length === 0) {
    return "Selecione pelo menos uma modalidade.";
  }

  if (matricula?.esportivas?.unidades?.length === 0) {
    return "Selecione pelo menos uma unidade.";
  }

  if (
    matricula?.esportivas?.horarios?.length === 0 ||
    matricula?.esportivas?.turmas?.length === 0
  ) {
    return "Selecione pelo menos um horario disponivel.";
  }

  return null;
}

function buildAlunoFromPublicEnrollment(matricula, protocol, enrollmentNumber, submittedAt) {
  const createdAt = sanitizeIsoDate(submittedAt) || new Date().toISOString().slice(0, 10);
  const modalidades = uniqueValues(matricula.esportivas.modalidades);
  const unidades = uniqueValues(matricula.esportivas.unidades);
  const horarios = uniqueValues(matricula.esportivas.horarios);
  const turmas = uniqueValues(matricula.esportivas.turmas);

  return {
    id: createId("a"),
    nome: matricula.dadosAluno.nomeCompleto,
    email: matricula.responsavel.email,
    telefone: matricula.responsavel.whatsapp,
    dataNascimento: sanitizeIsoDate(matricula.dadosAluno.dataNascimento),
    responsavel: matricula.responsavel.nomeCompleto,
    telefoneResponsavel: matricula.responsavel.whatsapp,
    modalidade: modalidades[0] || "",
    unidades,
    turmas,
    planos: [],
    horarios,
    turma: turmas[0] || "",
    plano: "",
    status: "experimental",
    matriculaEm: createdAt,
    numeroMatricula: enrollmentNumber,
    cpf: matricula.dadosAluno.cpf,
    rg: matricula.dadosAluno.rg,
    sexo: matricula.dadosAluno.sexo,
    matricula: {
      ...matricula,
      dadosAluno: {
        ...matricula.dadosAluno,
        numeroMatricula: enrollmentNumber,
      },
    },
    financeiro: null,
    origemCadastro: "Matricula publica",
    matriculaPublicaProtocolo: protocol,
  };
}

function normalizeCep(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .trim();
}

async function fetchCepAddress(cep) {
  const normalizedCep = normalizeCep(cep);

  if (normalizedCep.length !== 8) {
    const error = new Error("Informe um CEP valido com 8 numeros.");
    error.statusCode = 400;
    throw error;
  }

  let response;

  try {
    response = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    const error = new Error("Nao foi possivel consultar o CEP no momento.");
    error.statusCode = 502;
    throw error;
  }

  if (!response.ok) {
    const error = new Error("Nao foi possivel consultar o CEP no momento.");
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();

  if (data?.erro) {
    const error = new Error("CEP nao encontrado. Confira os numeros e tente novamente.");
    error.statusCode = 404;
    throw error;
  }

  return {
    cep: normalizedCep,
    rua: text(data?.logradouro, 191),
    bairro: text(data?.bairro, 191),
    cidade: text(data?.localidade, 191),
    estado: text(data?.uf, 50).toUpperCase(),
  };
}

async function getNextEnrollmentNumber(_req, res, next) {
  try {
    const result = await getNextEnrollmentNumberPreview();
    console.log(`[matricula-publica] Proxima matricula sugerida: ${result.numeroMatricula}.`);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function createPublicEnrollment(req, res, next) {
  try {
    const matricula = buildMatriculaFromPayload(req.body);
    const validationMessage = validatePublicEnrollment(matricula);

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const protocol = buildProtocol();
    const submittedAt =
      sanitizeIsoDate(req.body?.submittedAt) || new Date().toISOString().slice(0, 10);
    const createdAt = toMysqlDateTime();
    let createdEnrollment;

    await transaction(async (connection) => {
      const reservation = await allocateEnrollmentNumber(connection);
      const aluno = buildAlunoFromPublicEnrollment(
        matricula,
        protocol,
        reservation.numeroMatricula,
        submittedAt,
      );

      await persistAluno(connection, aluno);
      await upsertEnrollmentNumberRegistry(connection, {
        numeroMatricula: reservation.numeroMatricula,
        alunoId: aluno.id,
        alunoNome: aluno.nome,
        status: aluno.status,
      });

      await connection.execute(
        `
          INSERT INTO j12_matriculas_publicas (
            id,
            protocolo,
            numero_matricula,
            aluno_id,
            nome_aluno,
            nome_responsavel,
            email_responsavel,
            status,
            payload_json,
            created_at,
            synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          createId("mp"),
          protocol,
          reservation.numeroMatricula,
          aluno.id,
          aluno.nome,
          aluno.responsavel,
          aluno.email,
          "recebida",
          stringifyJson({
            ...matricula,
            dadosAluno: {
              ...matricula.dadosAluno,
              numeroMatricula: reservation.numeroMatricula,
            },
            submittedAt: req.body?.submittedAt ?? new Date().toISOString(),
          }),
          createdAt,
          createdAt,
        ],
      );

      createdEnrollment = {
        protocol,
        status: "recebida",
        createdAt,
        numeroMatricula: reservation.numeroMatricula,
      };
    });

    console.log(
      `[matricula-publica] Matricula ${createdEnrollment.numeroMatricula} registrada sob protocolo ${protocol}.`,
    );

    return res.status(201).json({
      ok: true,
      ...createdEnrollment,
    });
  } catch (error) {
    next(error);
  }
}

async function lookupAddress(req, res, next) {
  try {
    const address = await fetchCepAddress(req.query?.cep);
    res.json(address);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getNextEnrollmentNumber,
  createPublicEnrollment,
  lookupAddress,
};
