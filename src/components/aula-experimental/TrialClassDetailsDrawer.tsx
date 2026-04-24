import { CalendarDays, Clock3, Mail, Phone, RefreshCcw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  calculateTrialClassAge,
  canConvertTrialClass,
  canEditTrialClass,
  canRescheduleTrialClass,
  type TrialClass,
} from "@/lib/trial-classes-store";
import { TrialClassStatusBadge } from "./TrialClassStatusBadge";

export function TrialClassDetailsDrawer({
  open,
  onOpenChange,
  trialClass,
  onEdit,
  onReschedule,
  onConvert,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  trialClass: TrialClass | null;
  onEdit: (trialClass: TrialClass) => void;
  onReschedule: (trialClass: TrialClass) => void;
  onConvert: (trialClass: TrialClass) => void;
}) {
  if (!trialClass) return null;

  const age = calculateTrialClassAge(trialClass.birthDate);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-primary/20 bg-[#050913] p-0 text-slate-100 sm:max-w-2xl"
      >
        <div className="border-b border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(255,106,0,0.24),transparent_38%),linear-gradient(180deg,#111827,#050913)] px-6 py-8">
          <SheetHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <SheetTitle className="text-2xl text-white">{trialClass.studentName}</SheetTitle>
                <SheetDescription className="mt-1 text-slate-300">
                  {trialClass.modality} • {trialClass.unit}
                </SheetDescription>
                <div className="mt-3 flex flex-wrap gap-2">
                  <TrialClassStatusBadge status={trialClass.status} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {canEditTrialClass(trialClass) && (
                  <Button variant="outline" onClick={() => onEdit(trialClass)}>
                    Editar
                  </Button>
                )}
                {canRescheduleTrialClass(trialClass) && (
                  <Button variant="outline" onClick={() => onReschedule(trialClass)}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Reagendar
                  </Button>
                )}
                {canConvertTrialClass(trialClass) && (
                  <Button
                    onClick={() => onConvert(trialClass)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Converter
                  </Button>
                )}
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="space-y-5 px-6 py-6">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <InfoCard icon={UserRound} label="Aluno" value={trialClass.studentName} />
            <InfoCard
              icon={CalendarDays}
              label="Nascimento / idade"
              value={age === null ? "Nao informado" : `${trialClass.birthDate} • ${age} ano(s)`}
            />
            <InfoCard icon={Phone} label="Telefone" value={trialClass.phone} />
          </section>

          <section className="rounded-3xl border border-primary/15 bg-white/5 p-5">
            <div className="mb-4 text-xs uppercase tracking-[0.22em] text-primary/80">
              Responsavel
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoRow label="Nome" value={trialClass.guardianName} />
              <InfoRow label="WhatsApp" value={trialClass.whatsapp || "Nao informado"} />
              <InfoRow label="Telefone" value={trialClass.phone} />
              <InfoRow label="E-mail" value={trialClass.email || "Nao informado"} />
            </div>
          </section>

          <section className="rounded-3xl border border-primary/15 bg-white/5 p-5">
            <div className="mb-4 text-xs uppercase tracking-[0.22em] text-primary/80">
              Agendamento
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoRow label="Modalidade" value={trialClass.modality} />
              <InfoRow label="Professor" value={trialClass.professor} />
              <InfoRow label="Turma" value={trialClass.turma} />
              <InfoRow label="Origem" value={String(trialClass.leadSource)} />
              <InfoRow label="Data" value={trialClass.date} />
              <InfoRow label="Horario" value={trialClass.time} />
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              {trialClass.notes || "Sem observacoes registradas."}
            </div>
          </section>

          <section className="rounded-3xl border border-primary/15 bg-white/5 p-5">
            <div className="mb-4 text-xs uppercase tracking-[0.22em] text-primary/80">
              Historico
            </div>
            <div className="space-y-3">
              {trialClass.history.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-100">{entry.title}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(entry.at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">{entry.description}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-primary/15 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary/80">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-3 text-sm text-slate-100">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm text-slate-100">{value}</div>
    </div>
  );
}
