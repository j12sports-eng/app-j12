import { type FormEvent, type ReactNode } from "react";
import { Loader2, Save } from "lucide-react";

import {
  CHAMPIONSHIP_CATEGORY_SUGGESTIONS,
  CHAMPIONSHIP_MODALITY_SUGGESTIONS,
  CHAMPIONSHIP_STATUS_OPTIONS,
} from "../constants/championship.constants";

import type {
  ChampionshipFormErrors,
  ChampionshipFormValues,
} from "../schemas/championship.schemas";
import type { ChampionshipStatus } from "../types/championship.types";

type ChampionshipFormProps = {
  description?: string;
  errors?: ChampionshipFormErrors;
  isSaving?: boolean;
  onChange: (values: ChampionshipFormValues) => void;
  onCancel?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  title?: string;
  values: ChampionshipFormValues;
};

export function ChampionshipForm({
  description = "Cadastro administrativo do campeonato.",
  errors = {},
  isSaving = false,
  onCancel,
  onChange,
  onSubmit,
  submitLabel = "Salvar campeonato",
  title = "Novo campeonato",
  values,
}: ChampionshipFormProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <div>
        <h3 className="text-lg font-black text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>

      <div className="mt-5 grid gap-3">
        <Field error={errors.name} label="Nome">
          <input
            value={values.name}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
            className={fieldClassName}
            required
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field error={errors.category} label="Categoria">
            <input
              list="championship-category-suggestions"
              value={values.category}
              onChange={(event) => onChange({ ...values, category: event.target.value })}
              className={fieldClassName}
              required
            />
            <datalist id="championship-category-suggestions">
              {CHAMPIONSHIP_CATEGORY_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </Field>

          <Field error={errors.modality} label="Modalidade">
            <input
              list="championship-modality-suggestions"
              value={values.modality}
              onChange={(event) => onChange({ ...values, modality: event.target.value })}
              className={fieldClassName}
              required
            />
            <datalist id="championship-modality-suggestions">
              {CHAMPIONSHIP_MODALITY_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field error={errors.startDate} label="Data inicial">
            <input
              type="date"
              value={values.startDate}
              onChange={(event) => onChange({ ...values, startDate: event.target.value })}
              className={fieldClassName}
              required
            />
          </Field>

          <Field error={errors.endDate} label="Data final">
            <input
              type="date"
              value={values.endDate}
              onChange={(event) => onChange({ ...values, endDate: event.target.value })}
              className={fieldClassName}
              required
            />
          </Field>

          <Field error={errors.status} label="Status">
            <select
              value={values.status}
              onChange={(event) =>
                onChange({ ...values, status: event.target.value as ChampionshipStatus })
              }
              className={fieldClassName}
            >
              {CHAMPIONSHIP_STATUS_OPTIONS.filter((option) => option.value).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field error={errors.description} label="Observacoes">
          <textarea
            value={values.description}
            onChange={(event) => onChange({ ...values, description: event.target.value })}
            className={`${fieldClassName} min-h-24 resize-y py-3`}
          />
        </Field>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {submitLabel}
          </button>

          {onCancel ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={onCancel}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function Field({ children, error, label }: { children: ReactNode; error?: string; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-semibold text-red-200">{error}</span>
      ) : null}
    </label>
  );
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15";
