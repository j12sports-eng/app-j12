import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Loader2, Plus } from "lucide-react";

import type {
  ChampionshipMatchEventPayload,
  ChampionshipRegistrationPlayer,
} from "../types/championship.types";

type MatchTeamOption = {
  label: string;
  registrationId: string;
};

type ChampionshipSubstitutionFormProps = {
  disabled?: boolean;
  isSaving?: boolean;
  onSubmit: (payload: ChampionshipMatchEventPayload) => void;
  playersByRegistration: Record<string, ChampionshipRegistrationPlayer[]>;
  teams: MatchTeamOption[];
};

export function ChampionshipSubstitutionForm({
  disabled,
  isSaving,
  onSubmit,
  playersByRegistration,
  teams,
}: ChampionshipSubstitutionFormProps) {
  const [teamRegistrationId, setTeamRegistrationId] = useState(teams[0]?.registrationId || "");
  const [playerId, setPlayerId] = useState("");
  const [relatedPlayerId, setRelatedPlayerId] = useState("");
  const [minute, setMinute] = useState("");
  const [period, setPeriod] = useState("");
  const [description, setDescription] = useState("");

  const players = useMemo(
    () => playersByRegistration[teamRegistrationId] || [],
    [playersByRegistration, teamRegistrationId],
  );

  useEffect(() => {
    setTeamRegistrationId((current) => {
      if (!teams.length) return "";
      return teams.some((team) => team.registrationId === current)
        ? current
        : teams[0].registrationId;
    });
  }, [teams]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!teamRegistrationId || !playerId || !relatedPlayerId || playerId === relatedPlayerId) {
      return;
    }

    onSubmit({
      description: description.trim() || null,
      eventType: "SUBSTITUTION",
      minute: parseOptionalNumber(minute),
      period: period.trim() || null,
      playerId,
      relatedPlayerId,
      teamRegistrationId,
    });
    setPlayerId("");
    setRelatedPlayerId("");
    setMinute("");
    setDescription("");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">Substituicao</h3>
          <p className="mt-1 text-sm text-slate-500">Registre entrada e saida de atletas.</p>
        </div>
        <ArrowRightLeft className="h-5 w-5 text-primary" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <select
          value={teamRegistrationId}
          onChange={(event) => {
            setTeamRegistrationId(event.target.value);
            setPlayerId("");
            setRelatedPlayerId("");
          }}
          disabled={disabled || isSaving}
          className={fieldClassName}
        >
          {teams.map((team) => (
            <option key={team.registrationId} value={team.registrationId}>
              {team.label}
            </option>
          ))}
        </select>

        <select
          value={playerId}
          onChange={(event) => setPlayerId(event.target.value)}
          disabled={disabled || isSaving || !teamRegistrationId}
          className={fieldClassName}
        >
          <option value="">Entrou</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.shirtNumber} - {player.name}
            </option>
          ))}
        </select>

        <select
          value={relatedPlayerId}
          onChange={(event) => setRelatedPlayerId(event.target.value)}
          disabled={disabled || isSaving || !teamRegistrationId}
          className={fieldClassName}
        >
          <option value="">Saiu</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.shirtNumber} - {player.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          min="0"
          value={minute}
          onChange={(event) => setMinute(event.target.value)}
          disabled={disabled || isSaving}
          className={fieldClassName}
          placeholder="Minuto"
        />

        <input
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          disabled={disabled || isSaving}
          className={fieldClassName}
          placeholder="Periodo"
        />

        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={disabled || isSaving}
          className={fieldClassName}
          placeholder="Descricao"
        />
      </div>

      <button
        type="submit"
        disabled={
          disabled ||
          isSaving ||
          !teamRegistrationId ||
          !playerId ||
          !relatedPlayerId ||
          playerId === relatedPlayerId
        }
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Registrar substituicao
      </button>
    </form>
  );
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";
