const ENROLLMENT_PLAN_STEPS = Object.freeze([
  "createResponsiblePerson",
  "createResponsibleProfile",
  "createStudentPerson",
  "createStudentProfile",
  "createRelationship",
  "createEnrollment",
  "generateContract",
  "generateFinancialPlan",
  "assignClass",
  "activateStudent",
]);

const ENROLLMENT_REQUIRED_FIELDS = Object.freeze([
  "aluno.nome",
  "aluno.dataNascimento",
  "aluno.sexo",
  "responsaveis",
  "responsaveis[].nome",
  "responsaveis[].relacionamento.tipo",
  "matricula.dataMatricula",
  "matricula.statusInicial",
]);

const ENROLLMENT_RELATIONSHIP_FLAGS = Object.freeze([
  "responsavelLegal",
  "financeiro",
  "financeiroPrincipal",
  "recebeComunicados",
  "podeBuscar",
  "emergencia",
  "emergenciaPrincipal",
]);

/**
 * Contract-only description for the future enrollment application boundary.
 *
 * This file defines payload expectations, response expectations and required
 * validation topics. It intentionally does not execute validation or persistence.
 */
const EnrollmentContract = Object.freeze({
  name: "EnrollmentContract",
  request: Object.freeze({
    aluno: "object",
    matricula: "object",
    metadata: "object?",
    responsaveis: "array<object>",
  }),
  response: Object.freeze({
    errors: "array",
    executable: "boolean",
    requiredProfiles: "object",
    steps: "array<string>",
    valid: "boolean",
    warnings: "array",
  }),
  requiredFields: ENROLLMENT_REQUIRED_FIELDS,
  relationshipFlags: ENROLLMENT_RELATIONSHIP_FLAGS,
  planSteps: ENROLLMENT_PLAN_STEPS,
});

module.exports = {
  ENROLLMENT_PLAN_STEPS,
  ENROLLMENT_RELATIONSHIP_FLAGS,
  ENROLLMENT_REQUIRED_FIELDS,
  EnrollmentContract,
};
