/**
 * Repository contract for the Classes/Turmas backend domain.
 *
 * This file defines the expected read-only interface for future consumers. It
 * does not implement persistence, instantiate database adapters or execute SQL.
 *
 * @typedef {Object} ClassRepository
 * @property {({ classId }: { classId?: string|number|null }) => Promise<Record<string, unknown>|null>} findById
 *   Read-only lookup for a class/turma by id.
 * @property {({ classId }: { classId?: string|number|null }) => Promise<Record<string, unknown>|null>} findActiveById
 *   Read-only lookup for a class/turma by id, returning null when inactive.
 * @property {({ classId, lockForUpdate, occupancySource }: { classId?: string|number|null, lockForUpdate?: boolean, occupancySource?: string|null }) => Promise<Record<string, unknown>|null>} getClassCapacitySnapshot
 *   Read-only snapshot with class capacity and current student count when the
 *   real schema exposes enough data. `lockForUpdate` must be used only inside
 *   a transaction. `occupancySource="enrollment_class_links"` switches the
 *   count to active Enrollment -> Turma links.
 */

module.exports = {};
