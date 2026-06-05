export function isServerRender() {
  return typeof window === "undefined";
}

export function logSsr(message: string, details?: Record<string, unknown>) {
  if (!isServerRender()) {
    return;
  }

  if (details) {
    console.log(message, details);
    return;
  }

  console.log(message);
}

export function logSsrRoute(route: string, stage: string) {
  logSsr(`[SSR] ${stage} rota ${route}`);
}
