type TitleLanguage = "zh-CN" | "en";

const storageKey = "incessant-language";
let selectedLanguage: TitleLanguage | undefined;

const resolveTitleLanguage = (): TitleLanguage => {
  if (selectedLanguage) return selectedLanguage;
  let savedLanguage: string | null = null;
  try {
    savedLanguage = localStorage.getItem(storageKey);
  } catch {
    // Browser language still works when storage is unavailable.
  }
  if (savedLanguage === "zh-CN" || savedLanguage === "en") return savedLanguage;
  const language = navigator.languages?.[0] || navigator.language || "zh-CN";
  return /^zh(?:-|$)/i.test(language) ? "zh-CN" : "en";
};

export const syncSiteTitle = () => {
  const language = resolveTitleLanguage();
  const title = document.querySelector<HTMLTitleElement>("title[data-title-zh]");
  const localizedTitle = language === "zh-CN" ? title?.dataset.titleZh : title?.dataset.titleEn;
  if (localizedTitle) document.title = localizedTitle;

  document
    .querySelectorAll<HTMLButtonElement>('[data-preference-group="language"]')
    .forEach((option) => {
      const selected = option.dataset.preferenceValue === language;
      option.setAttribute("aria-checked", String(selected));
      option.classList.toggle("is-selected", selected);
    });
};

export const setTitleLanguage = (language: TitleLanguage) => {
  selectedLanguage = language;
  try {
    localStorage.setItem(storageKey, language);
  } catch {
    // Keep the selection for this visit when storage is unavailable.
  }
  syncSiteTitle();
};

syncSiteTitle();
document.addEventListener("astro:after-swap", syncSiteTitle);
window.addEventListener("languagechange", syncSiteTitle);
