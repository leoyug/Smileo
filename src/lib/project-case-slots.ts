// A standalone Markdown link keeps each exhibit editable in the content editor.
export const projectCaseSlotLink = /<p>\s*<a href="#case-([a-z-]+)">[^<]+<\/a>\s*<\/p>/g;

export function renderProjectCaseBody(source: string, slots: ReadonlyMap<string, string>): string {
  return source
    // A standalone emphasized line before an H2 is a section label in the CMS.
    .replace(/<p><em>([^<>]+)<\/em><\/p>(\s*)(?=<h2\b)/g, '<p class="project-case-label">$1</p>$2')
    .replace(projectCaseSlotLink, (link, name: string) => {
      const rendered = slots.get(name);
      return rendered === undefined ? link : `<div id="case-${name}" data-case-slot="${name}">${rendered}</div>`;
    });
}
