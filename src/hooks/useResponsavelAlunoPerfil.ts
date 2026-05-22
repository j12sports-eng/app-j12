import { useCallback, useEffect, useState } from "react";

import { api, formatApiErrorMessage } from "@/lib/api";

export type PerfilDocumento = {
  id: string;
  titulo: string;
  nome: string;
  tipo: string;
  tamanho: number;
  uploadedAt: string | null;
  expiresAt: string | null;
  status: string;
  url?: string | null;
  dataUrl?: string | null;
  canUpload?: boolean;
};

export type PerfilAlunoCompleto = {
  aluno: {
    id: string;
    nome: string;
    fotoUrl?: string | null;
    idade?: string;
    dataNascimento?: string;
    modalidade?: string;
    categoria?: string;
    turma?: string;
    professor?: string;
    unidade?: string;
    statusMatricula?: string;
    numeroMatricula?: string;
    plano?: string;
    horarios?: string[];
    cpf?: string;
    rg?: string;
    sexo?: string;
    telefone?: string;
    email?: string;
    escola?: string;
    serieEscolar?: string;
    endereco?: {
      cep?: string;
      rua?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
    };
    responsavel?: {
      nome?: string;
      cpf?: string;
      rg?: string;
      whatsapp?: string;
      email?: string;
      parentesco?: string;
    };
    saude?: {
      alergias?: string;
      restricoesMedicas?: string;
      medicamentos?: string;
      contatoEmergencia?: string;
      planoSaude?: string;
      lesoes?: string;
      observacoes?: string;
    };
  };
  financeiro: {
    mensalidade: number;
    vencimento: string | null;
    statusPagamento: string;
    totalAberto: number;
    totalPago: number;
    pendentes: number;
    ultimasCobrancas: Array<Record<string, any>>;
    historico: Array<Record<string, any>>;
  };
  frequencia: {
    percentual: number;
    presentes: number;
    faltas: number;
    total: number;
    ultimasPresencas: Array<Record<string, any>>;
    graficoMensal: Array<{
      mes: string;
      presentes: number;
      faltas: number;
      total: number;
      percentual: number;
    }>;
  };
  avaliacoes: Array<{
    id: string;
    titulo: string;
    descricao: string;
    tipo: string;
  }>;
  documentos: PerfilDocumento[];
  contratos: Array<Record<string, any>>;
  mensagens: Array<Record<string, any>>;
  proximasAulas: Array<Record<string, any>>;
  updatedAt?: string;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error ?? new Error("Erro ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

export function useResponsavelAlunoPerfil(alunoId: string | undefined) {
  const [perfil, setPerfil] = useState<PerfilAlunoCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [uploadingDocumentId, setUploadingDocumentId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!alunoId) {
      setPerfil(null);
      setErro("Aluno nao informado.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErro("");

      const response = await api.get<PerfilAlunoCompleto>(
        `/responsavel/alunos/${encodeURIComponent(alunoId)}/perfil`,
      );
      setPerfil(response);
    } catch (error) {
      setPerfil(null);
      setErro(formatApiErrorMessage(error, "Erro ao carregar perfil do aluno."));
    } finally {
      setLoading(false);
    }
  }, [alunoId]);

  const uploadDocument = useCallback(
    async (documentId: string, file: File) => {
      if (!alunoId) return false;

      if (file.size > 4 * 1024 * 1024) {
        setErro("Documento acima do limite de 4MB.");
        return false;
      }

      try {
        setUploadingDocumentId(documentId);
        setErro("");

        const dataUrl = await readFileAsDataUrl(file);
        const response = await api.put<PerfilAlunoCompleto>(
          `/responsavel/alunos/${encodeURIComponent(alunoId)}/documentos/${encodeURIComponent(
            documentId,
          )}`,
          {
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl,
          },
        );

        setPerfil(response);
        return true;
      } catch (error) {
        setErro(formatApiErrorMessage(error, "Erro ao enviar documento."));
        return false;
      } finally {
        setUploadingDocumentId(null);
      }
    },
    [alunoId],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return {
    perfil,
    loading,
    erro,
    uploadingDocumentId,
    carregar,
    uploadDocument,
  };
}
