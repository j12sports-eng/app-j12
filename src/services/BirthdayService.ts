import { api } from "@/lib/api";
import type { DashboardBirthdaysResponse } from "@/types/BirthdayTypes";

const EMPTY_BIRTHDAYS: DashboardBirthdaysResponse = {
  today: [],
  week: [],
  month: [],
};

function normalizeBirthdayResponse(
  payload: DashboardBirthdaysResponse,
): DashboardBirthdaysResponse {
  return {
    today: Array.isArray(payload.today) ? payload.today : [],
    week: Array.isArray(payload.week) ? payload.week : [],
    month: Array.isArray(payload.month) ? payload.month : [],
  };
}

export const BirthdayService = {
  async getDashboardBirthdays(): Promise<DashboardBirthdaysResponse> {
    const payload = await api.get<DashboardBirthdaysResponse>("/dashboard/birthdays");

    return normalizeBirthdayResponse(payload ?? EMPTY_BIRTHDAYS);
  },
};
