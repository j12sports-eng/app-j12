const AUTH_SESSION_READY_EVENT = "j12:session-ready";
const AUTH_SESSION_CLEARED_EVENT = "j12:session-cleared";

export const AUTH_TOKEN_STORAGE_KEY = "j12_auth_token";
export const AUTH_USER_STORAGE_KEY = "j12_auth_user";

const LEGACY_TOKEN_STORAGE_KEYS = ["j12_mysql_token", "j12_token"];
const LEGACY_USER_STORAGE_KEYS = ["j12_user"];

function dispatchAuthEvent(name: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name));
}

function removeStorageKeys(keys: string[]) {
  if (typeof window === "undefined") return;
  keys.forEach((key) => window.localStorage.removeItem(key));
}

function getFirstStoredValue(keys: string[]) {
  if (typeof window === "undefined") return null;

  for (const key of keys) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }

  return null;
}

export function notifySessionReady() {
  dispatchAuthEvent(AUTH_SESSION_READY_EVENT);
}

export function notifySessionCleared() {
  dispatchAuthEvent(AUTH_SESSION_CLEARED_EVENT);
}

export function getStoredAuthToken() {
  return getFirstStoredValue([AUTH_TOKEN_STORAGE_KEY, ...LEGACY_TOKEN_STORAGE_KEYS]);
}

export function hasStoredAuthToken() {
  return Boolean(getStoredAuthToken());
}

export function getStoredAuthUser<T>() {
  const raw = getFirstStoredValue([AUTH_USER_STORAGE_KEY, ...LEGACY_USER_STORAGE_KEYS]);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveAuthSession(token: string, user: unknown) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  removeStorageKeys([...LEGACY_TOKEN_STORAGE_KEYS, ...LEGACY_USER_STORAGE_KEYS]);
  notifySessionReady();
}

export function clearAuthSession(options: { redirectToLogin?: boolean } = {}) {
  if (typeof window === "undefined") return;

  removeStorageKeys([
    AUTH_TOKEN_STORAGE_KEY,
    AUTH_USER_STORAGE_KEY,
    ...LEGACY_TOKEN_STORAGE_KEYS,
    ...LEGACY_USER_STORAGE_KEYS,
  ]);
  notifySessionCleared();

  if (options.redirectToLogin && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}
