import { useCallback, useEffect, useState } from "react";

import { formatApiErrorMessage } from "@/lib/api";
import { BirthdayService } from "@/services/BirthdayService";
import type { DashboardBirthdaysResponse } from "@/types/BirthdayTypes";

const EMPTY_BIRTHDAYS: DashboardBirthdaysResponse = {
  today: [],
  week: [],
  month: [],
};

export function useDashboardBirthdays() {
  const [data, setData] = useState<DashboardBirthdaysResponse>(EMPTY_BIRTHDAYS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const birthdays = await BirthdayService.getDashboardBirthdays();
      setData(birthdays);
    } catch (caughtError) {
      setError(formatApiErrorMessage(caughtError, "Erro ao carregar aniversariantes."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const birthdays = await BirthdayService.getDashboardBirthdays();

        if (active) {
          setData(birthdays);
        }
      } catch (caughtError) {
        if (active) {
          setError(formatApiErrorMessage(caughtError, "Erro ao carregar aniversariantes."));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  return {
    data,
    loading,
    error,
    reload,
  };
}
