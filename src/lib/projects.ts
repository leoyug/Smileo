import { getCollection } from "astro:content";

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
    image: entry.data.cover,
    href: `/projects/${entry.id}`,
  };
}
