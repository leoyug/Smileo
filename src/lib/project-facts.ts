export function formatProjectFactList(value: string): string {
  return value.split(/[、，,]/u).map((item) => item.trim()).filter(Boolean).join("\n");
}
