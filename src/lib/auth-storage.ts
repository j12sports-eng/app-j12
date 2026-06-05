const TOKEN_KEY = "j12_auth_token";

const USER_KEY = "j12_auth_user";

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function dispatchBrowserEvent(name: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(name));
}

/**
 * =========================
 * TOKEN
 * =========================
 */

export function setStoredAuthToken(token: string) {
  try {
    getBrowserStorage()?.setItem(TOKEN_KEY, token);
  } catch {
    // Storage can be disabled by the browser; auth falls back to an empty session.
  }
}

export function getStoredAuthToken(): string | null {
  try {
    return getBrowserStorage()?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function hasStoredAuthToken() {
  return Boolean(getStoredAuthToken());
}

export function clearStoredAuthToken() {
  try {
    getBrowserStorage()?.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

/**
 * =========================
 * USER
 * =========================
 */

export function setStoredAuthUser(user: any) {
  try {
    getBrowserStorage()?.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage persistence failures.
  }
}

export function getStoredAuthUser() {
  let raw: string | null | undefined;

  try {
    raw = getBrowserStorage()?.getItem(USER_KEY);
  } catch {
    raw = null;
  }

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearStoredAuthUser() {
  try {
    getBrowserStorage()?.removeItem(USER_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

/**
 * =========================
 * SESSION HELPERS
 * =========================
 */

export function clearAuthSession() {
  clearStoredAuthToken();
  clearStoredAuthUser();
  dispatchBrowserEvent("j12:session-cleared");
}

export function saveAuthSession(token: string, user: any) {
  setStoredAuthToken(token);
  setStoredAuthUser(user);
  dispatchBrowserEvent("j12:session-ready");
}

export function getAuthSession() {
  return {
    token: getStoredAuthToken(),
    user: getStoredAuthUser(),
  };
}
