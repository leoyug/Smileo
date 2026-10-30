import { withoutLanguage } from "../i18n/runtime";
import { transitionTheme, type ThemePreference } from "./theme";
import { gsap } from "gsap";
import { cssTimeToMilliseconds } from "../lib/css-time";
import { setTitleLanguage, syncSiteTitle } from "./site-title";
import {
  initializeSound,
  playInterfaceSound,
  setSoundPreference,
  type SoundPreference,
} from "./sound";

const topLevelPaths = new Set([
  "/",
  "/projects/",
  "/writing/",
  "/photos/",
  "/about/",
]);
const reducedMotionQuery = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);
let pendingPageSound = false;

const initializePreferences = () => {
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
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      const target = event.target as HTMLElement;
      if (target.matches('[data-preference-group="language"]')) {
        event.preventDefault();
        const options = [...document.querySelectorAll<HTMLButtonElement>('[data-preference-group="language"]')];
        const index = options.indexOf(target as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + (event.key === "ArrowLeft" ? -1 : 1) + options.length) % options.length;
        options[next]?.focus(); options[next]?.click();
      }
    }
    if (event.key !== "Escape") return;
    const panel = document.querySelector<HTMLElement>(
      "[data-preferences-panel]",
    );
    if (!panel || panel.hidden) return;
    closePreferences(true);
  });

  document.addEventListener("astro:before-preparation", () => {
    pendingPageSound = true;
  });

  document.addEventListener("astro:page-load", () => {
    if (!pendingPageSound) return;
    pendingPageSound = false;
    const path = location.pathname.endsWith("/")
      ? location.pathname
      : `${location.pathname}/`;
    if (topLevelPaths.has(withoutLanguage(path))) playInterfaceSound("navigate", 0.55);
  });
}

initializePreferences();
document.addEventListener("astro:page-load", initializePreferences);
