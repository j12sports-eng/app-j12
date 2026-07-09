const assert = require("node:assert/strict");
const test = require("node:test");

const {
  FinancialAutomationEventStatus,
  FinancialAutomationEventType,
  FinancialAutomationTargetType,
} = require("../../entities/financial-automation-event.entity.js");
const {
  CREATE_FINANCIAL_AUTOMATION_EVENTS_TABLE_SQL,
  MySqlFinancialAutomationRepository,
} = require("./mysql-financial-automation.repository.js");

test("MySqlFinancialAutomationRepository records automation events idempotently", async () => {
  const calls = [];
  const repository = new MySqlFinancialAutomationRepository({
    idGenerator: () => "evt-fixed",
    queryRunner: async (sql, params = []) => {
      calls.push({ params, sql });

      if (sql === CREATE_FINANCIAL_AUTOMATION_EVENTS_TABLE_SQL) {
        return { affectedRows: 0 };
      }

      if (sql.includes("INSERT IGNORE INTO financial_automation_events")) {
        return { affectedRows: 1 };
      }

      if (sql.includes("WHERE event_key = ?")) {
        return [
          {
            event_key: params[0],
            event_type: FinancialAutomationEventType.REMINDER_SENT,
            id: "evt-fixed",
            status: FinancialAutomationEventStatus.COMPLETED,
            target_id: "men-1",
            target_type: FinancialAutomationTargetType.INSTALLMENT,
          },
        ];
      }

      return [];
    },
  });

  const result = await repository.recordAutomationEvent({
    eventKey: "key-1",
    eventType: FinancialAutomationEventType.REMINDER_SENT,
    status: FinancialAutomationEventStatus.COMPLETED,
    targetId: "men-1",
    targetType: FinancialAutomationTargetType.INSTALLMENT,
  });

  assert.equal(result.created, true);
  assert.equal(result.event.eventKey, "key-1");
  assert.equal(
    calls.some((call) => call.sql.includes("CREATE TABLE IF NOT EXISTS")),
    true,
  );
  assert.equal(
    calls.some((call) => call.sql.includes("INSERT IGNORE")),
    true,
  );
});

test("MySqlFinancialAutomationRepository maps upcoming installment windows", async () => {
  const calls = [];
  const repository = new MySqlFinancialAutomationRepository({
    queryRunner: async (sql, params = []) => {
      calls.push({ params, sql });
      if (sql.includes("FROM j12_mensalidades")) {
        return [
          {
            aluno_id: "aluno-1",
            cobranca_id: "cob-1",
            data_vencimento: "2026-07-10",
            mensalidade_id: "men-1",
            nome_aluno: "Aluno Teste",
            status: "pendente",
            valor: 200,
          },
        ];
      }

      return [];
    },
  });

  const items = await repository.findUpcomingInstallments({
    days: [0, 1],
    limit: 10,
    referenceDate: "2026-07-09",
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].daysOffset, 1);
  assert.equal(items[0].mensalidadeId, "men-1");
  assert.deepEqual(calls[0].params.slice(0, 2), ["2026-07-09", "2026-07-10"]);
});

test("MySqlFinancialAutomationRepository lists grouped payments with existing finance tables", async () => {
  const repository = new MySqlFinancialAutomationRepository({
    queryRunner: async (sql, params = []) => {
      assert.match(sql, /FROM financial_payments p/);
      assert.deepEqual(params.slice(0, 2), ["PAGO", "CANCELADO"]);

      return [
        {
          amount: 150,
          charge_id: "cob-1",
          id: "pay-1",
          mensalidade_id: "men-1",
          paid_at: "2026-07-09 10:00:00",
          status: "PAGO",
          student_id: "aluno-1",
          txid: "TXID1",
        },
      ];
    },
  });

  const payments = await repository.findPayments({
    limit: 10,
    statuses: ["PAGO", "CANCELADO"],
  });

  assert.equal(payments.length, 1);
  assert.equal(payments[0].id, "pay-1");
  assert.equal(payments[0].status, "PAGO");
});

test("MySqlFinancialAutomationRepository completes pending events for paid Inter payments", async () => {
  const calls = [];
  const repository = new MySqlFinancialAutomationRepository({
    queryRunner: async (sql, params = []) => {
      calls.push({ params, sql });
      if (sql.includes("UPDATE financial_automation_events")) {
        return { affectedRows: 3 };
      }
      return [];
    },
  });

  repository.schemaReady = true;
  const result = await repository.markPendingEventsCompletedForPaidPayments({
    payments: [
      {
        chargeId: "cob-1",
        id: "pay-1",
        mensalidadeId: "men-1",
      },
    ],
    processRunId: "run-1",
  });

  assert.equal(result.completed, 3);
  assert.equal(calls[0].params[0], "run-1");
  assert.deepEqual(calls[0].params.slice(1).sort(), ["cob-1", "men-1", "pay-1"]);
});
