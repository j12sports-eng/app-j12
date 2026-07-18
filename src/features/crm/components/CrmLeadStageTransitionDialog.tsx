import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { formatApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useMoveCrmLeadStage } from "../hooks/use-crm-leads";
import type { CrmLeadDetail } from "../types/crm-lead.types";
import type { CrmPipeline } from "../types/crm-pipeline.types";

export function CrmLeadStageTransitionDialog({
  lead,
  pipeline,
  open,
  onOpenChange,
}: {
  lead: CrmLeadDetail;
  pipeline: CrmPipeline;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useMoveCrmLeadStage();
  const [nextStage, setNextStage] = useState("");
  const [reason, setReason] = useState("");
  const current = pipeline.stages.find((stage) => stage.id === lead.stage);
  const options = useMemo(() => current?.transitions || [], [current]);
  const target = options.find((stage) => stage === nextStage);
  useEffect(() => {
    if (open) {
      setNextStage(options[0] || "");
      setReason("");
      mutation.reset();
    }
  }, [open, lead.id, lead.stage, options]);
  async function submit() {
    if (!target || mutation.isPending) return;
    if (target === "LOST" && !reason.trim()) return;
    try {
      await mutation.mutateAsync({
        leadId: lead.id,
        input: {
          nextStage: target as never,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          expectedStage: lead.stage,
          expectedStatus: lead.status,
        },
      });
      toast.success("Estágio atualizado.");
      onOpenChange(false);
    } catch (error) {
      // Keep the dialog and reason open so the operator can recover from conflicts.
      void error;
    }
  }
  const error = mutation.error ? stageError(mutation.error) : null;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) onOpenChange(value);
      }}
    >
      <DialogContent className="border-white/10 bg-card">
        <DialogHeader>
          <DialogTitle className="text-white">Alterar estágio</DialogTitle>
          <DialogDescription>
            Lead {lead.id} · estado atual {lead.stage}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="crm-next-stage">Próximo estágio</Label>
            <select
              id="crm-next-stage"
              className="j12-field h-10 w-full px-3"
              value={nextStage}
              onChange={(event) => setNextStage(event.target.value)}
            >
              <option value="">Selecione</option>
              {options.map((id) => (
                <option key={id} value={id}>
                  {pipeline.stages.find((stage) => stage.id === id)?.label || id}
                </option>
              ))}
            </select>
          </div>
          {target === "LOST" ? (
            <div className="space-y-2">
              <Label htmlFor="crm-lost-reason">Motivo da perda *</Label>
              <Input
                id="crm-lost-reason"
                value={reason}
                maxLength={191}
                onChange={(event) => setReason(event.target.value)}
                autoFocus
              />
            </div>
          ) : null}
          {target ? (
            <p className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-slate-200">
              Confirme a mudança para <strong>{target}</strong>. Esta ação não converte
              automaticamente o Lead.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-red-200">
              {error}
            </p>
          ) : null}
          <p aria-live="polite" className="sr-only">
            {mutation.isPending ? "Atualizando estágio" : ""}
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!target || (target === "LOST" && !reason.trim()) || mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function stageError(error: unknown) {
  const code = (error as { data?: { code?: string } })?.data?.code;
  const messages: Record<string, string> = {
    CRM_STAGE_TRANSITION_INVALID: "Esta mudança de etapa não é permitida.",
    CRM_STAGE_CONFLICT:
      "O Lead foi atualizado por outro usuário. Atualize os dados e tente novamente.",
    CRM_STAGE_TERMINAL: "Este Lead já está em um estado terminal.",
    CRM_LOST_REASON_REQUIRED: "Informe o motivo da perda.",
    CRM_ACCESS_DENIED: "Você não possui permissão para alterar este Lead.",
  };
  return (
    messages[code || ""] || formatApiErrorMessage(error, "Não foi possível alterar o estágio.")
  );
}
