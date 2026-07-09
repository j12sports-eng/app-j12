import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Plus, ShieldAlert } from "lucide-react";

import type {
  ChampionshipMatchEventPayload,
  ChampionshipMatchEventType,
  ChampionshipRegistrationPlayer,
} from "../types/championship.types";

type MatchTeamOption = {
  label: string;
  registrationId: string;
};

type ChampionshipCardFormProps = {
  disabled?: boolean;
  isSaving?: boolean;
  onSubmit: (payload: ChampionshipMatchEventPayload) => void;
  playersByRegistration: Record<string, ChampionshipRegistrationPlayer[]>;
  teams: MatchTeamOption[];
};

const EVENT_OPTIONS: Array<{ label: string; value: ChampionshipMatchEventType }> = [
  { label: "Cartao amarelo", value: "YELLOW_CARD" },
  { label: "Cartao vermelho", value: "RED_CARD" },
  { label: "Falta", value: "FOUL" },
  { label: "Tempo tecnico", value: "TECHNICAL_TIMEOUT" },
  { label: "Observacao", value: "OBSERVATION" },
  { label: "W.O.", value: "WALKOVER" },
];

export function ChampionshipCardForm({
  disabled,
  isSaving,
  onSubmit,
  playersByRegistration,
  teams,
}: ChampionshipCardFormProps) {
  const [eventType, setEventType] = useState<ChampionshipMatchEventType>("YELLOW_CARD");
  const [teamRegistrationId, setTeamRegistrationId] = useState(teams[0]?.registrationId || "");
  const [playerId, setPlayerId] = useState("");
  const [minute, setMinute] = useState("");
  const [period, setPeriod] = useState("");
  const [description, setDescription] = useState("");

  const players = useMemo(
    () => playersByRegistration[teamRegistrationId] || [],
    [playersByRegistration, teamRegistrationId],
  );
  const needsTeam = !["OBSERVATION", "TECHNICAL_TIMEOUT"].includes(eventType);
  const needsPlayer = ["YELLOW_CARD", "RED_CARD", "FOUL"].includes(eventType);

  useEffect(() => {
    setTeamRegistrationId((current) => {
      if (!teams.length) return "";
      if (current && teams.some((team) => team.registrationId === current)) return current;
      return needsTeam ? teams[0].registrationId : "";
    });
  }, [needsTeam, teams]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if ((needsTeam && !teamRegistrationId) || (needsPlayer && !playerId)) return;

    onSubmit({
      description: description.trim() || null,
      eventType,
      minute: parseOptionalNumber(minute),
      period: period.trim() || null,
      playerId: needsPlayer ? playerId : null,
      teamRegistrationId: needsTeam || teamRegistrationId ? teamRegistrationId || null : null,
    });
    setPlayerId("");
    setMinute("");
    setDescription("");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">Eventos disciplinares</h3>
          <p className="mt-1 text-sm text-slate-500">Cartoes, faltas, observacoes e W.O.</p>
        </div>
        {eventType === "WALKOVER" ? (
          <AlertTriangle className="h-5 w-5 text-primary" />
        ) : (
          <ShieldAlert className="h-5 w-5 text-primary" />
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <select
          value={eventType}
          onChange={(event) => {
            setEventType(event.target.value as ChampionshipMatchEventType);
            setPlayerId("");
          }}
          disabled={disabled || isSaving}
          className={fieldClassName}
        >
          {EVENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={teamRegistrationId}
          onChange={(event) => {
            setTeamRegistrationId(event.target.value);
            setPlayerId("");
          }}
          disabled={disabled || isSaving}
          className={fieldClassName}
        >
          <option value="">Sem equipe</option>
          {teams.map((team) => (
            <option key={team.registrationId} value={team.registrationId}>
              {team.label}
            </option>
          ))}
        </select>

        <select
          value={playerId}
          onChange={(event) => setPlayerId(event.target.value)}
          disabled={disabled || isSaving || !needsPlayer || !teamRegistrationId}
          className={fieldClassName}
        >
          <option value="">Atleta</option>
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
          disabled || isSaving || (needsTeam && !teamRegistrationId) || (needsPlayer && !playerId)
        }
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-black text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Registrar evento
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
