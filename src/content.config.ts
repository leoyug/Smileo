import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { projectDownloadSchema } from "./lib/project-download";

const publicationFields = {
  title: z.string().min(1),
  description: z.string().min(1),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  draft: z.boolean().default(false),
};

const optionalText = z.preprocess(
  (value) => typeof value === "string" && !value.trim() ? undefined : value,
  z.string().trim().min(1).optional(),
);

const articles = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/articles" }),
  schema: z.object({
    ...publicationFields,
    order: z.number().int().positive(),
    subtitle: z.string().trim().min(1).optional(),
    cover: z.preprocess(
      (value) => typeof value === "string" ? value.trim() || undefined : value,
      z.string().startsWith("/").optional(),
    ),
    coverAlt: optionalText,
    category: optionalText,
    tags: z.array(z.string().min(1)).default([]),
    readingMinutes: z.number().int().positive(),
    featured: z.boolean().default(false),
    relatedProjects: z.array(reference("projects")).default([]),
  }),
});

const projects = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "./src/content/projects",
    // Keep the CMS filename as the ID, including case, so previews and relationships agree.
    generateId: ({ entry }) => entry.replace(/\.(md|mdx)$/, ""),
  }),
  schema: z.object({
    ...publicationFields,
    hidden: z.boolean().default(false),
    period: z.string().trim().min(1, "请填写项目时间"),
    projectType: optionalText,
    website: z.preprocess(
      (value) => typeof value === "string" ? value.trim() || undefined : value,
      z.url({ protocol: /^https?$/, error: "项目网址须使用有效的 http 或 https 网址" }).optional(),
    ),
    status: z.enum(["ongoing", "launched", "experiment", "archive"]),
    role: optionalText,
    tools: optionalText,
    featured: z.boolean().default(false),
    order: z.number().int().positive(),
    cover: z.string().startsWith("/").optional(),
    download: projectDownloadSchema,
    archiveImages: z.array(z.string().startsWith("/")).default([]),
    privacyNote: z.string().optional(),
    relatedArticles: z.array(reference("articles")).default([]),
  }),
});

const photos = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/photos" }),
  schema: z.object({
    src: z.string().startsWith("/"),
    alt: z.string().min(1),
    order: z.number().int().positive(),
    size: z.enum(["tall", "short"]),
    orientation: z.enum(["portrait", "landscape"]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    draft: z.boolean().default(false),
    publicMetadata: z.object({
      capturedAt: z.coerce.date().optional(),
      camera: z.string().optional(),
      lens: z.string().optional(),
      focalLength: z.string().optional(),
      aperture: z.string().optional(),
      shutterSpeed: z.string().optional(),
      iso: z.number().int().positive().optional(),
      place: z.string().optional(),
    }).default({}),
  }).refine(
    (photo) => photo.size === (photo.orientation === "portrait" ? "tall" : "short"),
    { message: "Portrait photos require tall; landscape photos require short", path: ["size"] },
  ).refine(
    (photo) => photo.width !== photo.height && photo.orientation === (photo.height > photo.width ? "portrait" : "landscape"),
    { message: "Orientation must match width and height; square photos are unsupported", path: ["orientation"] },
  ),
});

const resume = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/resume" }),
  schema: z.object({
    name: z.string().min(1),
    publicName: z.string().min(1),
    title: z.string().min(1),
    location: z.string().min(1),
    email: z.email(),
    summary: z.string().min(1),
    introduction: z.array(z.string().min(1)).min(1),
    experience: z.array(z.object({
      period: z.string().min(1),
      role: z.string().min(1),
      organization: z.string().min(1),
      summary: z.string().min(1),
    })).min(1),
    projects: z.array(z.object({
      name: z.string().min(1),
      summary: z.string().min(1),
      tags: z.array(z.string().min(1)).min(1),
    })).default([]),
    skills: z.array(z.object({
      label: z.string().min(1),
      items: z.array(z.string().min(1)).min(1),
    })).default([]),
    education: z.object({
      school: z.string().min(1),
      degree: z.string().min(1),
      period: z.string().min(1),
      place: z.string().min(1),
    }).optional(),
    links: z.array(z.object({
      label: z.string().min(1),
      href: z.url(),
    })).default([]),
  }),
});

export const collections = { articles, projects, photos, resume };
