import { transitionTheme } from "./theme";

const themeWindow = window as Window & { __portfolioTheme?: boolean };

if (!themeWindow.__portfolioTheme) {
  themeWindow.__portfolioTheme = true;
  document.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-portfolio-theme]");
    if (!button) return;
    transitionTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", button);
  });
}
