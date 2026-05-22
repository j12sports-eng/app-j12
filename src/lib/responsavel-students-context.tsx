import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, formatApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const FAMILY_SELECTION = "__familia__";

export type ResponsavelAluno = {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  modalidade?: string;
  turma?: string;
  plano?: string;
  unidade?: string;
  professor?: string;
  categoria?: string;
  numeroMatricula?: string;
  status?: string;
};

type ResponsavelStudentsContextValue = {
  alunos: ResponsavelAluno[];
  loading: boolean;
  erro: string;
  selectedStudentId: string | null;
  selectedStudent: ResponsavelAluno | null;
  isFamilyView: boolean;
  selectStudent: (studentId: string | null) => void;
  reload: () => Promise<void>;
};

const ResponsavelStudentsContext = createContext<ResponsavelStudentsContextValue | null>(null);

function normalizeStudent(value: Partial<ResponsavelAluno>): ResponsavelAluno | null {
  const id = String(value.id ?? "").trim();
  if (!id) return null;

  return {
    id,
    nome: String(value.nome ?? "Aluno").trim() || "Aluno",
    email: String(value.email ?? "").trim(),
    telefone: String(value.telefone ?? "").trim(),
    modalidade: String(value.modalidade ?? "").trim(),
    turma: String(value.turma ?? "").trim(),
    plano: String(value.plano ?? "").trim(),
    unidade: String(value.unidade ?? "").trim(),
    professor: String(value.professor ?? "").trim(),
    categoria: String(value.categoria ?? "").trim(),
    numeroMatricula: String(value.numeroMatricula ?? "").trim(),
    status: String(value.status ?? "ativo").trim(),
  };
}

function storageKey(userId: string | null | undefined) {
  return `j12:responsavel:selected-student:${userId || "anon"}`;
}

function readStoredSelection(userId: string | null | undefined) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKey(userId));
}

function writeStoredSelection(userId: string | null | undefined, studentId: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), studentId ?? FAMILY_SELECTION);
}

function resolveInitialSelection(
  students: ResponsavelAluno[],
  userId: string | null | undefined,
  currentSelection: string | null,
) {
  if (students.length === 0) return null;
  if (students.length === 1) return students[0].id;

  const stored = currentSelection ?? readStoredSelection(userId);
  if (stored === FAMILY_SELECTION) return null;
  if (stored && students.some((student) => student.id === stored)) return stored;

  return null;
}

export function ResponsavelStudentsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [alunos, setAlunos] = useState<ResponsavelAluno[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const isResponsavel = isAuthenticated && user?.role === "responsavel";

  const reload = useCallback(async () => {
    if (!isResponsavel) {
      setAlunos([]);
      setSelectedStudentId(null);
      setErro("");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErro("");

      const response = await api.get<ResponsavelAluno[]>("/responsavel/alunos");
      const normalized = (Array.isArray(response) ? response : [])
        .map(normalizeStudent)
        .filter((student): student is ResponsavelAluno => Boolean(student));

      setAlunos(normalized);
      setSelectedStudentId((current) => {
        const next = resolveInitialSelection(normalized, user?.id, current);
        writeStoredSelection(user?.id, next);
        return next;
      });
    } catch (error) {
      setAlunos([]);
      setSelectedStudentId(null);
      setErro(formatApiErrorMessage(error, "Erro ao carregar alunos vinculados."));
    } finally {
      setLoading(false);
    }
  }, [isResponsavel, user?.id]);

  useEffect(() => {
    if (authLoading) return;
    void reload();
  }, [authLoading, reload]);

  const selectStudent = useCallback(
    (studentId: string | null) => {
      const nextStudentId =
        studentId && alunos.some((student) => student.id === studentId) ? studentId : null;

      setSelectedStudentId(nextStudentId);
      writeStoredSelection(user?.id, nextStudentId);
    },
    [alunos, user?.id],
  );

  const selectedStudent = useMemo(
    () => alunos.find((student) => student.id === selectedStudentId) ?? null,
    [alunos, selectedStudentId],
  );

  const value = useMemo(
    () => ({
      alunos,
      loading,
      erro,
      selectedStudentId,
      selectedStudent,
      isFamilyView: alunos.length > 1 && selectedStudentId === null,
      selectStudent,
      reload,
    }),
    [
      alunos,
      loading,
      erro,
      selectedStudentId,
      selectedStudent,
      selectStudent,
      reload,
    ],
  );

  return (
    <ResponsavelStudentsContext.Provider value={value}>
      {children}
    </ResponsavelStudentsContext.Provider>
  );
}

export function useResponsavelStudents() {
  const context = useContext(ResponsavelStudentsContext);

  if (!context) {
    throw new Error("useResponsavelStudents precisa estar dentro do ResponsavelStudentsProvider");
  }

  return context;
}
