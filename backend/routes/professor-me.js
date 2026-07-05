const express = require("express");

const { requireAuth } = require("../auth.js");
const teacherPortal = require("../services/teacher-portal.js");

function createProfessorMeRouter(options = {}) {
  const router = express.Router();
  const service = options.service || teacherPortal;
  const requireAuthMiddleware = options.requireAuth || requireAuth;

  router.use(requireAuthMiddleware);

  async function getScope(req) {
    return service.resolveTeacherScope(req.auth || req.user, {
      professorId: req.query?.professorId || req.query?.teacherId || req.body?.professorId,
      teacherId: req.query?.teacherId || req.body?.teacherId,
    });
  }

  router.get("/", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(await service.loadTeacherProfile(scope.professorId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/dashboard", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(await service.loadTeacherDashboard(scope.professorId, scope));
    } catch (error) {
      next(error);
    }
  });

  router.get("/profile", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(await service.loadTeacherProfile(scope.professorId));
    } catch (error) {
      next(error);
    }
  });

  router.put("/profile", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(
        successEnvelope(
          await service.updateTeacherProfile(scope.professorId, req.body || {}, scope.requestedBy),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/settings", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(await service.loadTeacherPreferences(scope.professorId));
    } catch (error) {
      next(error);
    }
  });

  router.put("/settings", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(
        successEnvelope(
          await service.updateTeacherPreferences(scope.professorId, req.body || {}, scope.requestedBy),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/agenda", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(
        await service.loadTeacherAgenda(scope.professorId, {
          date: req.query?.date,
          view: req.query?.view,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/agenda/recurrences", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      const agenda = await service.loadTeacherAgenda(scope.professorId, {
        date: req.query?.date,
        view: req.query?.view || "month",
      });
      res.json({
        recurrences: agenda.recurrences || [],
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/agenda/:agendaItemId/status", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(
        successEnvelope(
          await service.updateTeacherAgendaStatus(
            scope.professorId,
            req.params.agendaItemId,
            req.body || {},
            scope.requestedBy,
          ),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/turmas", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(await service.loadTeacherClasses(scope.professorId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/turmas/:turmaId", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(await service.loadTeacherClassDetail(scope.professorId, req.params.turmaId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/turmas/:turmaId/alunos", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(await service.loadTeacherClassStudents(scope.professorId, req.params.turmaId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/presencas", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(
        await service.loadTeacherPresence(scope.professorId, {
          date: req.query?.date,
          turmaId: req.query?.turmaId || req.query?.classId,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/presencas", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.status(201).json(
        successEnvelope(
          await service.saveTeacherAttendance(scope.professorId, req.body || {}, scope.requestedBy),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/avaliacoes", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(
        await service.loadTeacherEvaluations(scope.professorId, {
          alunoId: req.query?.alunoId,
          limit: req.query?.limit,
          turmaId: req.query?.turmaId,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/avaliacoes", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.status(201).json(
        successEnvelope(
          await service.createTeacherEvaluation(scope.professorId, req.body || {}, scope.requestedBy),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/ocorrencias", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(await service.loadTeacherOccurrences(scope.professorId, { limit: req.query?.limit }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/ocorrencias", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.status(201).json(
        successEnvelope(
          await service.createTeacherOccurrence(scope.professorId, req.body || {}, scope.requestedBy),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/planejamentos", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(await service.loadTeacherLessonPlans(scope.professorId, { limit: req.query?.limit }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/planejamentos", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.status(201).json(
        successEnvelope(
          await service.upsertTeacherLessonPlan(scope.professorId, req.body || {}, scope.requestedBy),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.put("/planejamentos/:planId", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(
        successEnvelope(
          await service.upsertTeacherLessonPlan(
            scope.professorId,
            { ...(req.body || {}), id: req.params.planId },
            scope.requestedBy,
          ),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/comunicacao", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.json(await service.loadTeacherMessages(scope.professorId, { limit: req.query?.limit }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/comunicacao", async (req, res, next) => {
    try {
      const scope = await getScope(req);
      res.status(201).json(
        successEnvelope(
          await service.sendTeacherMessage(scope.professorId, req.body || {}, scope.requestedBy),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function successEnvelope(data) {
  return {
    data,
    success: true,
  };
}

const router = createProfessorMeRouter();

module.exports = router;
module.exports.createProfessorMeRouter = createProfessorMeRouter;
