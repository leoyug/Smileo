import { DurableObject } from "cloudflare:workers";
import { dailyPageSize, type DailyEntry, type DailyPage } from "../../src/lib/daily";

export type DailySource = "rss" | "github";
export type DailyContent = Pick<DailyEntry, "body" | "url" | "title">;
type DailyState = "candidate" | "published" | "ignored" | "withdrawn";

export interface Candidate {
  key: string;
  time: number;
  title: string;
  url: string;
  summary: string;
}

interface DailyRow extends Record<string, SqlStorageValue> {
  id: string;
  body: string;
  url: string | null;
  title: string | null;
  source: DailySource | "telegram";
  summary: string | null;
  state: DailyState;
  published_at: number | null;
  revision_at: number | null;
  revision_id: number | null;
  receipt_pending: number;
  notice_id: number | null;
}

const entryIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

export function isDailyId(id: string) {
  return entryIdPattern.test(id);
}

export function parseDailyCursor(value: string) {
  const [time, id, extra] = value.split(".");
  const publishedAt = Number(time);
  return !extra && id && isDailyId(id) && /^\d+$/.test(time)
    && Number.isSafeInteger(publishedAt) && publishedAt > 0 && value === `${publishedAt}.${id}`
    ? { publishedAt, id }
    : null;
}

function publicEntry(row: DailyRow): DailyEntry {
  return { id: row.id, body: row.body, url: row.url, title: row.title, publishedAt: row.published_at! };
}

export class Daily extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec(`
      CREATE TABLE IF NOT EXISTS daily_entries (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_key TEXT NOT NULL,
        state TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        url TEXT,
        title TEXT,
        summary TEXT,
        published_at INTEGER,
        revision_at INTEGER,
        revision_id INTEGER,
        receipt_pending INTEGER NOT NULL DEFAULT 0,
        notice_id INTEGER UNIQUE,
        notice_until INTEGER NOT NULL DEFAULT 0,
        note_message_id INTEGER,
        UNIQUE (source, source_key)
      )
    `);
    sql.exec("CREATE INDEX IF NOT EXISTS daily_published ON daily_entries (state, published_at DESC, id DESC)");
    sql.exec("CREATE TABLE IF NOT EXISTS daily_sources (source TEXT PRIMARY KEY, watermark INTEGER NOT NULL)");
  }

  list(before: ReturnType<typeof parseDailyCursor>, limit = dailyPageSize): DailyPage {
    const rows = this.ctx.storage.sql.exec<DailyRow>(
      "SELECT * FROM daily_entries WHERE state = 'published' AND (? IS NULL OR (published_at, id) < (?, ?)) ORDER BY published_at DESC, id DESC LIMIT ?",
      before?.publishedAt ?? null, before?.publishedAt ?? null, before?.id ?? null, limit + 1,
    ).toArray();
    const entries = rows.slice(0, limit).map(publicEntry);
    const last = entries.at(-1);
    return { entries, nextCursor: rows.length > limit && last ? `${last.publishedAt}.${last.id}` : null };
  }

  find(id: string) {
    const row = this.ctx.storage.sql.exec<DailyRow>(
      "SELECT * FROM daily_entries WHERE id = ? AND state = 'published'", id,
    ).toArray()[0];
    return row ? publicEntry(row) : null;
  }

  saveMessage(key: string, content: DailyContent, time: number, revision: number, updateId: number, edited: boolean) {
    return this.ctx.storage.transactionSync(() => {
      const sql = this.ctx.storage.sql;
      const row = sql.exec<DailyRow>("SELECT * FROM daily_entries WHERE source = 'telegram' AND source_key = ?", key).toArray()[0];
      if (row) {
        if (row.state !== "published") return null;
        if (revision === row.revision_at && updateId === row.revision_id) {
          return row.receipt_pending ? { id: row.id, edited } : null;
        }
        if (!edited || revision < row.revision_at!
          || (revision === row.revision_at && updateId < row.revision_id!)) return null;
        sql.exec("UPDATE daily_entries SET body = ?, url = ?, title = ?, revision_at = ?, revision_id = ?, receipt_pending = 1 WHERE id = ?",
          content.body, content.url, content.title, revision, updateId, row.id);
        return { id: row.id, edited: true };
      }
      if (edited) return null;

      const id = crypto.randomUUID();
      sql.exec(`
        INSERT INTO daily_entries (id, source, source_key, state, body, url, title, published_at, revision_at, revision_id, receipt_pending)
        VALUES (?, 'telegram', ?, 'published', ?, ?, ?, ?, ?, ?, 1)
      `, id, key, content.body, content.url, content.title, time, revision, updateId);
      return { id, edited: false };
    });
  }

  markReceiptSent(id: string, revision: number, updateId: number) {
    this.ctx.storage.sql.exec("UPDATE daily_entries SET receipt_pending = 0 WHERE id = ? AND revision_at = ? AND revision_id = ?",
      id, revision, updateId);
  }

  setState(id: string, action: "publish" | "ignore" | "withdraw", now: number): DailyState | null {
    const expected = action === "withdraw" ? "published" : "candidate";
    const state = { publish: "published", ignore: "ignored", withdraw: "withdrawn" }[action] as DailyState;
    return this.ctx.storage.transactionSync(() => {
      const sql = this.ctx.storage.sql;
      sql.exec(`
        UPDATE daily_entries SET state = ?, published_at = CASE WHEN ? = 'published' THEN ? ELSE published_at END
        WHERE id = ? AND state = ?
      `, state, state, now, id, expected);
      return sql.exec<DailyRow>("SELECT state FROM daily_entries WHERE id = ?", id).toArray()[0]?.state ?? null;
    });
  }

  saveCandidateNote(noticeId: number, messageId: number, note: string, revision: number, updateId: number, edited: boolean) {
    const row = this.ctx.storage.sql.exec<DailyRow>(
      `UPDATE daily_entries SET body = ?, note_message_id = ?, revision_at = ?, revision_id = ?
        WHERE notice_id = ?
          AND (state = 'candidate' OR (state = 'published' AND ? = 1))
          AND (? = 0 OR note_message_id = ?)
          AND (revision_at IS NULL OR (revision_at, revision_id) < (?, ?))
        RETURNING id, state`,
      note, messageId, revision, updateId, noticeId, Number(edited), Number(edited), messageId, revision, updateId,
    ).toArray()[0];
    return row ? { id: row.id, state: row.state } : null;
  }

  watermark(source: DailySource) {
    return this.ctx.storage.sql.exec<{ watermark: number }>(
      "SELECT watermark FROM daily_sources WHERE source = ?", source,
    ).toArray()[0]?.watermark ?? null;
  }

  ingest(source: DailySource, candidates: Candidate[], now: number) {
    this.ctx.storage.transactionSync(() => {
      const sql = this.ctx.storage.sql;
      const previous = this.watermark(source);
      for (const candidate of candidates) {
        const baseline = previous === null || (source === "github" && candidate.time < previous);
        sql.exec(`
          INSERT OR IGNORE INTO daily_entries (id, source, source_key, state, url, title, summary)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, crypto.randomUUID(), source, candidate.key, baseline ? "ignored" : "candidate",
          candidate.url, baseline ? null : candidate.title, baseline ? null : candidate.summary);
      }
      const latest = candidates.reduce((value, item) => Math.max(value, item.time), previous ?? 0);
      sql.exec(`
        INSERT INTO daily_sources (source, watermark) VALUES (?, ?)
        ON CONFLICT (source) DO UPDATE SET watermark = excluded.watermark
      `, source, latest || now);
    });
  }

  claimNotice(now: number) {
    return this.ctx.storage.sql.exec<DailyRow>(`
      UPDATE daily_entries SET notice_until = ? WHERE id = (
        SELECT id FROM daily_entries WHERE state = 'candidate' AND notice_id IS NULL AND notice_until <= ?
        ORDER BY rowid LIMIT 1
      ) RETURNING *
    `, now + 300_000, now).toArray()[0] ?? null;
  }

  noteDelivered(id: string, messageId: number) {
    this.ctx.storage.sql.exec("UPDATE daily_entries SET notice_id = ? WHERE id = ? AND notice_id IS NULL", messageId, id);
  }
}
