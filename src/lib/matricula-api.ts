import type { AlunoMatriculaData } from "./aluno-matricula";
import { mysqlApi } from "./mysql-api";

export type EnrollmentNumberResponse = {
  numeroMatricula: string;
  strategy: "reused" | "sequential";
  reusedFrom: "inativo" | "excluido" | null;
};

export type CepLookupResponse = {
  cep: string;
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
};

export type PublicEnrollmentResponse = {
  ok: boolean;
  protocol: string;
  status: string;
  createdAt: string;
  numeroMatricula: string;
};

export async function getNextEnrollmentNumber() {
  console.log("[matricula-api] Buscando proximo numero de matricula.");
  return mysqlApi.get<EnrollmentNumberResponse>("/public/enrollments/next-number");
}

export async function lookupCepAddress(cep: string) {
  console.log("[matricula-api] Consultando CEP.", cep);
  return mysqlApi.get<CepLookupResponse>(`/public/address/lookup?cep=${encodeURIComponent(cep)}`);
}

export async function createPublicEnrollment(
  payload: AlunoMatriculaData & { submittedAt: string },
) {
  console.log("[matricula-api] Enviando matricula publica.", payload.dadosAluno.numeroMatricula);
  return mysqlApi.post<PublicEnrollmentResponse>("/public/enrollments", payload);
}
