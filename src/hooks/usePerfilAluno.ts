import { useEffect, useState } from "react";

import { api } from "@/lib/api";

type PerfilAluno = {
  id: string;
  nome_completo: string;
  email_contato: string;
  telefone_contato?: string;
  modalidade_principal?: string;
  status?: string;
};

export function usePerfilAluno() {
  const [perfil, setPerfil] = useState<PerfilAluno | null>(null);

  const [loading, setLoading] = useState(true);

  const [erro, setErro] = useState("");

  async function carregarPerfil() {
    try {
      setLoading(true);
      setErro("");

      const response = await api.get<PerfilAluno>("/aluno/me/perfil");

      setPerfil(response);
    } catch (err: any) {
      console.error("ERRO PERFIL:", err);

      setErro(err?.message || "Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  }

  async function salvarPerfil(payload: { telefone_contato: string; email_contato: string }) {
    try {
      await api.put("/aluno/me/perfil", payload);

      await carregarPerfil();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  useEffect(() => {
    carregarPerfil();
  }, []);

  return {
    perfil,
    loading,
    erro,
    salvarPerfil,
    recarregar: carregarPerfil,
  };
}
