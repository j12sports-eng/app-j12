import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  isValidInvitationToken,
  PublicInvitationError,
  resolvePublicInvitation,
} from "@/features/enrollments/api/digital-invitation-public";

type ViewState = "loading" | "ready" | "unavailable" | "network" | "rate_limit" | "malformed";

export const Route = createFileRoute("/matricula/$token")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "referrer", content: "no-referrer" },
    ],
    title: "Matricula digital | J12 Sports",
  }),
  component: DigitalEnrollmentInvitationPage,
});

function DigitalEnrollmentInvitationPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<ViewState>(() =>
    isValidInvitationToken(token) ? "loading" : "malformed",
  );
  useEffect(() => {
    if (!isValidInvitationToken(token)) {
      setState("malformed");
      return;
    }
    let active = true;
    setState("loading");
    resolvePublicInvitation(token)
      .then(() => active && setState("ready"))
      .catch((error: unknown) => {
        if (!active) return;
        setState(error instanceof PublicInvitationError ? error.kind : "network");
      });
    return () => {
      active = false;
    };
  }, [token]);
  const copy = {
    loading: ["Validando convite", "Aguarde enquanto verificamos o acesso seguro."],
    ready: [
      "Convite confirmado",
      "Este convite esta disponivel. O preenchimento da matricula sera liberado em uma proxima etapa.",
    ],
    unavailable: [
      "Convite indisponivel",
      "O link pode ter expirado, sido revogado ou ja nao estar disponivel.",
    ],
    network: ["Sem conexao com o servidor", "Verifique sua internet e tente novamente mais tarde."],
    rate_limit: ["Muitas tentativas", "Aguarde alguns instantes antes de tentar novamente."],
    malformed: ["Link invalido", "Confira se o link recebido esta completo."],
  }[state];
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-5 py-10 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-orange-500/25 bg-zinc-950 p-7 shadow-2xl shadow-orange-500/10">
        <div className="mb-6 h-1.5 w-16 rounded-full bg-orange-500" />
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-orange-400">J12 Sports</p>
        <h1 className="mt-3 text-3xl font-black">{copy[0]}</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">{copy[1]}</p>
        {state === "ready" && (
          <button
            type="button"
            disabled
            className="mt-7 w-full rounded-2xl bg-orange-500/40 px-5 py-3 font-bold text-black/60"
          >
            Formulario em breve
          </button>
        )}
      </section>
    </main>
  );
}
