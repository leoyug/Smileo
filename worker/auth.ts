export async function hasWriteAccess(request: Request, token: string): Promise<boolean> {
  return matchesSecret(request.headers.get("Authorization"), `Bearer ${token}`);
}

export async function matchesSecret(provided: string | null, expectedSecret: string): Promise<boolean> {
  if (!provided) return false;

  const encoder = new TextEncoder();
  const [received, expected] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expectedSecret)),
  ]);
  return crypto.subtle.timingSafeEqual(received, expected);
}
