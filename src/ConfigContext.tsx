import { createContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

type ConfigResponse<T> = T | { data?: T };

type ConfigContextValue = {
  modalidades: unknown[];
  planos: unknown[];
};

export const ConfigContext = createContext<ConfigContextValue>({
  modalidades: [],
  planos: [],
});

function extractConfigData<T>(payload: ConfigResponse<T>, fallback: T): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data ?? fallback;
  }

  return (payload as T) ?? fallback;
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [modalidades, setModalidades] = useState<unknown[]>([]);
  const [planos, setPlanos] = useState<unknown[]>([]);

  async function carregarConfigs() {
    const mod = await api.get<ConfigResponse<unknown[]>>("/api/config/modalidades");
    const pla = await api.get<ConfigResponse<unknown[]>>("/api/config/planos");

    setModalidades(extractConfigData(mod, []));
    setPlanos(extractConfigData(pla, []));
  }

  useEffect(() => {
    carregarConfigs();
  }, []);

  return (
    <ConfigContext.Provider
      value={{
        modalidades,
        planos,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}
