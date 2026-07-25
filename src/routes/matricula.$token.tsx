import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { advanceDigitalEnrollmentStep, DigitalEnrollmentForm, DigitalEnrollmentStep, getDigitalEnrollmentForm, isValidInvitationToken, PublicInvitationError, saveDigitalEnrollmentStep } from "@/features/enrollments/api/digital-invitation-public";

type LoadState = "loading" | "ready" | "unavailable" | "network" | "rate_limit" | "malformed";
type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";
const STEPS: DigitalEnrollmentStep[] = ["RESPONSIBLE_DATA", "STUDENT_DATA", "ADDRESS", "ADDITIONAL_INFORMATION", "REVIEW"];
const LABELS: Record<DigitalEnrollmentStep, string> = { RESPONSIBLE_DATA: "Responsável", STUDENT_DATA: "Aluno", ADDRESS: "Endereço", ADDITIONAL_INFORMATION: "Informações adicionais", REVIEW: "Revisão" };

export const Route = createFileRoute("/matricula/$token")({ head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow, noarchive" }, { name: "referrer", content: "no-referrer" }], title: "Matrícula digital | J12 Sports" }), component: DigitalEnrollmentPage });

function DigitalEnrollmentPage() {
  const { token } = Route.useParams();
  const [loadState, setLoadState] = useState<LoadState>(() => isValidInvitationToken(token) ? "loading" : "malformed");
  const [form, setForm] = useState<DigitalEnrollmentForm | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  useEffect(() => {
    if (!isValidInvitationToken(token)) { setLoadState("malformed"); return; }
    let active = true;
    getDigitalEnrollmentForm(token).then((data) => { if (active) { setForm(data); setLoadState("ready"); } }).catch((error) => { if (active) setLoadState(error instanceof PublicInvitationError && (error.kind === "network" || error.kind === "rate_limit") ? error.kind : "unavailable"); });
    return () => { active = false; };
  }, [token]);
  if (loadState !== "ready" || !form) return <StatusScreen state={loadState} />;

  const current = form.progress.currentStep;
  const patch = (section: "responsible" | "student" | "address", field: string, value: string) => setForm((valueForm) => valueForm ? { ...valueForm, [section]: { ...valueForm[section], [field]: value } } : valueForm);
  const persist = async () => {
    if (current === "REVIEW") return form;
    const config = current === "RESPONSIBLE_DATA" ? ["responsible", form.responsible] : current === "STUDENT_DATA" ? ["student", form.student] : current === "ADDRESS" ? ["address", form.address] : ["additional-information", {}];
    setSaveState("saving");
    try {
      const saved = await saveDigitalEnrollmentStep(token, config[0] as string, config[1] as Record<string, string>, form.progress.revision);
      setForm(saved); setSaveState("saved"); return saved;
    } catch (error) {
      setSaveState(error instanceof PublicInvitationError && error.kind === "conflict" ? "conflict" : "error");
      throw error;
    }
  };
  const advance = async () => {
    try {
      const saved = await persist();
      const next = STEPS[STEPS.indexOf(current) + 1];
      if (!saved || !next) return;
      const result = await advanceDigitalEnrollmentStep(token, next, saved.progress.revision);
      setForm({ ...saved, progress: result.progress }); setSaveState("idle");
    } catch { /* controlled state is already visible */ }
  };

  return <main className="min-h-screen bg-[#050505] px-4 py-8 text-white"><section className="mx-auto max-w-2xl rounded-3xl border border-orange-500/20 bg-zinc-950 p-6 shadow-2xl shadow-orange-500/10 md:p-9">
    <p className="text-xs font-black uppercase tracking-[.3em] text-orange-400">J12 Sports · Matrícula digital</p>
    <div className="mt-6 flex gap-2">{STEPS.map((step, index) => <div key={step} className={`h-1.5 flex-1 rounded-full ${index <= STEPS.indexOf(current) ? "bg-orange-500" : "bg-zinc-800"}`} />)}</div>
    <div className="mt-8 flex items-start justify-between gap-4"><div><p className="text-sm text-zinc-500">Etapa {STEPS.indexOf(current) + 1} de 5</p><h1 className="mt-1 text-3xl font-black">{LABELS[current]}</h1></div><SaveBadge state={saveState} /></div>
    <div className="mt-8 space-y-5" onBlur={() => void persist()}>
      {current === "RESPONSIBLE_DATA" && <><Field label="Nome completo" value={form.responsible.name} onChange={(v) => patch("responsible", "name", v)} /><Field label="E-mail" type="email" value={form.responsible.email} onChange={(v) => patch("responsible", "email", v)} /><Field label="Telefone" value={form.responsible.phone} onChange={(v) => patch("responsible", "phone", v)} /></>}
      {current === "STUDENT_DATA" && <><Field label="Nome completo" value={form.student.name} onChange={(v) => patch("student", "name", v)} /><Field label="Data de nascimento" type="date" value={form.student.birthDate?.slice(0,10) || ""} onChange={(v) => patch("student", "birthDate", v)} /></>}
      {current === "ADDRESS" && <>{([['zipCode','CEP'],['street','Logradouro'],['number','Número'],['district','Bairro'],['city','Cidade'],['state','Estado'],['complement','Complemento']] as const).map(([field,label]) => <Field key={field} label={label} value={form.address[field] || ""} onChange={(v) => patch("address", field, v)} />)}</>}
      {current === "ADDITIONAL_INFORMATION" && <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm leading-6 text-zinc-400">Não há informações adicionais obrigatórias nesta etapa. Nenhum dado médico, escolar, documental ou financeiro será solicitado agora.</div>}
      {current === "REVIEW" && <Review form={form} />}
    </div>
    {current !== "REVIEW" && <button type="button" onClick={() => void advance()} disabled={saveState === "saving" || saveState === "conflict"} className="mt-8 w-full rounded-2xl bg-orange-500 px-5 py-3.5 font-black text-black transition hover:bg-orange-400 disabled:opacity-40">Salvar e continuar</button>}
  </section></main>;
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="block"><span className="mb-2 block text-sm font-bold text-zinc-300">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500" /></label>; }
function SaveBadge({ state }: { state: SaveState }) { const copy = { idle: "", saving: "Salvando...", saved: "Salvo", error: "Erro ao salvar", conflict: "Conflito: recarregue a página" }[state]; return <span className={`text-xs font-bold ${state === "conflict" || state === "error" ? "text-red-400" : "text-orange-400"}`}>{copy}</span>; }
function Review({ form }: { form: DigitalEnrollmentForm }) { return <div className="space-y-4 text-sm"><Summary title="Responsável" values={[form.responsible.name, form.responsible.email, form.responsible.phone]} /><Summary title="Aluno" values={[form.student.name, form.student.birthDate]} /><Summary title="Endereço" values={[form.address.street, form.address.number, form.address.district, form.address.city, form.address.state, form.address.zipCode]} /></div>; }
function Summary({ title, values }: { title: string; values: string[] }) { return <div className="rounded-2xl border border-zinc-800 p-5"><h2 className="font-black text-orange-400">{title}</h2>{values.filter(Boolean).map((value) => <p key={value} className="mt-1 text-zinc-300">{value}</p>)}</div>; }
function StatusScreen({ state }: { state: LoadState }) { const copy = state === "loading" ? ["Validando convite", "Aguarde enquanto carregamos seu formulário."] : state === "network" ? ["Sem conexão", "Verifique sua internet e tente novamente."] : state === "rate_limit" ? ["Muitas tentativas", "Aguarde alguns instantes antes de tentar novamente."] : state === "malformed" ? ["Link inválido", "Confira se o link recebido está completo."] : ["Formulário indisponível", "O convite pode ter expirado, sido revogado ou não possuir os vínculos necessários."]; return <main className="flex min-h-screen items-center justify-center bg-[#050505] px-5 text-white"><section className="w-full max-w-lg rounded-3xl border border-orange-500/20 bg-zinc-950 p-8"><div className="h-1.5 w-16 rounded-full bg-orange-500"/><h1 className="mt-6 text-3xl font-black">{copy[0]}</h1><p className="mt-3 text-zinc-400">{copy[1]}</p></section></main>; }
