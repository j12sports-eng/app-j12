import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type Unidade = {
  id: string;
  nome: string;
};

export type Modalidade = {
  id: string;
  nome: string;
};

let unidadesState: Unidade[] = [];
let modalidadesState: Modalidade[] = [];

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export async function loadSystem() {
  try {
    const [unidades, modalidades] = await Promise.all([
      apiFetch("/unidades"),
      apiFetch("/modalidades"),
    ]);

    unidadesState = unidades || [];
    modalidadesState = modalidades || [];

    emit();
  } catch (error) {
    console.error(error);
  }
}

export function useUnidades() {
  const [state, setState] = useState(unidadesState);

  useEffect(() => {
    const update = () => setState([...unidadesState]);

    listeners.add(update);

    loadSystem();

    return () => {
      listeners.delete(update);
    };
  }, []);

  return state;
}

export function useModalidades() {
  const [state, setState] = useState(modalidadesState);

  useEffect(() => {
    const update = () => setState([...modalidadesState]);

    listeners.add(update);

    loadSystem();

    return () => {
      listeners.delete(update);
    };
  }, []);

  return state;
}