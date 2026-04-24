import { mysqlApi } from "./mysql-api";

type ResourceConfig<T extends { id: string }> = {
  endpoint: string;
  initialState: T[];
  normalize?: (item: T) => T;
  loadAll?: () => Promise<T[]>;
  createEntity?: (entity: T) => Promise<T>;
  updateEntity?: (entity: T) => Promise<T>;
  deleteEntity?: (id: string) => Promise<void>;
};

export function createMysqlResourceStore<T extends { id: string }>(
  config: ResourceConfig<T>,
) {
  const normalize = config.normalize ?? ((item: T) => item);
  const loadAll = config.loadAll ?? (() => mysqlApi.get<T[]>(config.endpoint));
  const createEntity =
    config.createEntity ?? ((entity: T) => mysqlApi.post<T>(config.endpoint, entity));
  const updateEntity =
    config.updateEntity ??
    ((entity: T) => mysqlApi.put<T>(`${config.endpoint}/${entity.id}`, entity));
  const deleteEntity =
    config.deleteEntity ?? ((id: string) => mysqlApi.del(`${config.endpoint}/${id}`));
  let state =
    typeof window === "undefined" ? config.initialState.map(normalize) : ([] as T[]);
  let initialized = typeof window === "undefined";
  let loading = false;
  let errorMessage: string | null = null;
  let loadingPromise: Promise<void> | null = null;
  let mutationVersion = 0;
  let queue = Promise.resolve();
  const listeners = new Set<() => void>();

  function emit() {
    listeners.forEach((listener) => listener());
  }

  async function reload() {
    loading = true;
    errorMessage = null;
    emit();

    try {
      const data = await loadAll();
      state = data.map(normalize);
      initialized = true;
      errorMessage = null;
      emit();
    } catch (caughtError) {
      if (
        caughtError instanceof Error &&
        "status" in caughtError &&
        (caughtError.status === 401 || caughtError.status === 403)
      ) {
        state = [];
        initialized = true;
        loading = false;
        errorMessage = caughtError.message;
        emit();
        return;
      }

      errorMessage =
        caughtError instanceof Error ? caughtError.message : "Falha ao recarregar dados.";
      console.error(`Falha ao recarregar ${config.endpoint}.`, caughtError);
    } finally {
      loading = false;
      emit();
    }
  }

  async function ensureLoaded() {
    if (typeof window === "undefined" || initialized) return;
    if (loadingPromise) return loadingPromise;

    const version = mutationVersion;
    loading = true;
    errorMessage = null;
    emit();

    loadingPromise = (async () => {
      try {
        const data = await loadAll();
        if (mutationVersion !== version) return;
        state = data.map(normalize);
        initialized = true;
        errorMessage = null;
        emit();
      } catch (caughtError) {
        if (
          caughtError instanceof Error &&
          "status" in caughtError &&
          (caughtError.status === 401 || caughtError.status === 403)
        ) {
          state = [];
          initialized = true;
          loading = false;
          errorMessage = caughtError.message;
          emit();
          return;
        }

        errorMessage =
          caughtError instanceof Error ? caughtError.message : "Falha ao carregar dados.";
        console.error(`Falha ao carregar ${config.endpoint}.`, caughtError);
      } finally {
        loading = false;
        loadingPromise = null;
        emit();
      }
    })();

    return loadingPromise;
  }

  function replaceState(nextState: T[]) {
    mutationVersion += 1;
    state = nextState.map(normalize);
    initialized = true;
    loading = false;
    errorMessage = null;
    emit();
  }

  function resetState() {
    mutationVersion += 1;
    state = [];
    initialized = false;
    loading = false;
    errorMessage = null;
    emit();
  }

  function enqueue(task: () => Promise<void>) {
    queue = queue
      .then(task)
      .catch(async (error) => {
        console.error(`Falha ao persistir ${config.endpoint}.`, error);
        await reload();
      });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("j12:session-ready", () => {
      void reload();
    });

    window.addEventListener("j12:session-cleared", () => {
      resetState();
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
    getMeta() {
      return { loading, error: errorMessage, initialized };
    },
    getState() {
      return state;
    },
    replaceState,
    ensureLoaded,
    reload,
    resetState,
    persistCreate(entity: T) {
      enqueue(async () => {
        const saved = normalize(await createEntity(entity));
        state = state.map((item) => (item.id === entity.id ? saved : item));
        emit();
      });
    },
    persistUpdate(entity: T) {
      enqueue(async () => {
        const saved = normalize(await updateEntity(entity));
        state = state.map((item) => (item.id === entity.id ? saved : item));
        emit();
      });
    },
    persistDelete(id: string) {
      enqueue(async () => {
        await deleteEntity(id);
      });
    },
  };
}
