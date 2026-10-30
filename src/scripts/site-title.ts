import { languageFromPath, languagePath, withoutLanguage, type Language } from "../i18n/runtime";

const storageKey = "incessant-language";

let loadingEnglish404 = false;
export const syncSiteTitle = () => {
  if (!loadingEnglish404 && languageFromPath(location.pathname) === "en" && document.documentElement.lang !== "en" && document.querySelector('[data-not-found]')) {
    loadingEnglish404 = true;
    fetch('/en/404/').then(response => response.text()).then(html => {
      const page = new DOMParser().parseFromString(html, 'text/html');
      if (page.documentElement.lang !== 'en') return;
      document.body.replaceWith(document.adoptNode(page.body));
      document.title = page.title;
      document.documentElement.lang = 'en';
      document.dispatchEvent(new Event('astro:page-load'));
    }).catch(() => { loadingEnglish404 = false; });
  }
  const language = languageFromPath(location.pathname);
  document.documentElement.lang = language;
  const title = document.querySelector<HTMLTitleElement>("title[data-title-zh]");
  const localizedTitle = language === "zh-CN" ? title?.dataset.titleZh : title?.dataset.titleEn;
  if (localizedTitle) document.title = localizedTitle;
  document.querySelectorAll<HTMLElement>('[data-preference-group="language"]').forEach(option => {
    const selected = option.dataset.preferenceValue === language;
    option.setAttribute("aria-checked", String(selected));
    option.classList.toggle("is-selected", selected);
  });
  try {
    localStorage.setItem(storageKey, language);
    const saved = sessionStorage.getItem("incessant-language-scroll");
    if (saved) {
      sessionStorage.removeItem("incessant-language-scroll");
      const position = JSON.parse(saved) as { path: string; y: number };
      if (position.path === withoutLanguage(location.pathname) && Number.isFinite(position.y) && !location.hash)
        requestAnimationFrame(() => scrollTo({top: position.y, behavior: "instant"}));
    }
  } catch { /* Language URLs work even when storage is unavailable. */ }
};

export const setTitleLanguage = (language: Language) => {
  try {
    localStorage.setItem(storageKey, language);
    sessionStorage.setItem("incessant-language-scroll", JSON.stringify({path: withoutLanguage(location.pathname), y: scrollY}));
  } catch { /* Navigation does not depend on browser storage. */ }
  if (language === languageFromPath(location.pathname)) return syncSiteTitle();
  const url = new URL(location.href);
  url.pathname = location.pathname.startsWith('/design-system') ? languagePath('/', language) : languagePath(location.pathname, language);
  location.assign(url.href);
};

syncSiteTitle();
document.addEventListener("astro:after-swap", syncSiteTitle);

document.addEventListener('click', event => {
  const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('[data-language-switch]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  setTitleLanguage(languageFromPath(location.pathname) === 'en' ? 'zh-CN' : 'en');
});
