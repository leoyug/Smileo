import { z } from "astro/zod";

// Keystatic saves an untouched optional object as {}, or as blank child fields.
export const projectDownloadSchema = z.preprocess(
  (value) => value && typeof value === "object" && Object.values(value).every(
    (item) => item == null || typeof item === "string" && !item.trim(),
  ) ? undefined : value,
  z.object({
    href: z.string().trim().startsWith("/"),
    filename: z.string().trim().min(1),
    label: z.string().trim().min(1),
  }).optional(),
);
