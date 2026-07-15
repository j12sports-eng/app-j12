const { expect, test } = require("@playwright/test");

const { JOURNEYS } = require("./journey-catalog.cjs");
const {
  DATA,
  activateJourneyClassLink,
  ensureJourneyObligation,
  prepareJourneyEnrollment,
  queryRows,
} = require("../../scripts/e2e/sprint-23-11-fixtures.cjs");

const SAFE_CHARGE_NAME = `${DATA.prefix} Cobranca Segura`;
const SAFE_CHARGE_PAYER = `${DATA.prefix} Pagador Local`;
const COURT_NAME = `${DATA.prefix} Quadra Browser`;
const RESERVATION_TITLE = `${DATA.prefix} Reserva Browser`;
const CONFLICT_RESERVATION_TITLE = `${DATA.prefix} Reserva Conflitante`;
const CHAMPIONSHIP_NAME = `${DATA.prefix} Copa Browser`;

const HANDLERS = {
  J01: adminAuthenticates,
  J02: adminCreatesAndFindsStudent,
  J03: adminVerifiesResponsibleLink,
  J04: adminConfirmsEnrollment,
  J05: adminVerifiesStudentInClass,
  J06: adminVerifiesFinancialObligation,
  J07: adminCreatesSafeCharge,
  J08: adminProcessesInternalPayment,
  J09: adminVerifiesReconciledStatus,
  J10: adminRunsMonthlyAutomation,
  J11: adminVerifiesPersistedHistory,
  J12: adminOpensAutomationHistory,
  J13: adminVerifiesFinancialBi,
  J14: professorViewsAssignedClass,
  J15: professorRegistersAttendance,
  J16: studentViewsOwnDashboard,
  J17: responsibleViewsLinkedDependent,
  J18: adminCreatesCourtReservation,
  J19: adminCannotCreateConflictingReservation,
  J20: adminCreatesAndPublishesChampionship,
  J21: publicPortalShowsPublishedChampionship,
};

const IMPLEMENTED = new Set(Object.keys(HANDLERS));

test.describe("Sprint 23.11 - 21 canonical browser journeys", () => {
  for (const journey of JOURNEYS) {
    test(`${journey.id} - ${journey.name}`, async ({ page }) => {
      expect(IMPLEMENTED.has(journey.id)).toBe(true);
      const unexpectedExternalRequests = await guardExternalRequests(page);
      await HANDLERS[journey.id](page);
      expect(unexpectedExternalRequests).toEqual([]);
    });
  }
});

async function adminAuthenticates(page) {
  await login(page, "admin@j12.com");
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);
  await expect(page.getByText("Admin J12", { exact: false }).first()).toBeVisible();
}

async function adminCreatesAndFindsStudent(page) {
  await login(page, "admin@j12.com");
  await page.goto("/alunos");
  await page.getByRole("button", { name: /Nova matr/i }).click();
  await expect(page).toHaveURL(/\/matricula(?:[/?#]|$)/);

  // The canonical create action is the four-step enrollment wizard, not the legacy dialog.
  await page.getByLabel(/Nome completo \*/).fill(DATA.journeyStudentName);
  await page.getByLabel(/Data de nascimento \*/).fill("2011-11-23");
  await page.getByLabel(/Sexo \*/).selectOption({ index: 1 });
  await page
    .getByRole("button", { name: new RegExp(escapeRegex(DATA.turmaName)) })
    .first()
    .click();
  await page.getByRole("button", { name: /Pr.*xima etapa/i }).click();

  await page.getByLabel(/Nome completo do respons.*vel \*/).fill(DATA.journeyResponsibleName);
  await page.getByLabel(/CPF do respons.*vel \*/).fill("52998224725");
  await page.getByLabel(/Telefone principal \*/).fill(DATA.journeyResponsibleWhatsapp);
  await page.getByLabel(/^E-mail/).fill("responsavel.jornada.2311b@e2e.local");
  await page.getByLabel(/Grau de parentesco \*/).selectOption({ index: 1 });
  await page.getByRole("button", { name: /Pr.*xima etapa/i }).click();
  await page.getByRole("button", { name: /Pr.*xima etapa/i }).click();
  await page.getByRole("button", { name: /Finalizar matr/i }).click();

  await expect(page.getByRole("heading", { name: /Matr.*cula registrada/i })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: /Ir para alunos/i }).click();
  const search = page.getByPlaceholder("Buscar por nome, e-mail, turma, plano ou unidade...");
  await search.fill(DATA.journeyStudentName);
  await expect(page.getByText(DATA.journeyStudentName, { exact: true }).first()).toBeVisible();
  await expect
    .poll(async () => {
      const rows = await queryRows(
        "SELECT COUNT(*) AS total FROM j12_alunos WHERE nome_completo = ?",
        [DATA.journeyStudentName],
      );
      return Number(rows[0]?.total || 0);
    })
    .toBe(1);
}

async function adminVerifiesResponsibleLink(page) {
  await login(page, "admin@j12.com");
  await page.goto("/alunos");
  await page
    .getByPlaceholder("Buscar por nome, e-mail, turma, plano ou unidade...")
    .fill(DATA.journeyStudentName);
  await page.getByText(DATA.journeyStudentName, { exact: true }).first().click();
  await expect(page.getByRole("dialog")).toContainText(DATA.journeyResponsibleName);
  await expect(page.getByRole("dialog")).toContainText(/\(11\) 92311-2311/);

  const rows = await queryRows(
    `SELECT nome_completo, whatsapp
     FROM j12_alunos_responsaveis
     WHERE aluno_id = (SELECT id FROM j12_alunos WHERE nome_completo = ? LIMIT 1)`,
    [DATA.journeyStudentName],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].nome_completo).toBe(DATA.journeyResponsibleName);
  expect(String(rows[0].whatsapp).replace(/\D/g, "")).toBe(DATA.journeyResponsibleWhatsapp);
}

async function adminConfirmsEnrollment(page) {
  await prepareJourneyEnrollment();
  await login(page, "admin@j12.com");
  await page.goto("/admin/enrollments");
  await page.getByPlaceholder("Nome, CPF, email, pessoa ou perfil").fill(DATA.journeyStudentName);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  const searchResult = page.getByRole("article").filter({ hasText: DATA.journeyStudentName });
  await searchResult.getByRole("button", { name: "Selecionar aluno" }).click();
  await expect(page.getByText("Rascunho", { exact: true }).last()).toBeVisible();
  const confirmButton = page.getByRole("button", { name: "Confirmar matricula" });
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();
  await expect(page.getByText("Ativa", { exact: true }).last()).toBeVisible();

  const rows = await queryRows("SELECT status FROM enrollments WHERE id = ?", [DATA.enrollmentId]);
  expect(rows[0]?.status).toBe("ACTIVE");
}

async function adminVerifiesStudentInClass(page) {
  await activateJourneyClassLink();
  await login(page, "admin@j12.com");
  await page.goto("/turmas");
  const card = page.getByRole("article").filter({ hasText: DATA.turmaName });
  await expect(card).toBeVisible();
  await card.getByTitle("Ver turma").click();
  await expect(page.getByRole("dialog")).toContainText(DATA.journeyStudentName);

  const rows = await queryRows(
    "SELECT status FROM enrollment_class_links WHERE id = ? AND enrollment_id = ?",
    [DATA.classLinkId, DATA.enrollmentId],
  );
  expect(rows[0]?.status).toBe("ACTIVE");
}

async function adminVerifiesFinancialObligation(page) {
  // Keep this journey deterministic even if an earlier browser assertion fails.
  await prepareJourneyEnrollment();
  await ensureJourneyObligation();
  await login(page, "admin@j12.com");
  await page.goto("/admin/financeiro");
  await page.getByPlaceholder("ID da matricula").fill(DATA.enrollmentId);
  await page
    .getByPlaceholder("ID da matricula")
    .locator("xpath=ancestor::form")
    .getByRole("button", { name: "Consultar" })
    .click();
  await expect(page.getByText(DATA.obligationId, { exact: false })).toBeVisible();
  await expect(page.getByText("Pendente", { exact: true }).last()).toBeVisible();

  const rows = await queryRows(
    "SELECT status, amount FROM enrollment_financial_obligations WHERE id = ?",
    [DATA.obligationId],
  );
  expect(rows[0]?.status).toBe("PENDING");
  expect(Number(rows[0]?.amount)).toBe(231.1);
}

async function adminCreatesSafeCharge(page) {
  await login(page, "admin@j12.com");
  await page.goto("/admin/financeiro");
  await page.getByRole("button", { name: "Nova cobranca" }).click();

  const dialog = page.getByRole("dialog", { name: "Nova cobranca" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Nao", exact: true }).click();
  await dialog.getByLabel("Origem/Pagador").fill(SAFE_CHARGE_PAYER);
  await dialog.getByLabel("Responsavel/Contato").fill("E2E local sem envio externo");
  await dialog.getByRole("button", { name: "Continuar" }).click();
  await dialog.getByLabel("Nome da cobranca").fill(SAFE_CHARGE_NAME);
  await dialog.getByLabel("Valor").fill("23110");
  await dialog.getByLabel("Data vencimento").fill(futureDate(10));
  await dialog.getByLabel("Forma pagamento").selectOption("dinheiro");
  await dialog.getByLabel("Observacoes").fill("Simulacao local Sprint 23.11B");
  await dialog.getByRole("button", { name: "Criar cobranca" }).click();

  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText("Cobranca criada com sucesso.", { exact: true })).toBeVisible();

  const chargeRow = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: SAFE_CHARGE_PAYER, exact: true }),
  });
  await expect(chargeRow).toBeVisible();
  await expect(chargeRow).toContainText("R$ 231,10");

  const rows = await queryRows(
    "SELECT status, forma_pagamento, valor_final FROM j12_financeiro_cobrancas WHERE descricao = ?",
    [SAFE_CHARGE_NAME],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe("pendente");
  expect(rows[0].forma_pagamento).toBe("dinheiro");
  expect(Number(rows[0].valor_final)).toBe(231.1);
}

async function adminProcessesInternalPayment(page) {
  await prepareJourneyEnrollment();
  await ensureJourneyObligation();
  const card = await openJourneyObligation(page);
  await card.getByRole("button", { name: "Baixar" }).click();
  await expect(page.getByRole("heading", { name: "Marcar como paga" })).toBeVisible();
  await page.getByPlaceholder("Comprovante interno, recibo ou observacao").fill("E2E-LOCAL-2311B");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText("Obrigacao marcada como paga.")).toBeVisible();
  await expect(card.getByText("Paga", { exact: true })).toBeVisible();

  const rows = await queryRows(
    "SELECT status, metadata_json FROM enrollment_financial_obligations WHERE id = ?",
    [DATA.obligationId],
  );
  expect(rows[0]?.status).toBe("PAID");
  expect(String(rows[0]?.metadata_json)).toContain("E2E-LOCAL-2311B");
}

async function adminVerifiesReconciledStatus(page) {
  const card = await openJourneyObligation(page);
  await expect(card.getByText("Paga", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Baixar" })).toBeDisabled();

  const rows = await queryRows(
    "SELECT status, metadata_json, updated_at FROM enrollment_financial_obligations WHERE id = ?",
    [DATA.obligationId],
  );
  expect(rows[0]?.status).toBe("PAID");
  expect(rows[0]?.updated_at).toBeTruthy();
  const metadata =
    typeof rows[0]?.metadata_json === "string"
      ? JSON.parse(rows[0].metadata_json)
      : rows[0]?.metadata_json;
  const paymentAudit = metadata?.statusAudit?.at(-1);
  expect(paymentAudit).toMatchObject({
    action: "MARK_PAID",
    paymentReference: "E2E-LOCAL-2311B",
    toStatus: "PAID",
  });
  expect(paymentAudit?.paidAt).toBeTruthy();
  expect(paymentAudit?.paidBy).toBeTruthy();
}

async function adminRunsMonthlyAutomation(page) {
  await login(page, "admin@j12.com");
  await page.goto("/admin/financeiro");
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/financeiro/gerar-mensalidades"),
  );
  await page.getByRole("button", { name: "Gerar mensalidades" }).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.execution_id).toMatch(/^billing-/);
  await expect(page.getByText("Rotina de mensalidades executada com sucesso.")).toBeVisible({
    timeout: 20_000,
  });

  const rows = await queryRows(
    `SELECT status
       FROM financial_automation_execution_history
       WHERE execution_id = ?
       ORDER BY
         CASE status
           WHEN 'STARTED' THEN 0
           WHEN 'SUCCEEDED' THEN 1
           WHEN 'FAILED' THEN 2
           ELSE 3
         END,
         created_at ASC,
         id ASC`,
    [body.execution_id],
  );
  expect(rows.map((row) => row.status)).toEqual(["STARTED", "SUCCEEDED"]);
}

async function adminVerifiesPersistedHistory(page) {
  const executionId = await latestMonthlyBillingExecutionId();
  await login(page, "admin@j12.com");
  await page.getByRole("link", { name: "Historico de Automacoes" }).click();
  await expect(page).toHaveURL(/\/admin\/financeiro\/automacoes\/historico/);
  const row = page
    .getByRole("row")
    .filter({ hasText: "monthly-billing" })
    .filter({ hasText: "SUCCEEDED" })
    .first();
  await expect(row).toBeVisible();
  await expect(row).toContainText("monthly-billing");

  const rows = await queryRows(
    "SELECT COUNT(*) AS total FROM financial_automation_execution_history WHERE execution_id = ?",
    [executionId],
  );
  expect(Number(rows[0]?.total)).toBe(2);
}

async function adminOpensAutomationHistory(page) {
  const executionId = await latestMonthlyBillingExecutionId();
  await login(page, "admin@j12.com");
  await page.getByRole("link", { name: "Historico de Automacoes" }).click();
  await expect(page).toHaveURL(/\/admin\/financeiro\/automacoes\/historico/);
  const row = page
    .getByRole("row")
    .filter({ hasText: "monthly-billing" })
    .filter({ hasText: "SUCCEEDED" })
    .first();
  await row.getByRole("button", { name: "Abrir" }).click();
  const dialog = page.getByRole("dialog", { name: "Detalhes da execucao" });
  await expect(dialog).toContainText(executionId);
  await expect(dialog.getByText("STARTED", { exact: true })).toBeVisible();
  await expect(dialog.getByText("SUCCEEDED", { exact: true })).toBeVisible();
}

async function adminVerifiesFinancialBi(page) {
  const chargeRows = await queryRows(
    "SELECT COUNT(*) AS total FROM j12_financeiro_cobrancas WHERE descricao = ? AND ativo = 1",
    [SAFE_CHARGE_NAME],
  );
  expect(Number(chargeRows[0]?.total)).toBe(1);

  const expectedRevenueRows = await queryRows(
    `SELECT COALESCE(SUM(COALESCE(valor_final, valor, 0)), 0) AS expected_revenue
     FROM j12_financeiro_cobrancas
     WHERE ativo = 1
       AND vencimento BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND CURRENT_DATE()
      AND LOWER(status) NOT IN (
        'cancelled',
        'canceled',
        'cancelado',
        'cancelada',
        'removida',
        'removida_pelo_usuario_recebedor'
      )
       AND LOWER(tipo) NOT IN ('despesa', 'expense')`,
  );
  const expectedRevenueValue = Number(expectedRevenueRows[0]?.expected_revenue || 0);
  expect(expectedRevenueValue).toBeGreaterThanOrEqual(231.1);

  await login(page, "admin@j12.com");
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      url.pathname.endsWith("/admin/bi/financial") &&
      url.searchParams.get("period") === "CURRENT_MONTH"
    );
  });
  await page.getByRole("link", { name: "BI Financeiro" }).click();
  await expect(page).toHaveURL(/\/admin\/bi\/financeiro/);
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const body = await response.json();
  const apiExpectedRevenue = Number(body.data?.kpis?.expectedRevenue?.value);
  expect(apiExpectedRevenue).toBe(expectedRevenueValue);

  await expect(page.getByRole("heading", { name: "Analise financeira consolidada" })).toBeVisible();
  const expectedRevenue = page.getByRole("article").filter({ hasText: "Receita prevista" });
  await expect(expectedRevenue).toBeVisible();
  await expect(expectedRevenue).toContainText(formatCurrency(apiExpectedRevenue));
}

async function professorViewsAssignedClass(page) {
  await login(page, "prof@j12.com");
  await page.goto("/professor/presencas");
  await expect(page.getByRole("heading", { name: "Controle de presencas." })).toBeVisible();
  await expect(page.getByLabel("Turma")).toHaveValue(String(DATA.turmaId));
  await expect(page.getByText(DATA.turmaName, { exact: true }).last()).toBeVisible();
  await expect(page.getByText(DATA.portalStudentName, { exact: true })).toBeVisible();
  await expect(page.getByText(DATA.journeyStudentName, { exact: true })).toBeVisible();
}

async function professorRegistersAttendance(page) {
  await login(page, "prof@j12.com");
  await page.goto("/professor/presencas");
  const student = page.getByRole("article").filter({ hasText: DATA.portalStudentName });
  await expect(student).toBeVisible();
  await student.getByRole("button", { name: "Falta" }).click();
  await page.getByRole("button", { name: "Salvar chamada" }).click();
  await expect(page.getByText("Chamada salva com sucesso!")).toBeVisible();

  const rows = await queryRows(
    "SELECT presente FROM student_presencas WHERE aluno_id = ? AND turma = ? AND data_aula = ?",
    [DATA.portalStudentId, DATA.turmaName, todayDate()],
  );
  expect(rows).toHaveLength(1);
  expect(Number(rows[0].presente)).toBe(0);
}

async function studentViewsOwnDashboard(page) {
  await login(page, "aluno@j12.com");
  await page.goto("/portal-aluno/dashboard");
  await expect(page.getByText(`Ola, ${DATA.portalStudentName}`, { exact: true })).toBeVisible();
  await expect(page.getByText("Plano E2E", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(DATA.journeyStudentName, { exact: true })).toHaveCount(0);
}

async function responsibleViewsLinkedDependent(page) {
  await login(page, "responsavel@j12.com");
  await page.goto("/portal-responsavel/dashboard");
  await expect(page.getByText(DATA.portalStudentName, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(DATA.journeyStudentName, { exact: true })).toHaveCount(0);

  const rows = await queryRows(
    "SELECT aluno_id FROM j12_responsavel_alunos WHERE responsavel_id = ?",
    [String(DATA.responsibleId)],
  );
  expect(rows.map((row) => String(row.aluno_id))).toEqual([DATA.portalStudentId]);
}

async function adminCreatesCourtReservation(page) {
  await login(page, "admin@j12.com");
  await page.goto("/admin/quadras");
  await page.getByRole("button", { name: "Quadras", exact: true }).click();
  const courtForm = page.locator("form").filter({ hasText: "Nova quadra" });
  await courtForm.getByLabel("Nome").fill(COURT_NAME);
  await courtForm.getByLabel("Tipo").fill("Futsal");
  await courtForm.getByRole("button", { name: "Salvar quadra" }).click();
  await expect(page.getByText("Quadra cadastrada.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Calendario", exact: true }).click();
  const reservationForm = page.locator("form").filter({ hasText: "Nova reserva" });
  await reservationForm.getByLabel("Titulo").fill(RESERVATION_TITLE);
  await reservationForm.getByLabel("Quadra").selectOption({ label: COURT_NAME });
  await reservationForm.getByLabel("Nome do locatario").fill(`${DATA.prefix} Locatario`);
  await reservationForm.getByLabel("Email").fill("locatario.2311b@e2e.local");
  await reservationForm.getByLabel("Inicio").fill(reservationDateTime(19));
  await reservationForm.getByLabel("Fim").fill(reservationDateTime(20));
  await reservationForm.getByLabel("Pagamento").selectOption("dinheiro");
  await reservationForm.getByLabel("Gerar cobranca no financeiro").uncheck();
  await reservationForm.getByLabel("Enviar para lista de espera se houver conflito").uncheck();
  await reservationForm.getByRole("button", { name: "Criar reserva" }).click();
  await expect(
    page.getByText("Reserva criada e integrada ao financeiro/notificacoes.", { exact: true }),
  ).toBeVisible();

  const rows = await queryRows(
    `SELECT reservation.id, reservation.status, reservation.financial_charge_id
     FROM j12_quadra_reservas reservation
     INNER JOIN j12_quadras court ON court.id = reservation.quadra_id
     WHERE court.nome = ? AND reservation.title = ?`,
    [COURT_NAME, RESERVATION_TITLE],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe("confirmed");
  expect(rows[0].financial_charge_id).toBeNull();
}

async function adminCannotCreateConflictingReservation(page) {
  await login(page, "admin@j12.com");
  await page.goto("/admin/quadras");
  await page.getByRole("button", { name: "Calendario", exact: true }).click();
  const reservationForm = page.locator("form").filter({ hasText: "Nova reserva" });
  await reservationForm.getByLabel("Titulo").fill(CONFLICT_RESERVATION_TITLE);
  await reservationForm.getByLabel("Quadra").selectOption({ label: COURT_NAME });
  await reservationForm.getByLabel("Nome do locatario").fill(`${DATA.prefix} Conflito`);
  await reservationForm.getByLabel("Email").fill("conflito.2311b@e2e.local");
  await reservationForm.getByLabel("Inicio").fill(reservationDateTime(19));
  await reservationForm.getByLabel("Fim").fill(reservationDateTime(20));
  await reservationForm.getByLabel("Gerar cobranca no financeiro").uncheck();
  await reservationForm.getByLabel("Enviar para lista de espera se houver conflito").uncheck();
  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().endsWith("/reservas"),
  );
  await reservationForm.getByRole("button", { name: "Criar reserva" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(409);

  const responseBody = await response.json();
  expect(JSON.stringify(responseBody)).toMatch(
    /indisponivel|conflito|reserva ou bloqueio|COURT_RESERVATION_CONFLICT/i,
  );

  const notifications = page.getByRole("region", { name: /Notifications/i });
  await expect(notifications).toContainText(
    /indisponivel|conflito|reserva ou bloqueio|Nao foi possivel criar a reserva/i,
  );

  const rows = await queryRows(
    "SELECT COUNT(*) AS total FROM j12_quadra_reservas WHERE title = ?",
    [CONFLICT_RESERVATION_TITLE],
  );
  expect(Number(rows[0]?.total)).toBe(0);
}

async function adminCreatesAndPublishesChampionship(page) {
  await login(page, "admin@j12.com");
  await page.goto("/admin/campeonatos");
  const form = page.locator("form").filter({ hasText: "Novo campeonato" });
  await form.getByLabel("Nome").fill(CHAMPIONSHIP_NAME);
  await form.getByLabel("Categoria").fill("Sub-13");
  await form.getByLabel("Modalidade").fill("Futsal");
  await form.getByLabel("Data inicial").fill(futureDate(30));
  await form.getByLabel("Data final").fill(futureDate(37));
  await form.getByLabel("Status").selectOption("DRAFT");
  await form.getByLabel("Observacoes").fill("Campeonato sintetico local Sprint 23.11B");
  await form.getByRole("button", { name: "Criar campeonato" }).click();
  await expect(page.getByText("Campeonato criado.", { exact: true })).toBeVisible();

  const card = page.getByRole("article").filter({ hasText: CHAMPIONSHIP_NAME });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Campeonato publicado.", { exact: true })).toBeVisible();
  await expect(card.getByText("Publicado", { exact: true })).toBeVisible();

  const rows = await queryRows(
    "SELECT status, published_at FROM j12_campeonatos WHERE name = ? AND deleted_at IS NULL",
    [CHAMPIONSHIP_NAME],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe("PUBLISHED");
  expect(rows[0].published_at).toBeTruthy();
}

async function publicPortalShowsPublishedChampionship(page) {
  const rows = await queryRows(
    "SELECT status FROM j12_campeonatos WHERE name = ? AND deleted_at IS NULL",
    [CHAMPIONSHIP_NAME],
  );
  expect(rows[0]?.status).toBe("PUBLISHED");

  await page.goto("/campeonatos");
  await expect(page.getByRole("heading", { name: "Campeonatos J12" })).toBeVisible();
  const card = page.getByRole("article").filter({ hasText: CHAMPIONSHIP_NAME });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Sub-13");
  await expect(card).toContainText("Futsal");
  await expect(page.getByText("locatario.2311b@e2e.local")).toHaveCount(0);
}

async function openJourneyObligation(page) {
  await login(page, "admin@j12.com");
  await page.goto("/admin/financeiro");
  await page.getByPlaceholder("ID da matricula").fill(DATA.enrollmentId);
  await page
    .getByPlaceholder("ID da matricula")
    .locator("xpath=ancestor::form")
    .getByRole("button", { name: "Consultar" })
    .click();
  const card = page.getByRole("article").filter({ hasText: DATA.obligationId });
  await expect(card).toBeVisible();
  return card;
}

async function latestMonthlyBillingExecutionId() {
  const rows = await queryRows(
    "SELECT execution_id FROM financial_automation_execution_history WHERE automation_name = 'monthly-billing' ORDER BY created_at DESC LIMIT 1",
  );
  const executionId = String(rows[0]?.execution_id || "");
  expect(executionId).toMatch(/^billing-/);
  return executionId;
}

async function login(page, email) {
  await page.goto("/login");
  const form = page.getByRole("form", { name: "Login J12" });
  await expect(form).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("E-mail").fill(email);
  await page.locator("#login-password").fill(requiredPassword());
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login(?:[/?#]|$)/, { timeout: 20_000 });
}

async function guardExternalRequests(page) {
  const unexpected = [];
  await page.context().route("**/*", async (route) => {
    const requestUrl = route.request().url();
    const url = new URL(requestUrl);
    if (
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      ["data:", "blob:"].includes(url.protocol)
    ) {
      await route.continue();
      return;
    }

    unexpected.push(requestUrl);
    await route.abort("blockedbyclient");
  });
  return unexpected;
}

function requiredPassword() {
  const password = String(process.env.E2E_AUTH_PASSWORD || "");
  if (!password) throw new Error("E2E_AUTH_PASSWORD is required for functional journeys.");
  return password;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
}

function futureDate(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function reservationDateTime(hour) {
  return `${futureDate(21)}T${String(hour).padStart(2, "0")}:00`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
