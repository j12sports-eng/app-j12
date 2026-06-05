import { apiFetch, ApiError, formatApiErrorMessage } from "@/lib/api";

import { hasStoredAuthToken } from "./auth-storage";

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type ReplaceOptions = {
  persist?: boolean;
};

type RemoteCollectionMeta = {
  loading: boolean;
  error: string | null;
  initialized: boolean;
};

type RemoteCollectionOptions<T> = {
  emptyState?: T;
};

export function createRemoteCollectionStore<T>(
  collection: string,
  initialState: T,
  options: RemoteCollectionOptions<T> = {},
) {
  let state = cloneValue(
    typeof window === "undefined" ? initialState : (options.emptyState ?? initialState),
  );

  let initialized = typeof window === "undefined";

  let loading = false;

  let errorMessage: string | null = null;

  let loadingPromise: Promise<void> | null = null;

  let mutationVersion = 0;

  let saveChain = Promise.resolve();

  const listeners = new Set<() => void>();

  let metaSnapshot: RemoteCollectionMeta = {
    loading,
    error: errorMessage,
    initialized,
  };

  function getMetaSnapshot(): RemoteCollectionMeta {
    if (
      metaSnapshot.loading === loading &&
      metaSnapshot.error === errorMessage &&
      metaSnapshot.initialized === initialized
    ) {
      return metaSnapshot;
    }

    metaSnapshot = {
      loading,
      error: errorMessage,
      initialized,
    };

    return metaSnapshot;
  }

  function emit() {
    listeners.forEach((listener) => listener());
  }

  async function persistSnapshot(snapshot: T): Promise<void> {
    // Enviar com wrapper 'data' conforme esperado pelo backend
    const payload = { data: snapshot };
    
    console.log(`[RemoteCollection] Persistindo ${collection}:`, payload);
    
    try {
      const response = await apiFetch<unknown>(`/api/state/${collection}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      console.log(`[RemoteCollection] ✓ ${collection} persistido com sucesso`, response);
    } catch (error: any) {
      console.error(`[RemoteCollection] ✗ Falha ao persistir ${collection}:`, {
        status: error?.status,
        message: error?.message,
        data: error?.data,
      });
      throw error;
    }
  }

  function queuePersist(snapshot: T) {
    const payload = cloneValue(snapshot);

    saveChain = saveChain
      .then(() => persistSnapshot(payload))
      .catch((error: any) => {
        // Não retry em erro 400 (dados inválidos)
        if (error instanceof ApiError && error.status === 400) {
          console.error(`[RemoteCollection] Erro 400 (dados inválidos) para ${collection}:`, error.data);
          errorMessage = formatApiErrorMessage(error, "Dados inválidos para salvar.");
          emit();
          return; // Não tentar novamente
        }

        errorMessage = formatApiErrorMessage(error, "Nao foi possivel salvar os dados na API.");
        emit();
        console.error(`Falha ao persistir a colecao ${collection}.`, error);
      });
  }

  async function ensureLoaded() {
    if (typeof window === "undefined" || initialized || !hasStoredAuthToken()) {
      return;
    }

    if (loadingPromise) {
      return loadingPromise;
    }

    const loadVersion = mutationVersion;

    loading = true;

    errorMessage = null;

    emit();

    loadingPromise = (async () => {
      try {
        const response: any = await apiFetch(`/api/state/${collection}`);

        if (mutationVersion !== loadVersion) {
          return;
        }

        state = response.data;

        initialized = true;

        errorMessage = null;

        emit();
      } catch (error: any) {
        if (error instanceof ApiError && error.status === 404) {
          if (mutationVersion !== loadVersion) {
            return;
          }

          state = cloneValue(initialState);

          initialized = true;

          errorMessage = null;

          emit();

          queuePersist(state);

          return;
        }

        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          state = cloneValue(options.emptyState ?? initialState);

          initialized = true;

          errorMessage = error.message;

          emit();

          return;
        }

        errorMessage = formatApiErrorMessage(error, "Nao foi possivel sincronizar os dados.");

        console.error(`Falha ao carregar a colecao ${collection}.`, error);
      } finally {
        loading = false;

        loadingPromise = null;

        emit();
      }
    })();

    return loadingPromise;
  }

  function replaceState(nextState: T, options: ReplaceOptions = {}) {
    mutationVersion += 1;

    state = nextState;

    initialized = true;

    loading = false;

    errorMessage = null;

    emit();

    if (typeof window !== "undefined" && options.persist !== false) {
      queuePersist(nextState);
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("j12:session-ready", () => {
      initialized = false;

      void ensureLoaded();
    });

    window.addEventListener("j12:session-cleared", () => {
      mutationVersion += 1;

      state = cloneValue(options.emptyState ?? initialState);

      initialized = false;

      loading = false;

      errorMessage = null;

      emit();
    });
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);

      if (typeof window !== "undefined" && hasStoredAuthToken()) {
        void ensureLoaded();
      }

      return () => listeners.delete(listener);
    },

    getSnapshot() {
      return state;
    },

    getMeta() {
      return getMetaSnapshot();
    },

    getState() {
      return state;
    },

    ensureLoaded,

    replaceState,

    async reload() {
      initialized = false;

      await ensureLoaded();
    },

    resetToInitialState() {
      replaceState(cloneValue(initialState));
    },
  };
}
