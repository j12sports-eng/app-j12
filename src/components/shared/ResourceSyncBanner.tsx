type ResourceStatus = {
  loading: boolean;
  error: string | null;
  initialized: boolean;
};

export function ResourceSyncBanner({
  status,
  resourceLabel,
  hasData = false,
}: {
  status: ResourceStatus;
  resourceLabel: string;
  hasData?: boolean;
}) {
  if (status.error) {
    return (
      <section className="rounded-3xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
        Nao foi possivel sincronizar {resourceLabel}. {status.error}
      </section>
    );
  }

  if (status.loading && !hasData) {
    return (
      <section className="rounded-3xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
        Carregando {resourceLabel} da API...
      </section>
    );
  }

  if (status.loading) {
    return (
      <section className="rounded-3xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-primary/90">
        Sincronizando {resourceLabel} com a API...
      </section>
    );
  }

  return null;
}
