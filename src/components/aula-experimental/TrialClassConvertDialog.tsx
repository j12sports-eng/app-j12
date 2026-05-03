import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Sparkles } from "lucide-react";
import { toast } from "sonner";
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
import { usePlanos } from "@/lib/planos-store";
import {
  canConvertTrialClass,
  trialClassesStore,
  type TrialClass,
} from "@/lib/trial-classes-store";

export function TrialClassConvertDialog({
  open,
  onOpenChange,
  trialClass,
  onConverted,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  trialClass: TrialClass | null;
  onConverted?: (trialClass: TrialClass) => void;
}) {
  const planos = usePlanos();
  const [plan, setPlan] = useState("");
  const [converting, setConverting] = useState(false);

  const availablePlanos = useMemo(() => {
    const dynamicPlanos = planos
      .filter((item) => item.status === "ativo")
      .map((item) => item.nome.trim())
      .filter(Boolean);

    return Array.from(new Set(dynamicPlanos));
  }, [planos]);

  useEffect(() => {
    if (!open) return;
    setPlan((current) => current || availablePlanos[0] || "");
  }, [availablePlanos, open]);

  if (!trialClass) return null;
  const currentTrialClass = trialClass;

  async function handleConvert() {
    if (!canConvertTrialClass(currentTrialClass)) {
      toast.error("Somente aulas com comparecimento podem ser convertidas.");
      return;
    }

    setConverting(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    try {
      const result = trialClassesStore.convertToAluno(currentTrialClass.id, plan);

      if (!result.ok) {
        toast.error(result.reason);
        return;
      }

      toast.success(`Aluno ${result.aluno.nome} criado com sucesso.`);
      if (result.turmaWarning) {
        toast.warning(
          `Aluno criado, mas nao foi possivel vincular na turma: ${result.turmaWarning}`,
        );
      }
      onConverted?.(result.trialClass);
      onOpenChange(false);
    } finally {
      setConverting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-primary/20 bg-[#070b14] text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Converter em aluno
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Use os dados da aula experimental para criar o aluno diretamente na base oficial.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-primary/20 bg-[#0b1120] p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-primary/80">
              Resumo do lead
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="font-semibold text-white">{currentTrialClass.studentName}</div>
              <div>Responsavel: {currentTrialClass.guardianName}</div>
              <div>Modalidade: {currentTrialClass.modality}</div>
              <div>Turma: {currentTrialClass.turma || "A definir"}</div>
              <div>Professor: {currentTrialClass.professor}</div>
              <div>
                Agenda: {currentTrialClass.date} as {currentTrialClass.time}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-primary/20 bg-[#0b1120] p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary/80">
              <Sparkles className="h-4 w-4" />
              Conversao
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Plano inicial</Label>
                <select
                  value={plan}
                  onChange={(event) => setPlan(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {availablePlanos.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                O aluno sera criado com status ativo, usando o catalogo oficial de planos e mantendo
                o vinculo com esta aula experimental.
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConvert}
            disabled={
              converting ||
              !canConvertTrialClass(currentTrialClass) ||
              !plan ||
              availablePlanos.length === 0
            }
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {converting ? "Convertendo..." : "Converter em aluno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
