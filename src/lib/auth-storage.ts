const TOKEN_KEY = "j12_auth_token";

const USER_KEY = "j12_auth_user";

/**
 * =========================
 * TOKEN
 * =========================
 */

export function setStoredAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function hasStoredAuthToken() {
  return !!localStorage.getItem(TOKEN_KEY);
}

export function clearStoredAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * =========================
 * USER
 * =========================
 */

export function setStoredAuthUser(user: any) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredAuthUser() {
  const raw = localStorage.getItem(USER_KEY);

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
  localStorage.removeItem(USER_KEY);
}

/**
 * =========================
 * SESSION HELPERS
 * =========================
 */

export function clearAuthSession() {
  clearStoredAuthToken();
  clearStoredAuthUser();
}

export function saveAuthSession(token: string, user: any) {
  setStoredAuthToken(token);
  setStoredAuthUser(user);
}

export function getAuthSession() {
  return {
    token: getStoredAuthToken(),
    user: getStoredAuthUser(),
  };
}

