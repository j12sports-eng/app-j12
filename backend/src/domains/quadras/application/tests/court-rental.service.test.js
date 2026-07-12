const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  CourtRentalService,
  DEFAULT_OPENING_HOURS,
  buildReservationOccurrences,
  calculateReservationValue,
  isWithinOpeningHours,
  normalizeCourtPayload,
  overlaps,
} = require("../services/court-rental.service.js");

test("confirmReservationPayment rejects cancelled reservations before any mutation", async () => {
  const queries = [];
  const service = new CourtRentalService({
    queryRunner: async (sql, params) => {
      queries.push({ params, sql });
      return [];
    },
  });
  service.ensureSchema = async () => {};
  service.getReservationById = async () => ({
    financialChargeId: "charge-cancelled",
    id: "reservation-cancelled",
    paymentMethod: "pix",
    status: "cancelled",
  });

  await assert.rejects(
    () => service.confirmReservationPayment("reservation-cancelled"),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /reserva cancelada/i);
      return true;
    },
  );
  assert.equal(queries.length, 0);
});

test("calculateReservationValue applies weekday price rules and discounts", () => {
  const quote = calculateReservationValue({
    basePrice: 120,
    discountValue: 30,
    endAt: "2026-07-06T19:30:00",
    rules: [
      {
        active: true,
        currency: "BRL",
        id: "regra-pico",
        pricePerHour: 220,
        priority: 10,
        startTime: "18:00",
        endTime: "23:00",
        weekday: "seg",
      },
    ],
    startAt: "2026-07-06T18:00:00",
  });

  assert.equal(quote.durationMinutes, 90);
  assert.equal(quote.pricePerHour, 220);
  assert.equal(quote.subtotal, 330);
  assert.equal(quote.discountValue, 30);
  assert.equal(quote.total, 300);
  assert.equal(quote.ruleId, "regra-pico");
});

test("buildReservationOccurrences creates bounded recurring reservations", () => {
  const occurrences = buildReservationOccurrences({
    endAt: "2026-07-06T20:00:00",
    recurrence: {
      daysOfWeek: ["seg", "qua"],
      frequency: "weekly",
      interval: 1,
      until: "2026-07-13",
    },
    startAt: "2026-07-06T19:00:00",
  });

  assert.equal(occurrences.length, 3);
  assert.deepEqual(
    occurrences.map((item) => item.startAt),
    ["2026-07-06T19:00:00", "2026-07-08T19:00:00", "2026-07-13T19:00:00"],
  );
  assert.ok(occurrences.every((item) => item.recurrenceGroupId));
});

test("buildReservationOccurrences supports monthly recurrence intervals", () => {
  const occurrences = buildReservationOccurrences({
    endAt: "2026-07-31T20:00:00",
    recurrence: {
      daysOfWeek: [],
      frequency: "monthly",
      interval: 1,
      until: "2026-09-30",
    },
    startAt: "2026-07-31T19:00:00",
  });

  assert.deepEqual(
    occurrences.map((item) => item.startAt),
    ["2026-07-31T19:00:00", "2026-08-31T19:00:00", "2026-09-30T19:00:00"],
  );
});

test("normalizeCourtPayload accepts Sprint 16 court metadata", () => {
  const court = normalizeCourtPayload({
    capacidade: 14,
    coberta: true,
    iluminacao: true,
    nome: "Quadra Teste",
    precoBase: 180,
    precoFimSemana: 210,
    precoNoturno: 230,
    tempoMaximoMinutos: 240,
    tempoMinimoMinutos: 60,
  });

  assert.equal(court.capacidade, 14);
  assert.equal(court.coberta, true);
  assert.equal(court.iluminacao, true);
  assert.equal(court.precoFimSemana, 210);
  assert.equal(court.precoNoturno, 230);
  assert.equal(court.tempoMinimoMinutos, 60);
  assert.equal(court.tempoMaximoMinutos, 240);
});

test("opening hours block unavailable periods", () => {
  assert.equal(
    isWithinOpeningHours(DEFAULT_OPENING_HOURS, "2026-07-06T09:00:00", "2026-07-06T10:00:00"),
    true,
  );
  assert.equal(
    isWithinOpeningHours(DEFAULT_OPENING_HOURS, "2026-07-05T09:00:00", "2026-07-05T10:00:00"),
    false,
  );
});

test("overlaps detects partial conflicts only", () => {
  assert.equal(
    overlaps(
      "2026-07-06T10:00:00",
      "2026-07-06T11:00:00",
      "2026-07-06T10:30:00",
      "2026-07-06T11:30:00",
    ),
    true,
  );
  assert.equal(
    overlaps(
      "2026-07-06T10:00:00",
      "2026-07-06T11:00:00",
      "2026-07-06T11:00:00",
      "2026-07-06T12:00:00",
    ),
    false,
  );
});
