const { randomUUID } = require("node:crypto");

const { canManageSystem } = require("../../../../../auth.js");
const { query, tableExists } = require("../../../../config/db.js");

const COURT_STATUSES = new Set(["ativa", "manutencao", "indisponivel"]);
const RESERVATION_STATUSES = new Set([
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "waitlisted",
]);
const BLOCK_TYPES = new Set([
  "administrativo",
  "feriado",
  "manutencao",
  "aula",
  "indisponivel",
  "evento",
  "campeonato",
  "uso_interno",
]);
const PAYMENT_METHODS = new Set([
  "pix",
  "boleto",
  "cartao",
  "dinheiro",
  "cortesia",
  "mensalista",
  "avulso",
]);
const PAYMENT_STATUSES = new Set(["pending", "paid", "cancelled", "refunded"]);
const WEEKDAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const DEFAULT_OPENING_HOURS = {
  dom: [],
  seg: [{ start: "08:00", end: "22:00" }],
  ter: [{ start: "08:00", end: "22:00" }],
  qua: [{ start: "08:00", end: "22:00" }],
  qui: [{ start: "08:00", end: "22:00" }],
  sex: [{ start: "08:00", end: "22:00" }],
  sab: [{ start: "08:00", end: "18:00" }],
};

class CourtRentalService {
  constructor(options = {}) {
    this.query = options.query || query;
    this.tableExists = options.tableExists || tableExists;
    this.now = options.now || (() => new Date());
    this.io = options.io || null;
  }

  async ensureSchema() {
    await ensureCourtRentalSchema({
      query: this.query,
      tableExists: this.tableExists,
    });
  }

  assertAdmin(authUser) {
    if (!canManageSystem(authUser)) {
      throw httpError("Sem permissao para gerenciar locacao de quadras.", 403);
    }
  }

  actor(authUser) {
    return text(authUser?.email || authUser?.login || authUser?.id || "sistema", 191);
  }

  async listCourts(filters = {}) {
    await this.ensureSchema();
    const params = [];
    const where = [];

    if (filters.status) {
      where.push("quadra.status = ?");
      params.push(normalizeCourtStatus(filters.status));
    }

    const rows = await this.query(
      `
        SELECT *
        FROM j12_quadras quadra
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY quadra.nome ASC
      `,
      params,
    );

    return readRows(rows).map(mapCourtRow);
  }

  async getCourtById(courtId) {
    await this.ensureSchema();
    const id = requiredText(courtId, "quadraId", 64);
    const rows = await this.query("SELECT * FROM j12_quadras WHERE id = ? LIMIT 1", [id]);
    const court = readRows(rows)[0];

    if (!court) {
      throw httpError("Quadra nao encontrada.", 404);
    }

    return mapCourtRow(court);
  }

  async createCourt(payload = {}, authUser = null) {
    await this.ensureSchema();
    const court = normalizeCourtPayload(payload);
    const id = court.id || createId("quadra");

    await this.query(
      `
        INSERT INTO j12_quadras (
          id,
          nome,
          tipo,
          descricao,
          fotos_json,
          dimensoes_json,
          capacidade,
          coberta,
          iluminacao,
          status,
          unidade,
          funcionamento_json,
          preco_base,
          preco_noturno,
          preco_fim_semana,
          tempo_minimo_minutos,
          tempo_maximo_minutos,
          observacoes,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        court.nome,
        court.tipo,
        court.descricao,
        JSON.stringify(court.fotos),
        JSON.stringify(court.dimensoes),
        court.capacidade,
        court.coberta ? 1 : 0,
        court.iluminacao ? 1 : 0,
        court.status,
        court.unidade,
        JSON.stringify(court.funcionamento),
        court.precoBase,
        court.precoNoturno,
        court.precoFimSemana,
        court.tempoMinimoMinutos,
        court.tempoMaximoMinutos,
        court.observacoes,
        this.actor(authUser),
        this.actor(authUser),
      ],
    );

    await this.audit("court.created", id, { nome: court.nome }, authUser);
    return this.getCourtById(id);
  }

  async updateCourt(courtId, payload = {}, authUser = null) {
    await this.ensureSchema();
    const current = await this.getCourtById(courtId);
    const court = normalizeCourtPayload({ ...current, ...payload, id: current.id });

    await this.query(
      `
        UPDATE j12_quadras
        SET
          nome = ?,
          tipo = ?,
          descricao = ?,
          fotos_json = ?,
          dimensoes_json = ?,
          capacidade = ?,
          coberta = ?,
          iluminacao = ?,
          status = ?,
          unidade = ?,
          funcionamento_json = ?,
          preco_base = ?,
          preco_noturno = ?,
          preco_fim_semana = ?,
          tempo_minimo_minutos = ?,
          tempo_maximo_minutos = ?,
          observacoes = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        court.nome,
        court.tipo,
        court.descricao,
        JSON.stringify(court.fotos),
        JSON.stringify(court.dimensoes),
        court.capacidade,
        court.coberta ? 1 : 0,
        court.iluminacao ? 1 : 0,
        court.status,
        court.unidade,
        JSON.stringify(court.funcionamento),
        court.precoBase,
        court.precoNoturno,
        court.precoFimSemana,
        court.tempoMinimoMinutos,
        court.tempoMaximoMinutos,
        court.observacoes,
        this.actor(authUser),
        current.id,
      ],
    );

    await this.audit("court.updated", current.id, { nome: court.nome }, authUser);
    return this.getCourtById(current.id);
  }

  async listPriceRules(courtId) {
    await this.ensureSchema();
    const id = requiredText(courtId, "quadraId", 64);
    const rows = await this.query(
      `
        SELECT *
        FROM j12_quadra_price_rules
        WHERE quadra_id = ?
        ORDER BY priority DESC, weekday ASC, start_time ASC
      `,
      [id],
    );

    return readRows(rows).map(mapPriceRuleRow);
  }

  async upsertPriceRule(courtId, payload = {}, authUser = null) {
    await this.ensureSchema();
    const court = await this.getCourtById(courtId);
    const rule = normalizePriceRulePayload(payload);
    const id = text(payload.id, 64) || createId("preco");

    await this.query(
      `
        INSERT INTO j12_quadra_price_rules (
          id,
          quadra_id,
          weekday,
          start_time,
          end_time,
          price_per_hour,
          currency,
          priority,
          active,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          weekday = VALUES(weekday),
          start_time = VALUES(start_time),
          end_time = VALUES(end_time),
          price_per_hour = VALUES(price_per_hour),
          currency = VALUES(currency),
          priority = VALUES(priority),
          active = VALUES(active),
          updated_by = VALUES(updated_by),
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        id,
        court.id,
        rule.weekday,
        rule.startTime,
        rule.endTime,
        rule.pricePerHour,
        rule.currency,
        rule.priority,
        rule.active ? 1 : 0,
        this.actor(authUser),
        this.actor(authUser),
      ],
    );

    await this.audit("price_rule.upserted", id, { courtId: court.id }, authUser);
    const rows = await this.query("SELECT * FROM j12_quadra_price_rules WHERE id = ? LIMIT 1", [
      id,
    ]);
    return mapPriceRuleRow(readRows(rows)[0]);
  }

  async listRenters(filters = {}) {
    await this.ensureSchema();
    const search = text(filters.search, 80).toLowerCase();
    const params = [];
    let where = "";

    if (search) {
      where = "WHERE LOWER(nome) LIKE ? OR LOWER(email) LIKE ? OR telefone LIKE ?";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const rows = await this.query(
      `
        SELECT *
        FROM j12_locatarios
        ${where}
        ORDER BY nome ASC
        LIMIT 200
      `,
      params,
    );

    return readRows(rows).map(mapRenterRow);
  }

  async getRenterById(renterId) {
    await this.ensureSchema();
    const id = requiredText(renterId, "locatarioId", 64);
    const rows = await this.query("SELECT * FROM j12_locatarios WHERE id = ? LIMIT 1", [id]);
    const renter = readRows(rows)[0];

    if (!renter) {
      throw httpError("Locatario nao encontrado.", 404);
    }

    return mapRenterRow(renter);
  }

  async createRenter(payload = {}, authUser = null) {
    await this.ensureSchema();
    const renter = normalizeRenterPayload(payload);
    const id = renter.id || createId("loc");

    await this.query(
      `
        INSERT INTO j12_locatarios (
          id,
          nome,
          email,
          telefone,
          documento,
          status,
          observacoes,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        renter.nome,
        renter.email,
        renter.telefone,
        renter.documento,
        renter.status,
        renter.observacoes,
        this.actor(authUser),
        this.actor(authUser),
      ],
    );

    await this.audit("renter.created", id, { nome: renter.nome }, authUser);
    return this.getRenterById(id);
  }

  async listReservations(filters = {}) {
    await this.ensureSchema();
    const params = [];
    const where = [];

    if (filters.courtId) {
      where.push("reserva.quadra_id = ?");
      params.push(String(filters.courtId));
    }

    if (filters.renterId) {
      where.push("reserva.locatario_id = ?");
      params.push(String(filters.renterId));
    }

    if (filters.status) {
      where.push("reserva.status = ?");
      params.push(normalizeReservationStatus(filters.status));
    }

    if (filters.from) {
      where.push("reserva.end_at > ?");
      params.push(toSqlDateTime(filters.from));
    }

    if (filters.to) {
      where.push("reserva.start_at < ?");
      params.push(toSqlDateTime(filters.to));
    }

    const rows = await this.query(
      `
        SELECT
          reserva.*,
          quadra.nome AS quadra_nome,
          quadra.tipo AS quadra_tipo,
          locatario.nome AS locatario_nome,
          locatario.email AS locatario_email,
          locatario.telefone AS locatario_telefone
        FROM j12_quadra_reservas reserva
        INNER JOIN j12_quadras quadra ON quadra.id = reserva.quadra_id
        INNER JOIN j12_locatarios locatario ON locatario.id = reserva.locatario_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY reserva.start_at ASC, reserva.created_at DESC
        LIMIT ?
      `,
      [...params, normalizeLimit(filters.limit, 500)],
    );

    return readRows(rows).map(mapReservationRow);
  }

  async createReservation(payload = {}, authUser = null) {
    await this.ensureSchema();
    const input = normalizeReservationPayload(payload);
    const court = await this.getCourtById(input.courtId);
    const renter = await this.resolveRenter(input, authUser);
    const occurrences = buildReservationOccurrences(input);
    const created = [];
    const waitlisted = [];

    for (const occurrence of occurrences) {
      const validation = await this.validateAvailability({
        courtId: court.id,
        endAt: occurrence.endAt,
        startAt: occurrence.startAt,
      });

      if (!validation.available) {
        if (input.allowWaitlist) {
          waitlisted.push(
            await this.addToWaitlist(
              {
                courtId: court.id,
                desiredEndAt: occurrence.endAt,
                desiredStartAt: occurrence.startAt,
                reason: validation.reason,
                renterId: renter.id,
              },
              authUser,
            ),
          );
          continue;
        }

        const error = httpError(validation.reason || "Horario indisponivel para reserva.", 409);
        error.details = validation;
        throw error;
      }

      const quote = await this.calculateQuote({
        courtId: court.id,
        couponCode: input.couponCode,
        discountValue: input.discountValue,
        endAt: occurrence.endAt,
        startAt: occurrence.startAt,
      });
      const reservation = await this.insertReservation({
        actor: this.actor(authUser),
        court,
        input,
        occurrence,
        quote,
        renter,
      });

      created.push(reservation);
    }

    if (created.length > 0) {
      await this.notifyReservationChange("reservation.created", created[0], authUser);
    }

    return {
      created,
      waitlisted,
      summary: {
        createdCount: created.length,
        waitlistedCount: waitlisted.length,
      },
    };
  }

  async updateReservation(reservationId, payload = {}, authUser = null) {
    await this.ensureSchema();
    const current = await this.getReservationById(reservationId);
    const status = payload.status ? normalizeReservationStatus(payload.status) : current.status;
    const paymentStatus = payload.paymentStatus
      ? normalizePaymentStatus(payload.paymentStatus)
      : current.paymentStatus;
    const notes =
      typeof payload.notes === "undefined" && typeof payload.observacoes === "undefined"
        ? current.notes
        : nullableText(payload.notes ?? payload.observacoes, 2000);

    await this.query(
      `
        UPDATE j12_quadra_reservas
        SET status = ?, payment_status = ?, notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [status, paymentStatus, notes, this.actor(authUser), current.id],
    );

    await this.audit("reservation.updated", current.id, { status }, authUser);
    const updated = await this.getReservationById(current.id);
    await this.notifyReservationChange("reservation.updated", updated, authUser);
    return updated;
  }

  async confirmReservationPayment(reservationId, payload = {}, authUser = null) {
    await this.ensureSchema();
    const current = await this.getReservationById(reservationId);

    // A cancelled reservation cannot be revived financially or settle its linked charge.
    if (current.status === "cancelled") {
      throw httpError("Nao e permitido confirmar pagamento de uma reserva cancelada.", 409);
    }

    const paymentMethod = payload.paymentMethod
      ? normalizePaymentMethod(payload.paymentMethod)
      : current.paymentMethod;
    const paidAt = normalizeDate(payload.paidAt || payload.dataPagamento) || todayISO();

    await this.query(
      `
        UPDATE j12_quadra_reservas
        SET
          status = CASE WHEN status = 'cancelled' THEN status ELSE 'confirmed' END,
          payment_status = 'paid',
          payment_method = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [paymentMethod, this.actor(authUser), current.id],
    );

    if (current.financialChargeId && (await this.safeTableExists("j12_financeiro_cobrancas"))) {
      await this.query(
        `
          UPDATE j12_financeiro_cobrancas
          SET
            status = 'pago',
            pago_em = ?,
            data_pagamento = ?,
            forma_pagamento = ?,
            alterado_por = ?,
            alterado_em = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [paidAt, paidAt, paymentMethod, this.actor(authUser), current.financialChargeId],
      );
    }

    await this.audit(
      "reservation.payment_confirmed",
      current.id,
      {
        paidAt,
        paymentMethod,
      },
      authUser,
    );
    const updated = await this.getReservationById(current.id);
    await this.notifyReservationChange("reservation.payment_confirmed", updated, authUser);
    return updated;
  }

  async duplicateReservation(reservationId, payload = {}, authUser = null) {
    await this.ensureSchema();
    const current = await this.getReservationById(reservationId);
    const startAt = requiredDateTime(
      payload.startAt || payload.start_at || current.startAt,
      "startAt",
    );
    const endAt = requiredDateTime(payload.endAt || payload.end_at || current.endAt, "endAt");
    const validation = await this.validateAvailability({
      courtId: payload.courtId || payload.quadraId || current.court.id,
      endAt,
      startAt,
    });

    if (!validation.available) {
      const error = httpError(validation.reason || "Horario indisponivel para duplicacao.", 409);
      error.details = validation;
      throw error;
    }

    const court = await this.getCourtById(payload.courtId || payload.quadraId || current.court.id);
    const renter = await this.getRenterById(
      payload.renterId || payload.locatarioId || current.renter.id,
    );
    const quote = await this.calculateQuote({
      courtId: court.id,
      discountValue: current.discountValue,
      endAt,
      startAt,
    });
    const duplicated = await this.insertReservation({
      actor: this.actor(authUser),
      court,
      input: {
        autoConfirm: payload.autoConfirm ?? current.status === "confirmed",
        couponCode: current.couponCode,
        generateCharge: payload.generateCharge !== false,
        idempotencyKey: payload.idempotencyKey,
        notes: payload.notes ?? current.notes,
        paymentMethod: payload.paymentMethod
          ? normalizePaymentMethod(payload.paymentMethod)
          : current.paymentMethod,
        recurrence: null,
        title: payload.title || `${current.title} (copia)`,
      },
      occurrence: {
        endAt,
        recurrenceGroupId: null,
        startAt,
      },
      quote,
      renter,
    });

    await this.audit(
      "reservation.duplicated",
      duplicated.id,
      {
        sourceReservationId: current.id,
      },
      authUser,
    );
    await this.notifyReservationChange("reservation.created", duplicated, authUser);
    return duplicated;
  }

  async cancelReservation(reservationId, payload = {}, authUser = null) {
    await this.ensureSchema();
    const current = await this.getReservationById(reservationId);
    const reason = nullableText(payload.reason ?? payload.motivo, 500);

    await this.query(
      `
        UPDATE j12_quadra_reservas
        SET
          status = 'cancelled',
          payment_status = CASE WHEN payment_status = 'paid' THEN payment_status ELSE 'cancelled' END,
          cancel_reason = ?,
          cancelled_at = CURRENT_TIMESTAMP,
          cancelled_by = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [reason, this.actor(authUser), this.actor(authUser), current.id],
    );

    if (current.financialChargeId && (await this.safeTableExists("j12_financeiro_cobrancas"))) {
      await this.query(
        `
          UPDATE j12_financeiro_cobrancas
          SET status = 'cancelado', cancelamento_motivo = ?, alterado_por = ?, alterado_em = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [reason, this.actor(authUser), current.financialChargeId],
      );
    }

    await this.audit("reservation.cancelled", current.id, { reason }, authUser);
    const cancelled = await this.getReservationById(current.id);
    await this.notifyReservationChange("reservation.cancelled", cancelled, authUser);
    const waitlistPromotion = await this.promoteWaitlistForReservation(cancelled, authUser);
    return {
      ...cancelled,
      waitlistPromotion,
    };
  }

  async rescheduleReservation(reservationId, payload = {}, authUser = null) {
    await this.ensureSchema();
    const current = await this.getReservationById(reservationId);
    const nextStartAt = requiredDateTime(payload.startAt ?? payload.start_at, "startAt");
    const nextEndAt = requiredDateTime(payload.endAt ?? payload.end_at, "endAt");
    const validation = await this.validateAvailability({
      courtId: current.court.id,
      endAt: nextEndAt,
      excludeReservationId: current.id,
      startAt: nextStartAt,
    });

    if (!validation.available) {
      const error = httpError(validation.reason || "Novo horario indisponivel.", 409);
      error.details = validation;
      throw error;
    }

    const quote = await this.calculateQuote({
      courtId: current.court.id,
      discountValue: current.discountValue,
      endAt: nextEndAt,
      startAt: nextStartAt,
    });

    await this.query(
      `
        UPDATE j12_quadra_reservas
        SET
          start_at = ?,
          end_at = ?,
          duration_minutes = ?,
          value = ?,
          final_value = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        toSqlDateTime(nextStartAt),
        toSqlDateTime(nextEndAt),
        quote.durationMinutes,
        quote.subtotal,
        quote.total,
        this.actor(authUser),
        current.id,
      ],
    );

    await this.audit(
      "reservation.rescheduled",
      current.id,
      {
        endAt: nextEndAt,
        startAt: nextStartAt,
      },
      authUser,
    );
    const updated = await this.getReservationById(current.id);
    await this.notifyReservationChange("reservation.rescheduled", updated, authUser);
    return updated;
  }

  async getReservationById(reservationId) {
    const rows = await this.query(
      `
        SELECT
          reserva.*,
          quadra.nome AS quadra_nome,
          quadra.tipo AS quadra_tipo,
          locatario.nome AS locatario_nome,
          locatario.email AS locatario_email,
          locatario.telefone AS locatario_telefone
        FROM j12_quadra_reservas reserva
        INNER JOIN j12_quadras quadra ON quadra.id = reserva.quadra_id
        INNER JOIN j12_locatarios locatario ON locatario.id = reserva.locatario_id
        WHERE reserva.id = ?
        LIMIT 1
      `,
      [requiredText(reservationId, "reservationId", 64)],
    );
    const row = readRows(rows)[0];

    if (!row) {
      throw httpError("Reserva nao encontrada.", 404);
    }

    return mapReservationRow(row);
  }

  async getAvailability(filters = {}) {
    await this.ensureSchema();
    const period = buildPeriod(filters);
    const courts = filters.courtId
      ? [await this.getCourtById(filters.courtId)]
      : await this.listCourts();
    const reservations = await this.listReservations({
      courtId: filters.courtId,
      from: period.startAt,
      limit: 1000,
      to: period.endAt,
    });
    const blocks = await this.listBlocks({
      courtId: filters.courtId,
      from: period.startAt,
      to: period.endAt,
    });

    return {
      blocks,
      courts,
      period,
      reservations,
      slots: buildAvailabilitySlots({
        blocks,
        courts,
        period,
        reservations,
      }),
    };
  }

  async validateAvailability(input = {}) {
    await this.ensureSchema();
    const court = await this.getCourtById(input.courtId);
    const startAt = requiredDateTime(input.startAt, "startAt");
    const endAt = requiredDateTime(input.endAt, "endAt");

    if (new Date(startAt) >= new Date(endAt)) {
      return {
        available: false,
        code: "INVALID_WINDOW",
        reason: "Horario final deve ser posterior ao inicial.",
      };
    }

    const durationMinutes = durationBetweenMinutes(startAt, endAt);

    if (court.tempoMinimoMinutos > 0 && durationMinutes < court.tempoMinimoMinutos) {
      return {
        available: false,
        code: "BELOW_MINIMUM_DURATION",
        reason: `Tempo minimo da quadra e ${court.tempoMinimoMinutos} minutos.`,
      };
    }

    if (court.tempoMaximoMinutos > 0 && durationMinutes > court.tempoMaximoMinutos) {
      return {
        available: false,
        code: "ABOVE_MAXIMUM_DURATION",
        reason: `Tempo maximo da quadra e ${court.tempoMaximoMinutos} minutos.`,
      };
    }

    if (court.status !== "ativa") {
      return {
        available: false,
        code: "COURT_INACTIVE",
        reason: "Quadra nao esta ativa para reservas.",
      };
    }

    if (!isWithinOpeningHours(court.funcionamento, startAt, endAt)) {
      return {
        available: false,
        code: "OUTSIDE_OPENING_HOURS",
        reason: "Horario fora do funcionamento da quadra.",
      };
    }

    const conflicts = await this.findConflicts({
      courtId: court.id,
      endAt,
      excludeReservationId: input.excludeReservationId,
      startAt,
    });

    if (conflicts.length > 0) {
      return {
        available: false,
        code: "CONFLICT",
        conflicts,
        reason: "Ja existe reserva ou bloqueio nesse horario.",
      };
    }

    return {
      available: true,
      code: "AVAILABLE",
      conflicts: [],
      reason: null,
    };
  }

  async findConflicts(input = {}) {
    const reservationParams = [
      requiredText(input.courtId, "quadraId", 64),
      toSqlDateTime(input.endAt),
      toSqlDateTime(input.startAt),
    ];
    let excludeClause = "";

    if (input.excludeReservationId) {
      excludeClause = "AND reserva.id <> ?";
      reservationParams.push(String(input.excludeReservationId));
    }

    const reservations = await this.query(
      `
        SELECT id, start_at, end_at, status
        FROM j12_quadra_reservas reserva
        WHERE reserva.quadra_id = ?
          AND reserva.status NOT IN ('cancelled', 'waitlisted')
          AND reserva.start_at < ?
          AND reserva.end_at > ?
          ${excludeClause}
      `,
      reservationParams,
    );
    const blocks = await this.query(
      `
        SELECT id, start_at, end_at, block_type, reason
        FROM j12_quadra_bloqueios bloqueio
        WHERE bloqueio.quadra_id = ?
          AND bloqueio.active = 1
          AND bloqueio.start_at < ?
          AND bloqueio.end_at > ?
      `,
      [String(input.courtId), toSqlDateTime(input.endAt), toSqlDateTime(input.startAt)],
    );

    return [
      ...readRows(reservations).map((row) => ({
        id: String(row.id),
        endAt: fromSqlDateTime(row.end_at),
        source: "reservation",
        startAt: fromSqlDateTime(row.start_at),
        status: row.status,
      })),
      ...readRows(blocks).map((row) => ({
        id: String(row.id),
        endAt: fromSqlDateTime(row.end_at),
        reason: row.reason,
        source: "block",
        startAt: fromSqlDateTime(row.start_at),
        type: row.block_type,
      })),
    ];
  }

  async calculateQuote(input = {}) {
    await this.ensureSchema();
    const court = await this.getCourtById(input.courtId);
    const startAt = requiredDateTime(input.startAt, "startAt");
    const endAt = requiredDateTime(input.endAt, "endAt");
    const rules = await this.listPriceRules(court.id);

    return calculateReservationValue({
      basePrice: resolveCourtPriceForPeriod(court, startAt, endAt),
      couponCode: input.couponCode,
      discountValue: input.discountValue,
      endAt,
      rules,
      startAt,
    });
  }

  async listBlocks(filters = {}) {
    await this.ensureSchema();
    const params = [];
    const where = ["bloqueio.active = 1"];

    if (filters.courtId) {
      where.push("bloqueio.quadra_id = ?");
      params.push(String(filters.courtId));
    }

    if (filters.from) {
      where.push("bloqueio.end_at > ?");
      params.push(toSqlDateTime(filters.from));
    }

    if (filters.to) {
      where.push("bloqueio.start_at < ?");
      params.push(toSqlDateTime(filters.to));
    }

    const rows = await this.query(
      `
        SELECT bloqueio.*, quadra.nome AS quadra_nome
        FROM j12_quadra_bloqueios bloqueio
        INNER JOIN j12_quadras quadra ON quadra.id = bloqueio.quadra_id
        WHERE ${where.join(" AND ")}
        ORDER BY bloqueio.start_at ASC
      `,
      params,
    );

    return readRows(rows).map(mapBlockRow);
  }

  async createBlock(payload = {}, authUser = null) {
    await this.ensureSchema();
    const block = normalizeBlockPayload(payload);
    const court = await this.getCourtById(block.courtId);
    const id = createId("bloq");

    await this.query(
      `
        INSERT INTO j12_quadra_bloqueios (
          id,
          quadra_id,
          block_type,
          start_at,
          end_at,
          reason,
          recurrence_json,
          exclusive_for_classes,
          active,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `,
      [
        id,
        court.id,
        block.type,
        toSqlDateTime(block.startAt),
        toSqlDateTime(block.endAt),
        block.reason,
        JSON.stringify(block.recurrence),
        block.exclusiveForClasses ? 1 : 0,
        this.actor(authUser),
        this.actor(authUser),
      ],
    );

    await this.audit("block.created", id, { courtId: court.id, type: block.type }, authUser);
    return (
      await this.listBlocks({ courtId: court.id, from: block.startAt, to: block.endAt })
    ).find((item) => item.id === id);
  }

  async updateBlock(blockId, payload = {}, authUser = null) {
    await this.ensureSchema();
    const current = await this.getBlockById(blockId);
    const block = normalizeBlockPayload({
      courtId: payload.courtId || current.court.id,
      endAt: payload.endAt || current.endAt,
      exclusiveForClasses:
        typeof payload.exclusiveForClasses === "undefined"
          ? current.exclusiveForClasses
          : payload.exclusiveForClasses,
      reason: payload.reason ?? current.reason,
      recurrence: payload.recurrence ?? current.recurrence,
      startAt: payload.startAt || current.startAt,
      type: payload.type || current.type,
    });
    const court = await this.getCourtById(block.courtId);

    await this.query(
      `
        UPDATE j12_quadra_bloqueios
        SET
          quadra_id = ?,
          block_type = ?,
          start_at = ?,
          end_at = ?,
          reason = ?,
          recurrence_json = ?,
          exclusive_for_classes = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        court.id,
        block.type,
        toSqlDateTime(block.startAt),
        toSqlDateTime(block.endAt),
        block.reason,
        JSON.stringify(block.recurrence),
        block.exclusiveForClasses ? 1 : 0,
        this.actor(authUser),
        current.id,
      ],
    );

    await this.audit(
      "block.updated",
      current.id,
      { courtId: court.id, type: block.type },
      authUser,
    );
    return this.getBlockById(current.id);
  }

  async cancelBlock(blockId, payload = {}, authUser = null) {
    await this.ensureSchema();
    const current = await this.getBlockById(blockId);
    const reason = nullableText(payload.reason || payload.motivo || current.reason, 500);

    await this.query(
      `
        UPDATE j12_quadra_bloqueios
        SET active = 0, reason = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [reason, this.actor(authUser), current.id],
    );

    await this.audit("block.cancelled", current.id, { reason }, authUser);
    return {
      ...current,
      active: false,
      reason: reason || current.reason,
    };
  }

  async getBlockById(blockId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        SELECT bloqueio.*, quadra.nome AS quadra_nome
        FROM j12_quadra_bloqueios bloqueio
        INNER JOIN j12_quadras quadra ON quadra.id = bloqueio.quadra_id
        WHERE bloqueio.id = ?
        LIMIT 1
      `,
      [requiredText(blockId, "blockId", 64)],
    );
    const row = readRows(rows)[0];

    if (!row) {
      throw httpError("Bloqueio nao encontrado.", 404);
    }

    return mapBlockRow(row);
  }

  async addToWaitlist(payload = {}, authUser = null) {
    await this.ensureSchema();
    const court = await this.getCourtById(payload.courtId);
    const renter = await this.getRenterById(payload.renterId);
    const desiredStartAt = requiredDateTime(payload.desiredStartAt, "desiredStartAt");
    const desiredEndAt = requiredDateTime(payload.desiredEndAt, "desiredEndAt");

    if (parseDate(desiredEndAt) <= parseDate(desiredStartAt)) {
      throw httpError("A janela da lista de espera precisa ter fim posterior ao inicio.", 400);
    }

    const id = createId("wait");

    await this.query(
      `
        INSERT INTO j12_quadra_waitlist (
          id,
          quadra_id,
          locatario_id,
          desired_start_at,
          desired_end_at,
          status,
          reason,
          created_by
        ) VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?)
      `,
      [
        id,
        court.id,
        renter.id,
        toSqlDateTime(desiredStartAt),
        toSqlDateTime(desiredEndAt),
        nullableText(payload.reason, 500),
        this.actor(authUser),
      ],
    );

    await this.audit("waitlist.created", id, { courtId: court.id }, authUser);
    return {
      court,
      desiredEndAt,
      desiredStartAt,
      id,
      reason: payload.reason || "",
      renter,
      status: "waiting",
    };
  }

  async listWaitlist(filters = {}) {
    await this.ensureSchema();
    const params = [];
    const where = [];

    if (filters.courtId) {
      where.push("espera.quadra_id = ?");
      params.push(String(filters.courtId));
    }

    const rows = await this.query(
      `
        SELECT
          espera.*,
          quadra.nome AS quadra_nome,
          locatario.nome AS locatario_nome
        FROM j12_quadra_waitlist espera
        INNER JOIN j12_quadras quadra ON quadra.id = espera.quadra_id
        INNER JOIN j12_locatarios locatario ON locatario.id = espera.locatario_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY espera.created_at ASC
      `,
      params,
    );

    return readRows(rows).map(mapWaitlistRow);
  }

  async promoteWaitlistEntry(waitlistId, payload = {}, authUser = null) {
    await this.ensureSchema();
    const entry = await this.getWaitlistEntryById(waitlistId);

    if (entry.status !== "waiting") {
      throw httpError("Entrada da lista de espera nao esta aguardando vaga.", 409);
    }

    const validation = await this.validateAvailability({
      courtId: entry.court.id,
      endAt: entry.desiredEndAt,
      startAt: entry.desiredStartAt,
    });

    if (!validation.available) {
      const error = httpError(validation.reason || "Horario ainda indisponivel.", 409);
      error.details = validation;
      throw error;
    }

    const court = await this.getCourtById(entry.court.id);
    const renter = await this.getRenterById(entry.renter.id);
    const quote = await this.calculateQuote({
      courtId: court.id,
      discountValue: payload.discountValue,
      endAt: entry.desiredEndAt,
      startAt: entry.desiredStartAt,
    });
    const reservation = await this.insertReservation({
      actor: this.actor(authUser),
      court,
      input: {
        autoConfirm: payload.autoConfirm !== false,
        generateCharge: payload.generateCharge !== false,
        idempotencyKey: payload.idempotencyKey,
        notes: payload.notes || `Promovido da lista de espera ${entry.id}.`,
        paymentMethod: normalizePaymentMethod(payload.paymentMethod),
        recurrence: null,
        title: payload.title || `Reserva ${court.nome}`,
      },
      occurrence: {
        endAt: entry.desiredEndAt,
        recurrenceGroupId: null,
        startAt: entry.desiredStartAt,
      },
      quote,
      renter,
    });

    await this.query(
      `
        UPDATE j12_quadra_waitlist
        SET status = 'promoted', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [entry.id],
    );

    await this.audit("waitlist.promoted", entry.id, { reservationId: reservation.id }, authUser);
    await this.notifyReservationChange("waitlist.promoted", reservation, authUser);
    return {
      reservation,
      waitlist: {
        ...entry,
        status: "promoted",
      },
    };
  }

  async getWaitlistEntryById(waitlistId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        SELECT
          espera.*,
          quadra.nome AS quadra_nome,
          locatario.nome AS locatario_nome
        FROM j12_quadra_waitlist espera
        INNER JOIN j12_quadras quadra ON quadra.id = espera.quadra_id
        INNER JOIN j12_locatarios locatario ON locatario.id = espera.locatario_id
        WHERE espera.id = ?
        LIMIT 1
      `,
      [requiredText(waitlistId, "waitlistId", 64)],
    );
    const row = readRows(rows)[0];

    if (!row) {
      throw httpError("Entrada da lista de espera nao encontrada.", 404);
    }

    return mapWaitlistRow(row);
  }

  async getReports(filters = {}) {
    await this.ensureSchema();
    const period = buildReportPeriod(filters);
    const [reservations, courts, renters] = await Promise.all([
      this.listReservations({ from: period.from, limit: 2000, to: period.to }),
      this.listCourts(),
      this.listRenters(),
    ]);
    const completedOrConfirmed = reservations.filter((item) =>
      ["confirmed", "completed"].includes(item.status),
    );
    const cancelled = reservations.filter((item) => item.status === "cancelled");
    const totalRevenue = completedOrConfirmed.reduce(
      (sum, item) => sum + number(item.finalValue),
      0,
    );
    const revenueByCourt = courts.map((court) => {
      const courtReservations = completedOrConfirmed.filter((item) => item.court.id === court.id);
      return {
        courtId: court.id,
        courtName: court.nome,
        reservations: courtReservations.length,
        revenue: roundMoney(
          courtReservations.reduce((sum, item) => sum + number(item.finalValue), 0),
        ),
      };
    });
    const mostUsedHours = aggregateMostUsedHours(completedOrConfirmed);
    const frequentRenters = renters
      .map((renter) => {
        const renterReservations = reservations.filter((item) => item.renter.id === renter.id);
        return {
          renterId: renter.id,
          renterName: renter.nome,
          reservations: renterReservations.length,
          revenue: roundMoney(
            renterReservations.reduce((sum, item) => sum + number(item.finalValue), 0),
          ),
        };
      })
      .filter((item) => item.reservations > 0)
      .sort((left, right) => right.reservations - left.reservations)
      .slice(0, 10);

    return {
      cancelledReservations: cancelled.length,
      frequentRenters,
      mostUsedHours,
      occupancyRate: calculateOccupancyRate({ courts, period, reservations: completedOrConfirmed }),
      period,
      reservationCount: reservations.length,
      revenueByCourt,
      totalRevenue: roundMoney(totalRevenue),
    };
  }

  async exportReports(filters = {}) {
    const format = normalizeExportFormat(filters.format || filters.tipo);
    const report = await this.getReports(filters);
    const rows = buildReportExportRows(report);
    const filename = `quadras-relatorio-${report.period.from.slice(0, 10)}-${report.period.to.slice(0, 10)}.${format === "excel" ? "xls" : format}`;
    const content =
      format === "pdf"
        ? createSimplePdfReport(report, rows)
        : format === "excel"
          ? createExcelReport(rows)
          : createCsvReport(rows);
    const mimeType =
      format === "pdf"
        ? "application/pdf"
        : format === "excel"
          ? "application/vnd.ms-excel"
          : "text/csv; charset=utf-8";

    return {
      contentBase64: Buffer.from(content, "utf8").toString("base64"),
      filename,
      format,
      mimeType,
    };
  }

  async listAudit(filters = {}) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        SELECT *
        FROM j12_quadra_audit_logs
        ORDER BY created_at DESC
        LIMIT ?
      `,
      [normalizeLimit(filters.limit, 120)],
    );

    return readRows(rows).map(mapAuditRow);
  }

  async insertReservation({ actor, court, input, occurrence, quote, renter }) {
    const id = createId("res");
    const status = input.autoConfirm ? "confirmed" : "pending";
    const chargeId = input.generateCharge
      ? await this.createFinancialCharge({
          actor,
          court,
          dueDate: occurrence.startAt.slice(0, 10),
          paymentMethod: input.paymentMethod,
          quote,
          renter,
          reservationId: id,
        })
      : null;

    await this.query(
      `
        INSERT INTO j12_quadra_reservas (
          id,
          quadra_id,
          locatario_id,
          title,
          start_at,
          end_at,
          duration_minutes,
          reservation_type,
          status,
          payment_status,
          payment_method,
          recurrence_group_id,
          recurrence_json,
          value,
          discount_value,
          coupon_code,
          final_value,
          financial_charge_id,
          notes,
          idempotency_key,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        court.id,
        renter.id,
        input.title || `Reserva ${court.nome}`,
        toSqlDateTime(occurrence.startAt),
        toSqlDateTime(occurrence.endAt),
        quote.durationMinutes,
        input.recurrence?.frequency ? "recorrente" : "avulsa",
        status,
        "pending",
        input.paymentMethod,
        occurrence.recurrenceGroupId,
        JSON.stringify(input.recurrence),
        quote.subtotal,
        quote.discountValue,
        input.couponCode,
        quote.total,
        chargeId,
        input.notes,
        input.idempotencyKey ||
          `${court.id}:${renter.id}:${occurrence.startAt}:${occurrence.endAt}`,
        actor,
        actor,
      ],
    );

    await this.audit(
      "reservation.created",
      id,
      {
        courtId: court.id,
        endAt: occurrence.endAt,
        startAt: occurrence.startAt,
        value: quote.total,
      },
      { email: actor, login: actor, id: actor },
    );

    return this.getReservationById(id);
  }

  async createFinancialCharge({
    actor,
    court,
    dueDate,
    paymentMethod,
    quote,
    renter,
    reservationId,
  }) {
    if (!(await this.safeTableExists("j12_financeiro_cobrancas"))) {
      return null;
    }

    const id = createId("cob-quadra");
    const competencia = dueDate.slice(0, 7);

    await this.query(
      `
        INSERT INTO j12_financeiro_cobrancas (
          id,
          aluno_id,
          numero_matricula,
          nome_aluno,
          competencia,
          descricao,
          tipo,
          valor,
          vencimento,
          status,
          origem,
          periodicidade,
          modalidade,
          turma,
          unidade,
          responsavel_financeiro,
          telefone_whatsapp,
          email,
          observacao,
          data_geracao,
          valor_original,
          desconto_valor,
          valor_final,
          tipo_cobranca,
          alterado_por
        ) VALUES (?, ?, NULL, ?, ?, ?, 'locacao_quadra', ?, ?, 'pendente', 'automatico', 'avulsa', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'avulsa', ?)
      `,
      [
        id,
        `locatario:${renter.id}`,
        renter.nome,
        competencia,
        `Locacao de quadra - ${court.nome}`,
        quote.total,
        dueDate,
        court.tipo,
        court.nome,
        court.unidade,
        renter.nome,
        renter.telefone,
        renter.email,
        `Reserva ${reservationId} | pagamento ${paymentMethod}`,
        this.now().toISOString().slice(0, 10),
        quote.subtotal,
        quote.discountValue,
        quote.total,
        actor,
      ],
    );

    return id;
  }

  async notifyReservationChange(eventType, reservation, authUser = null) {
    const notificationReady =
      (await this.safeTableExists("agenda_notification_events")) &&
      (await this.safeTableExists("agenda_notifications"));

    if (notificationReady) {
      const eventId = createId("quadra_evt");
      await this.query(
        `
          INSERT INTO agenda_notification_events (
            id,
            event_type,
            class_id,
            payload_json,
            actor_id,
            idempotency_key,
            status,
            occurred_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'RECORDED', CURRENT_TIMESTAMP)
          ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
        `,
        [
          eventId,
          eventType.toUpperCase().replace(/\./g, "_"),
          reservation.court.id,
          JSON.stringify({ reservationId: reservation.id, module: "quadras" }),
          this.actor(authUser),
          `quadra:${eventType}:${reservation.id}:${Date.now()}`,
        ],
      );

      await this.query(
        `
          INSERT INTO agenda_notifications (
            id,
            event_id,
            queue_id,
            recipient_type,
            recipient_id,
            title,
            message,
            notification_type,
            status
          ) VALUES (?, ?, NULL, 'RENTER', ?, ?, ?, 'COURT_RENTAL', 'UNREAD')
        `,
        [
          createId("quadra_ntf"),
          eventId,
          reservation.renter.id,
          "Reserva de quadra",
          buildReservationNotificationMessage(eventType, reservation),
        ],
      );
    }

    const io = this.io || global.io;
    if (io && typeof io.emit === "function") {
      io.emit("quadras:reservas-atualizadas", {
        event: eventType,
        reservationId: reservation.id,
      });
      io.emit("nova_notificacao", {
        message: buildReservationNotificationMessage(eventType, reservation),
        title: "Reserva de quadra",
      });
    }

    return {
      emailPrepared: true,
      internalPrepared: notificationReady,
      pushPrepared: true,
      whatsappPrepared: true,
    };
  }

  async resolveRenter(input, authUser = null) {
    if (input.renterId) {
      return this.getRenterById(input.renterId);
    }

    if (!input.renter?.nome) {
      throw httpError("Informe o locatario da reserva.", 400);
    }

    return this.createRenter(input.renter, authUser);
  }

  async promoteWaitlistForReservation(reservation, authUser = null) {
    const rows = await this.query(
      `
        SELECT id
        FROM j12_quadra_waitlist
        WHERE quadra_id = ?
          AND status = 'waiting'
          AND desired_start_at < ?
          AND desired_end_at > ?
        ORDER BY
          CASE
            WHEN desired_start_at = ? AND desired_end_at = ? THEN 0
            ELSE 1
          END,
          created_at ASC
        LIMIT 1
      `,
      [
        reservation.court.id,
        toSqlDateTime(reservation.endAt),
        toSqlDateTime(reservation.startAt),
        toSqlDateTime(reservation.startAt),
        toSqlDateTime(reservation.endAt),
      ],
    );
    const first = readRows(rows)[0];

    if (!first) {
      return null;
    }

    try {
      return await this.promoteWaitlistEntry(
        first.id,
        {
          autoConfirm: false,
          generateCharge: true,
          paymentMethod: reservation.paymentMethod,
        },
        authUser,
      );
    } catch (error) {
      await this.query(
        `
          UPDATE j12_quadra_waitlist
          SET reason = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [text(error.message, 500), first.id],
      );
      return {
        error: error.message,
        waitlistId: String(first.id),
      };
    }
  }

  async audit(action, entityId, metadata = {}, authUser = null) {
    await this.ensureSchema();
    await this.query(
      `
        INSERT INTO j12_quadra_audit_logs (
          id,
          action,
          entity_id,
          actor_id,
          actor_role,
          metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        createId("audit"),
        text(action, 80),
        nullableText(entityId, 64),
        this.actor(authUser),
        text(authUser?.role || authUser?.perfil || "", 50),
        JSON.stringify(metadata || {}),
      ],
    );
  }

  async safeTableExists(tableName) {
    try {
      return Boolean(await this.tableExists(tableName));
    } catch {
      return false;
    }
  }
}

async function ensureCourtRentalSchema({
  query: runQuery = query,
  tableExists: hasTable = tableExists,
} = {}) {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS j12_quadras (
      id VARCHAR(64) PRIMARY KEY,
      nome VARCHAR(191) NOT NULL,
      tipo VARCHAR(80) NOT NULL,
      descricao TEXT NULL,
      fotos_json LONGTEXT NULL,
      dimensoes_json LONGTEXT NULL,
      capacidade INT NOT NULL DEFAULT 0,
      coberta TINYINT(1) NOT NULL DEFAULT 0,
      iluminacao TINYINT(1) NOT NULL DEFAULT 1,
      status VARCHAR(32) NOT NULL DEFAULT 'ativa',
      unidade VARCHAR(191) NULL,
      funcionamento_json LONGTEXT NULL,
      preco_base DECIMAL(10,2) NOT NULL DEFAULT 0,
      preco_noturno DECIMAL(10,2) NOT NULL DEFAULT 0,
      preco_fim_semana DECIMAL(10,2) NOT NULL DEFAULT 0,
      tempo_minimo_minutos INT NOT NULL DEFAULT 60,
      tempo_maximo_minutos INT NOT NULL DEFAULT 180,
      observacoes TEXT NULL,
      created_by VARCHAR(191) NULL,
      updated_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_j12_quadras_status (status),
      INDEX idx_j12_quadras_tipo (tipo)
    )
  `);
  await ensureCourtColumns(runQuery);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS j12_locatarios (
      id VARCHAR(64) PRIMARY KEY,
      nome VARCHAR(191) NOT NULL,
      email VARCHAR(191) NULL,
      telefone VARCHAR(50) NULL,
      documento VARCHAR(50) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'ativo',
      observacoes TEXT NULL,
      created_by VARCHAR(191) NULL,
      updated_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_j12_locatarios_nome (nome),
      INDEX idx_j12_locatarios_status (status)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS j12_quadra_price_rules (
      id VARCHAR(64) PRIMARY KEY,
      quadra_id VARCHAR(64) NOT NULL,
      weekday VARCHAR(16) NULL,
      start_time VARCHAR(20) NULL,
      end_time VARCHAR(20) NULL,
      price_per_hour DECIMAL(10,2) NOT NULL DEFAULT 0,
      currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
      priority INT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_by VARCHAR(191) NULL,
      updated_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_j12_quadra_price_rules_quadra (quadra_id),
      INDEX idx_j12_quadra_price_rules_lookup (quadra_id, weekday, active)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS j12_quadra_reservas (
      id VARCHAR(64) PRIMARY KEY,
      quadra_id VARCHAR(64) NOT NULL,
      locatario_id VARCHAR(64) NOT NULL,
      title VARCHAR(191) NOT NULL,
      start_at DATETIME NOT NULL,
      end_at DATETIME NOT NULL,
      duration_minutes INT NOT NULL DEFAULT 0,
      reservation_type VARCHAR(32) NOT NULL DEFAULT 'avulsa',
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
      payment_method VARCHAR(32) NOT NULL DEFAULT 'pix',
      recurrence_group_id VARCHAR(64) NULL,
      recurrence_json LONGTEXT NULL,
      value DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      coupon_code VARCHAR(80) NULL,
      final_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      financial_charge_id VARCHAR(64) NULL,
      notes TEXT NULL,
      idempotency_key VARCHAR(191) NOT NULL,
      cancel_reason TEXT NULL,
      cancelled_at DATETIME NULL,
      cancelled_by VARCHAR(191) NULL,
      created_by VARCHAR(191) NULL,
      updated_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX ux_j12_quadra_reservas_idempotency (idempotency_key),
      INDEX idx_j12_quadra_reservas_quadra_periodo (quadra_id, start_at, end_at),
      INDEX idx_j12_quadra_reservas_locatario (locatario_id),
      INDEX idx_j12_quadra_reservas_status (status),
      INDEX idx_j12_quadra_reservas_recorrencia (recurrence_group_id)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS j12_quadra_bloqueios (
      id VARCHAR(64) PRIMARY KEY,
      quadra_id VARCHAR(64) NOT NULL,
      block_type VARCHAR(32) NOT NULL,
      start_at DATETIME NOT NULL,
      end_at DATETIME NOT NULL,
      reason VARCHAR(500) NULL,
      recurrence_json LONGTEXT NULL,
      exclusive_for_classes TINYINT(1) NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_by VARCHAR(191) NULL,
      updated_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_j12_quadra_bloqueios_quadra_periodo (quadra_id, start_at, end_at),
      INDEX idx_j12_quadra_bloqueios_tipo (block_type)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS j12_quadra_waitlist (
      id VARCHAR(64) PRIMARY KEY,
      quadra_id VARCHAR(64) NOT NULL,
      locatario_id VARCHAR(64) NOT NULL,
      desired_start_at DATETIME NOT NULL,
      desired_end_at DATETIME NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'waiting',
      reason VARCHAR(500) NULL,
      created_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_j12_quadra_waitlist_quadra (quadra_id, desired_start_at),
      INDEX idx_j12_quadra_waitlist_locatario (locatario_id),
      INDEX idx_j12_quadra_waitlist_status (status)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS j12_quadra_audit_logs (
      id VARCHAR(64) PRIMARY KEY,
      action VARCHAR(80) NOT NULL,
      entity_id VARCHAR(64) NULL,
      actor_id VARCHAR(191) NULL,
      actor_role VARCHAR(50) NULL,
      metadata_json LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_j12_quadra_audit_action (action),
      INDEX idx_j12_quadra_audit_entity (entity_id),
      INDEX idx_j12_quadra_audit_created (created_at)
    )
  `);

  await ensureSeedCourts({ query: runQuery, tableExists: hasTable });
}

async function ensureCourtColumns(runQuery) {
  const columns = [
    ["capacidade", "INT NOT NULL DEFAULT 0"],
    ["coberta", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["iluminacao", "TINYINT(1) NOT NULL DEFAULT 1"],
    ["preco_noturno", "DECIMAL(10,2) NOT NULL DEFAULT 0"],
    ["preco_fim_semana", "DECIMAL(10,2) NOT NULL DEFAULT 0"],
    ["tempo_minimo_minutos", "INT NOT NULL DEFAULT 60"],
    ["tempo_maximo_minutos", "INT NOT NULL DEFAULT 180"],
  ];

  for (const [name, definition] of columns) {
    await ensureColumn(runQuery, "j12_quadras", name, definition);
  }
}

async function ensureColumn(runQuery, tableName, columnName, definition) {
  try {
    await runQuery(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  } catch (error) {
    if (
      error?.code === "ER_DUP_FIELDNAME" ||
      error?.errno === 1060 ||
      /duplicate column|duplicate field|already exists/i.test(String(error?.message || ""))
    ) {
      return;
    }

    throw error;
  }
}

async function ensureSeedCourts({ query: runQuery }) {
  const countRows = await runQuery("SELECT COUNT(*) AS total FROM j12_quadras");
  const total = number(readRows(countRows)[0]?.total, 0);
  if (total > 0) return;

  await runQuery(
    `
      INSERT INTO j12_quadras (
        id,
        nome,
        tipo,
        descricao,
        fotos_json,
        dimensoes_json,
        capacidade,
        coberta,
        iluminacao,
        status,
        unidade,
        funcionamento_json,
        preco_base,
        preco_noturno,
        preco_fim_semana,
        tempo_minimo_minutos,
        tempo_maximo_minutos,
        observacoes,
        created_by,
        updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', 'seed')
    `,
    [
      "quadra-principal",
      "Quadra Principal",
      "Futsal",
      "Quadra coberta para futsal e treinos tecnicos.",
      JSON.stringify([]),
      JSON.stringify({ largura: 20, comprimento: 40, unidade: "m" }),
      12,
      1,
      1,
      "ativa",
      "Unidade Centro",
      JSON.stringify(DEFAULT_OPENING_HOURS),
      180,
      220,
      200,
      60,
      180,
      "Seed inicial da Sprint 16.",
    ],
  );
}

function normalizeCourtPayload(payload = {}) {
  const nome = requiredText(payload.nome || payload.name, "nome", 191);
  const tipo = text(payload.tipo || payload.type || "Futsal", 80) || "Futsal";
  const tempoMinimoMinutos = Math.max(
    integer(
      payload.tempoMinimoMinutos ?? payload.tempo_minimo_minutos ?? payload.minimumMinutes,
      60,
    ),
    0,
  );
  const tempoMaximoMinutos = Math.max(
    integer(
      payload.tempoMaximoMinutos ?? payload.tempo_maximo_minutos ?? payload.maximumMinutes,
      180,
    ),
    0,
  );

  return {
    capacidade: Math.max(integer(payload.capacidade ?? payload.capacity, 0), 0),
    coberta: Boolean(payload.coberta ?? payload.covered ?? false),
    descricao: nullableText(payload.descricao || payload.description, 2000),
    dimensoes: normalizeDimensions(payload.dimensoes || payload.dimensions),
    fotos: normalizeStringArray(payload.fotos || payload.photos),
    funcionamento: normalizeOpeningHours(payload.funcionamento || payload.openingHours),
    id: nullableText(payload.id, 64),
    iluminacao: Boolean(payload.iluminacao ?? payload.lighting ?? payload.hasLighting ?? true),
    nome,
    observacoes: nullableText(payload.observacoes || payload.notes, 2000),
    precoBase: money(payload.precoBase ?? payload.preco_base ?? payload.basePrice, 0),
    precoFimSemana: money(
      payload.precoFimSemana ?? payload.preco_fim_semana ?? payload.weekendPrice,
      0,
    ),
    precoNoturno: money(payload.precoNoturno ?? payload.preco_noturno ?? payload.nightPrice, 0),
    status: normalizeCourtStatus(payload.status),
    tempoMaximoMinutos: Math.max(tempoMaximoMinutos, tempoMinimoMinutos),
    tempoMinimoMinutos,
    tipo,
    unidade: nullableText(payload.unidade || payload.unitName, 191),
  };
}

function normalizeRenterPayload(payload = {}) {
  return {
    documento: nullableText(payload.documento || payload.document, 50),
    email: nullableText(payload.email, 191),
    id: nullableText(payload.id, 64),
    nome: requiredText(payload.nome || payload.name, "nome", 191),
    observacoes: nullableText(payload.observacoes || payload.notes, 2000),
    status: text(payload.status, 32).toLowerCase() === "inativo" ? "inativo" : "ativo",
    telefone: nullableText(payload.telefone || payload.phone, 50),
  };
}

function normalizeReservationPayload(payload = {}) {
  const recurrence = normalizeRecurrence(payload.recurrence || payload.recorrencia);
  const startAt = requiredDateTime(payload.startAt || payload.start_at, "startAt");
  const endAt = requiredDateTime(payload.endAt || payload.end_at, "endAt");

  return {
    allowWaitlist: Boolean(payload.allowWaitlist ?? payload.listaEspera),
    autoConfirm: payload.autoConfirm !== false,
    couponCode: nullableText(payload.couponCode || payload.cupom, 80),
    courtId: requiredText(payload.courtId || payload.quadraId || payload.quadra_id, "quadraId", 64),
    discountValue: money(payload.discountValue ?? payload.descontoValor, 0),
    endAt,
    generateCharge: payload.generateCharge !== false,
    idempotencyKey: nullableText(payload.idempotencyKey, 191),
    notes: nullableText(payload.notes || payload.observacoes, 2000),
    paymentMethod: normalizePaymentMethod(payload.paymentMethod || payload.formaPagamento),
    recurrence,
    renter: payload.renter || payload.locatario || null,
    renterId: nullableText(payload.renterId || payload.locatarioId || payload.locatario_id, 64),
    startAt,
    title: nullableText(payload.title || payload.titulo, 191),
  };
}

function normalizePriceRulePayload(payload = {}) {
  const weekday = normalizeWeekday(payload.weekday || payload.diaSemana);

  return {
    active: payload.active !== false && payload.ativa !== false,
    currency: text(payload.currency || "BRL", 3).toUpperCase() || "BRL",
    endTime: nullableText(payload.endTime || payload.horarioFim, 20),
    pricePerHour: money(payload.pricePerHour ?? payload.valorHora, 0),
    priority: integer(payload.priority || payload.prioridade, 0),
    startTime: nullableText(payload.startTime || payload.horarioInicio, 20),
    weekday,
  };
}

function normalizeBlockPayload(payload = {}) {
  const type = text(payload.type || payload.tipo || payload.blockType, 32)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return {
    courtId: requiredText(payload.courtId || payload.quadraId || payload.quadra_id, "quadraId", 64),
    endAt: requiredDateTime(payload.endAt || payload.end_at, "endAt"),
    exclusiveForClasses: Boolean(payload.exclusiveForClasses || payload.exclusivoAulas),
    reason: nullableText(payload.reason || payload.motivo, 500),
    recurrence: normalizeRecurrence(payload.recurrence || payload.recorrencia),
    startAt: requiredDateTime(payload.startAt || payload.start_at, "startAt"),
    type: BLOCK_TYPES.has(type) ? type : "administrativo",
  };
}

function normalizeCourtStatus(value) {
  const normalized = text(value, 32)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized === "manutencao" || normalized === "maintenance") return "manutencao";
  if (normalized === "indisponivel" || normalized === "inactive") return "indisponivel";
  return COURT_STATUSES.has(normalized) ? normalized : "ativa";
}

function normalizeReservationStatus(value) {
  const normalized = text(value, 32).toLowerCase();
  if (["confirmada", "confirmado", "confirmed"].includes(normalized)) return "confirmed";
  if (["cancelada", "cancelado", "cancelled"].includes(normalized)) return "cancelled";
  if (["concluida", "concluido", "completed"].includes(normalized)) return "completed";
  if (["lista_espera", "waitlisted"].includes(normalized)) return "waitlisted";
  return RESERVATION_STATUSES.has(normalized) ? normalized : "pending";
}

function normalizePaymentStatus(value) {
  const normalized = text(value, 32).toLowerCase();
  if (["pago", "paid"].includes(normalized)) return "paid";
  if (["cancelado", "cancelled"].includes(normalized)) return "cancelled";
  if (["estornado", "refunded"].includes(normalized)) return "refunded";
  return PAYMENT_STATUSES.has(normalized) ? normalized : "pending";
}

function normalizePaymentMethod(value) {
  const normalized = text(value, 32).toLowerCase();
  if (["boleto", "bank_slip"].includes(normalized)) return "boleto";
  if (["cartao", "card", "credit_card"].includes(normalized)) return "cartao";
  if (["dinheiro", "cash"].includes(normalized)) return "dinheiro";
  if (["cortesia", "free"].includes(normalized)) return "cortesia";
  if (["mensalista", "subscriber", "member"].includes(normalized)) return "mensalista";
  if (["avulso", "single"].includes(normalized)) return "avulso";
  return PAYMENT_METHODS.has(normalized) ? normalized : "pix";
}

function normalizeRecurrence(value) {
  const source = readObject(value);
  const frequency = text(source.frequency || source.frequencia, 32).toLowerCase();

  if (!frequency || frequency === "none") {
    return null;
  }

  return {
    daysOfWeek: normalizeStringArray(source.daysOfWeek || source.diasSemana)
      .map(normalizeWeekday)
      .filter(Boolean),
    frequency: frequency === "monthly" || frequency === "mensal" ? "monthly" : "weekly",
    interval: Math.max(integer(source.interval || source.intervalo, 1), 1),
    until: normalizeDate(source.until || source.ate || source.endDate) || null,
  };
}

function normalizeDimensions(value) {
  const source = readObject(value);
  return {
    comprimento: number(source.comprimento ?? source.length, 0),
    largura: number(source.largura ?? source.width, 0),
    unidade: text(source.unidade || source.unit || "m", 10) || "m",
  };
}

function normalizeOpeningHours(value) {
  const source = readObject(value);
  const next = {};

  for (const key of WEEKDAY_KEYS) {
    const windows = Array.isArray(source[key]) ? source[key] : DEFAULT_OPENING_HOURS[key] || [];
    next[key] = windows
      .map((item) => ({
        end: normalizeTime(item.end || item.fim || item.endTime),
        start: normalizeTime(item.start || item.inicio || item.startTime),
      }))
      .filter(
        (item) => item.start && item.end && timeToMinutes(item.start) < timeToMinutes(item.end),
      );
  }

  return next;
}

function normalizeWeekday(value) {
  const normalized = text(value, 16)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (["0", "dom", "domingo", "sun", "sunday"].includes(normalized)) return "dom";
  if (["1", "seg", "segunda", "monday", "mon"].includes(normalized)) return "seg";
  if (["2", "ter", "terca", "tuesday", "tue"].includes(normalized)) return "ter";
  if (["3", "qua", "quarta", "wednesday", "wed"].includes(normalized)) return "qua";
  if (["4", "qui", "quinta", "thursday", "thu"].includes(normalized)) return "qui";
  if (["5", "sex", "sexta", "friday", "fri"].includes(normalized)) return "sex";
  if (["6", "sab", "sabado", "saturday", "sat"].includes(normalized)) return "sab";
  return null;
}

function normalizeTime(value) {
  const normalized = text(value, 20);
  const match = normalized.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function buildReservationOccurrences(input) {
  if (!input.recurrence) {
    return [
      {
        endAt: input.endAt,
        recurrenceGroupId: null,
        startAt: input.startAt,
      },
    ];
  }

  const groupId = createId("rec");
  const occurrences = [];
  const baseStart = parseDateTime(input.startAt);
  const baseEnd = parseDateTime(input.endAt);
  const until = parseDate(`${input.recurrence.until || input.startAt.slice(0, 10)}T23:59:59`);
  const durationMs = baseEnd.getTime() - baseStart.getTime();
  const maxOccurrences = 80;
  const interval = Math.max(integer(input.recurrence.interval, 1), 1);

  if (input.recurrence.frequency === "monthly") {
    let offset = 0;

    while (occurrences.length < maxOccurrences) {
      const cursor = addMonthsClamped(baseStart, offset);
      if (cursor > until) break;

      const end = new Date(cursor.getTime() + durationMs);
      occurrences.push({
        endAt: toInputDateTime(end),
        recurrenceGroupId: groupId,
        startAt: toInputDateTime(cursor),
      });

      offset += interval;
    }

    return occurrences;
  }

  const cursor = new Date(baseStart);
  const days = input.recurrence.daysOfWeek.length
    ? input.recurrence.daysOfWeek
    : [WEEKDAY_KEYS[baseStart.getDay()]];

  while (occurrences.length < maxOccurrences && cursor <= until) {
    const weekday = WEEKDAY_KEYS[cursor.getDay()];
    const weeksFromStart = Math.floor(
      (startOfDay(cursor).getTime() - startOfDay(baseStart).getTime()) / (7 * 24 * 60 * 60 * 1000),
    );

    if (days.includes(weekday) && weeksFromStart % interval === 0) {
      const end = new Date(cursor.getTime() + durationMs);
      occurrences.push({
        endAt: toInputDateTime(end),
        recurrenceGroupId: groupId,
        startAt: toInputDateTime(cursor),
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences;
}

function resolveCourtPriceForPeriod(court, startAt, endAt) {
  const start = parseDateTime(startAt);
  const end = parseDateTime(endAt);
  const isWeekend = [0, 6].includes(start.getDay());
  const startsAtNight = start.getHours() >= 18;
  const endsAtNight = end.getHours() >= 18 || end.getHours() < start.getHours();

  if (isWeekend && money(court.precoFimSemana, 0) > 0) {
    return court.precoFimSemana;
  }

  if ((startsAtNight || endsAtNight) && money(court.precoNoturno, 0) > 0) {
    return court.precoNoturno;
  }

  return court.precoBase;
}

function calculateReservationValue({
  basePrice,
  couponCode,
  discountValue,
  endAt,
  rules = [],
  startAt,
}) {
  const start = parseDateTime(startAt);
  const end = parseDateTime(endAt);
  const durationMinutes = Math.max(Math.round((end.getTime() - start.getTime()) / 60000), 0);
  const weekday = WEEKDAY_KEYS[start.getDay()];
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const activeRules = rules
    .filter((rule) => rule.active)
    .filter((rule) => !rule.weekday || rule.weekday === weekday)
    .filter((rule) => {
      if (!rule.startTime || !rule.endTime) return true;
      return (
        startMinutes >= timeToMinutes(rule.startTime) && startMinutes < timeToMinutes(rule.endTime)
      );
    })
    .sort((left, right) => right.priority - left.priority);
  const selectedRule = activeRules[0] || null;
  const pricePerHour = money(selectedRule?.pricePerHour ?? basePrice, 0);
  const subtotal = roundMoney((durationMinutes / 60) * pricePerHour);
  const couponDiscount = couponCode ? 0 : 0;
  const discount = Math.min(roundMoney(number(discountValue, 0) + couponDiscount), subtotal);
  const total = roundMoney(Math.max(subtotal - discount, 0));

  return {
    couponCode: couponCode || null,
    currency: selectedRule?.currency || "BRL",
    discountValue: discount,
    durationMinutes,
    pricePerHour,
    ruleId: selectedRule?.id || null,
    subtotal,
    total,
  };
}

function isWithinOpeningHours(openingHours, startAt, endAt) {
  const start = parseDateTime(startAt);
  const end = parseDateTime(endAt);
  const weekday = WEEKDAY_KEYS[start.getDay()];
  const windows = readObject(openingHours)[weekday] || [];
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();

  return windows.some(
    (window) =>
      startMinutes >= timeToMinutes(window.start) && endMinutes <= timeToMinutes(window.end),
  );
}

function buildAvailabilitySlots({ blocks, courts, period, reservations }) {
  const days = enumerateDates(period.startAt.slice(0, 10), period.endAt.slice(0, 10));

  return courts.flatMap((court) =>
    days.map((date) => {
      const weekday = WEEKDAY_KEYS[parseDate(`${date}T00:00:00`).getDay()];
      const windows = court.funcionamento[weekday] || [];
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59`;
      const busyReservations = reservations.filter(
        (item) =>
          item.court.id === court.id && overlaps(item.startAt, item.endAt, dayStart, dayEnd),
      );
      const busyBlocks = blocks.filter(
        (item) =>
          item.court.id === court.id && overlaps(item.startAt, item.endAt, dayStart, dayEnd),
      );

      return {
        blocks: busyBlocks,
        courtId: court.id,
        courtName: court.nome,
        date,
        reservations: busyReservations,
        status: court.status,
        windows,
      };
    }),
  );
}

function buildPeriod(filters = {}) {
  const view = text(filters.view, 20).toLowerCase();
  const baseDate = parseDate(`${normalizeDate(filters.date) || todayISO()}T00:00:00`);

  if (filters.from && filters.to) {
    return {
      endAt: `${normalizeDate(filters.to)}T23:59:59`,
      startAt: `${normalizeDate(filters.from)}T00:00:00`,
      view: "custom",
    };
  }

  if (view === "month") {
    const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
    return {
      endAt: `${toDateOnly(end)}T23:59:59`,
      startAt: `${toDateOnly(start)}T00:00:00`,
      view: "month",
    };
  }

  if (view === "week") {
    const diffToMonday = (baseDate.getDay() + 6) % 7;
    const start = new Date(baseDate);
    start.setDate(baseDate.getDate() - diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      endAt: `${toDateOnly(end)}T23:59:59`,
      startAt: `${toDateOnly(start)}T00:00:00`,
      view: "week",
    };
  }

  const date = toDateOnly(baseDate);
  return {
    endAt: `${date}T23:59:59`,
    startAt: `${date}T00:00:00`,
    view: "day",
  };
}

function buildReportPeriod(filters = {}) {
  const period = buildPeriod({
    from: filters.from,
    to: filters.to,
    view: filters.view || "month",
    date: filters.date,
  });
  return {
    from: period.startAt,
    to: period.endAt,
  };
}

function calculateOccupancyRate({ courts, period, reservations }) {
  const totalMinutes = courts.reduce((sum, court) => {
    const days = enumerateDates(period.from.slice(0, 10), period.to.slice(0, 10));
    return (
      sum +
      days.reduce((daySum, date) => {
        const weekday = WEEKDAY_KEYS[parseDate(`${date}T00:00:00`).getDay()];
        const windows = court.funcionamento[weekday] || [];
        return (
          daySum +
          windows.reduce(
            (windowSum, window) =>
              windowSum + Math.max(timeToMinutes(window.end) - timeToMinutes(window.start), 0),
            0,
          )
        );
      }, 0)
    );
  }, 0);
  const reservedMinutes = reservations.reduce(
    (sum, reservation) => sum + number(reservation.durationMinutes, 0),
    0,
  );

  return totalMinutes > 0 ? Math.round((reservedMinutes / totalMinutes) * 100) : 0;
}

function aggregateMostUsedHours(reservations) {
  const counts = new Map();
  for (const reservation of reservations) {
    const hour = reservation.startAt.slice(11, 16);
    counts.set(hour, (counts.get(hour) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([hour, reservationsCount]) => ({ hour, reservations: reservationsCount }))
    .sort((left, right) => right.reservations - left.reservations)
    .slice(0, 8);
}

function normalizeExportFormat(value) {
  const normalized = text(value, 20).toLowerCase();
  if (["pdf"].includes(normalized)) return "pdf";
  if (["excel", "xls", "xlsx"].includes(normalized)) return "excel";
  return "csv";
}

function buildReportExportRows(report) {
  return [
    ["Indicador", "Valor", "Detalhe"],
    ["Periodo", `${report.period.from.slice(0, 10)} a ${report.period.to.slice(0, 10)}`, ""],
    ["Receita total", formatExportMoney(report.totalRevenue), ""],
    ["Reservas", String(report.reservationCount), ""],
    ["Cancelamentos", String(report.cancelledReservations), ""],
    ["Taxa de ocupacao", `${report.occupancyRate}%`, ""],
    ...report.revenueByCourt.map((item) => [
      `Receita - ${item.courtName}`,
      formatExportMoney(item.revenue),
      `${item.reservations} reservas`,
    ]),
    ...report.mostUsedHours.map((item) => [
      `Horario ${item.hour}`,
      `${item.reservations} usos`,
      "Horarios ocupados",
    ]),
    ...report.frequentRenters.map((item) => [
      `Cliente ${item.renterName}`,
      `${item.reservations} reservas`,
      formatExportMoney(item.revenue),
    ]),
  ];
}

function createCsvReport(rows) {
  return rows
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function createExcelReport(rows) {
  const cells = rows
    .map(
      (row) =>
        `<tr>${row.map((value) => `<td>${escapeHtml(String(value ?? ""))}</td>`).join("")}</tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"></head><body><table>${cells}</table></body></html>`;
}

function createSimplePdfReport(report, rows) {
  const lines = [
    "Relatorio de Locacao de Quadras",
    `Periodo: ${report.period.from.slice(0, 10)} a ${report.period.to.slice(0, 10)}`,
    ...rows.slice(2).map((row) => `${row[0]}: ${row[1]} ${row[2] || ""}`.trim()),
  ].slice(0, 36);
  const content = lines
    .map((line, index) => `BT /F1 10 Tf 40 ${790 - index * 18} Td (${escapePdfText(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapePdfText(value) {
  return text(value, 180).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatExportMoney(value) {
  return `BRL ${roundMoney(value).toFixed(2)}`;
}

function mapCourtRow(row) {
  return {
    capacidade: integer(row.capacidade, 0),
    coberta: Boolean(row.coberta),
    createdAt: row.created_at ?? null,
    descricao: row.descricao ?? "",
    dimensoes: safeJsonParse(row.dimensoes_json, { comprimento: 0, largura: 0, unidade: "m" }),
    fotos: safeJsonParse(row.fotos_json, []),
    funcionamento: normalizeOpeningHours(
      safeJsonParse(row.funcionamento_json, DEFAULT_OPENING_HOURS),
    ),
    id: String(row.id),
    iluminacao: typeof row.iluminacao === "undefined" ? true : Boolean(row.iluminacao),
    nome: row.nome,
    observacoes: row.observacoes ?? "",
    precoBase: money(row.preco_base, 0),
    precoFimSemana: money(row.preco_fim_semana, 0),
    precoNoturno: money(row.preco_noturno, 0),
    status: normalizeCourtStatus(row.status),
    tempoMaximoMinutos: integer(row.tempo_maximo_minutos, 180),
    tempoMinimoMinutos: integer(row.tempo_minimo_minutos, 60),
    tipo: row.tipo,
    unidade: row.unidade ?? "",
    updatedAt: row.updated_at ?? null,
  };
}

function mapRenterRow(row) {
  return {
    createdAt: row.created_at ?? null,
    documento: row.documento ?? "",
    email: row.email ?? "",
    id: String(row.id),
    nome: row.nome,
    observacoes: row.observacoes ?? "",
    status: row.status ?? "ativo",
    telefone: row.telefone ?? "",
    updatedAt: row.updated_at ?? null,
  };
}

function mapPriceRuleRow(row) {
  return {
    active: Boolean(row.active),
    courtId: String(row.quadra_id),
    currency: row.currency || "BRL",
    endTime: row.end_time || null,
    id: String(row.id),
    pricePerHour: money(row.price_per_hour, 0),
    priority: integer(row.priority, 0),
    startTime: row.start_time || null,
    weekday: row.weekday || null,
  };
}

function mapReservationRow(row) {
  return {
    cancelReason: row.cancel_reason ?? "",
    cancelledAt: row.cancelled_at ?? null,
    couponCode: row.coupon_code ?? "",
    court: {
      id: String(row.quadra_id),
      nome: row.quadra_nome ?? "",
      tipo: row.quadra_tipo ?? "",
    },
    createdAt: row.created_at ?? null,
    discountValue: money(row.discount_value, 0),
    durationMinutes: integer(row.duration_minutes, 0),
    endAt: fromSqlDateTime(row.end_at),
    finalValue: money(row.final_value, 0),
    financialChargeId: row.financial_charge_id ?? null,
    id: String(row.id),
    notes: row.notes ?? "",
    paymentMethod: normalizePaymentMethod(row.payment_method),
    paymentStatus: normalizePaymentStatus(row.payment_status),
    recurrence: safeJsonParse(row.recurrence_json, null),
    recurrenceGroupId: row.recurrence_group_id ?? null,
    renter: {
      email: row.locatario_email ?? "",
      id: String(row.locatario_id),
      nome: row.locatario_nome ?? "",
      telefone: row.locatario_telefone ?? "",
    },
    reservationType: row.reservation_type || "avulsa",
    startAt: fromSqlDateTime(row.start_at),
    status: normalizeReservationStatus(row.status),
    title: row.title,
    updatedAt: row.updated_at ?? null,
    value: money(row.value, 0),
  };
}

function mapBlockRow(row) {
  return {
    active: Boolean(row.active),
    court: {
      id: String(row.quadra_id),
      nome: row.quadra_nome ?? "",
    },
    endAt: fromSqlDateTime(row.end_at),
    exclusiveForClasses: Boolean(row.exclusive_for_classes),
    id: String(row.id),
    reason: row.reason ?? "",
    recurrence: safeJsonParse(row.recurrence_json, null),
    startAt: fromSqlDateTime(row.start_at),
    type: row.block_type,
  };
}

function mapWaitlistRow(row) {
  return {
    court: {
      id: String(row.quadra_id),
      nome: row.quadra_nome ?? "",
    },
    createdAt: row.created_at,
    desiredEndAt: fromSqlDateTime(row.desired_end_at),
    desiredStartAt: fromSqlDateTime(row.desired_start_at),
    id: String(row.id),
    reason: row.reason ?? "",
    renter: {
      id: String(row.locatario_id),
      nome: row.locatario_nome ?? "",
    },
    status: row.status || "waiting",
  };
}

function mapAuditRow(row) {
  return {
    action: row.action,
    actorId: row.actor_id ?? "",
    actorRole: row.actor_role ?? "",
    createdAt: row.created_at,
    entityId: row.entity_id ?? null,
    id: String(row.id),
    metadata: safeJsonParse(row.metadata_json, {}),
  };
}

function buildReservationNotificationMessage(eventType, reservation) {
  const action =
    {
      "reservation.cancelled": "cancelada",
      "reservation.payment_confirmed": "com pagamento confirmado",
      "reservation.rescheduled": "reagendada",
      "reservation.updated": "atualizada",
      "waitlist.promoted": "promovida da lista de espera",
    }[eventType] || "confirmada";

  return `Reserva ${action}: ${reservation.court.nome} em ${reservation.startAt.slice(0, 16)}.`;
}

function readRows(result) {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  return Array.isArray(result) ? result : [];
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeJsonParse(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value ?? fallback;
  try {
    const parsed = JSON.parse(String(value));
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => text(item, 500)).filter(Boolean)));
}

function text(value, max = 65535) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function nullableText(value, max = 65535) {
  const normalized = text(value, max);
  return normalized || null;
}

function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);
  if (!normalized) {
    throw httpError(`Campo obrigatorio ausente: ${field}.`, 400);
  }
  return normalized;
}

function number(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integer(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function money(value, fallback = 0) {
  return roundMoney(number(value, fallback));
}

function roundMoney(value) {
  return Number(number(value, 0).toFixed(2));
}

function requiredDateTime(value, field) {
  const normalized = normalizeDateTime(value);
  if (!normalized) {
    throw httpError(`Data/hora invalida: ${field}.`, 400);
  }
  return normalized;
}

function normalizeDateTime(value) {
  const normalized = text(value, 32);
  const match = normalized.match(
    /^(\d{4}-\d{2}-\d{2})[T\s]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?/,
  );
  if (!match) return null;
  return `${match[1]}T${match[2]}:${match[3]}:${match[4] || "00"}`;
}

function normalizeDate(value) {
  const normalized = text(value, 32);
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function parseDateTime(value) {
  const normalized = requiredDateTime(value, "dateTime");
  return parseDate(normalized);
}

function parseDate(value) {
  const normalized = normalizeDateTime(value) || `${normalizeDate(value)}T00:00:00`;
  const [datePart, timePart] = normalized.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
}

function toSqlDateTime(value) {
  return requiredDateTime(value, "dateTime").replace("T", " ");
}

function fromSqlDateTime(value) {
  const normalized = text(value, 32);
  if (!normalized) return "";
  return normalized.replace(" ", "T").slice(0, 19);
}

function toInputDateTime(date) {
  return `${toDateOnly(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00`;
}

function toDateOnly(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonthsClamped(date, monthsToAdd) {
  const targetMonth = date.getMonth() + monthsToAdd;
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  const next = new Date(date);
  next.setMonth(targetMonth, Math.min(date.getDate(), lastDay));
  return next;
}

function durationBetweenMinutes(startAt, endAt) {
  return Math.max(
    Math.round((parseDateTime(endAt).getTime() - parseDateTime(startAt).getTime()) / 60000),
    0,
  );
}

function todayISO() {
  return toDateOnly(new Date());
}

function enumerateDates(startDate, endDate) {
  const start = parseDate(`${startDate}T00:00:00`);
  const end = parseDate(`${endDate}T00:00:00`);
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(toDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function timeToMinutes(value) {
  const [hour, minute] = text(value, 20).split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

function overlaps(startA, endA, startB, endB) {
  return parseDateTime(startA) < parseDateTime(endB) && parseDateTime(endA) > parseDateTime(startB);
}

function normalizeLimit(value, fallback = 100) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.trunc(parsed), 2000) : fallback;
}

function createId(prefix) {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function httpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  BLOCK_TYPES,
  COURT_STATUSES,
  CourtRentalService,
  DEFAULT_OPENING_HOURS,
  PAYMENT_METHODS,
  RESERVATION_STATUSES,
  WEEKDAY_KEYS,
  buildAvailabilitySlots,
  buildPeriod,
  buildReservationOccurrences,
  calculateOccupancyRate,
  calculateReservationValue,
  ensureCourtRentalSchema,
  isWithinOpeningHours,
  normalizeCourtPayload,
  normalizeCourtStatus,
  normalizeReservationPayload,
  normalizeReservationStatus,
  normalizeWeekday,
  overlaps,
};
