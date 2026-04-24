import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Contrato } from "@/lib/contratos-store";
import { STATUS_LABEL } from "@/lib/contratos-store";
import { baixarContratoPDF } from "@/lib/contratos-pdf";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contrato: Contrato | null;
}

export function ContratoVisualizarDialog({ open, onOpenChange, contrato }: Props) {
  if (!contrato) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Contrato — {contrato.alunoNome}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline">{STATUS_LABEL[contrato.status]}</Badge>
          <span className="text-muted-foreground">
            Vigência: {contrato.dataInicio} → {contrato.dataFim}
          </span>
        </div>
        <pre className="mt-3 whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed">
          {contrato.conteudo}
        </pre>
        {contrato.assinatura && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs">
            <div className="font-semibold text-primary">✓ Assinatura do Responsável (Contratante)</div>
            <div className="mt-1 text-muted-foreground">
              {contrato.assinatura.nome} (CPF {contrato.assinatura.cpf}) —{" "}
              {new Date(contrato.assinatura.assinadoEm).toLocaleString("pt-BR")} — IP{" "}
              {contrato.assinatura.ip}
            </div>
          </div>
        )}
        {contrato.assinaturaJ12 && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs">
            <div className="font-semibold text-primary">✓ Assinatura da J12 Sports (Contratada)</div>
            <div className="mt-1 text-muted-foreground">
              {contrato.assinaturaJ12.nome} (CNPJ {contrato.assinaturaJ12.cpf}) —{" "}
              {new Date(contrato.assinaturaJ12.assinadoEm).toLocaleString("pt-BR")} — IP{" "}
              {contrato.assinaturaJ12.ip}
            </div>
          </div>
        )}
        {contrato.transacoesGeradas.length > 0 && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
            <span className="font-semibold">Financeiro:</span>{" "}
            <span className="text-muted-foreground">
              {contrato.transacoesGeradas.length} parcelas geradas automaticamente.
            </span>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={() => baixarContratoPDF(contrato)}>
            <Download className="mr-2 h-4 w-4" /> Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}