import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { advanceDigitalEnrollmentStep, deleteDigitalEnrollmentDocument, digitalEnrollmentDocumentDownloadUrl, DigitalEnrollmentDocument, DigitalEnrollmentDocumentType, DigitalEnrollmentForm, DigitalEnrollmentStep, getDigitalEnrollmentForm, isValidInvitationToken, listDigitalEnrollmentDocuments, PublicInvitationError, saveDigitalEnrollmentStep, uploadDigitalEnrollmentDocument } from "@/features/enrollments/api/digital-invitation-public";

type LoadState = "loading" | "ready" | "unavailable" | "network" | "rate_limit" | "malformed";
type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";
const STEPS: DigitalEnrollmentStep[] = ["RESPONSIBLE_DATA", "STUDENT_DATA", "ADDRESS", "ADDITIONAL_INFORMATION", "DOCUMENTS", "REVIEW"];
const LABELS: Record<DigitalEnrollmentStep, string> = { RESPONSIBLE_DATA: "Responsável", STUDENT_DATA: "Aluno", ADDRESS: "Endereço", ADDITIONAL_INFORMATION: "Informações adicionais", DOCUMENTS: "Documentos", REVIEW: "Revisão" };

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
    if (current === "REVIEW" || current === "DOCUMENTS") return form;
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
    <div className="mt-8 flex items-start justify-between gap-4"><div><p className="text-sm text-zinc-500">Etapa {STEPS.indexOf(current) + 1} de {STEPS.length}</p><h1 className="mt-1 text-3xl font-black">{LABELS[current]}</h1></div><SaveBadge state={saveState} /></div>
    <div className="mt-8 space-y-5" onBlur={() => void persist()}>
      {current === "RESPONSIBLE_DATA" && <><Field label="Nome completo" value={form.responsible.name} onChange={(v) => patch("responsible", "name", v)} /><Field label="E-mail" type="email" value={form.responsible.email} onChange={(v) => patch("responsible", "email", v)} /><Field label="Telefone" value={form.responsible.phone} onChange={(v) => patch("responsible", "phone", v)} /></>}
      {current === "STUDENT_DATA" && <><Field label="Nome completo" value={form.student.name} onChange={(v) => patch("student", "name", v)} /><Field label="Data de nascimento" type="date" value={form.student.birthDate?.slice(0,10) || ""} onChange={(v) => patch("student", "birthDate", v)} /></>}
      {current === "ADDRESS" && <>{([['zipCode','CEP'],['street','Logradouro'],['number','Número'],['district','Bairro'],['city','Cidade'],['state','Estado'],['complement','Complemento']] as const).map(([field,label]) => <Field key={field} label={label} value={form.address[field] || ""} onChange={(v) => patch("address", field, v)} />)}</>}
      {current === "ADDITIONAL_INFORMATION" && <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm leading-6 text-zinc-400">Não há informações adicionais obrigatórias nesta etapa. Nenhum dado médico, escolar, documental ou financeiro será solicitado agora.</div>}
      {current === "DOCUMENTS" && <Documents token={token} />}
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

function Documents({ token }: { token: string }) {
  const [documents, setDocuments] = useState<DigitalEnrollmentDocument[]>([]);
  const [type, setType] = useState<DigitalEnrollmentDocumentType>("CPF");
  const [state, setState] = useState<"loading" | "idle" | "uploading" | "error">("loading");
  useEffect(() => { let active = true; listDigitalEnrollmentDocuments(token).then((items) => { if (active) { setDocuments(items); setState("idle"); } }).catch(() => { if (active) setState("error"); }); return () => { active = false; }; }, [token]);
  const upload = async (file?: File) => { if (!file) return; setState("uploading"); try { const item = await uploadDigitalEnrollmentDocument(token, type, file); setDocuments((items) => [item, ...items]); setState("idle"); } catch { setState("error"); } };
  const remove = async (id: string) => { try { await deleteDigitalEnrollmentDocument(token, id); setDocuments((items) => items.filter((item) => item.id !== id)); } catch { setState("error"); } };
  return <div className="space-y-5">
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5"><p className="text-sm font-bold text-zinc-200">Enviar documento</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr]"><select value={type} onChange={(event) => setType(event.target.value as DigitalEnrollmentDocumentType)} className="rounded-xl border border-zinc-700 bg-black px-3 py-3 text-sm">{(["CPF","RG","CERTIDAO_NASCIMENTO","COMPROVANTE_RESIDENCIA","FOTO","OUTRO"] as const).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><input aria-label="Arquivo do documento" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" disabled={state === "uploading"} onChange={(event) => void upload(event.target.files?.[0])} className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500 file:px-3 file:py-2 file:font-bold file:text-black" /></div><p className="mt-3 text-xs text-zinc-500">PDF, JPG, PNG ou WEBP, at� 10 MB. O envio usa conex�o multipart segura.</p></div>
    {state === "loading" && <p className="text-sm text-zinc-400">Carregando documentos...</p>}{state === "uploading" && <p className="text-sm font-bold text-orange-400">Enviando arquivo...</p>}{state === "error" && <p role="alert" className="text-sm font-bold text-red-400">N�o foi poss�vel concluir a opera��o. Verifique o arquivo e tente novamente.</p>}
    <div className="space-y-3">{documents.length === 0 && state !== "loading" ? <p className="rounded-2xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">Nenhum arquivo enviado.</p> : documents.map((item) => <div key={item.id} className="rounded-2xl border border-zinc-800 p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-bold text-zinc-100">{item.originalName}</p><p className="mt-1 text-xs text-zinc-500">{item.type.replaceAll("_", " ")} � {(item.sizeBytes / 1024).toFixed(1)} KB</p><p className={`mt-2 text-xs font-black ${item.status === "REJECTED" ? "text-red-400" : item.status === "APPROVED" ? "text-emerald-400" : "text-orange-400"}`}>{item.status === "PENDING" ? "Pendente" : item.status === "APPROVED" ? "Aprovado" : "Rejeitado � reenvio permitido"}</p>{item.rejectionReason && <p className="mt-1 text-xs text-red-300">{item.rejectionReason}</p>}</div><div className="flex gap-2"><a href={digitalEnrollmentDocumentDownloadUrl(token, item.id)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold">Baixar</a>{item.status !== "APPROVED" && <button type="button" onClick={() => void remove(item.id)} className="rounded-lg border border-red-900 px-3 py-2 text-xs font-bold text-red-400">Excluir</button>}</div></div></div>)}</div>
  </div>;
}