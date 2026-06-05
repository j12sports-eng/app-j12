import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { logSsr } from "@/lib/ssr-debug";
import { settingsStore, useSettingsState } from "./settings-store";
import type { AppearanceSettingsData } from "./types";

type ThemeContextValue = {
  appearance: AppearanceSettingsData;
  updateAppearance: (data: AppearanceSettingsData) => void;
  resetAppearance: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const darkPalette = {
  background: "#060B14",
  foreground: "#F8FAFC",
  card: "#111827",
  muted: "#1F2937",
  mutedForeground: "#94A3B8",
  border: "rgba(255,255,255,0.12)",
  sidebar: "#09111E",
  sidebarAccent: "#172033",
};

const lightPalette = {
  background: "#F6F7FB",
  foreground: "#0F172A",
  card: "#FFFFFF",
  muted: "#E2E8F0",
  mutedForeground: "#0F172A",
  border: "rgba(15,23,42,0.12)",
  sidebar: "#FFFFFF",
  sidebarAccent: "#F1F5F9",
};

function getContrastColor(hexColor: string) {
  const hex = hexColor.replace("#", "");
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex;
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 160 ? "#0F172A" : "#F8FAFC";
}

function getMutedTextColor(textColor: string, backgroundColor: string) {
  return `color-mix(in srgb, ${textColor} 92%, ${backgroundColor} 8%)`;
}

function applyAppearance(appearance: AppearanceSettingsData) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const palette = appearance.mode === "light" ? lightPalette : darkPalette;
  const pageBackground = appearance.pageBackgroundColor || palette.background;
  const buttonForeground = getContrastColor(appearance.buttonColor);
  const headerForeground = getContrastColor(appearance.headerColor);
  const footerForeground = getContrastColor(appearance.footerColor);
  const mutedTextColor = getMutedTextColor(appearance.textColor, pageBackground);

  root.classList.remove("dark");
  root.dataset.themeMode = appearance.mode;

  root.style.setProperty("--background", pageBackground);
  root.style.setProperty("--foreground", appearance.textColor);
  root.style.setProperty("--card", appearance.cardColor);
  root.style.setProperty("--card-foreground", appearance.textColor);
  root.style.setProperty("--popover", appearance.cardColor);
  root.style.setProperty("--popover-foreground", appearance.textColor);
  root.style.setProperty("--primary", appearance.primaryColor);
  root.style.setProperty("--primary-foreground", getContrastColor(appearance.primaryColor));
  root.style.setProperty("--primary-glow", appearance.primaryColor);
  root.style.setProperty("--secondary", appearance.secondaryColor);
  root.style.setProperty("--secondary-foreground", getContrastColor(appearance.secondaryColor));
  root.style.setProperty("--muted", palette.muted);
  root.style.setProperty("--muted-foreground", mutedTextColor);
  root.style.setProperty("--accent", appearance.secondaryColor);
  root.style.setProperty("--accent-foreground", getContrastColor(appearance.secondaryColor));
  root.style.setProperty("--border", palette.border);
  root.style.setProperty("--input", palette.muted);
  root.style.setProperty("--ring", appearance.primaryColor);
  root.style.setProperty("--sidebar", appearance.menuBackgroundColor || palette.sidebar);
  root.style.setProperty("--sidebar-foreground", appearance.menuTextColor);
  root.style.setProperty("--sidebar-primary", appearance.primaryColor);
  root.style.setProperty("--sidebar-primary-foreground", getContrastColor(appearance.primaryColor));
  root.style.setProperty("--sidebar-accent", appearance.menuColor || palette.sidebarAccent);
  root.style.setProperty("--sidebar-accent-foreground", appearance.menuTextColor);
  root.style.setProperty("--sidebar-border", palette.border);
  root.style.setProperty("--sidebar-ring", appearance.primaryColor);
  root.style.setProperty("--button-brand", appearance.buttonColor);
  root.style.setProperty("--button-brand-foreground", buttonForeground);
  root.style.setProperty("--app-header-bg", appearance.headerColor);
  root.style.setProperty("--app-header-foreground", appearance.headerTextColor || headerForeground);
  root.style.setProperty("--app-footer-bg", appearance.footerColor);
  root.style.setProperty("--app-footer-foreground", footerForeground);
  root.style.setProperty("--app-menu-bg", appearance.menuBackgroundColor);
  root.style.setProperty("--app-menu-surface", appearance.menuColor);
  root.style.setProperty("--app-menu-foreground", appearance.menuTextColor);
  root.style.setProperty("--app-page-bg", pageBackground);
  root.style.setProperty("--success", "#22C55E");
  root.style.setProperty("--warning", "#F59E0B");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  logSsr("[SSR] entrou no ThemeProvider");

  const settings = useSettingsState();

  useEffect(() => {
    applyAppearance(settings.appearance);
  }, [settings.appearance]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      appearance: settings.appearance,
      updateAppearance: (data) => settingsStore.saveAppearance(data),
      resetAppearance: () => settingsStore.reset(),
    }),
    [settings.appearance],
  );

  logSsr("[SSR] terminou ThemeProvider", {
    mode: settings.appearance.mode,
  });

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeSettings() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemeSettings deve ser usado dentro de ThemeProvider");
  return context;
}
