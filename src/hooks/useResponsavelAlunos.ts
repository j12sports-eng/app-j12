import { useResponsavelStudents } from "@/lib/responsavel-students-context";

export function useResponsavelAlunos() {
  const {
    alunos,
    loading,
    erro,
    selectedStudentId,
    selectedStudent,
    isFamilyView,
    selectStudent,
    reload,
  } = useResponsavelStudents();

  return {
    alunos,
    loading,
    erro,
    selectedStudentId,
    selectedStudent,
    isFamilyView,
    selectStudent,
    reload,
  };
}

