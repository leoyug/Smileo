import { getCollection } from "astro:content";
import { getProjectCategory } from "./project-badges";

export async function getProjects() {
  return (await getCollection("projects", ({ data }) => import.meta.env.DEV || !data.draft)).sort((left, right) =>
    left.data.order - right.data.order
    || right.data.publishedAt.getTime() - left.data.publishedAt.getTime()
    || left.id.localeCompare(right.id));
}

export function projectPreview(entry: Awaited<ReturnType<typeof getProjects>>[number]) {
  return {
    title: entry.data.title,
    summary: entry.data.description,
    status: entry.data.status,
    badge: getProjectCategory(entry.id),
    image: entry.data.cover,
    href: `/projects/${entry.id}`,
  };
}
