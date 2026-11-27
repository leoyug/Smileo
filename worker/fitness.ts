import { DurableObject } from "cloudflare:workers";
import type { FitnessRings, FitnessSnapshot } from "../src/lib/avatar-fitness";
import { hasWriteAccess } from "./auth";
import { checkPulsHeaders, parsePulsBatch, PulsBatchError, type FitnessDayUpdate } from "./puls-batch";

interface StoredValue<T> {
  value: T;
  exportedAt: number;
}

interface FitnessDay {
  date: string;
  rings?: StoredValue<FitnessRings>;
  steps?: StoredValue<number | null>;
}

export class Fitness extends DurableObject<Env> {
  latest(): FitnessSnapshot | null {
    const days = this.ctx.storage.kv.get<FitnessDay[]>("days") ?? [];
    // Activity summaries can arrive before the same day's step total closes.
    const completeDay = days.find(({ rings, steps }) => steps?.value != null
      && Object.values(rings?.value ?? {}).some(ring => ring?.value != null));
    const day = completeDay ?? days.find(({ rings, steps }) => steps?.value != null
      || (rings && Object.values(rings.value).some(ring => ring !== null)));
    if (!day) return null;

    return {
      rings: day.rings?.value ?? null,
      steps: day.steps?.value ?? null,
    };
  }

  save(updates: FitnessDayUpdate[], exportedAt: number): void {
    const days = this.ctx.storage.kv.get<FitnessDay[]>("days") ?? [];
    const byDate = new Map(days.map(day => [day.date, day]));
    let changed = false;
    for (const update of updates) {
      const day: FitnessDay = byDate.get(update.date) ?? { date: update.date };
      if (update.rings && (!day.rings || day.rings.exportedAt < exportedAt)) {
        day.rings = { value: update.rings, exportedAt };
        changed = true;
      }
      if (update.steps !== undefined && (!day.steps || day.steps.exportedAt < exportedAt)) {
        day.steps = { value: update.steps, exportedAt };
        changed = true;
      }
      byDate.set(day.date, day);
    }
    if (changed) {
      // Keep a short fallback if the current calendar day has yet to sync.
      const recent = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
      this.ctx.storage.kv.put("days", recent);
    }
  }
}

export async function serveFitness(request: Request, pathname: string, env: Env): Promise<Response> {
  const headers = new Headers({ "Cache-Control": "no-store" });
  const isPublic = pathname === "/api/fitness";
  const isUpload = pathname === "/api/puls/v1/batches";
  const isCapabilities = pathname === "/api/puls/v1/capabilities";

  if (!isPublic && !isUpload && !isCapabilities) {
    return Response.json({ error: "Not found" }, { status: 404, headers });
  }
  const method = isUpload ? "POST" : "GET";
  if (request.method !== method) {
    headers.set("Allow", method);
    return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  }

  try {
    if (isPublic) {
      const snapshot = await env.FITNESS.getByName("site").latest();
      return Response.json({ snapshot }, { headers });
    }

    if (!env.FITNESS_SYNC_TOKEN) {
      return Response.json({ error: "Fitness sync unavailable" }, { status: 503, headers });
    }
    if (!(await hasWriteAccess(request, env.FITNESS_SYNC_TOKEN))) {
      headers.set("WWW-Authenticate", "Bearer");
      return Response.json({ error: "Unauthorized" }, { status: 401, headers });
    }
    checkPulsHeaders(request);
    if (isCapabilities) {
      return Response.json({
        protocolVersions: [1],
        features: ["batches", "aggregates", "activitySummaries"],
        server: "smileo",
        version: "1",
      }, { headers });
    }

    const { days, exportedAt } = await parsePulsBatch(request);
    if (days.length) await env.FITNESS.getByName("site").save(days, exportedAt);
    return new Response(null, { status: 204, headers });
  } catch (error) {
    if (error instanceof PulsBatchError) {
      return Response.json({ error: error.message, supportedVersions: error.supportedVersions }, { status: error.status, headers });
    }
    console.error("Could not access website fitness data", error);
    return Response.json({ error: "Fitness data unavailable" }, { status: 503, headers });
  }
}
