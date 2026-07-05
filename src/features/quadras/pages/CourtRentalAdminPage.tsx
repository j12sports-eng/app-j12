import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  BarChart3,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  ListOrdered,
  MapPin,
  Percent,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Users,
  WalletCards,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { formatApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

import {
  useCourtAvailability,
  useCourtAudit,
  useCourtBlocks,
  useCourtPriceRules,
  useCourtRentalActions,
  useCourtReports,
  useCourtWaitlist,
  useCourts,
  useRenters,
  useReservations,
} from "../hooks/useCourtRental";

import type {
  CalendarView,
  Court,
  CourtBlockPayload,
  CourtMutationPayload,
  CourtStatus,
  PaymentMethod,
  PriceRulePayload,
  RenterMutationPayload,
  ReservationPayload,
  ReservationStatus,
  WaitlistPayload,
  WeekdayKey,
} from "../types/quadras.types";

type TabKey =
  | "dashboard"
  | "calendario"
  | "reservas"
  | "quadras"
  | "disponibilidade"
  | "clientes"
  | "listaEspera"
  | "bloqueios"
  | "relatorios"
  | "auditoria";

type ReservationFormState = {
  allowWaitlist: boolean;
  autoConfirm: boolean;
  courtId: string;
  discountValue: string;
  endAt: string;
  generateCharge: boolean;
  notes: string;
  paymentMethod: PaymentMethod;
  recurrenceDays: WeekdayKey[];
  recurrenceFrequency: "weekly" | "monthly";
  recurrenceInterval: string;
  recurrenceUntil: string;
  recurring: boolean;
  renterDocumento: string;
  renterEmail: string;
  renterId: string;
  renterNome: string;
  renterTelefone: string;
  startAt: string;
  title: string;
};

type CourtFormState = {
  capacidade: string;
  coberta: boolean;
  comprimento: string;
  descricao: string;
  fotos: string;
  iluminacao: boolean;
  largura: string;
  nome: string;
  observacoes: string;
  precoBase: string;
  precoFimSemana: string;
  precoNoturno: string;
  status: CourtStatus;
  tempoMaximoMinutos: string;
  tempoMinimoMinutos: string;
  tipo: string;
  unidade: string;
};

type PriceRuleFormState = {
  active: boolean;
  diaSemana: WeekdayKey | "";
  horarioFim: string;
  horarioInicio: string;
  prioridade: string;
  valorHora: string;
};

type RenterFormState = {
  documento: string;
  email: string;
  nome: string;
  observacoes: string;
  telefone: string;
};

type BlockFormState = {
  courtId: string;
  endAt: string;
  exclusiveForClasses: boolean;
  reason: string;
  startAt: string;
  type: CourtBlockPayload["type"];
};

type WaitlistFormState = {
  courtId: string;
  desiredEndAt: string;
  desiredStartAt: string;
  reason: string;
  renterId: string;
};

const TABS: Array<{ key: TabKey; label: string; icon: typeof CalendarDays }> = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "calendario", label: "Calendario", icon: CalendarDays },
  { key: "reservas", label: "Reservas", icon: CalendarRange },
  { key: "quadras", label: "Quadras", icon: MapPin },
  { key: "disponibilidade", label: "Disponibilidade", icon: Clock3 },
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "listaEspera", label: "Lista de espera", icon: ListOrdered },
  { key: "bloqueios", label: "Bloqueios", icon: Ban },
  { key: "relatorios", label: "Relatorios", icon: WalletCards },
  { key: "auditoria", label: "Auditoria", icon: ShieldCheck },
];

const COURT_STATUSES: Array<{ label: string; value: CourtStatus }> = [
  { label: "Ativa", value: "ativa" },
  { label: "Manutencao", value: "manutencao" },
  { label: "Indisponivel", value: "indisponivel" },
];

const RESERVATION_STATUSES: Array<{ label: string; value: ReservationStatus | "" }> = [
  { label: "Todas", value: "" },
  { label: "Pendentes", value: "pending" },
  { label: "Confirmadas", value: "confirmed" },
  { label: "Concluidas", value: "completed" },
  { label: "Canceladas", value: "cancelled" },
  { label: "Lista de espera", value: "waitlisted" },
];

const PAYMENT_METHODS: Array<{ label: string; value: PaymentMethod }> = [
  { label: "PIX", value: "pix" },
  { label: "Boleto", value: "boleto" },
  { label: "Cartao", value: "cartao" },
  { label: "Dinheiro", value: "dinheiro" },
  { label: "Mensalista", value: "mensalista" },
  { label: "Avulso", value: "avulso" },
  { label: "Cortesia", value: "cortesia" },
];

const WEEKDAYS: Array<{ label: string; value: WeekdayKey | "" }> = [
  { label: "Todos", value: "" },
  { label: "Dom", value: "dom" },
  { label: "Seg", value: "seg" },
  { label: "Ter", value: "ter" },
  { label: "Qua", value: "qua" },
  { label: "Qui", value: "qui" },
  { label: "Sex", value: "sex" },
  { label: "Sab", value: "sab" },
];

const VIEW_OPTIONS: Array<{ label: string; value: CalendarView }> = [
  { label: "Dia", value: "day" },
  { label: "Semana", value: "week" },
  { label: "Mes", value: "month" },
];

function CourtRentalAdminContent() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [calendarDate, setCalendarDate] = useState(() => toDateInput(new Date()));
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [courtFilter, setCourtFilter] = useState("");
  const [reservationStatus, setReservationStatus] = useState<ReservationStatus | "">("");
  const [renterSearch, setRenterSearch] = useState("");
  const [reservationForm, setReservationForm] = useState<ReservationFormState>(() =>
    createReservationForm(toDateInput(new Date())),
  );
  const [courtForm, setCourtForm] = useState<CourtFormState>(() => createCourtForm());
  const [priceRuleForm, setPriceRuleForm] = useState<PriceRuleFormState>(() =>
    createPriceRuleForm(),
  );
  const [renterForm, setRenterForm] = useState<RenterFormState>(() => createRenterForm());
  const [blockForm, setBlockForm] = useState<BlockFormState>(() =>
    createBlockForm(toDateInput(new Date())),
  );
  const [waitlistForm, setWaitlistForm] = useState<WaitlistFormState>(() =>
    createWaitlistForm(toDateInput(new Date())),
  );

  const period = useMemo(
    () => buildClientPeriod(calendarDate, calendarView),
    [calendarDate, calendarView],
  );
  const courtsQuery = useCourts();
  const courts = useMemo(() => courtsQuery.data || [], [courtsQuery.data]);
  const selectedCourtId = courtFilter || courts[0]?.id || "";
  const availabilityFilters = useMemo(
    () => ({
      courtId: selectedCourtId || undefined,
      date: calendarDate,
      view: calendarView,
    }),
    [calendarDate, calendarView, selectedCourtId],
  );
  const reservationFilters = useMemo(
    () => ({
      courtId: selectedCourtId || undefined,
      from: period.from,
      limit: 500,
      status: reservationStatus || undefined,
      to: period.to,
    }),
    [period.from, period.to, reservationStatus, selectedCourtId],
  );

  const rentersQuery = useRenters(renterSearch);
  const reservationsQuery = useReservations(reservationFilters);
  const availabilityQuery = useCourtAvailability(availabilityFilters);
  const blocksQuery = useCourtBlocks(availabilityFilters);
  const waitlistQuery = useCourtWaitlist(selectedCourtId || undefined);
  const reportsQuery = useCourtReports({ date: calendarDate, view: calendarView });
  const priceRulesQuery = useCourtPriceRules(selectedCourtId || undefined);
  const auditQuery = useCourtAudit(80);
  const actions = useCourtRentalActions();

  useEffect(() => {
    if (!courts[0]) return;

    setCourtFilter((current) => current || courts[0].id);
    setReservationForm((current) => ({ ...current, courtId: current.courtId || courts[0].id }));
    setBlockForm((current) => ({ ...current, courtId: current.courtId || courts[0].id }));
    setWaitlistForm((current) => ({ ...current, courtId: current.courtId || courts[0].id }));
  }, [courts]);

  const reservations = reservationsQuery.data || [];
  const renters = rentersQuery.data || [];
  const reports = reportsQuery.data;
  const waitlist = waitlistQuery.data || [];
  const blocks = blocksQuery.data || [];
  const priceRules = priceRulesQuery.data || [];
  const audit = auditQuery.data || [];
  const selectedCourt = courts.find((court) => court.id === selectedCourtId) || courts[0] || null;
  const hasInitialLoading =
    courtsQuery.isLoading && reservationsQuery.isLoading && availabilityQuery.isLoading;
  const errorMessage = readFirstError([
    courtsQuery.error,
    reservationsQuery.error,
    availabilityQuery.error,
    reportsQuery.error,
    rentersQuery.error,
  ]);
  const activeCourts = courts.filter((court) => court.status === "ativa");
  const confirmedReservations = reservations.filter((item) =>
    ["confirmed", "completed"].includes(item.status),
  );
  const today = toDateInput(new Date());
  const todayReservations = reservations.filter((item) => item.startAt.slice(0, 10) === today);
  const todayRevenue = todayReservations
    .filter((item) => ["confirmed", "completed"].includes(item.status))
    .reduce((sum, item) => sum + item.finalValue, 0);
  const busyCourtIds = new Set(
    todayReservations
      .filter((item) => ["confirmed", "pending"].includes(item.status))
      .map((item) => item.court.id),
  );
  const pendingReservations = reservations.filter((item) => item.status === "pending");
  const nextReservation =
    reservations
      .filter((item) => ["confirmed", "pending"].includes(item.status))
      .filter((item) => new Date(item.startAt).getTime() >= Date.now())
      .sort(
        (left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
      )[0] || null;

  async function handleCreateReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const courtId = reservationForm.courtId || selectedCourtId;
    if (!courtId) {
      toast.error("Selecione uma quadra para reservar.");
      return;
    }

    if (!reservationForm.renterId && !reservationForm.renterNome.trim()) {
      toast.error("Selecione ou cadastre um locatario.");
      return;
    }

    const payload: ReservationPayload = {
      allowWaitlist: reservationForm.allowWaitlist,
      autoConfirm: reservationForm.autoConfirm,
      courtId,
      discountValue: readMoney(reservationForm.discountValue),
      endAt: reservationForm.endAt,
      generateCharge: reservationForm.generateCharge,
      notes: reservationForm.notes,
      paymentMethod: reservationForm.paymentMethod,
      recurrence: reservationForm.recurring
        ? {
            daysOfWeek:
              reservationForm.recurrenceFrequency === "weekly"
                ? reservationForm.recurrenceDays.length
                  ? reservationForm.recurrenceDays
                  : [weekdayFromDate(reservationForm.startAt)]
                : [],
            frequency: reservationForm.recurrenceFrequency,
            interval: Number(reservationForm.recurrenceInterval || 1),
            until: reservationForm.recurrenceUntil || reservationForm.startAt.slice(0, 10),
          }
        : null,
      renter: reservationForm.renterId
        ? null
        : {
            documento: reservationForm.renterDocumento,
            email: reservationForm.renterEmail,
            nome: reservationForm.renterNome,
            telefone: reservationForm.renterTelefone,
          },
      renterId: reservationForm.renterId || undefined,
      startAt: reservationForm.startAt,
      title: reservationForm.title || undefined,
    };

    try {
      const result = await actions.createReservation.mutateAsync(payload);
      toast.success(
        result.summary.waitlistedCount > 0
          ? "Horario indisponivel. Locatario enviado para lista de espera."
          : "Reserva criada e integrada ao financeiro/notificacoes.",
      );
      setReservationForm((current) => ({
        ...createReservationForm(calendarDate),
        courtId,
        renterId: current.renterId,
      }));
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel criar a reserva."));
    }
  }

  async function handleCreateCourt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: CourtMutationPayload = {
      descricao: courtForm.descricao,
      dimensoes: {
        comprimento: readMoney(courtForm.comprimento),
        largura: readMoney(courtForm.largura),
        unidade: "m",
      },
      fotos: courtForm.fotos
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      capacidade: Number(courtForm.capacidade || 0),
      coberta: courtForm.coberta,
      iluminacao: courtForm.iluminacao,
      nome: courtForm.nome,
      observacoes: courtForm.observacoes,
      precoBase: readMoney(courtForm.precoBase),
      precoFimSemana: readMoney(courtForm.precoFimSemana),
      precoNoturno: readMoney(courtForm.precoNoturno),
      status: courtForm.status,
      tempoMaximoMinutos: Number(courtForm.tempoMaximoMinutos || 0),
      tempoMinimoMinutos: Number(courtForm.tempoMinimoMinutos || 0),
      tipo: courtForm.tipo,
      unidade: courtForm.unidade,
    };

    try {
      const court = await actions.createCourt.mutateAsync(payload);
      toast.success("Quadra cadastrada.");
      setCourtFilter(court.id);
      setCourtForm(createCourtForm());
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel cadastrar a quadra."));
    }
  }

  async function handleCreatePriceRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourtId) {
      toast.error("Selecione uma quadra para configurar precos.");
      return;
    }

    const payload: PriceRulePayload = {
      active: priceRuleForm.active,
      diaSemana: priceRuleForm.diaSemana,
      horarioFim: priceRuleForm.horarioFim,
      horarioInicio: priceRuleForm.horarioInicio,
      prioridade: Number(priceRuleForm.prioridade || 0),
      valorHora: readMoney(priceRuleForm.valorHora),
    };

    try {
      await actions.upsertPriceRule.mutateAsync({ courtId: selectedCourtId, payload });
      toast.success("Regra de preco salva.");
      setPriceRuleForm(createPriceRuleForm());
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel salvar a regra de preco."));
    }
  }

  async function handleCreateRenter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: RenterMutationPayload = {
      documento: renterForm.documento,
      email: renterForm.email,
      nome: renterForm.nome,
      observacoes: renterForm.observacoes,
      telefone: renterForm.telefone,
    };

    try {
      const renter = await actions.createRenter.mutateAsync(payload);
      toast.success("Locatario cadastrado.");
      setReservationForm((current) => ({ ...current, renterId: renter.id }));
      setRenterForm(createRenterForm());
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel cadastrar o locatario."));
    }
  }

  async function handleCreateBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const courtId = blockForm.courtId || selectedCourtId;

    if (!courtId) {
      toast.error("Selecione uma quadra para bloquear.");
      return;
    }

    try {
      await actions.createBlock.mutateAsync({
        courtId,
        endAt: blockForm.endAt,
        exclusiveForClasses: blockForm.exclusiveForClasses,
        reason: blockForm.reason,
        startAt: blockForm.startAt,
        type: blockForm.type,
      });
      toast.success("Bloqueio registrado.");
      setBlockForm(createBlockForm(calendarDate, courtId));
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel criar o bloqueio."));
    }
  }

  async function handleCancelReservation(reservationId: string) {
    try {
      await actions.cancelReservation.mutateAsync({
        reason: "Cancelamento administrativo",
        reservationId,
      });
      toast.success("Reserva cancelada.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel cancelar a reserva."));
    }
  }

  async function handleUpdateReservationStatus(reservationId: string, status: ReservationStatus) {
    try {
      await actions.updateReservation.mutateAsync({
        payload: { status },
        reservationId,
      });
      toast.success("Status da reserva atualizado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel atualizar a reserva."));
    }
  }

  async function handleConfirmPayment(reservationId: string, paymentMethod?: PaymentMethod) {
    try {
      await actions.confirmReservationPayment.mutateAsync({
        paymentMethod,
        reservationId,
      });
      toast.success("Pagamento confirmado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel confirmar o pagamento."));
    }
  }

  async function handleDuplicateReservation(reservationId: string) {
    try {
      await actions.duplicateReservation.mutateAsync({
        reservationId,
        title: "Reserva duplicada",
      });
      toast.success("Reserva duplicada.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel duplicar a reserva."));
    }
  }

  async function handleResizeReservation(
    reservationId: string,
    startAt: string,
    endAt: string,
    minutes: number,
  ) {
    const nextEndAt = shiftDateTime(endAt, minutes);

    if (new Date(nextEndAt) <= new Date(startAt)) {
      toast.error("A reserva precisa manter duracao positiva.");
      return;
    }

    try {
      await actions.rescheduleReservation.mutateAsync({
        endAt: nextEndAt,
        reservationId,
        startAt,
      });
      toast.success("Duracao da reserva atualizada.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel redimensionar a reserva."));
    }
  }

  async function handleDropReservation(reservationId: string, targetDate: string) {
    const reservation = reservations.find((item) => item.id === reservationId);
    if (!reservation) return;

    try {
      await actions.rescheduleReservation.mutateAsync({
        endAt: `${targetDate}${reservation.endAt.slice(10)}`,
        reservationId,
        startAt: `${targetDate}${reservation.startAt.slice(10)}`,
      });
      toast.success("Reserva reagendada.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel mover a reserva."));
    }
  }

  async function handleCancelPendingReservations() {
    if (pendingReservations.length === 0) {
      toast.info("Nao ha reservas pendentes no periodo.");
      return;
    }

    try {
      await Promise.all(
        pendingReservations.map((reservation) =>
          actions.cancelReservation.mutateAsync({
            reason: "Cancelamento em lote de pendentes",
            reservationId: reservation.id,
          }),
        ),
      );
      toast.success("Reservas pendentes canceladas.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel cancelar todas as pendentes."));
    }
  }

  async function handlePromoteWaitlist(waitlistId: string) {
    try {
      await actions.promoteWaitlistEntry.mutateAsync({ waitlistId });
      toast.success("Lista de espera promovida para reserva.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Horario ainda indisponivel para promocao."));
    }
  }

  async function handleAddWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const courtId = waitlistForm.courtId || selectedCourtId;
    if (!courtId) {
      toast.error("Selecione uma quadra para a lista de espera.");
      return;
    }

    if (!waitlistForm.renterId) {
      toast.error("Selecione um locatario para a lista de espera.");
      return;
    }

    if (new Date(waitlistForm.desiredEndAt) <= new Date(waitlistForm.desiredStartAt)) {
      toast.error("O fim desejado precisa ser posterior ao inicio.");
      return;
    }

    const payload: WaitlistPayload = {
      courtId,
      desiredEndAt: waitlistForm.desiredEndAt,
      desiredStartAt: waitlistForm.desiredStartAt,
      reason: waitlistForm.reason || undefined,
      renterId: waitlistForm.renterId,
    };

    try {
      await actions.addToWaitlist.mutateAsync(payload);
      toast.success("Locatario adicionado a lista de espera.");
      setWaitlistForm((current) => ({
        ...createWaitlistForm(calendarDate, courtId),
        renterId: current.renterId,
      }));
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel adicionar na lista de espera."));
    }
  }

  async function handleCancelBlock(blockId: string) {
    try {
      await actions.cancelBlock.mutateAsync({
        blockId,
        reason: "Bloqueio encerrado pelo painel administrativo",
      });
      toast.success("Bloqueio encerrado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel encerrar o bloqueio."));
    }
  }

  async function handleExportReport(format: "csv" | "excel" | "pdf") {
    try {
      const file = await actions.exportReports.mutateAsync({
        date: calendarDate,
        format,
        view: calendarView,
      });
      downloadBase64File(file.contentBase64, file.filename, file.mimeType);
      toast.success("Relatorio exportado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel exportar o relatorio."));
    }
  }

  if (hasInitialLoading) {
    return (
      <ProtectedRoute roles={["admin", "coordenador"]}>
        <AppShell title="Locacao de Quadras">
          <SkeletonDashboard cards={4} panels={2} withHero />
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <AppShell title="Locacao de Quadras" contentClassName="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,69,0,0.18),rgba(18,18,20,0.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <ShieldCheck className="h-4 w-4" />
                Sprint 16
              </div>
              <h2 className="mt-4 text-2xl font-black text-white md:text-4xl">
                Operacao de reservas, disponibilidade e receita por quadra
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Painel integrado com Agenda, Financeiro, Notificacoes e auditoria administrativa.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[560px]">
              <MetricCard
                icon={MapPin}
                label="Quadras ativas"
                value={activeCourts.length}
                detail={`${courts.length} cadastradas`}
              />
              <MetricCard
                icon={CalendarRange}
                label="Reservas"
                value={reservations.length}
                detail={`${confirmedReservations.length} confirmadas`}
              />
              <MetricCard
                icon={Percent}
                label="Ocupacao"
                value={`${reports?.occupancyRate || 0}%`}
                detail={calendarViewLabel(calendarView)}
              />
              <MetricCard
                icon={WalletCards}
                label="Receita"
                value={formatMoney(reports?.totalRevenue || 0)}
                detail="Periodo atual"
              />
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Nao foi possivel carregar todos os dados de quadras.</p>
              <p className="mt-1 text-red-100/80">{errorMessage}</p>
            </div>
          </div>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-card p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-bold transition",
                      active
                        ? "border-primary/40 bg-primary text-primary-foreground"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_150px_auto]">
              <label className="sr-only" htmlFor="court-filter">
                Filtrar quadra
              </label>
              <select
                id="court-filter"
                value={selectedCourtId}
                onChange={(event) => {
                  setCourtFilter(event.target.value);
                  setReservationForm((current) => ({ ...current, courtId: event.target.value }));
                  setBlockForm((current) => ({ ...current, courtId: event.target.value }));
                }}
                className={fieldClassName}
              >
                {courts.length === 0 ? <option value="">Nenhuma quadra</option> : null}
                {courts.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.nome}
                  </option>
                ))}
              </select>

              <input
                aria-label="Data do calendario"
                type="date"
                value={calendarDate}
                onChange={(event) => setCalendarDate(event.target.value)}
                className={fieldClassName}
              />

              <button
                type="button"
                onClick={() => {
                  void availabilityQuery.refetch();
                  void reservationsQuery.refetch();
                  void reportsQuery.refetch();
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </button>
            </div>
          </div>
        </section>

        {activeTab === "dashboard" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-2xl border border-white/10 bg-card p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <SectionTitle
                  icon={BarChart3}
                  title="Dashboard"
                  description="Indicadores operacionais de reservas, receita e ocupacao."
                />
                <button
                  type="button"
                  disabled={actions.cancelReservation.isPending || pendingReservations.length === 0}
                  onClick={handleCancelPendingReservations}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 text-sm font-bold text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Ban className="h-4 w-4" />
                  Cancelar pendentes
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={CalendarRange}
                  label="Reservas hoje"
                  value={todayReservations.length}
                  detail={`${pendingReservations.length} pendentes no periodo`}
                />
                <MetricCard
                  icon={WalletCards}
                  label="Receita hoje"
                  value={formatMoney(todayRevenue)}
                  detail="Confirmadas e concluidas"
                />
                <MetricCard
                  icon={WalletCards}
                  label="Receita mes"
                  value={formatMoney(reports?.totalRevenue || 0)}
                  detail="Periodo do filtro"
                />
                <MetricCard
                  icon={MapPin}
                  label="Quadras livres"
                  value={Math.max(activeCourts.length - busyCourtIds.size, 0)}
                  detail={`${busyCourtIds.size} ocupadas hoje`}
                />
                <MetricCard
                  icon={Percent}
                  label="Taxa de ocupacao"
                  value={`${reports?.occupancyRate || 0}%`}
                  detail={calendarViewLabel(calendarView)}
                />
                <MetricCard
                  icon={Clock3}
                  label="Proxima reserva"
                  value={nextReservation ? formatDateTime(nextReservation.startAt) : "-"}
                  detail={nextReservation?.court.nome || "Sem proxima reserva"}
                />
                <MetricCard
                  icon={ListOrdered}
                  label="Lista de espera"
                  value={waitlist.filter((item) => item.status === "waiting").length}
                  detail="Aguardando vaga"
                />
                <MetricCard
                  icon={Ban}
                  label="Bloqueios"
                  value={blocks.length}
                  detail="Periodo selecionado"
                />
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <ReportList
                  empty="Sem receita por quadra."
                  items={(reports?.revenueByCourt || []).map((item) => ({
                    detail: `${item.reservations} reservas`,
                    label: item.courtName,
                    value: formatMoney(item.revenue),
                  }))}
                  title="Receita por quadra"
                />
                <ReportList
                  empty="Sem proximas reservas."
                  items={reservations
                    .filter((item) => ["confirmed", "pending"].includes(item.status))
                    .slice(0, 6)
                    .map((item) => ({
                      detail: `${item.renter.nome} - ${formatMoney(item.finalValue)}`,
                      label: item.court.nome,
                      value: formatDateTime(item.startAt),
                    }))}
                  title="Agenda operacional"
                />
              </div>
            </section>

            <div className="space-y-5">
              <ReservationForm
                courts={courts}
                form={reservationForm}
                isSaving={actions.createReservation.isPending}
                onChange={setReservationForm}
                onSubmit={handleCreateReservation}
                renters={renters}
              />
            </div>
          </div>
        ) : null}

        {activeTab === "calendario" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-2xl border border-white/10 bg-card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SectionTitle
                  icon={CalendarDays}
                  title="Disponibilidade"
                  description={`${selectedCourt?.nome || "Quadra"} - ${formatDate(period.from)} a ${formatDate(period.to)}`}
                />
                <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                  {VIEW_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={calendarView === option.value}
                      onClick={() => setCalendarView(option.value)}
                      className={cn(
                        "min-h-9 rounded-lg px-3 text-sm font-bold transition",
                        calendarView === option.value
                          ? "bg-primary text-primary-foreground"
                          : "text-slate-400 hover:text-white",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(availabilityQuery.data?.slots || []).length > 0 ? (
                  availabilityQuery.data?.slots.map((slot) => (
                    <article
                      key={`${slot.courtId}-${slot.date}`}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const reservationId = event.dataTransfer.getData("text/plain");
                        if (reservationId) {
                          void handleDropReservation(reservationId, slot.date);
                        }
                      }}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-white">{formatDate(slot.date)}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {slot.courtName}
                          </p>
                        </div>
                        <StatusBadge status={slot.status} />
                      </div>

                      <div className="mt-4 space-y-2">
                        {slot.windows.length > 0 ? (
                          slot.windows.map((window) => (
                            <div
                              key={`${window.start}-${window.end}`}
                              className="flex items-center gap-2 text-sm text-slate-300"
                            >
                              <Clock3 className="h-4 w-4 text-primary" />
                              {window.start} - {window.end}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">Sem funcionamento cadastrado.</p>
                        )}
                      </div>

                      <div className="mt-4 grid gap-2">
                        <Pill tone="success" label={`${slot.reservations.length} reservas`} />
                        <Pill tone="warning" label={`${slot.blocks.length} bloqueios`} />
                      </div>

                      <div className="mt-4 space-y-2">
                        {slot.reservations.slice(0, 4).map((reservation) => (
                          <button
                            key={reservation.id}
                            type="button"
                            draggable
                            title={`${reservation.renter.nome} - ${reservation.court.nome} - ${formatDateTime(reservation.startAt)}`}
                            onClick={() => {
                              setReservationStatus(reservation.status);
                              setActiveTab("reservas");
                            }}
                            onDragStart={(event) => {
                              event.dataTransfer.setData("text/plain", reservation.id);
                              event.dataTransfer.effectAllowed = "move";
                            }}
                            className={cn(
                              "w-full rounded-xl border px-3 py-2 text-left text-sm transition hover:brightness-110",
                              reservation.status === "confirmed"
                                ? "border-primary/30 bg-primary/15 text-primary"
                                : reservation.status === "pending"
                                  ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
                                  : "border-white/10 bg-black/20 text-slate-300",
                            )}
                          >
                            <span className="block truncate font-black">{reservation.title}</span>
                            <span className="mt-1 block truncate text-xs opacity-80">
                              {reservation.startAt.slice(11, 16)} - {reservation.renter.nome}
                            </span>
                          </button>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    icon={CalendarDays}
                    title="Sem disponibilidade para exibir"
                    description="Cadastre uma quadra ativa ou ajuste o periodo selecionado."
                  />
                )}
              </div>
            </section>

            <div className="space-y-5">
              <ReservationForm
                courts={courts}
                form={reservationForm}
                isSaving={actions.createReservation.isPending}
                onChange={setReservationForm}
                onSubmit={handleCreateReservation}
                renters={renters}
              />

              <BlockForm
                courts={courts}
                form={blockForm}
                isSaving={actions.createBlock.isPending}
                onChange={setBlockForm}
                onSubmit={handleCreateBlock}
              />
            </div>
          </div>
        ) : null}

        {activeTab === "disponibilidade" ? (
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <SectionTitle
              icon={Clock3}
              title="Disponibilidade"
              description="Horarios livres, ocupados, bloqueados, manutencoes e eventos."
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(availabilityQuery.data?.slots || []).length > 0 ? (
                availabilityQuery.data?.slots.map((slot) => {
                  const busyCount = slot.reservations.length + slot.blocks.length;

                  return (
                    <article
                      key={`availability-${slot.courtId}-${slot.date}`}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-white">{slot.courtName}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(slot.date)}</p>
                        </div>
                        <Pill
                          tone={busyCount > 0 ? "warning" : "success"}
                          label={busyCount > 0 ? "Ocupado" : "Livre"}
                        />
                      </div>
                      <div className="mt-4 grid gap-2">
                        {slot.windows.map((window) => (
                          <div
                            key={`${slot.courtId}-${slot.date}-${window.start}`}
                            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300"
                          >
                            Livre base: {window.start} - {window.end}
                          </div>
                        ))}
                        {slot.reservations.map((reservation) => (
                          <div
                            key={reservation.id}
                            className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary"
                          >
                            Reserva: {reservation.startAt.slice(11, 16)} -{" "}
                            {reservation.endAt.slice(11, 16)} | {reservation.renter.nome}
                          </div>
                        ))}
                        {slot.blocks.map((block) => (
                          <div
                            key={block.id}
                            className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
                          >
                            Bloqueio: {block.startAt.slice(11, 16)} - {block.endAt.slice(11, 16)} |{" "}
                            {block.type}
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })
              ) : (
                <EmptyState
                  icon={Clock3}
                  title="Sem dados de disponibilidade"
                  description="Ajuste os filtros de quadra, data ou visualizacao."
                />
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "reservas" ? (
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <SectionTitle
                icon={CalendarRange}
                title="Reservas"
                description="Alteracao de status, cancelamentos e consulta por periodo."
              />
              <select
                aria-label="Filtrar status da reserva"
                value={reservationStatus}
                onChange={(event) =>
                  setReservationStatus(event.target.value as ReservationStatus | "")
                }
                className={fieldClassName}
              >
                {RESERVATION_STATUSES.map((status) => (
                  <option key={status.value || "todas"} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 space-y-3">
              {reservations.length > 0 ? (
                reservations.map((reservation) => (
                  <article
                    key={reservation.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-white">{reservation.title}</h3>
                          <ReservationBadge status={reservation.status} />
                          <Pill tone="info" label={reservation.paymentMethod.toUpperCase()} />
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                          <Info label="Quadra" value={reservation.court.nome} />
                          <Info label="Cliente" value={reservation.renter.nome} />
                          <Info label="Inicio" value={formatDateTime(reservation.startAt)} />
                          <Info label="Valor" value={formatMoney(reservation.finalValue)} />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                        <button
                          type="button"
                          disabled={
                            actions.updateReservation.isPending ||
                            reservation.status === "completed"
                          }
                          onClick={() => handleUpdateReservationStatus(reservation.id, "completed")}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Concluir
                        </button>
                        <button
                          type="button"
                          disabled={
                            actions.confirmReservationPayment.isPending ||
                            reservation.paymentStatus === "paid" ||
                            reservation.status === "cancelled"
                          }
                          onClick={() =>
                            handleConfirmPayment(reservation.id, reservation.paymentMethod)
                          }
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 text-sm font-bold text-primary transition hover:bg-primary/20 disabled:opacity-50"
                        >
                          <CreditCard className="h-4 w-4" />
                          Pagamento
                        </button>
                        <button
                          type="button"
                          disabled={actions.duplicateReservation.isPending}
                          onClick={() => handleDuplicateReservation(reservation.id)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
                        >
                          <Copy className="h-4 w-4" />
                          Duplicar
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={actions.rescheduleReservation.isPending}
                            onClick={() =>
                              handleResizeReservation(
                                reservation.id,
                                reservation.startAt,
                                reservation.endAt,
                                -30,
                              )
                            }
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
                          >
                            -30min
                          </button>
                          <button
                            type="button"
                            disabled={actions.rescheduleReservation.isPending}
                            onClick={() =>
                              handleResizeReservation(
                                reservation.id,
                                reservation.startAt,
                                reservation.endAt,
                                30,
                              )
                            }
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
                          >
                            +30min
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={
                            actions.cancelReservation.isPending ||
                            reservation.status === "cancelled"
                          }
                          onClick={() => handleCancelReservation(reservation.id)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 text-sm font-bold text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <Ban className="h-4 w-4" />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  icon={CalendarRange}
                  title="Nenhuma reserva no periodo"
                  description="Crie uma reserva no calendario ou ajuste os filtros."
                />
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "quadras" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-2xl border border-white/10 bg-card p-5">
              <SectionTitle
                icon={MapPin}
                title="Cadastro de quadras"
                description="Status, funcionamento base, fotos e dimensoes."
              />

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {courts.length > 0 ? (
                  courts.map((court) => (
                    <article
                      key={court.id}
                      className={cn(
                        "rounded-2xl border bg-white/[0.03] p-4 transition",
                        court.id === selectedCourtId ? "border-primary/40" : "border-white/10",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-white">{court.nome}</p>
                          <p className="mt-1 text-sm text-slate-400">
                            {court.tipo} - {court.unidade || "Unidade nao informada"}
                          </p>
                        </div>
                        <StatusBadge status={court.status} />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <Info label="Preco base" value={formatMoney(court.precoBase)} />
                        <Info
                          label="Dimensoes"
                          value={`${court.dimensoes.largura || 0} x ${court.dimensoes.comprimento || 0}${court.dimensoes.unidade || "m"}`}
                        />
                        <Info label="Capacidade" value={court.capacidade || "-"} />
                        <Info
                          label="Noite/FDS"
                          value={`${formatMoney(court.precoNoturno)} / ${formatMoney(court.precoFimSemana)}`}
                        />
                        <Info label="Coberta" value={court.coberta ? "Sim" : "Nao"} />
                        <Info label="Iluminacao" value={court.iluminacao ? "Sim" : "Nao"} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setCourtFilter(court.id)}
                        className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10"
                      >
                        Selecionar
                      </button>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    icon={MapPin}
                    title="Nenhuma quadra cadastrada"
                    description="Cadastre a primeira quadra para iniciar reservas."
                  />
                )}
              </div>
            </section>

            <div className="space-y-5">
              <CourtForm
                form={courtForm}
                isSaving={actions.createCourt.isPending}
                onChange={setCourtForm}
                onSubmit={handleCreateCourt}
              />

              <PriceRuleForm
                form={priceRuleForm}
                isSaving={actions.upsertPriceRule.isPending}
                onChange={setPriceRuleForm}
                onSubmit={handleCreatePriceRule}
                priceRules={priceRules}
                selectedCourt={selectedCourt}
              />
            </div>
          </div>
        ) : null}

        {activeTab === "clientes" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-2xl border border-white/10 bg-card p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <SectionTitle
                  icon={Users}
                  title="Locatarios"
                  description="Cadastro, historico financeiro e pendencias por reserva."
                />
                <label className="relative block md:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={renterSearch}
                    onChange={(event) => setRenterSearch(event.target.value)}
                    placeholder="Buscar cliente"
                    className={cn(fieldClassName, "pl-9")}
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {renters.length > 0 ? (
                  renters.map((renter) => {
                    const renterReservations = reservations.filter(
                      (reservation) => reservation.renter.id === renter.id,
                    );

                    return (
                      <article
                        key={renter.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-black text-white">{renter.nome}</p>
                            <p className="mt-1 text-sm text-slate-400">
                              {renter.telefone || renter.email || "Sem contato"}
                            </p>
                          </div>
                          <Pill
                            tone={renter.status === "ativo" ? "success" : "warning"}
                            label={renter.status}
                          />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Info label="Reservas" value={renterReservations.length} />
                          <Info
                            label="Receita"
                            value={formatMoney(
                              renterReservations.reduce((sum, item) => sum + item.finalValue, 0),
                            )}
                          />
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <EmptyState
                    icon={Users}
                    title="Nenhum locatario encontrado"
                    description="Cadastre um cliente ou ajuste a busca."
                  />
                )}
              </div>
            </section>

            <RenterForm
              form={renterForm}
              isSaving={actions.createRenter.isPending}
              onChange={setRenterForm}
              onSubmit={handleCreateRenter}
            />
          </div>
        ) : null}

        {activeTab === "listaEspera" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-2xl border border-white/10 bg-card p-5">
              <SectionTitle
                icon={ListOrdered}
                title="Lista de espera"
                description="Fila automatica por horario ocupado, com promocao quando houver vaga."
              />

              <div className="mt-5 space-y-3">
                {waitlist.length > 0 ? (
                  waitlist.map((entry, index) => (
                    <article
                      key={entry.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Pill tone="info" label={`#${index + 1}`} />
                            <h3 className="text-lg font-black text-white">{entry.renter.nome}</h3>
                            <Pill
                              tone={entry.status === "waiting" ? "warning" : "success"}
                              label={entry.status}
                            />
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <Info label="Quadra" value={entry.court.nome} />
                            <Info label="Inicio" value={formatDateTime(entry.desiredStartAt)} />
                            <Info label="Motivo" value={entry.reason || "Horario ocupado"} />
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={
                            actions.promoteWaitlistEntry.isPending || entry.status !== "waiting"
                          }
                          onClick={() => handlePromoteWaitlist(entry.id)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 text-sm font-bold text-primary transition hover:bg-primary/20 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Promover
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    icon={ListOrdered}
                    title="Lista de espera vazia"
                    description="Reservas conflitantes com lista autorizada aparecerao aqui."
                  />
                )}
              </div>
            </section>

            <WaitlistForm
              courts={courts}
              form={waitlistForm}
              isSaving={actions.addToWaitlist.isPending}
              onChange={setWaitlistForm}
              onSubmit={handleAddWaitlist}
              renters={renters}
            />
          </div>
        ) : null}

        {activeTab === "bloqueios" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-2xl border border-white/10 bg-card p-5">
              <SectionTitle
                icon={Ban}
                title="Bloqueios"
                description="Manutencao, eventos, campeonatos, feriados e uso interno."
              />

              <div className="mt-5 space-y-3">
                {blocks.length > 0 ? (
                  blocks.map((block) => (
                    <article
                      key={block.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black text-white">{block.court.nome}</h3>
                            <Pill tone="warning" label={block.type.replace("_", " ")} />
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <Info label="Inicio" value={formatDateTime(block.startAt)} />
                            <Info label="Fim" value={formatDateTime(block.endAt)} />
                            <Info label="Motivo" value={block.reason || "Sem motivo"} />
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={actions.cancelBlock.isPending}
                          onClick={() => handleCancelBlock(block.id)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 text-sm font-bold text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <Ban className="h-4 w-4" />
                          Encerrar
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    icon={Ban}
                    title="Nenhum bloqueio no periodo"
                    description="Crie um bloqueio para impedir reservas em manutencoes, eventos ou feriados."
                  />
                )}
              </div>
            </section>

            <BlockForm
              courts={courts}
              form={blockForm}
              isSaving={actions.createBlock.isPending}
              onChange={setBlockForm}
              onSubmit={handleCreateBlock}
            />
          </div>
        ) : null}

        {activeTab === "relatorios" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-2xl border border-white/10 bg-card p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <SectionTitle
                  icon={WalletCards}
                  title="Relatorios"
                  description="Ocupacao, receita, cancelamentos, horarios e clientes frequentes."
                />
                <div className="flex flex-wrap gap-2">
                  <ExportButton
                    icon={FileText}
                    isLoading={actions.exportReports.isPending}
                    label="CSV"
                    onClick={() => handleExportReport("csv")}
                  />
                  <ExportButton
                    icon={FileSpreadsheet}
                    isLoading={actions.exportReports.isPending}
                    label="Excel"
                    onClick={() => handleExportReport("excel")}
                  />
                  <ExportButton
                    icon={Download}
                    isLoading={actions.exportReports.isPending}
                    label="PDF"
                    onClick={() => handleExportReport("pdf")}
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <ReportCard label="Taxa de ocupacao" value={`${reports?.occupancyRate || 0}%`} />
                <ReportCard label="Receita" value={formatMoney(reports?.totalRevenue || 0)} />
                <ReportCard label="Canceladas" value={reports?.cancelledReservations || 0} />
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <ReportList
                  empty="Sem receita por quadra."
                  items={(reports?.revenueByCourt || []).map((item) => ({
                    detail: `${item.reservations} reservas`,
                    label: item.courtName,
                    value: formatMoney(item.revenue),
                  }))}
                  title="Receita por quadra"
                />
                <ReportList
                  empty="Sem horarios utilizados."
                  items={(reports?.mostUsedHours || []).map((item) => ({
                    detail: "Horario",
                    label: item.hour,
                    value: `${item.reservations} usos`,
                  }))}
                  title="Horarios mais usados"
                />
                <ReportList
                  empty="Sem clientes frequentes."
                  items={(reports?.frequentRenters || []).map((item) => ({
                    detail: formatMoney(item.revenue),
                    label: item.renterName,
                    value: `${item.reservations} reservas`,
                  }))}
                  title="Clientes frequentes"
                />
                <ReportList
                  empty="Sem lista de espera."
                  items={waitlist.map((item) => ({
                    detail: item.reason || "Aguardando vaga",
                    label: item.renter.nome,
                    value: formatDateTime(item.desiredStartAt),
                  }))}
                  title="Lista de espera"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-card p-5">
              <SectionTitle
                icon={ShieldCheck}
                title="Auditoria"
                description="Ultimas acoes administrativas de locacao."
              />
              <div className="mt-5 space-y-3">
                {audit.length > 0 ? (
                  audit.slice(0, 12).map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <p className="text-sm font-black text-white">{entry.action}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTime(entry.createdAt)}
                      </p>
                      <p className="mt-2 break-words text-sm text-slate-300">
                        {entry.actorId || "sistema"} - {entry.entityId || "sem entidade"}
                      </p>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    icon={ShieldCheck}
                    title="Sem auditoria recente"
                    description="As proximas acoes de quadras aparecerao aqui."
                  />
                )}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "auditoria" ? (
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <SectionTitle
              icon={ShieldCheck}
              title="Auditoria"
              description="Criacao, alteracao, cancelamento, pagamento, usuario, data e motivo."
            />
            <div className="mt-5 space-y-3">
              {audit.length > 0 ? (
                audit.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px] md:items-center">
                      <div>
                        <p className="text-sm font-black text-white">{entry.action}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateTime(entry.createdAt)}
                        </p>
                        <p className="mt-2 break-words text-sm text-slate-300">
                          {entry.actorId || "sistema"} - {entry.entityId || "sem entidade"}
                        </p>
                      </div>
                      <Pill tone="info" label={entry.actorRole || "sistema"} />
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  icon={ShieldCheck}
                  title="Sem auditoria recente"
                  description="As proximas acoes administrativas aparecerao aqui."
                />
              )}
            </div>
          </section>
        ) : null}
      </AppShell>
    </ProtectedRoute>
  );
}

function ReservationForm({
  courts,
  form,
  isSaving,
  onChange,
  onSubmit,
  renters,
}: {
  courts: Court[];
  form: ReservationFormState;
  isSaving: boolean;
  onChange: (value: ReservationFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  renters: Array<{ id: string; nome: string; telefone: string }>;
}) {
  const selectedRenter = renters.find((renter) => renter.id === form.renterId);

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <SectionTitle
        icon={PlusCircle}
        title="Nova reserva"
        description="Avulsa ou recorrente, com cobranca automatica."
      />

      <div className="mt-5 grid gap-3">
        <Field label="Titulo">
          <input
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            placeholder="Reserva avulsa"
            className={fieldClassName}
          />
        </Field>
        <Field label="Quadra">
          <select
            value={form.courtId}
            onChange={(event) => onChange({ ...form, courtId: event.target.value })}
            className={fieldClassName}
            required
          >
            <option value="">Selecione</option>
            {courts.map((court) => (
              <option key={court.id} value={court.id}>
                {court.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Locatario cadastrado">
          <select
            value={form.renterId}
            onChange={(event) => onChange({ ...form, renterId: event.target.value })}
            className={fieldClassName}
          >
            <option value="">Novo locatario</option>
            {renters.map((renter) => (
              <option key={renter.id} value={renter.id}>
                {renter.nome}
              </option>
            ))}
          </select>
        </Field>

        {!form.renterId ? (
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <Field label="Nome do locatario">
              <input
                value={form.renterNome}
                onChange={(event) => onChange({ ...form, renterNome: event.target.value })}
                className={fieldClassName}
                required={!form.renterId}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Telefone">
                <input
                  value={form.renterTelefone}
                  onChange={(event) => onChange({ ...form, renterTelefone: event.target.value })}
                  className={fieldClassName}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.renterEmail}
                  onChange={(event) => onChange({ ...form, renterEmail: event.target.value })}
                  className={fieldClassName}
                />
              </Field>
            </div>
            <Field label="Documento">
              <input
                value={form.renterDocumento}
                onChange={(event) => onChange({ ...form, renterDocumento: event.target.value })}
                className={fieldClassName}
              />
            </Field>
          </div>
        ) : selectedRenter ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
            Reserva para {selectedRenter.nome}{" "}
            {selectedRenter.telefone ? `- ${selectedRenter.telefone}` : ""}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Inicio">
            <input
              type="datetime-local"
              value={form.startAt.slice(0, 16)}
              onChange={(event) =>
                onChange({ ...form, startAt: normalizeDateTimeInput(event.target.value) })
              }
              className={fieldClassName}
              required
            />
          </Field>
          <Field label="Fim">
            <input
              type="datetime-local"
              value={form.endAt.slice(0, 16)}
              onChange={(event) =>
                onChange({ ...form, endAt: normalizeDateTimeInput(event.target.value) })
              }
              className={fieldClassName}
              required
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pagamento">
            <select
              value={form.paymentMethod}
              onChange={(event) =>
                onChange({ ...form, paymentMethod: event.target.value as PaymentMethod })
              }
              className={fieldClassName}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Desconto">
            <input
              inputMode="decimal"
              value={form.discountValue}
              onChange={(event) => onChange({ ...form, discountValue: event.target.value })}
              className={fieldClassName}
              placeholder="0,00"
            />
          </Field>
        </div>
        <Field label="Observacoes">
          <textarea
            value={form.notes}
            onChange={(event) => onChange({ ...form, notes: event.target.value })}
            className={cn(fieldClassName, "min-h-20 resize-y py-3")}
          />
        </Field>

        <div className="grid gap-2">
          <Toggle
            checked={form.generateCharge}
            label="Gerar cobranca no financeiro"
            onChange={(checked) => onChange({ ...form, generateCharge: checked })}
          />
          <Toggle
            checked={form.autoConfirm}
            label="Confirmar automaticamente"
            onChange={(checked) => onChange({ ...form, autoConfirm: checked })}
          />
          <Toggle
            checked={form.allowWaitlist}
            label="Enviar para lista de espera se houver conflito"
            onChange={(checked) => onChange({ ...form, allowWaitlist: checked })}
          />
          <Toggle
            checked={form.recurring}
            label="Reserva recorrente"
            onChange={(checked) => onChange({ ...form, recurring: checked })}
          />
        </div>

        {form.recurring ? (
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Frequencia">
                <select
                  value={form.recurrenceFrequency}
                  onChange={(event) =>
                    onChange({
                      ...form,
                      recurrenceFrequency: event.target
                        .value as ReservationFormState["recurrenceFrequency"],
                    })
                  }
                  className={fieldClassName}
                >
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </Field>
              <Field label="Intervalo">
                <input
                  inputMode="numeric"
                  value={form.recurrenceInterval}
                  onChange={(event) =>
                    onChange({ ...form, recurrenceInterval: event.target.value })
                  }
                  className={fieldClassName}
                />
              </Field>
              <Field label="Repetir ate">
                <input
                  type="date"
                  value={form.recurrenceUntil}
                  onChange={(event) => onChange({ ...form, recurrenceUntil: event.target.value })}
                  className={fieldClassName}
                  required={form.recurring}
                />
              </Field>
            </div>
            {form.recurrenceFrequency === "weekly" ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WEEKDAYS.filter((day) => day.value).map((day) => {
                  const value = day.value as WeekdayKey;
                  const checked = form.recurrenceDays.includes(value);

                  return (
                    <Toggle
                      key={value}
                      checked={checked}
                      label={day.label}
                      onChange={(nextChecked) =>
                        onChange({
                          ...form,
                          recurrenceDays: nextChecked
                            ? Array.from(new Set([...form.recurrenceDays, value]))
                            : form.recurrenceDays.filter((item) => item !== value),
                        })
                      }
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        <SubmitButton icon={PlusCircle} isSaving={isSaving} label="Criar reserva" />
      </div>
    </form>
  );
}

function BlockForm({
  courts,
  form,
  isSaving,
  onChange,
  onSubmit,
}: {
  courts: Court[];
  form: BlockFormState;
  isSaving: boolean;
  onChange: (value: BlockFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <SectionTitle
        icon={Wrench}
        title="Bloqueio"
        description="Feriado, manutencao, aula exclusiva ou bloqueio administrativo."
      />
      <div className="mt-5 grid gap-3">
        <Field label="Quadra">
          <select
            value={form.courtId}
            onChange={(event) => onChange({ ...form, courtId: event.target.value })}
            className={fieldClassName}
            required
          >
            <option value="">Selecione</option>
            {courts.map((court) => (
              <option key={court.id} value={court.id}>
                {court.nome}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Inicio">
            <input
              type="datetime-local"
              value={form.startAt.slice(0, 16)}
              onChange={(event) =>
                onChange({ ...form, startAt: normalizeDateTimeInput(event.target.value) })
              }
              className={fieldClassName}
              required
            />
          </Field>
          <Field label="Fim">
            <input
              type="datetime-local"
              value={form.endAt.slice(0, 16)}
              onChange={(event) =>
                onChange({ ...form, endAt: normalizeDateTimeInput(event.target.value) })
              }
              className={fieldClassName}
              required
            />
          </Field>
        </div>
        <Field label="Tipo">
          <select
            value={form.type}
            onChange={(event) =>
              onChange({ ...form, type: event.target.value as CourtBlockPayload["type"] })
            }
            className={fieldClassName}
          >
            <option value="administrativo">Administrativo</option>
            <option value="feriado">Feriado</option>
            <option value="manutencao">Manutencao</option>
            <option value="evento">Evento</option>
            <option value="campeonato">Campeonato</option>
            <option value="uso_interno">Uso interno</option>
            <option value="aula">Exclusivo para aulas</option>
            <option value="indisponivel">Indisponivel</option>
          </select>
        </Field>
        <Field label="Motivo">
          <input
            value={form.reason}
            onChange={(event) => onChange({ ...form, reason: event.target.value })}
            className={fieldClassName}
          />
        </Field>
        <Toggle
          checked={form.exclusiveForClasses}
          label="Horario exclusivo para aulas"
          onChange={(checked) => onChange({ ...form, exclusiveForClasses: checked })}
        />
        <SubmitButton icon={Ban} isSaving={isSaving} label="Criar bloqueio" />
      </div>
    </form>
  );
}

function WaitlistForm({
  courts,
  form,
  isSaving,
  onChange,
  onSubmit,
  renters,
}: {
  courts: Court[];
  form: WaitlistFormState;
  isSaving: boolean;
  onChange: (value: WaitlistFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  renters: Array<{ id: string; nome: string }>;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <SectionTitle
        icon={ListOrdered}
        title="Entrar na lista"
        description="Registro manual para horarios ocupados ou disputados."
      />
      <div className="mt-5 grid gap-3">
        <Field label="Quadra">
          <select
            value={form.courtId}
            onChange={(event) => onChange({ ...form, courtId: event.target.value })}
            className={fieldClassName}
            required
          >
            <option value="">Selecione</option>
            {courts.map((court) => (
              <option key={court.id} value={court.id}>
                {court.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Locatario">
          <select
            value={form.renterId}
            onChange={(event) => onChange({ ...form, renterId: event.target.value })}
            className={fieldClassName}
            required
          >
            <option value="">Selecione</option>
            {renters.map((renter) => (
              <option key={renter.id} value={renter.id}>
                {renter.nome}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Inicio desejado">
            <input
              type="datetime-local"
              value={form.desiredStartAt.slice(0, 16)}
              onChange={(event) =>
                onChange({ ...form, desiredStartAt: normalizeDateTimeInput(event.target.value) })
              }
              className={fieldClassName}
              required
            />
          </Field>
          <Field label="Fim desejado">
            <input
              type="datetime-local"
              value={form.desiredEndAt.slice(0, 16)}
              onChange={(event) =>
                onChange({ ...form, desiredEndAt: normalizeDateTimeInput(event.target.value) })
              }
              className={fieldClassName}
              required
            />
          </Field>
        </div>
        <Field label="Motivo">
          <input
            value={form.reason}
            onChange={(event) => onChange({ ...form, reason: event.target.value })}
            className={fieldClassName}
          />
        </Field>
        <SubmitButton icon={PlusCircle} isSaving={isSaving} label="Adicionar a lista" />
      </div>
    </form>
  );
}

function CourtForm({
  form,
  isSaving,
  onChange,
  onSubmit,
}: {
  form: CourtFormState;
  isSaving: boolean;
  onChange: (value: CourtFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <SectionTitle
        icon={Save}
        title="Nova quadra"
        description="Cadastro completo de infraestrutura."
      />
      <div className="mt-5 grid gap-3">
        <Field label="Nome">
          <input
            value={form.nome}
            onChange={(event) => onChange({ ...form, nome: event.target.value })}
            className={fieldClassName}
            required
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <input
              value={form.tipo}
              onChange={(event) => onChange({ ...form, tipo: event.target.value })}
              className={fieldClassName}
              placeholder="Futsal, Society"
              required
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(event) => onChange({ ...form, status: event.target.value as CourtStatus })}
              className={fieldClassName}
            >
              {COURT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Unidade">
          <input
            value={form.unidade}
            onChange={(event) => onChange({ ...form, unidade: event.target.value })}
            className={fieldClassName}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Capacidade">
            <input
              inputMode="numeric"
              value={form.capacidade}
              onChange={(event) => onChange({ ...form, capacidade: event.target.value })}
              className={fieldClassName}
            />
          </Field>
          <Toggle
            checked={form.coberta}
            label="Quadra coberta"
            onChange={(checked) => onChange({ ...form, coberta: checked })}
          />
          <Toggle
            checked={form.iluminacao}
            label="Possui iluminacao"
            onChange={(checked) => onChange({ ...form, iluminacao: checked })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Largura">
            <input
              inputMode="decimal"
              value={form.largura}
              onChange={(event) => onChange({ ...form, largura: event.target.value })}
              className={fieldClassName}
            />
          </Field>
          <Field label="Comprimento">
            <input
              inputMode="decimal"
              value={form.comprimento}
              onChange={(event) => onChange({ ...form, comprimento: event.target.value })}
              className={fieldClassName}
            />
          </Field>
          <Field label="Preco base">
            <input
              inputMode="decimal"
              value={form.precoBase}
              onChange={(event) => onChange({ ...form, precoBase: event.target.value })}
              className={fieldClassName}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Preco noturno">
            <input
              inputMode="decimal"
              value={form.precoNoturno}
              onChange={(event) => onChange({ ...form, precoNoturno: event.target.value })}
              className={fieldClassName}
            />
          </Field>
          <Field label="Preco fim de semana">
            <input
              inputMode="decimal"
              value={form.precoFimSemana}
              onChange={(event) => onChange({ ...form, precoFimSemana: event.target.value })}
              className={fieldClassName}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tempo minimo (min)">
            <input
              inputMode="numeric"
              value={form.tempoMinimoMinutos}
              onChange={(event) => onChange({ ...form, tempoMinimoMinutos: event.target.value })}
              className={fieldClassName}
            />
          </Field>
          <Field label="Tempo maximo (min)">
            <input
              inputMode="numeric"
              value={form.tempoMaximoMinutos}
              onChange={(event) => onChange({ ...form, tempoMaximoMinutos: event.target.value })}
              className={fieldClassName}
            />
          </Field>
        </div>
        <Field label="Descricao">
          <textarea
            value={form.descricao}
            onChange={(event) => onChange({ ...form, descricao: event.target.value })}
            className={cn(fieldClassName, "min-h-20 resize-y py-3")}
          />
        </Field>
        <Field label="Fotos (uma URL por linha)">
          <textarea
            value={form.fotos}
            onChange={(event) => onChange({ ...form, fotos: event.target.value })}
            className={cn(fieldClassName, "min-h-20 resize-y py-3")}
          />
        </Field>
        <Field label="Observacoes">
          <textarea
            value={form.observacoes}
            onChange={(event) => onChange({ ...form, observacoes: event.target.value })}
            className={cn(fieldClassName, "min-h-20 resize-y py-3")}
          />
        </Field>
        <SubmitButton icon={Save} isSaving={isSaving} label="Salvar quadra" />
      </div>
    </form>
  );
}

function PriceRuleForm({
  form,
  isSaving,
  onChange,
  onSubmit,
  priceRules,
  selectedCourt,
}: {
  form: PriceRuleFormState;
  isSaving: boolean;
  onChange: (value: PriceRuleFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  priceRules: Array<{
    active: boolean;
    endTime: string | null;
    id: string;
    pricePerHour: number;
    startTime: string | null;
    weekday: WeekdayKey | null;
  }>;
  selectedCourt: Court | null;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <SectionTitle
        icon={CreditCard}
        title="Tabela de precos"
        description={selectedCourt ? selectedCourt.nome : "Selecione uma quadra"}
      />
      <div className="mt-5 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dia">
            <select
              value={form.diaSemana}
              onChange={(event) =>
                onChange({ ...form, diaSemana: event.target.value as WeekdayKey | "" })
              }
              className={fieldClassName}
            >
              {WEEKDAYS.map((day) => (
                <option key={day.value || "todos"} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Valor/hora">
            <input
              inputMode="decimal"
              value={form.valorHora}
              onChange={(event) => onChange({ ...form, valorHora: event.target.value })}
              className={fieldClassName}
              required
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Inicio">
            <input
              type="time"
              value={form.horarioInicio}
              onChange={(event) => onChange({ ...form, horarioInicio: event.target.value })}
              className={fieldClassName}
            />
          </Field>
          <Field label="Fim">
            <input
              type="time"
              value={form.horarioFim}
              onChange={(event) => onChange({ ...form, horarioFim: event.target.value })}
              className={fieldClassName}
            />
          </Field>
          <Field label="Prioridade">
            <input
              inputMode="numeric"
              value={form.prioridade}
              onChange={(event) => onChange({ ...form, prioridade: event.target.value })}
              className={fieldClassName}
            />
          </Field>
        </div>
        <Toggle
          checked={form.active}
          label="Regra ativa"
          onChange={(checked) => onChange({ ...form, active: checked })}
        />
        <SubmitButton icon={CreditCard} isSaving={isSaving} label="Salvar preco" />

        <div className="space-y-2 pt-2">
          {priceRules.length > 0 ? (
            priceRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
              >
                <span className="font-semibold text-white">
                  {rule.weekday || "todos"} {rule.startTime || "00:00"}-{rule.endTime || "23:59"}
                </span>
                <span className="text-primary">{formatMoney(rule.pricePerHour)}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Nenhuma regra especifica cadastrada.</p>
          )}
        </div>
      </div>
    </form>
  );
}

function RenterForm({
  form,
  isSaving,
  onChange,
  onSubmit,
}: {
  form: RenterFormState;
  isSaving: boolean;
  onChange: (value: RenterFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <SectionTitle
        icon={Users}
        title="Novo locatario"
        description="Cadastro rapido para reservas."
      />
      <div className="mt-5 grid gap-3">
        <Field label="Nome">
          <input
            value={form.nome}
            onChange={(event) => onChange({ ...form, nome: event.target.value })}
            className={fieldClassName}
            required
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Telefone">
            <input
              value={form.telefone}
              onChange={(event) => onChange({ ...form, telefone: event.target.value })}
              className={fieldClassName}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(event) => onChange({ ...form, email: event.target.value })}
              className={fieldClassName}
            />
          </Field>
        </div>
        <Field label="Documento">
          <input
            value={form.documento}
            onChange={(event) => onChange({ ...form, documento: event.target.value })}
            className={fieldClassName}
          />
        </Field>
        <Field label="Observacoes">
          <textarea
            value={form.observacoes}
            onChange={(event) => onChange({ ...form, observacoes: event.target.value })}
            className={cn(fieldClassName, "min-h-20 resize-y py-3")}
          />
        </Field>
        <SubmitButton icon={Save} isSaving={isSaving} label="Salvar locatario" />
      </div>
    </form>
  );
}

function SectionTitle({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof CalendarDays;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-lg font-black text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-slate-200">
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
        className="h-4 w-4 rounded border-white/20 bg-black text-primary focus:ring-primary"
      />
      {label}
    </label>
  );
}

function SubmitButton({
  icon: Icon,
  isSaving,
  label,
}: {
  icon: typeof PlusCircle;
  isSaving: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={isSaving}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

function ExportButton({
  icon: Icon,
  isLoading,
  label,
  onClick,
}: {
  icon: typeof Download;
  isLoading: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={onClick}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: typeof MapPin;
  label: string;
  value: number | string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 truncate text-xl font-black text-white">{value}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{detail}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-primary" />
      </div>
    </article>
  );
}

function ReportCard({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </article>
  );
}

function ReportList({
  empty,
  items,
  title,
}: {
  empty: string;
  items: Array<{ detail: string; label: string; value: string }>;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h4 className="text-sm font-black text-white">{title}</h4>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{item.label}</p>
                <p className="truncate text-xs text-slate-500">{item.detail}</p>
              </div>
              <span className="shrink-0 text-sm font-bold text-primary">{item.value}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">{empty}</p>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-white">{value || "-"}</p>
    </div>
  );
}

function EmptyState({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof CalendarDays;
  title: string;
}) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-slate-500" />
      <p className="mt-3 text-sm font-black text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: CourtStatus }) {
  const label =
    status === "ativa" ? "Ativa" : status === "manutencao" ? "Manutencao" : "Indisponivel";
  const tone =
    status === "ativa"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
      : status === "manutencao"
        ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
        : "border-red-400/20 bg-red-500/10 text-red-100";

  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold", tone)}>{label}</span>
  );
}

function ReservationBadge({ status }: { status: ReservationStatus }) {
  const map: Record<ReservationStatus, { label: string; tone: string }> = {
    cancelled: { label: "Cancelada", tone: "border-red-400/20 bg-red-500/10 text-red-100" },
    completed: {
      label: "Concluida",
      tone: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    },
    confirmed: { label: "Confirmada", tone: "border-primary/25 bg-primary/10 text-primary" },
    pending: { label: "Pendente", tone: "border-amber-400/20 bg-amber-500/10 text-amber-100" },
    waitlisted: { label: "Espera", tone: "border-sky-400/20 bg-sky-500/10 text-sky-100" },
  };
  const item = map[status] || map.pending;

  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold", item.tone)}>
      {item.label}
    </span>
  );
}

function Pill({ label, tone }: { label: string; tone: "info" | "success" | "warning" }) {
  const toneClass = {
    info: "border-sky-400/20 bg-sky-500/10 text-sky-100",
    success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    warning: "border-amber-400/20 bg-amber-500/10 text-amber-100",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-bold",
        toneClass,
      )}
    >
      {label}
    </span>
  );
}

function createReservationForm(date: string): ReservationFormState {
  return {
    allowWaitlist: true,
    autoConfirm: true,
    courtId: "",
    discountValue: "0",
    endAt: `${date}T20:00:00`,
    generateCharge: true,
    notes: "",
    paymentMethod: "pix",
    recurrenceDays: [weekdayFromDate(`${date}T19:00:00`)],
    recurrenceFrequency: "weekly",
    recurrenceInterval: "1",
    recurrenceUntil: date,
    recurring: false,
    renterDocumento: "",
    renterEmail: "",
    renterId: "",
    renterNome: "",
    renterTelefone: "",
    startAt: `${date}T19:00:00`,
    title: "",
  };
}

function createCourtForm(): CourtFormState {
  return {
    capacidade: "12",
    coberta: true,
    comprimento: "40",
    descricao: "",
    fotos: "",
    iluminacao: true,
    largura: "20",
    nome: "",
    observacoes: "",
    precoBase: "180",
    precoFimSemana: "200",
    precoNoturno: "220",
    status: "ativa",
    tempoMaximoMinutos: "180",
    tempoMinimoMinutos: "60",
    tipo: "Futsal",
    unidade: "Unidade Centro",
  };
}

function createPriceRuleForm(): PriceRuleFormState {
  return {
    active: true,
    diaSemana: "",
    horarioFim: "23:00",
    horarioInicio: "18:00",
    prioridade: "10",
    valorHora: "220",
  };
}

function createRenterForm(): RenterFormState {
  return {
    documento: "",
    email: "",
    nome: "",
    observacoes: "",
    telefone: "",
  };
}

function createBlockForm(date: string, courtId = ""): BlockFormState {
  return {
    courtId,
    endAt: `${date}T18:00:00`,
    exclusiveForClasses: false,
    reason: "",
    startAt: `${date}T17:00:00`,
    type: "administrativo",
  };
}

function createWaitlistForm(date: string, courtId = ""): WaitlistFormState {
  return {
    courtId,
    desiredEndAt: `${date}T20:00:00`,
    desiredStartAt: `${date}T19:00:00`,
    reason: "Horario ocupado",
    renterId: "",
  };
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeDateTimeInput(value: string) {
  return value.length === 16 ? `${value}:00` : value;
}

function shiftDateTime(value: string, minutes: number) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);
  return `${toDateInput(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00`;
}

function downloadBase64File(contentBase64: string, filename: string, mimeType: string) {
  if (typeof window === "undefined") return;

  const byteCharacters = window.atob(contentBase64);
  const byteNumbers = Array.from(byteCharacters, (character) => character.charCodeAt(0));
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readMoney(value: string) {
  const normalized = String(value || "0")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(Number(value) || 0);
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function buildClientPeriod(date: string, view: CalendarView) {
  const base = new Date(`${date}T00:00:00`);
  if (view === "month") {
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return {
      from: `${toDateInput(start)}T00:00:00`,
      to: `${toDateInput(end)}T23:59:59`,
    };
  }

  if (view === "week") {
    const start = new Date(base);
    start.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      from: `${toDateInput(start)}T00:00:00`,
      to: `${toDateInput(end)}T23:59:59`,
    };
  }

  return {
    from: `${date}T00:00:00`,
    to: `${date}T23:59:59`,
  };
}

function weekdayFromDate(value: string): WeekdayKey {
  const keys: WeekdayKey[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  return keys[new Date(value).getDay()] || "seg";
}

function calendarViewLabel(view: CalendarView) {
  if (view === "month") return "Mes atual";
  if (view === "week") return "Semana atual";
  return "Dia atual";
}

function readFirstError(errors: unknown[]) {
  const error = errors.find(Boolean);
  return error ? formatApiErrorMessage(error) : "";
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15";

function CourtRentalAdminPage() {
  return <CourtRentalAdminContent />;
}

export { CourtRentalAdminContent, CourtRentalAdminPage };
