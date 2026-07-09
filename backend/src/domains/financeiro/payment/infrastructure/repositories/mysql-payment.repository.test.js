const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CANCEL_PAYMENT_CHARGE_SQL,
  CREATE_PAYMENT_CHARGES_TABLE_SQL,
  INSERT_PAYMENT_CHARGE_SQL,
  MySqlPaymentRepository,
  PAYMENT_CHARGES_TABLE,
} = require("./mysql-payment.repository.js");

test("MySqlPaymentRepository creates, updates and cancels gateway charges locally", async () => {
  const calls = [];
  let row = null;
  const repository = new MySqlPaymentRepository({
    idGenerator: () => "fgc-sql-1",
    async queryRunner(sql, params = []) {
      calls.push({ params, sql });

      if (sql === INSERT_PAYMENT_CHARGE_SQL) {
        row = {
          amount: params[7],
          checkout_url: params[13],
          created_at: "2026-07-09 10:00:00",
          created_by: params[16],
          currency: params[8],
          description: params[9],
          due_date: params[10],
          external_id: params[12],
          id: params[0],
          legacy_charge_id: params[1],
          mensalidade_id: params[2],
          metadata_json: params[15],
          payment_method: params[11],
          provider: params[5],
          provider_payload: params[14],
          responsible_id: params[4],
          status: params[6],
          student_id: params[3],
          updated_at: "2026-07-09 10:00:00",
        };
        return { affectedRows: 1 };
      }

      if (/UPDATE financial_gateway_charges/i.test(sql) && sql !== CANCEL_PAYMENT_CHARGE_SQL) {
        row = {
          ...row,
          amount: params[0],
          description: params[3],
          updated_by: params[params.length - 2],
        };
        return { affectedRows: 1 };
      }

      if (sql === CANCEL_PAYMENT_CHARGE_SQL) {
        row = {
          ...row,
          cancelled_by: params[1],
          cancellation_reason: params[2],
          provider_payload: params[3],
          status: params[0],
          updated_by: params[4],
        };
        return { affectedRows: 1 };
      }

      if (/SELECT \*/i.test(sql)) {
        return row ? [row] : [];
      }

      return { affectedRows: 1 };
    },
  });

  const created = await repository.createCharge({
    amount: 300,
    createdBy: "admin@j12.local",
    description: "Mensalidade",
    dueDate: "2026-07-10",
    provider: "banco_inter",
    providerPayload: { integrated: false },
    studentId: "aluno-1",
  });
  const updated = await repository.updateCharge({
    id: "fgc-sql-1",
    patch: {
      amount: 320,
      description: "Mensalidade ajustada",
    },
    updatedBy: "admin@j12.local",
  });
  const cancelled = await repository.cancelCharge({
    cancelledBy: "admin@j12.local",
    id: "fgc-sql-1",
    providerPayload: { status: "CANCEL_PLANNED" },
    reason: "cancelamento",
  });

  assert.equal(created.id, "fgc-sql-1");
  assert.equal(updated.amount, 320);
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.cancellationReason, "cancelamento");
  assert.equal(calls[0].sql, CREATE_PAYMENT_CHARGES_TABLE_SQL);
  assert.equal(
    calls.some((call) => call.sql === INSERT_PAYMENT_CHARGE_SQL),
    true,
  );
  assert.equal(
    calls.some((call) => call.sql.includes(`UPDATE ${PAYMENT_CHARGES_TABLE}`)),
    true,
  );
});
