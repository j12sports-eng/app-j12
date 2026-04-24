import type { Aluno } from "./alunos-store";
import { mysqlApi } from "./mysql-api";

export async function getAlunos(): Promise<Aluno[]> {
  console.log("[alunos-api] Buscando alunos no MySQL...");
  const alunos = await mysqlApi.get<Aluno[]>("/alunos");
  console.log(`[alunos-api] ${alunos.length} aluno(s) carregado(s).`);
  return alunos;
}

export async function createAluno(aluno: Aluno): Promise<Aluno> {
  console.log("[alunos-api] Criando aluno.", { id: aluno.id, nome: aluno.nome });
  return mysqlApi.post<Aluno>("/alunos", aluno);
}

export async function updateAluno(aluno: Aluno): Promise<Aluno> {
  console.log("[alunos-api] Atualizando aluno.", { id: aluno.id, nome: aluno.nome });
  return mysqlApi.put<Aluno>(`/alunos/${aluno.id}`, aluno);
}

export async function deleteAluno(id: string): Promise<void> {
  console.log("[alunos-api] Removendo aluno.", { id });
  await mysqlApi.del(`/alunos/${id}`);
}
