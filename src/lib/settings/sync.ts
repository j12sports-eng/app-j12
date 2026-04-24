import {
  professoresStore,
  professorCanHandleClass,
  type Professor,
  type ProfessorInput,
} from "@/lib/professores-store";
import { turmasStore } from "@/lib/turmas-store";

export function toProfessorInput(professor: Professor): ProfessorInput {
  return {
    nome: professor.nome,
    email: professor.email,
    telefone: professor.telefone,
    cpf: professor.cpf,
    cref: professor.cref,
    modalidades: professor.modalidades,
    unidades: professor.unidades,
    status: professor.status,
    turmas: professor.turmas,
    jornadaProfessor: professor.jornadaProfessor,
    tipoContrato: professor.tipoContrato,
    valorContrato: professor.valorContrato,
    formaPagamentoProfessor: professor.formaPagamentoProfessor,
    dataInicioContrato: professor.dataInicioContrato,
    observacoesContrato: professor.observacoesContrato,
  };
}

export function syncProfessorTurmaNames() {
  const turmas = turmasStore.getSnapshot();
  const professores = professoresStore.getSnapshot();

  professores.forEach((professor) => {
    const turmaNames = turmas
      .filter((turma) => turma.professorId === professor.id)
      .map((turma) => turma.nome);

    professoresStore.update(professor.id, {
      ...toProfessorInput(professor),
      turmas: turmaNames,
    });
  });
}

export function assignTeacherToTurmas(teacherId: string, teacherName: string, classIds: string[]) {
  const turmas = turmasStore.getSnapshot();
  const professor = professoresStore.getById(teacherId);
  const invalidClassIds: string[] = [];

  turmas.forEach((turma) => {
    if (classIds.includes(turma.id)) {
      if (professor && !professorCanHandleClass(professor, turma)) {
        invalidClassIds.push(turma.id);
        return;
      }

      turmasStore.update(turma.id, {
        professorId: teacherId,
        professor: teacherName,
      });
      return;
    }

    if (turma.professorId === teacherId) {
      turmasStore.update(turma.id, {
        professorId: null,
        professor: "A definir",
      });
    }
  });

  syncProfessorTurmaNames();

  return {
    invalidClassIds,
  };
}
