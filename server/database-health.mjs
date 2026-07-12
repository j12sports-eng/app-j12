export function clampHealthCooldown(value, fallback = 30000) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(3600000, Math.max(5000, parsed));
}

export function createDatabaseHealthController({
  state,
  probe,
  cooldownMs = 30000,
  now = Date.now,
}) {
  const safeCooldownMs = clampHealthCooldown(cooldownMs);
  let probeInFlight = null;
  let lastProbeStartedAt = null;

  function refresh(reason) {
    if (probeInFlight) return probeInFlight;
    lastProbeStartedAt = now();
    probeInFlight = Promise.resolve()
      .then(() => probe(reason))
      .finally(() => {
        probeInFlight = null;
      });
    return probeInFlight;
  }

  function refreshForHealth() {
    if (state.ok) return Promise.resolve(true);
    if (probeInFlight) return probeInFlight;
    if (lastProbeStartedAt !== null && now() - lastProbeStartedAt < safeCooldownMs)
      return Promise.resolve(false);
    return refresh("health-check");
  }

  return { refresh, refreshForHealth };
}
