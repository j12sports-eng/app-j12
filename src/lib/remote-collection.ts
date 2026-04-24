import { ApiError, api } from "./api";

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type ReplaceOptions = {
  persist?: boolean;
};

export function createRemoteCollectionStore<T>(collection: string, initialState: T) {
  let state = cloneValue(initialState);
  let initialized = typeof window === "undefined";
  let loadingPromise: Promise<void> | null = null;
  let mutationVersion = 0;
  let saveChain = Promise.resolve();
  const listeners = new Set<() => void>();

  function emit() {
    listeners.forEach((listener) => listener());
  }

  async function persistSnapshot(snapshot: T) {
    await api.put<{ updatedAt: string }>(`/api/state/${collection}`, {
      data: snapshot,
    });
  }

  function queuePersist(snapshot: T) {
    const payload = cloneValue(snapshot);
    saveChain = saveChain
      .then(() => persistSnapshot(payload))
      .catch((error) => {
        console.error(`Falha ao persistir a colecao ${collection}.`, error);
      });
  }

  async function ensureLoaded() {
    if (typeof window === "undefined" || initialized) return;
    if (loadingPromise) return loadingPromise;

    const loadVersion = mutationVersion;

    loadingPromise = (async () => {
      try {
        const response = await api.get<{ data: T }>(`/api/state/${collection}`);

        if (mutationVersion !== loadVersion) return;

        state = response.data;
        initialized = true;
        emit();
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          if (mutationVersion !== loadVersion) return;

          state = cloneValue(initialState);
          initialized = true;
          emit();
          queuePersist(state);
          return;
        }

        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          return;
        }

        console.error(`Falha ao carregar a colecao ${collection}.`, error);
      } finally {
        loadingPromise = null;
      }
    })();

    return loadingPromise;
  }

  function replaceState(nextState: T, options: ReplaceOptions = {}) {
    mutationVersion += 1;
    state = nextState;
    initialized = true;
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
      state = cloneValue(initialState);
      initialized = false;
      emit();
    });
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);

      if (typeof window !== "undefined") {
        void ensureLoaded();
      }

      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return state;
    },
    getState() {
      return state;
    },
    ensureLoaded,
    replaceState,
    resetToInitialState() {
      replaceState(cloneValue(initialState));
    },
  };
}
