export type Language = 'zh-CN' | 'en';
export const languageFromPath = (pathname: string): Language => /^\/en(?:\/|$)/.test(pathname) ? 'en' : 'zh-CN';
export const withoutLanguage = (pathname: string) => pathname.replace(/^\/en(?=\/|$)/, '') || '/';
export const languagePath = (pathname: string, language: Language) => {
  const path = withoutLanguage(pathname);
  return language === 'en' ? `/en${path === '/' ? '/' : path}` : path;
};
export const uiText = (zh: string, en: string) => document.documentElement.lang === 'en' ? en : zh;
