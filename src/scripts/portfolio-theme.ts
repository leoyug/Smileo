const storageKey = "incessant-theme";

const syncPortfolioTheme = () => {
  const button = document.querySelector<HTMLButtonElement>("[data-portfolio-theme]");
  if (!button) return;
  const dark = document.documentElement.dataset.theme === "dark";
  button.setAttribute("aria-label", dark ? "切换到浅色模式" : "切换到深色模式");
  button.setAttribute("aria-pressed", String(dark));
};

const applyPortfolioTheme = (theme: "light" | "dark") => {
  localStorage.setItem(storageKey, theme);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = theme;
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#191918" : "#fbfaf9");
  syncPortfolioTheme();
};

const themeWindow = window as Window & { __portfolioTheme?: boolean };

if (!themeWindow.__portfolioTheme) {
  themeWindow.__portfolioTheme = true;
  document.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest("[data-portfolio-theme]");
    if (!button) return;
    applyPortfolioTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
  document.addEventListener("astro:page-load", syncPortfolioTheme);
}

syncPortfolioTheme();
