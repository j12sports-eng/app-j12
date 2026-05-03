import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { contratosStore, type Contrato } from "@/lib/contratos-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contrato: Contrato | null;
  /** Quem está assinando: responsável (CONTRATANTE) ou J12 (CONTRATADA). */
  parte?: "responsavel" | "j12";
}

export function AssinaturaDialog({ open, onOpenChange, contrato, parte = "responsavel" }: Props) {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [aceite, setAceite] = useState(false);

  useEffect(() => {
    if (open && contrato) {
      if (parte === "j12") {
        setNome("J12 Sports Ltda — Direção");
        setCpf("28.665.452/0001-01");
      } else {
        setNome(contrato.responsavel.nome);
        setCpf(contrato.responsavel.cpf);
      }
      setAceite(false);
    }
  }, [open, contrato, parte]);

  if (!contrato) return null;

  function assinar() {
    if (!nome.trim() || !cpf.trim()) {
      toast.error("Preencha nome e documento para assinar");
      return;
    }
    if (!aceite) {
      toast.error("Você precisa aceitar os termos do contrato");
      return;
    }
    const { contrato: atualizado, parcelasGeradas } = contratosStore.assinar(
      contrato!.id,
      { nome, cpf },
      parte,
    );
    if (parcelasGeradas > 0) {
      toast.success(`Contrato ativado! ${parcelasGeradas} parcelas geradas no Financeiro.`);
    } else if (atualizado?.status === "aguardando_assinatura") {
      toast.success(
        parte === "j12"
          ? "J12 assinou. Aguardando assinatura do responsável."
          : "Responsável assinou. Aguardando assinatura da J12.",
      );
    } else {
      toast.success("Contrato assinado eletronicamente!");
    }
    onOpenChange(false);
  }

  const isJ12 = parte === "j12";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Assinatura eletrônica —{" "}
            {isJ12 ? "J12 Sports (Contratada)" : "Responsável (Contratante)"}
          </DialogTitle>
          <DialogDescription>
            Aceite com validade jurídica nos termos da MP nº 2.200-2/2001.
            {isJ12
              ? " Ao assinar como J12, o contrato será concluído se o responsável já tiver assinado."
              : " Ao assinar como responsável, o contrato será concluído se a J12 já tiver assinado."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{isJ12 ? "Nome do representante J12" : "Nome completo do signatário"}</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>{isJ12 ? "CNPJ" : "CPF"}</Label>
            <Input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder={isJ12 ? "00.000.000/0000-00" : "000.000.000-00"}
            />
          </div>
          <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
            <Checkbox
              checked={aceite}
              onCheckedChange={(v) => setAceite(v === true)}
              className="mt-0.5"
            />
            <span>
              Li e aceito integralmente os termos do contrato de matrícula da J12 Sports. Reconheço
              que este aceite digital tem validade jurídica e caráter irrevogável.
            </span>
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={assinar} disabled={!aceite}>
            Assinar contrato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
