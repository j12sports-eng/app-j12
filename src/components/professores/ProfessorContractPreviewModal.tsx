import { Download, FileCheck2, FileText, PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Professor } from "@/lib/professores-store";
import { contratoProfessorBadgeClass, downloadProfessorContract } from "@/lib/professores-store";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  professor: Professor | null;
  onOpenSignature: (professor: Professor) => void;
}

export function ProfessorContractPreviewModal({
  open,
  onOpenChange,
  professor,
  onOpenSignature,
}: Props) {
  if (!professor || professor.contrato.status === "Não gerado") return null;

  const contrato = professor.contrato;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-primary/20 bg-[#070b14] text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-primary" />
            {contrato.templateTitulo} • {professor.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge className={contratoProfessorBadgeClass(contrato.status)}>{contrato.status}</Badge>
          <span className="text-slate-400">#{contrato.numeroContrato}</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">Gerado em {contrato.dataGeracao}</span>
          {contrato.dataAssinatura && (
            <>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Assinado em {contrato.dataAssinatura}</span>
            </>
          )}
        </div>

        <div className="rounded-3xl border border-primary/20 bg-white p-6 text-slate-900 shadow-[0_0_40px_rgba(255,106,0,0.08)]">
          <div
            className="prose prose-slate max-w-none prose-h1:text-3xl prose-h1:font-semibold prose-h2:text-lg prose-h2:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-li:text-slate-700"
            dangerouslySetInnerHTML={{ __html: contrato.conteudoHtml }}
          />

          {contrato.assinatura && (
            <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 font-semibold text-emerald-700">
                <FileCheck2 className="h-4 w-4" />
                Assinatura registrada
              </div>
              <div className="mt-2 text-slate-700">
                {contrato.assinatura.nomeAssinante} • CPF {contrato.assinatura.cpfAssinante}
              </div>
              <div className="text-slate-500">
                {contrato.assinatura.dataAssinatura} • {contrato.assinatura.formaAssinatura}
                {contrato.assinatura.ipAssinatura
                  ? ` • IP ${contrato.assinatura.ipAssinatura}`
                  : ""}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {contrato.status === "Pendente de assinatura" && (
            <Button
              onClick={() => onOpenSignature(professor)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <PenSquare className="mr-2 h-4 w-4" />
              Assinar contrato
            </Button>
          )}
          <Button
            onClick={() => downloadProfessorContract(professor)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="mr-2 h-4 w-4" />
            Baixar contrato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
