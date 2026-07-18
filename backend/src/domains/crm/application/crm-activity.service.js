const { CrmActivity } = require("../domain/crm-activity.js");

class CrmActivityService {
  constructor({ activityRepository, leadRepository, authorizeUnit = () => true, now = () => new Date() } = {}) {
    this.activityRepository = activityRepository;
    this.leadRepository = leadRepository;
    this.authorizeUnit = authorizeUnit;
    this.now = now;
  }

  async createActivity(input = {}, context) {
    this.authorize(context, input.unitId);
    const lead = await this.leadRepository.findById({ id: input.leadId, unitId: input.unitId });
    if (!lead) throw error("CRM_LEAD_NOT_FOUND");
    const activity = new CrmActivity({ ...input, createdAt: this.now().toISOString(), createdBy: context.userId });
    return this.activityRepository.createActivity(activity);
  }

  async findByLead(leadId, context) {
    this.authorize(context, context?.unitId);
    return this.activityRepository.findByLead({ leadId, unitId: context.unitId });
  }

  async findById(id, context) {
    this.authorize(context, context?.unitId);
    return this.activityRepository.findById({ id, unitId: context.unitId });
  }

  async completeTask(id, context) {
    this.authorize(context, context?.unitId);
    return this.activityRepository.completeTask({ id, unitId: context.unitId, completedAt: this.now().toISOString() });
  }

  async cancelTask(id, context) {
    this.authorize(context, context?.unitId);
    return this.activityRepository.cancelTask({ id, unitId: context.unitId });
  }

  async listPendingTasks(context) {
    this.authorize(context, context?.unitId);
    return this.activityRepository.listPendingTasks({ unitId: context.unitId });
  }

  authorize(context, unitId) {
    if (!context?.userId || !unitId || !this.authorizeUnit(context, unitId)) throw error("CRM_ACCESS_DENIED");
  }
}
function error(code) { return Object.assign(new Error(code), { code }); }
module.exports = { CrmActivityService };
