import { useEffect, useMemo, useState } from "react";
import { BellRing, Cake, Mail, MessageCircle, MonitorSpeaker } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { settingsStore, useSettingsState } from "@/lib/settings/settings-store";
import type { NotificationSettingsData } from "@/lib/settings/types";
import { useAlunos } from "@/lib/alunos-store";
import { SettingsPanel } from "./shared";

export function NotificationsSettings() {
  const settings = useSettingsState();
  const alunos = useAlunos();
  const [draft, setDraft] = useState<NotificationSettingsData>(settings.notifications);

  useEffect(() => {
    setDraft(settings.notifications);
  }, [settings.notifications]);

  const birthdays = useMemo(() => {
    const today = new Date();
    const month = today.getMonth() + 1;

    return {
      today: alunos.filter((aluno) => {
        if (!aluno.dataNascimento) return false;
        const date = new Date(`${aluno.dataNascimento}T00:00:00`);
        return date.getDate() === today.getDate() && date.getMonth() + 1 === month;
      }).length,
      week: alunos.filter((aluno) => {
        if (!aluno.dataNascimento) return false;
        const birthDate = new Date(`${aluno.dataNascimento}T00:00:00`);
        const currentYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        const diffDays = Math.floor((currentYearBirthday.getTime() - today.getTime()) / 86400000);
        return diffDays >= 0 && diffDays <= 7;
      }).length,
      month: alunos.filter((aluno) => {
        if (!aluno.dataNascimento) return false;
        return new Date(`${aluno.dataNascimento}T00:00:00`).getMonth() === today.getMonth();
      }).length,
    };
  }, [alunos]);

  function handleSave() {
    settingsStore.saveNotifications(draft);
    toast.success("Preferências de notificações salvas.");
  }

  return (
    <SettingsPanel
      title="Notificações"
      description="Defina eventos automáticos, canais de entrega e o lembrete de aniversário do aluno com reutilização global."
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <ToggleCard
            title="Lembrete de aula"
            description="Envia avisos pré-aula para alunos e responsáveis."
            checked={draft.lessonReminder}
            onCheckedChange={(checked) =>
              setDraft((current) => ({ ...current, lessonReminder: checked }))
            }
          />
          <ToggleCard
            title="Cobrança"
            description="Dispara lembretes automáticos para pagamentos pendentes."
            checked={draft.billing}
            onCheckedChange={(checked) => setDraft((current) => ({ ...current, billing: checked }))}
          />
          <ToggleCard
            title="Falta do aluno"
            description="Notifica equipe e responsáveis quando houver ausência registrada."
            checked={draft.absence}
            onCheckedChange={(checked) => setDraft((current) => ({ ...current, absence: checked }))}
          />

          <div className="rounded-3xl border border-border bg-card/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-foreground">Lembrete de aniversário do aluno</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Centralize lembretes para painel, dashboard, e-mail ou WhatsApp.
                </div>
              </div>
              <Switch
                checked={draft.birthdayReminderEnabled}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, birthdayReminderEnabled: checked }))
                }
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field
                label="Canal"
                value={draft.birthdayReminderChannel}
                as="select"
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    birthdayReminderChannel: value as NotificationSettingsData["birthdayReminderChannel"],
                  }))
                }
                options={[
                  { value: "dashboard", label: "Dashboard" },
                  { value: "painel", label: "Painel interno" },
                  { value: "email", label: "E-mail" },
                  { value: "whatsapp", label: "WhatsApp" },
                ]}
              />
              <Field
                label="Quando lembrar"
                value={draft.birthdayReminderType}
                as="select"
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    birthdayReminderType: value as NotificationSettingsData["birthdayReminderType"],
                  }))
                }
                options={[
                  { value: "today", label: "No próprio dia" },
                  { value: "days_before", label: "Antecedência" },
                  { value: "week", label: "Semana" },
                  { value: "month", label: "Mês" },
                ]}
              />
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Dias antes</label>
                <Input
                  type="number"
                  min={0}
                  value={draft.birthdayReminderDaysBefore}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      birthdayReminderDaysBefore: Number(event.target.value || "0"),
                    }))
                  }
                  className="j12-field"
                />
              </div>
              <div className="rounded-2xl border border-border bg-background/40 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Aniversariantes
                </div>
                <div className="mt-3 space-y-2 text-sm text-foreground">
                  <div>Hoje: {birthdays.today}</div>
                  <div>Semana: {birthdays.week}</div>
                  <div>Mês: {birthdays.month}</div>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Mensagem padrão
                </label>
                <Textarea
                  value={draft.birthdayReminderMessage}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      birthdayReminderMessage: event.target.value,
                    }))
                  }
                  className="j12-field min-h-[120px]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card/60 p-5">
          <div className="text-sm font-medium text-foreground">Canais habilitados</div>
          <div className="mt-4 space-y-4">
            <ChannelRow
              icon={MessageCircle}
              label="WhatsApp"
              checked={draft.whatsappEnabled}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, whatsappEnabled: checked }))
              }
            />
            <ChannelRow
              icon={Mail}
              label="E-mail"
              checked={draft.emailEnabled}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, emailEnabled: checked }))
              }
            />
            <ChannelRow icon={MonitorSpeaker} label="Painel / Dashboard" checked />
            <ChannelRow icon={Cake} label="Aniversário automático" checked={draft.birthdayReminderEnabled} />
          </div>
          <Button onClick={handleSave} className="mt-6 w-full">
            <BellRing className="h-4 w-4" />
            Salvar notificações
          </Button>
        </div>
      </div>
    </SettingsPanel>
  );
}

function ToggleCard({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-card/60 p-5">
      <div>
        <div className="font-medium text-foreground">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function ChannelRow({
  icon: Icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: typeof BellRing;
  label: string;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-background/40 px-4 py-3">
      <div className="flex items-center gap-2 text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      {onCheckedChange ? <Switch checked={checked} onCheckedChange={onCheckedChange} /> : <span className="text-xs text-muted-foreground">{checked ? "Ativo" : "Inativo"}</span>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  as,
  options = [],
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  as: "select";
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="j12-field h-10 w-full px-3 text-sm">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
