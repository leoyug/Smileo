import { gsap } from "gsap";
import { cssTimeToMilliseconds } from "../lib/css-time";
import { setTitleLanguage, syncSiteTitle } from "./site-title";
import {
  initializeSound,
  playInterfaceSound,
  setSoundPreference,
  type SoundPreference,
} from "./sound";

type ThemePreference = "light" | "system" | "dark";
type ResolvedTheme = "light" | "dark";
type ThemeTransition = {
  finished: Promise<void>;
  skipTransition?: () => void;
};
type ThemeTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ThemeTransition;
};

const storageKey = "incessant-theme";
const topLevelPaths = new Set([
  "/",
  "/projects/",
  "/writing/",
  "/photos/",
  "/about/",
]);
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
const reducedMotionQuery = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);
let isThemeTransitioning = false;
let activeThemeTransition: ThemeTransition | null = null;
let pendingPageSound = false;

const resolveTheme = (preference: ThemePreference): ResolvedTheme =>
  preference === "system"
    ? mediaQuery.matches
      ? "dark"
      : "light"
    : preference;

const applyTheme = (preference: ThemePreference) => {
  const theme = resolveTheme(preference);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference;
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#191918" : "#fbfaf9");

  document
    .querySelectorAll<HTMLButtonElement>("[data-theme-option]")
    .forEach((option) => {
      const selected = option.dataset.themeValue === preference;
      option.setAttribute("aria-checked", String(selected));
      option.classList.toggle("is-selected", selected);
    });
};

const clearThemeTransition = () => {
  const root = document.documentElement;
  activeThemeTransition?.skipTransition?.();
  activeThemeTransition = null;
  delete root.dataset.themeTransition;
  root.style.removeProperty("--theme-transition-x");
  root.style.removeProperty("--theme-transition-y");
  root.style.removeProperty("--theme-transition-radius");
  isThemeTransitioning = false;
};

const transitionTheme = (preference: ThemePreference, origin: HTMLElement) => {
  const root = document.documentElement;
  const nextTheme = resolveTheme(preference);
  const transitionDocument = document as ThemeTransitionDocument;

  if (
    root.dataset.theme === nextTheme ||
    reducedMotionQuery.matches ||
    !transitionDocument.startViewTransition
  ) {
    localStorage.setItem(storageKey, preference);
    applyTheme(preference);
    return;
  }

  if (isThemeTransitioning) return;

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
  isThemeTransitioning = true;

  try {
    const transition = transitionDocument.startViewTransition(() => {
      localStorage.setItem(storageKey, preference);
      applyTheme(preference);
    });
    activeThemeTransition = transition;

    transition.finished.then(clearThemeTransition, clearThemeTransition);
  } catch {
    clearThemeTransition();
    localStorage.setItem(storageKey, preference);
    applyTheme(preference);
  }
};

const initializePreferences = () => {
  const savedTheme = localStorage.getItem(storageKey);
  const preference: ThemePreference =
    savedTheme === "dark" || savedTheme === "light" ? savedTheme : "system";
  applyTheme(preference);
  syncSoundControls(initializeSound());
  syncSiteTitle();
};

const syncSoundControls = (preference: SoundPreference) => {
  document
    .querySelectorAll<HTMLButtonElement>('[data-preference-group="sound"]')
    .forEach((option) => {
      const selected = option.dataset.preferenceValue === preference;
      option.setAttribute("aria-checked", String(selected));
      option.classList.toggle("is-selected", selected);
    });
};

const setPreferencesPanelOpen = (panel: HTMLElement, open: boolean) => {
  gsap.killTweensOf(panel);
  gsap.set(panel, { clearProps: "transform,opacity,visibility" });
  panel.hidden = !open;
  if (!open || reducedMotionQuery.matches) return;

  const styles = getComputedStyle(document.documentElement);
  gsap.fromTo(
    panel,
    {
      autoAlpha: 0,
      y: parseFloat(styles.getPropertyValue("--preferences-enter-distance")),
      scale: parseFloat(styles.getPropertyValue("--dropdown-pre-scale")),
    },
    {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration:
        cssTimeToMilliseconds(styles.getPropertyValue("--dropdown-open-dur")) / 1000,
      ease: "power3.out",
      clearProps: "transform,opacity,visibility",
    },
  );
};

const closePreferences = (restoreFocus = false) => {
  const panel = document.querySelector<HTMLElement>("[data-preferences-panel]");
  if (!panel || panel.hidden) return;
  setPreferencesPanelOpen(panel, false);
  const toggle = document.querySelector<HTMLButtonElement>(
    "[data-preferences-toggle]",
  );
  toggle?.setAttribute("aria-expanded", "false");
  if (restoreFocus) toggle?.focus();
  playInterfaceSound("close", 0.55);
};

const themeWindow = window as Window & {
  __incessantThemeToggleInitialized?: boolean;
};

if (!themeWindow.__incessantThemeToggleInitialized) {
  themeWindow.__incessantThemeToggleInitialized = true;
  document.addEventListener("click", (event) => {
    const target = event.target as Element;
    const toggle = target.closest<HTMLButtonElement>(
      "[data-preferences-toggle]",
    );
    const panel = document.querySelector<HTMLElement>(
      "[data-preferences-panel]",
    );
    const themeOption = target.closest<HTMLButtonElement>(
      "[data-theme-option]",
    );
    const preferenceOption = target.closest<HTMLButtonElement>(
      "[data-preference-option]",
    );

    if (toggle && panel) {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isOpen));
      setPreferencesPanelOpen(panel, !isOpen);
      playInterfaceSound(isOpen ? "close" : "open", isOpen ? 0.55 : 0.6);
      return;
    }

    if (themeOption) {
      const preference = themeOption.dataset.themeValue as ThemePreference;
      playInterfaceSound("toggle", 0.7);
      transitionTheme(preference, themeOption);
      return;
    }

    if (preferenceOption) {
      const group = preferenceOption.dataset.preferenceGroup;
      if (group === "sound") {
        const preference = preferenceOption.dataset
          .preferenceValue as SoundPreference;
        setSoundPreference(preference);
        syncSoundControls(preference);
        return;
      }
      const wasSelected =
        preferenceOption.getAttribute("aria-checked") === "true";
      if (group === "language") {
        const language = preferenceOption.dataset.preferenceValue;
        if (language === "zh-CN" || language === "en") {
          setTitleLanguage(language);
          if (!wasSelected) playInterfaceSound("toggle", 0.7);
        }
      }
      return;
    }

    if (panel && !panel.hidden && !target.closest("[data-preferences-panel]")) {
      closePreferences();
    }
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target as Element;
    const panel = document.querySelector<HTMLElement>(
      "[data-preferences-panel]",
    );
    if (
      !panel ||
      panel.hidden ||
      target.closest("[data-preferences-panel], [data-preferences-toggle]")
    )
      return;
    closePreferences();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const panel = document.querySelector<HTMLElement>(
      "[data-preferences-panel]",
    );
    if (!panel || panel.hidden) return;
    closePreferences(true);
  });

  mediaQuery.addEventListener("change", () => {
    if (document.documentElement.dataset.themePreference === "system")
      applyTheme("system");
  });

  document.addEventListener("astro:before-preparation", () => {
    pendingPageSound = true;
    clearThemeTransition();
  });

  document.addEventListener("astro:page-load", () => {
    if (!pendingPageSound) return;
    pendingPageSound = false;
    const path = location.pathname.endsWith("/")
      ? location.pathname
      : `${location.pathname}/`;
    if (topLevelPaths.has(path)) playInterfaceSound("navigate", 0.55);
  });
}

initializePreferences();
document.addEventListener("astro:page-load", initializePreferences);
