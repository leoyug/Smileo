import type { FitnessRing, FitnessRings } from "../src/lib/avatar-fitness";

const maxBatchBytes = 2 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const calendarDate = /^\d{4}-\d{2}-\d{2}$/;
const sections = [
  ["sampleCount", null], ["deletionCount", "deleted"], ["routeCount", "route"],
  ["seriesCount", "series"], ["aggregateCount", "aggregate"],
  ["activitySummaryCount", "activitySummary"], ["profileCount", "profile"],
] as const;

export interface FitnessDayUpdate {
  date: string;
  rings?: FitnessRings;
  steps?: number | null;
}

export class PulsBatchError extends Error {
  constructor(message: string, readonly status = 400, readonly supportedVersions?: number[]) {
    super(message);
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PulsBatchError("Expected an NDJSON object");
  }
  return value as Record<string, unknown>;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function epochMs(value: unknown): number {
  const timestamp = number(value);
  if (timestamp === null || timestamp > 253402300799999) throw new PulsBatchError("Invalid timestamp");
  return timestamp;
}

function dayAt(timestamp: number, context: unknown, zone: unknown) {
  const temporal = context == null ? {} : object(context);
  const offset = temporal.utcOffsetSeconds;
  if (typeof offset === "number" && Number.isInteger(offset) && Math.abs(offset) <= 86400) {
    return new Date(timestamp + offset * 1000).toISOString().slice(0, 10);
  }

  if (typeof zone === "string" && zone && zone.length <= 100) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
      }).format(timestamp);
    } catch {
      // Older or invalid time-zone identifiers fall back to the UTC calendar date.
    }
  }
  return new Date(timestamp).toISOString().slice(0, 10);
}

function ring(rawValue: unknown, rawGoal: unknown, unit: FitnessRing["unit"]): FitnessRing | null {
  const value = number(rawValue);
  const goal = number(rawGoal);
  return value === null && goal === null ? null : { value, goal, unit };
}

function activityDate(summary: Record<string, unknown>) {
  const timestamp = epochMs(summary.date);
  if (summary.localDate == null) return dayAt(timestamp, summary.temporalContext, undefined);
  const date = summary.localDate;
  if (typeof date !== "string" || !calendarDate.test(date)
    || new Date(`${date}T00:00:00Z`).toJSON()?.slice(0, 10) !== date) {
    throw new PulsBatchError("Invalid Activity Rings date");
  }
  return date;
}

async function readBatch(request: Request) {
  if (!request.body) throw new PulsBatchError("Empty batch");
  if (Number(request.headers.get("Content-Length")) > maxBatchBytes) {
    throw new PulsBatchError("Batch is too large", 413);
  }
  const encoding = request.headers.get("Content-Encoding")?.toLowerCase() ?? "identity";
  if (encoding !== "identity" && encoding !== "gzip") throw new PulsBatchError("Unsupported content encoding");
  const body = encoding === "gzip" ? request.body.pipeThrough(new DecompressionStream("gzip")) : request.body;
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let text = "";
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > maxBatchBytes) {
        void reader.cancel().catch(() => {});
        throw new PulsBatchError("Batch is too large", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
  } catch (error) {
    if (error instanceof PulsBatchError) throw error;
    throw new PulsBatchError("Could not decode batch");
  } finally {
    reader.releaseLock();
  }
}

export function checkPulsHeaders(request: Request) {
  const version = request.headers.get("X-Puls-Protocol");
  if (version !== null && version !== "1") {
    throw new PulsBatchError("unsupported protocol version", 400, [1]);
  }
  for (const name of ["X-User-ID", "X-Wake-ID"]) {
    const value = request.headers.get(name);
    if (value !== null && !uuid.test(value)) throw new PulsBatchError(`Invalid ${name}`);
  }
}

export async function parsePulsBatch(request: Request) {
  const lines = (await readBatch(request)).split("\n").filter(line => line.trim() !== "");
  const parse = (line: string) => {
    try { return object(JSON.parse(line)); }
    catch { throw new PulsBatchError("Invalid NDJSON line"); }
  };
  if (!lines.length) throw new PulsBatchError("Empty batch");
  const header = parse(lines[0]);
  if (header.schemaVersion != null && header.schemaVersion !== 1) {
    throw new PulsBatchError("unsupported protocol version", 400, [1]);
  }
  if (typeof header.batchID !== "string" || !uuid.test(header.batchID)) {
    throw new PulsBatchError("Invalid batch ID");
  }
  const exportedAt = epochMs(header.exportedAt);
  const days = new Map<string, FitnessDayUpdate>();
  let lineIndex = 1;

  for (const [countKey, wrapper] of sections) {
    const count = header[countKey] ?? 0;
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0
      || lineIndex + count > lines.length || (countKey === "profileCount" && count > 1)) {
      throw new PulsBatchError("Invalid batch line counts");
    }
    for (let end = lineIndex + count; lineIndex < end; lineIndex++) {
      const line = parse(lines[lineIndex]);
      if (wrapper === null) {
        if (typeof line.type !== "string" || typeof line.kind !== "string") {
          throw new PulsBatchError("Expected a sample line");
        }
        continue;
      }
      const payload = object(line[wrapper]);
      if (wrapper === "activitySummary") {
        const date = activityDate(payload);
        const move = payload.moveMode === 1
          ? ring(payload.moveTimeMin, payload.moveTimeGoalMin, "min")
          : ring(payload.moveKcal, payload.moveGoalKcal, "kcal");
        days.set(date, { ...days.get(date), date, rings: {
          move,
          exercise: ring(payload.exerciseMin, payload.exerciseGoalMin, "min"),
          stand: ring(payload.standHours, payload.standGoalHours, "h"),
        } });
      } else if (wrapper === "aggregate" && payload.type === "HKQuantityTypeIdentifierStepCount"
        && payload.func === "sum" && payload.intervalValue === 1 && payload.intervalUnit === "day"
        && payload.deviceFilter === "all") {
        const start = epochMs(payload.bucketStart);
        if (epochMs(payload.bucketEnd) <= start) throw new PulsBatchError("Invalid step interval");
        const date = dayAt(start, payload.bucketStartContext, header.timeZoneID);
        const value = number(payload.value);
        days.set(date, { ...days.get(date), date, steps: value === null ? null : Math.round(value) });
      }
    }
  }
  if (lineIndex !== lines.length) throw new PulsBatchError("Unexpected batch lines");
  return { exportedAt, days: [...days.values()] };
}
