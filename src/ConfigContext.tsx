import { createContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

export const ConfigContext = createContext({});

export function ConfigProvider({ children }) {
  const [modalidades, setModalidades] = useState([]);
  const [planos, setPlanos] = useState([]);

  async function carregarConfigs() {
    const mod = await api.get("/api/config/modalidades");
    const pla = await api.get("/api/config/planos");

    setModalidades(mod.data);
    setPlanos(pla.data);
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