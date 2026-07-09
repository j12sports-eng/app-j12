import { type FormEvent, type ReactNode } from "react";
import { Crown, Loader2, RotateCcw, Save } from "lucide-react";

import { CHAMPIONSHIP_REGISTRATION_PLAYER_POSITION_OPTIONS } from "../constants/championship.constants";

export type ChampionshipRegistrationPlayerFormValues = {
  active: boolean;
  athleteId: string;
  birthDate: string;
  captain: boolean;
  document: string;
  name: string;
  position: string;
  shirtNumber: string;
};

type ChampionshipRegistrationPlayerFormProps = {
  disabled?: boolean;
  isSaving?: boolean;
  onChange: (values: ChampionshipRegistrationPlayerFormValues) => void;
  onReset?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  selectedPlayerId?: string | null;
  values: ChampionshipRegistrationPlayerFormValues;
};

export function ChampionshipRegistrationPlayerForm({
  disabled = false,
  isSaving = false,
  onChange,
  onReset,
  onSubmit,
  selectedPlayerId,
  values,
}: ChampionshipRegistrationPlayerFormProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <div>
        <h3 className="text-lg font-black text-white">
          {selectedPlayerId ? "Editar atleta" : "Cadastrar atleta"}
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Mantenha o elenco vinculado a inscricao selecionada.
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        <Field label="Nome">
          <input
            value={values.name}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
            className={fieldClassName}
            disabled={disabled}
            maxLength={191}
            required
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
          <Field label="Camisa">
            <input
              value={values.shirtNumber}
              onChange={(event) => onChange({ ...values, shirtNumber: event.target.value })}
              className={fieldClassName}
              disabled={disabled}
              inputMode="numeric"
              min={1}
              max={999}
              required
              type="number"
            />
          </Field>

          <Field label="Posicao">
            <select
              value={values.position}
              onChange={(event) => onChange({ ...values, position: event.target.value })}
              className={fieldClassName}
              disabled={disabled}
            >
              {CHAMPIONSHIP_REGISTRATION_PLAYER_POSITION_OPTIONS.map((position) => (
                <option key={position || "NONE"} value={position}>
                  {position || "Selecione"}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nascimento">
            <input
              value={values.birthDate}
              onChange={(event) => onChange({ ...values, birthDate: event.target.value })}
              className={fieldClassName}
              disabled={disabled}
              type="date"
            />
          </Field>

          <Field label="Documento">
            <input
              value={values.document}
              onChange={(event) => onChange({ ...values, document: event.target.value })}
              className={fieldClassName}
              disabled={disabled}
              maxLength={64}
            />
          </Field>
        </div>

        <Field label="Referencia futura de atleta">
          <input
            value={values.athleteId}
            onChange={(event) => onChange({ ...values, athleteId: event.target.value })}
            className={fieldClassName}
            disabled={disabled}
            maxLength={64}
            placeholder="Opcional"
          />
        </Field>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-semibold text-slate-200">
            <input
              type="checkbox"
              checked={values.captain}
              onChange={(event) => onChange({ ...values, captain: event.target.checked })}
              disabled={disabled}
              className="h-4 w-4 rounded border-white/20 bg-black text-primary focus:ring-primary"
            />
            Definir como capitao
            <Crown className="ml-auto h-4 w-4 text-primary" />
          </label>

          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-semibold text-slate-200">
            <input
              type="checkbox"
              checked={values.active}
              onChange={(event) => onChange({ ...values, active: event.target.checked })}
              disabled={disabled}
              className="h-4 w-4 rounded border-white/20 bg-black text-primary focus:ring-primary"
            />
            Ativo no elenco
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <button
            type="submit"
            disabled={disabled || isSaving || !values.name.trim() || !values.shirtNumber}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {selectedPlayerId ? "Salvar atleta" : "Cadastrar atleta"}
          </button>

          {selectedPlayerId && onReset ? (
            <button
              type="button"
              disabled={disabled || isSaving}
              onClick={onReset}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" />
              Novo
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">{label}</span>
      {children}
    </label>
  );
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";
