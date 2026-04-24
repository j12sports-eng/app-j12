import type { AuthUser, Role } from "./auth";
import {
  professorCanHandleClass,
  professoresStore,
  type Professor,
} from "./professores-store";
import { settingsStore } from "./settings/settings-store";
import type { Turma } from "./turmas-store";

export type UserRole = Extract<Role, "admin" | "coordenador" | "professor">;

export type TeacherClassLink = {
  teacherId?: string | null;
  teacherName: string;
  classId: string;
};

export type ClassAccessRule = {
  canView: boolean;
  canRegister: boolean;
  canEditHistory: boolean;
};

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/^prof\.?\s*/i, "")
    .replace(/^profa\.?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isPrivileged(user: AuthUser | null) {
  return user?.role === "admin" || user?.role === "coordenador";
}

function getLinkedTeacher(user: AuthUser) {
  const configuredUser = settingsStore.getUserById(user.id);
  const teacherId = configuredUser?.teacherId ?? user.teacherId ?? null;
  return teacherId ? professoresStore.getById(teacherId) ?? null : null;
}

function matchesTeacher(user: AuthUser, classItem: Turma, linkedTeacher: Professor | null) {
  const configuredUser = settingsStore.getUserById(user.id);

  if (configuredUser?.classIds.length) {
    return configuredUser.classIds.includes(classItem.id);
  }

  if (configuredUser?.teacherId && classItem.professorId) {
    return configuredUser.teacherId === classItem.professorId;
  }

  if (user.teacherId && classItem.professorId) {
    return user.teacherId === classItem.professorId;
  }

  if (!classItem.professorId && linkedTeacher && professorCanHandleClass(linkedTeacher, classItem)) {
    return true;
  }

  return normalizeName(user.nome) === normalizeName(classItem.professor);
}

export function canAccessClass(user: AuthUser | null, classItem: Turma): boolean {
  if (!user) return false;
  if (isPrivileged(user)) return true;
  if (user.role !== "professor") return false;

  const linkedTeacher = getLinkedTeacher(user);
  return matchesTeacher(user, classItem, linkedTeacher);
}

export function getAccessibleClasses(user: AuthUser | null, classes: Turma[]): Turma[] {
  if (!user) return [];
  if (isPrivileged(user)) return classes;
  if (user.role !== "professor") return [];
  return classes.filter((classItem) => canAccessClass(user, classItem));
}

export function getClassAccessRule(user: AuthUser | null, classItem: Turma): ClassAccessRule {
  const canView = canAccessClass(user, classItem);
  if (!canView) {
    return {
      canView: false,
      canRegister: false,
      canEditHistory: false,
    };
  }

  return {
    canView: true,
    canRegister: true,
    canEditHistory: true,
  };
}
