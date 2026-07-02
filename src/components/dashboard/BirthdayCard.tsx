import { memo, useCallback, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ExternalLink, MapPin, MessageCircle, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BirthdayStudent } from "@/types/BirthdayTypes";

const BIRTHDAY_MESSAGE = `Olá! 🎉

A equipe da J12 Sports deseja um feliz aniversário ao nosso atleta!

Que Deus abençoe sua vida com muita saúde, alegria e muitas conquistas.

Parabéns! 🧡⚽`;

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "J12";
}

function normalizeWhatsappPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (!digits) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  return digits;
}

function buildWhatsappUrl(phone: string) {
  const normalizedPhone = normalizeWhatsappPhone(phone);

  if (!normalizedPhone) return null;

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(BIRTHDAY_MESSAGE)}`;
}

function formatBirthdayDate(value: string) {
  if (!value) return "Data nao informada";

  const [, month, day] = value.slice(0, 10).split("-");
  if (!month || !day) return "Data nao informada";

  return `${day}/${month}`;
}

type BirthdayCardProps = {
  student: BirthdayStudent;
};

function BirthdayCardComponent({ student }: BirthdayCardProps) {
  const initials = useMemo(() => initialsFromName(student.nome), [student.nome]);
  const whatsappUrl = useMemo(
    () => buildWhatsappUrl(student.telefoneResponsavel),
    [student.telefoneResponsavel],
  );
  const birthdayDate = useMemo(
    () => formatBirthdayDate(student.dataAniversario || student.dataNascimento),
    [student.dataAniversario, student.dataNascimento],
  );

  const handleCongratulate = useCallback(() => {
    if (!whatsappUrl) return;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }, [whatsappUrl]);

  return (
    <article className="group flex h-full min-h-[284px] flex-col rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-1 hover:border-primary/35 hover:bg-white/[0.04] hover:shadow-[0_24px_55px_rgba(255,69,0,0.12)]">
      <div className="flex items-start gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-primary/70 bg-primary/10 text-lg font-black text-primary shadow-[0_0_28px_rgba(255,69,0,0.2)]">
          {student.foto ? (
            <img
              src={student.foto}
              alt={`Foto de ${student.nome}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden="true">{initials}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-black leading-5 text-white">{student.nome}</h3>
          <p className="mt-1 text-sm font-semibold text-primary">
            {student.idade} anos completando
          </p>
        </div>
      </div>

      <dl className="mt-4 grid flex-1 gap-2 text-sm">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <Users className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <dt className="sr-only">Turma</dt>
            <dd className="truncate font-semibold text-slate-200">{student.turma}</dd>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <dt className="sr-only">Unidade</dt>
            <dd className="truncate font-semibold text-slate-200">{student.unidade}</dd>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <dt className="sr-only">Data do aniversario</dt>
            <dd className="font-semibold text-slate-200">{birthdayDate}</dd>
          </div>
        </div>
      </dl>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button
          asChild
          variant="outline"
          className="h-10 border-white/10 bg-white/[0.03] text-xs font-black uppercase tracking-[0.12em] text-white hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
        >
          <Link
            to="/alunos"
            search={{ alunoId: student.id }}
            aria-label={`Abrir cadastro de ${student.nome}`}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir Cadastro
          </Link>
        </Button>

        <Button
          type="button"
          disabled={!whatsappUrl}
          onClick={handleCongratulate}
          className={cn(
            "h-10 bg-primary text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_0_24px_rgba(255,69,0,0.22)] hover:bg-primary/90 focus-visible:ring-primary",
            !whatsappUrl && "cursor-not-allowed opacity-50",
          )}
          aria-label={
            whatsappUrl
              ? `Parabenizar ${student.nome} pelo WhatsApp`
              : `Responsavel de ${student.nome} sem WhatsApp cadastrado`
          }
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          Parabenizar
        </Button>
      </div>
    </article>
  );
}

export const BirthdayCard = memo(BirthdayCardComponent);
