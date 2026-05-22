import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Contrato = {
  id: number;
  titulo: string;
  status: string;
  arquivoPdf: string;
  dataEmissao: string;
  dataAssinatura?: string;
  observacoes?: string;
};

export function useContratoAluno() {
  const [contrato, setContrato] = useState<Contrato | null>(null);

  const [loading, setLoading] = useState(true);

  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregar() {
      try {
        const response = await api.get<Contrato>("/aluno/me/contrato");

        setContrato(response);
      } catch (err) {
        console.error(err);

        setErro("Erro ao carregar contrato");
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, []);

  return {
    contrato,
    loading,
    erro,
  };
}
