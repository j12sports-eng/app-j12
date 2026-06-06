import { Link } from "@tanstack/react-router";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { ArrowRight, Flame, ShieldCheck, Sparkles } from "lucide-react";
import { branding } from "@/lib/branding";

export function AuthExperience({
  eyebrow,
  title,
  description,
  children,
  footer,
  variant = "marketing",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "marketing" | "minimal";
}) {
  if (variant === "minimal") {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-4 py-8 text-white sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,107,0,0.2),_transparent_34%),linear-gradient(180deg,_rgba(16,16,16,0.98),_rgba(4,4,4,1))]" />

        <section className="relative z-10 flex w-full max-w-md flex-col items-center">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-3xl border border-white/10 bg-black/50 shadow-[0_0_45px_-18px_rgba(255,107,0,0.95)]">
              <img
                src={branding.logo}
                alt={`Logo ${branding.name}`}
                className="h-12 w-12 object-contain"
              />
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ff8b45]">
              {branding.name}
            </span>
          </div>

          <div className="w-full rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.96),rgba(9,9,9,0.98))] p-6 shadow-[0_40px_90px_-45px_rgba(255,107,0,0.65)] backdrop-blur sm:p-8">
            {children}
            {footer ? <div className="mt-6 border-t border-white/10 pt-5">{footer}</div> : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,107,0,0.26),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(255,69,0,0.22),_transparent_28%),linear-gradient(180deg,_rgba(16,16,16,0.96),_rgba(4,4,4,1))]" />
      <div className="absolute inset-y-0 left-0 hidden w-1/2 bg-[linear-gradient(135deg,_rgba(255,107,0,0.08),_rgba(255,69,0,0.02)_45%,_transparent_70%)] lg:block" />

      <div className="relative mx-auto grid min-h-screen max-w-7xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1.12fr_0.88fr] lg:px-8">
        <section className="flex flex-col justify-between rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_30px_80px_-40px_rgba(255,107,0,0.55)] backdrop-blur md:p-8 lg:p-10">
          <div>
            <div className="mb-10 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-black/40 shadow-[0_0_40px_-18px_rgba(255,107,0,0.9)]">
                <img
                  src={branding.logo}
                  alt={`Logo ${branding.name}`}
                  className="h-11 w-11 object-contain"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#ff8b45]">
                  {branding.name}
                </p>
                <h1 className="text-xl font-semibold text-white sm:text-2xl">
                  {branding.subtitle}
                </h1>
              </div>
            </div>

            <div className="max-w-2xl space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#ff6b00]/25 bg-[#ff6b00]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#ff9f6b]">
                <Sparkles className="h-3.5 w-3.5" />
                {eyebrow}
              </span>

              <div className="space-y-4">
                <h2 className="max-w-xl text-4xl font-black leading-tight text-white sm:text-5xl">
                  {title}
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                  {description}
                </p>
              </div>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  title: "Acesso seguro",
                  text: "Fluxo de login com validações, feedback visual e recuperação real de senha.",
                },
                {
                  icon: Flame,
                  title: "Visual premium",
                  text: "Superfícies elegantes, contraste forte e destaques em laranja J12.",
                },
                {
                  icon: ArrowRight,
                  title: "Entrada rápida",
                  text: "Navegação clara entre login, recuperação e matrícula pública.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-black/25 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                >
                  <item.icon className="mb-3 h-5 w-5 text-[#ff7b29]" />
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-white/45">
            <span>Plataforma operacional J12</span>
            <span className="hidden h-1 w-1 rounded-full bg-white/25 sm:block" />
            <Link to="/matricula" className="transition hover:text-[#ff9f6b]">
              Matrícula pública
            </Link>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.96),rgba(9,9,9,0.98))] p-6 shadow-[0_40px_90px_-45px_rgba(255,107,0,0.65)] backdrop-blur xl:p-8">
            {children}
            {footer ? <div className="mt-6 border-t border-white/10 pt-5">{footer}</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export function AuthCardHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8 space-y-3">
      <h3 className="text-3xl font-black text-white">{title}</h3>
      <p className="text-sm leading-6 text-white/65">{description}</p>
    </div>
  );
}

export function AuthInput({
  label,
  error,
  rightSlot,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  rightSlot?: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-white/88">{label}</span>
      <span className="relative block">
        <input
          {...props}
          className={`h-13 w-full rounded-2xl border bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#ff6b00] focus:ring-4 focus:ring-[#ff6b00]/15 ${
            rightSlot ? "pr-12" : ""
          } ${error ? "border-red-500/70" : "border-white/12"}`}
        />
        {rightSlot ? (
          <span className="absolute inset-y-0 right-3 flex items-center">{rightSlot}</span>
        ) : null}
      </span>
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </label>
  );
}

export function AuthButton({
  children,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const className =
    variant === "primary"
      ? "bg-[linear-gradient(135deg,#ff6b00,#ff4500)] text-white shadow-[0_20px_50px_-24px_rgba(255,107,0,0.95)] hover:brightness-110"
      : variant === "secondary"
        ? "border border-[#ff6b00]/35 bg-white/[0.03] text-[#ffb07e] hover:bg-[#ff6b00]/12"
        : "border border-white/10 bg-transparent text-white/72 hover:bg-white/5";

  return (
    <button
      {...props}
      className={`inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${className} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-white/10" />
      <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/35">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}
