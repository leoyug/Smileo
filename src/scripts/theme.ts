import { uiText } from "../i18n/runtime";

export type ThemePreference = "light" | "system" | "dark";
type ResolvedTheme = "light" | "dark";
type ThemeTransition = {
  finished: Promise<void>;
  skipTransition?: () => void;
};
type ThemeTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ThemeTransition;
};

const storageKey = "incessant-theme";
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let activeThemeTransition: ThemeTransition | null = null;

const resolveTheme = (preference: ThemePreference): ResolvedTheme =>
  preference === "system" ? (mediaQuery.matches ? "dark" : "light") : preference;

const applyTheme = (preference: ThemePreference) => {
  const theme = resolveTheme(preference);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference;
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#191918" : "#fbfaf9");

  document.querySelectorAll<HTMLButtonElement>("[data-theme-option]").forEach((option) => {
    const selected = option.dataset.themeValue === preference;
    option.setAttribute("aria-checked", String(selected));
    option.classList.toggle("is-selected", selected);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-portfolio-theme]").forEach((button) => {
    const dark = theme === "dark";
    button.setAttribute("aria-label", dark
      ? uiText("切换到浅色模式", "Switch to light mode")
      : uiText("切换到深色模式", "Switch to dark mode"));
    button.setAttribute("aria-pressed", String(dark));
  });
};

const saveTheme = (preference: ThemePreference) => {
  try { localStorage.setItem(storageKey, preference); } catch { /* Switching still works when storage is unavailable. */ }
  applyTheme(preference);
};

const clearThemeTransition = () => {
  const root = document.documentElement;
  activeThemeTransition?.skipTransition?.();
  activeThemeTransition = null;
  delete root.dataset.themeTransition;
  root.style.removeProperty("--theme-transition-x");
  root.style.removeProperty("--theme-transition-y");
  root.style.removeProperty("--theme-transition-radius");
};

export const transitionTheme = (preference: ThemePreference, origin: HTMLElement) => {
  if (activeThemeTransition) return;
  const root = document.documentElement;
  const transitionDocument = document as ThemeTransitionDocument;
  if (root.dataset.theme === resolveTheme(preference) || reducedMotionQuery.matches || !transitionDocument.startViewTransition) {
    saveTheme(preference);
    return;
  }

  const bounds = origin.getBoundingClientRect();
  const originX = bounds.left + bounds.width / 2;
  const originY = bounds.top + bounds.height / 2;
  const radius = Math.hypot(
    Math.max(originX, window.innerWidth - originX),
    Math.max(originY, window.innerHeight - originY),
  );
  root.style.setProperty("--theme-transition-x", `${originX}px`);
  root.style.setProperty("--theme-transition-y", `${originY}px`);
  root.style.setProperty("--theme-transition-radius", `${radius}px`);
  root.dataset.themeTransition = "circle-blur";

  try {
    const transition = transitionDocument.startViewTransition(() => saveTheme(preference));
    activeThemeTransition = transition;
    const finish = () => {
      if (activeThemeTransition === transition) clearThemeTransition();
    };
    transition.finished.then(finish, finish);
  } catch {
    clearThemeTransition();
    saveTheme(preference);
  }
};

const initializeTheme = () => {
  let savedTheme: string | null = null;
  try { savedTheme = localStorage.getItem(storageKey); } catch { /* Fall back to the system preference. */ }
  applyTheme(savedTheme === "dark" || savedTheme === "light" ? savedTheme : "system");
};

mediaQuery.addEventListener("change", () => {
  if (document.documentElement.dataset.themePreference === "system") applyTheme("system");
});
document.addEventListener("astro:before-preparation", clearThemeTransition);
document.addEventListener("astro:page-load", initializeTheme);
initializeTheme();
