import { type FormEvent, type ReactNode } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";

export type ChampionshipGroupFormValues = {
  displayOrder: string;
  name: string;
};

type ChampionshipGroupFormProps = {
  isSaving?: boolean;
  onChange: (values: ChampionshipGroupFormValues) => void;
  onReset?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  selectedGroupId?: string | null;
  values: ChampionshipGroupFormValues;
};

export function ChampionshipGroupForm({
  isSaving = false,
  onChange,
  onReset,
  onSubmit,
  selectedGroupId,
  values,
}: ChampionshipGroupFormProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <div>
        <h3 className="text-lg font-black text-white">
          {selectedGroupId ? "Editar grupo" : "Criar grupo"}
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Organize equipes inscritas em grupos sem gerar jogos ou classificacao.
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        <Field label="Nome">
          <input
            value={values.name}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
            className={fieldClassName}
            maxLength={80}
            placeholder="Grupo A"
            required
          />
        </Field>

        <Field label="Ordem">
          <input
            value={values.displayOrder}
            onChange={(event) => onChange({ ...values, displayOrder: event.target.value })}
            className={fieldClassName}
            inputMode="numeric"
            min={0}
            placeholder="Automatico"
            type="number"
          />
        </Field>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <button
            type="submit"
            disabled={isSaving || !values.name.trim()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {selectedGroupId ? "Salvar grupo" : "Criar grupo"}
          </button>

          {selectedGroupId && onReset ? (
            <button
              type="button"
              disabled={isSaving}
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
