const { APPROVAL_STEP_TYPE } = require("./approval.types.js");

const APPROVAL_STEP_KEYS = Object.freeze({
  ATIVAR_MATRICULA: "ativar_matricula",
  CRIAR_PERFIL_ALUNO: "criar_perfil_aluno",
  CRIAR_PERFIL_RESPONSAVEL: "criar_perfil_responsavel",
  CRIAR_PESSOA_ALUNO: "criar_pessoa_aluno",
  CRIAR_PESSOA_RESPONSAVEL: "criar_pessoa_responsavel",
  CRIAR_RELACIONAMENTO: "criar_relacionamento",
  GERAR_CONTRATO: "gerar_contrato",
  GERAR_FINANCEIRO: "gerar_financeiro",
  VALIDAR_PRE_MATRICULA: "validar_pre_matricula",
});

/**
 * Ordered approval workflow steps.
 *
 * These definitions intentionally do not execute integrations. They only define
 * the target order, dependency chain and expected future outputs.
 *
 * @type {readonly import("./approval.types.js").ApprovalStepDefinition[]}
 */
const APPROVAL_STEPS = Object.freeze([
  Object.freeze({
    order: 1,
    key: APPROVAL_STEP_KEYS.VALIDAR_PRE_MATRICULA,
    type: APPROVAL_STEP_TYPE.VALIDAR_PRE_MATRICULA,
    label: "Validar Pre-Matricula",
    description: "Validar dados minimos do aluno, responsavel e status da pre-matricula.",
    dependencies: Object.freeze([]),
    futureOutputs: Object.freeze(["prematriculaValidada"]),
    implemented: false,
    integrationRequired: true,
  }),
  Object.freeze({
    order: 2,
    key: APPROVAL_STEP_KEYS.CRIAR_PESSOA_RESPONSAVEL,
    type: APPROVAL_STEP_TYPE.CRIAR_PESSOA_RESPONSAVEL,
    label: "Criar Pessoa do Responsavel",
    description: "Criar ou localizar a identidade Pessoa do responsavel.",
    dependencies: Object.freeze([APPROVAL_STEP_KEYS.VALIDAR_PRE_MATRICULA]),
    futureOutputs: Object.freeze(["pessoaResponsavelId"]),
    implemented: false,
    integrationRequired: true,
  }),
  Object.freeze({
    order: 3,
    key: APPROVAL_STEP_KEYS.CRIAR_PERFIL_RESPONSAVEL,
    type: APPROVAL_STEP_TYPE.CRIAR_PERFIL_RESPONSAVEL,
    label: "Criar Perfil Responsavel",
    description: "Criar o perfil de responsavel vinculado a Pessoa do responsavel.",
    dependencies: Object.freeze([APPROVAL_STEP_KEYS.CRIAR_PESSOA_RESPONSAVEL]),
    futureOutputs: Object.freeze(["responsavelProfileId"]),
    implemented: false,
    integrationRequired: true,
  }),
  Object.freeze({
    order: 4,
    key: APPROVAL_STEP_KEYS.CRIAR_PESSOA_ALUNO,
    type: APPROVAL_STEP_TYPE.CRIAR_PESSOA_ALUNO,
    label: "Criar Pessoa do Aluno",
    description: "Criar ou localizar a identidade Pessoa do aluno.",
    dependencies: Object.freeze([APPROVAL_STEP_KEYS.CRIAR_PERFIL_RESPONSAVEL]),
    futureOutputs: Object.freeze(["pessoaAlunoId"]),
    implemented: false,
    integrationRequired: true,
  }),
  Object.freeze({
    order: 5,
    key: APPROVAL_STEP_KEYS.CRIAR_PERFIL_ALUNO,
    type: APPROVAL_STEP_TYPE.CRIAR_PERFIL_ALUNO,
    label: "Criar Perfil Aluno",
    description: "Criar o perfil de aluno vinculado a Pessoa do aluno.",
    dependencies: Object.freeze([APPROVAL_STEP_KEYS.CRIAR_PESSOA_ALUNO]),
    futureOutputs: Object.freeze(["alunoProfileId"]),
    implemented: false,
    integrationRequired: true,
  }),
  Object.freeze({
    order: 6,
    key: APPROVAL_STEP_KEYS.CRIAR_RELACIONAMENTO,
    type: APPROVAL_STEP_TYPE.CRIAR_RELACIONAMENTO,
    label: "Criar Relacionamento",
    description: "Criar relacionamento entre perfil de aluno e perfil de responsavel.",
    dependencies: Object.freeze([
      APPROVAL_STEP_KEYS.CRIAR_PERFIL_RESPONSAVEL,
      APPROVAL_STEP_KEYS.CRIAR_PERFIL_ALUNO,
    ]),
    futureOutputs: Object.freeze(["alunoResponsavelRelacionamentoId"]),
    implemented: false,
    integrationRequired: true,
  }),
  Object.freeze({
    order: 7,
    key: APPROVAL_STEP_KEYS.GERAR_CONTRATO,
    type: APPROVAL_STEP_TYPE.GERAR_CONTRATO,
    label: "Gerar Contrato",
    description: "Gerar contrato inicial de matricula a partir da pre-matricula aprovada.",
    dependencies: Object.freeze([APPROVAL_STEP_KEYS.CRIAR_RELACIONAMENTO]),
    futureOutputs: Object.freeze(["contratoId"]),
    implemented: false,
    integrationRequired: true,
  }),
  Object.freeze({
    order: 8,
    key: APPROVAL_STEP_KEYS.GERAR_FINANCEIRO,
    type: APPROVAL_STEP_TYPE.GERAR_FINANCEIRO,
    label: "Gerar Financeiro",
    description: "Gerar configuracao financeira inicial e cobrancas quando aplicavel.",
    dependencies: Object.freeze([APPROVAL_STEP_KEYS.GERAR_CONTRATO]),
    futureOutputs: Object.freeze(["financeiroId", "cobrancaInicialId"]),
    implemented: false,
    integrationRequired: true,
  }),
  Object.freeze({
    order: 9,
    key: APPROVAL_STEP_KEYS.ATIVAR_MATRICULA,
    type: APPROVAL_STEP_TYPE.ATIVAR_MATRICULA,
    label: "Ativar Matricula",
    description: "Ativar a matricula apos criacao dos vinculos, contrato e financeiro.",
    dependencies: Object.freeze([APPROVAL_STEP_KEYS.GERAR_FINANCEIRO]),
    futureOutputs: Object.freeze(["matriculaAtivaId"]),
    implemented: false,
    integrationRequired: true,
  }),
]);

/**
 * Finds a workflow step definition by key.
 *
 * @param {string} key
 * @returns {import("./approval.types.js").ApprovalStepDefinition|undefined}
 */
function findApprovalStep(key) {
  return APPROVAL_STEPS.find((step) => step.key === key);
}

module.exports = {
  APPROVAL_STEP_KEYS,
  APPROVAL_STEPS,
  findApprovalStep,
};
