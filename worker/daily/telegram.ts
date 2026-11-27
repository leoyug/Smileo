import { dailyEntryPath, dailyLink } from "../../src/lib/daily";
import { matchesSecret } from "../auth";
import { isDailyId, type DailyContent } from "./store";

type DailyStore = DurableObjectStub<import("./store").Daily>;

export interface DailyTelegramEnv {
  DAILY_TELEGRAM_TOKEN?: string;
  DAILY_TELEGRAM_SECRET?: string;
  DAILY_TELEGRAM_OWNER_ID?: string;
}

type Button =
  | { text: string; url: string }
  | { text: string; callback_data: string };
type MessageOptions = { inline_keyboard?: Button[][]; message_id?: number; reply_to?: number };
type Entity = { type: string; offset: number; length: number; url?: string };
type Chat = { type: string; id: number };
type Message = {
  chat?: Chat;
  from?: { id: number };
  message_id: number;
  date: number;
  edit_date?: number;
  text?: string;
  entities?: Entity[];
  reply_to_message?: { message_id: number };
};
type Update = {
  update_id: number;
  message?: Message;
  edited_message?: Message;
  callback_query?: { id: string; from?: { id: number }; message?: Message; data?: string };
};

export function dailyTelegramConfig(env: DailyTelegramEnv) {
  const { DAILY_TELEGRAM_TOKEN: token, DAILY_TELEGRAM_SECRET: secret, DAILY_TELEGRAM_OWNER_ID: owner } = env;
  const ownerId = Number(owner);
  return token && /^\d+:[\w-]+$/.test(token) && secret && /^[\w-]{1,256}$/.test(secret)
    && Number.isSafeInteger(ownerId) && ownerId > 0 ? { token, secret, ownerId } : null;
}

function truncate(value: string, length: number) {
  return value.length <= length ? value : `${value.slice(0, length - 1).replace(/[\uD800-\uDBFF]$/, "")}…`;
}

function messageContent(text: string, entities: Entity[] = []): DailyContent {
  for (const entity of entities) {
    if (entity.type !== "url" && entity.type !== "text_link") continue;
    const label = text.slice(entity.offset, entity.offset + entity.length);
    const url = dailyLink(entity.type === "url" ? label : entity.url ?? "");
    if (!url) continue;
    const body = entity.type === "url"
      ? `${text.slice(0, entity.offset)}${text.slice(entity.offset + entity.length)}`.trim()
      : text.trim();
    return { body, url: url.href, title: entity.type === "text_link" ? truncate(label, 180) : null };
  }
  const url = dailyLink(text.trim());
  return url ? { body: "", url: url.href, title: null } : { body: text.trim(), url: null, title: null };
}

class Telegram {
  constructor(private readonly token: string, private readonly ownerId: number) {}

  async call<T>(method: string, parameters: Record<string, unknown>) {
    let response: Response;
    try {
      response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parameters),
        signal: AbortSignal.timeout(7000),
      });
    } catch {
      throw new Error(`Telegram ${method} request failed`);
    }
    const payload = await response.json<{ ok: boolean; result?: T }>();
    if (!response.ok || !payload.ok) throw new Error(`Telegram ${method} returned ${response.status}`);
    return payload.result as T;
  }

  message(text: string, options: MessageOptions = {}) {
    const { inline_keyboard, reply_to, message_id } = options;
    return this.call<{ message_id: number }>(message_id ? "editMessageText" : "sendMessage", {
      chat_id: this.ownerId, text, message_id,
      link_preview_options: { is_disabled: true },
      reply_markup: inline_keyboard ? { inline_keyboard } : undefined,
      reply_parameters: reply_to ? { message_id: reply_to, allow_sending_without_reply: true } : undefined,
    });
  }
}

function entryButtons(origin: string, id: string): Button[] {
  return [
    { text: "查看", url: new URL(dailyEntryPath(id), origin).href },
    { text: "撤回", callback_data: `daily:withdraw:${id}` },
  ];
}

function candidateButtons(id: string): Button[] {
  return [
    { text: "发布", callback_data: `daily:publish:${id}` },
    { text: "忽略", callback_data: `daily:ignore:${id}` },
  ];
}

export async function sendDailyCandidates(store: DailyStore, config: NonNullable<ReturnType<typeof dailyTelegramConfig>>) {
  const telegram = new Telegram(config.token, config.ownerId);
  for (let index = 0; index < 10; index++) {
    const candidate = await store.claimNotice(Date.now());
    if (!candidate) return;
    const source = candidate.source === "rss" ? "Smileo 写作" : "GitHub";
    const parts = [
      `待发布 · ${source}`,
      candidate.title ?? "",
      truncate(candidate.summary ?? "", 500),
      candidate.url ?? "",
      "可以先回复这条消息添加点评，再点「发布」。",
    ].filter(Boolean);
    const message = await telegram.message(parts.join("\n\n"), { inline_keyboard: [candidateButtons(candidate.id)] });
    await store.noteDelivered(candidate.id, message.message_id);
  }
}

export async function handleDailyWebhook(request: Request, env: Env & DailyTelegramEnv, store: DailyStore) {
  const config = dailyTelegramConfig(env);
  if (!config) return new Response(null, { status: 503 });
  if (!await matchesSecret(request.headers.get("X-Telegram-Bot-Api-Secret-Token"), config.secret)) {
    return new Response(null, { status: 403 });
  }
  const update = await request.json<Update>().catch(() => null);
  if (!update || !Number.isSafeInteger(update.update_id)) return new Response(null, { status: 400 });

  const { ownerId } = config;
  const telegram = new Telegram(config.token, ownerId);
  const origin = new URL(request.url).origin;
  const ownerChat = (chat?: Chat) => chat?.type === "private" && chat.id === ownerId;

  const callback = update.callback_query;
  if (callback?.from?.id === ownerId && ownerChat(callback.message?.chat)) {
    const [, action, id, extra] = callback.data?.split(":") ?? [];
    if (!callback.data?.startsWith("daily:") || extra || !id || !isDailyId(id)
      || (action !== "publish" && action !== "ignore" && action !== "withdraw")) {
      return new Response(null, { status: 204 });
    }
    const state = await store.setState(id, action, Date.now());
    const status = state === "published" ? "已发布" : state === "withdrawn" ? "已撤回"
      : state === "ignored" ? "已忽略" : "这条动态已不可用";
    await Promise.allSettled([
      telegram.call("answerCallbackQuery", { callback_query_id: callback.id, text: status }),
      telegram.message(status, {
        message_id: callback.message?.message_id,
        inline_keyboard: state === "published" ? [entryButtons(origin, id)] : [],
      }),
    ]);
    return new Response(null, { status: 204 });
  }

  const message = update.edited_message ?? update.message;
  if (message?.from?.id !== ownerId || !ownerChat(message.chat)
    || !Number.isSafeInteger(message.message_id) || !Number.isSafeInteger(message.date) || message.date <= 0) {
    return new Response(null, { status: 204 });
  }
  const edited = Boolean(update.edited_message);
  const text = message.text;
  if (typeof text !== "string" || !text.trim()) {
    if (!edited) await telegram.message("发送文字或链接即可发布动态。", { reply_to: message.message_id });
    return new Response(null, { status: 204 });
  }
  const command = /^\/(\w+)(?:@\w+)?(?:\s|$)/.exec(text)?.[1];
  if (command) {
    if (!edited && command === "recent") {
      const { entries } = await store.list(null);
      const labels = entries.map(entry => truncate(entry.body || entry.title || dailyLink(entry.url ?? "")?.hostname || "动态", 28));
      await telegram.message(entries.length ? labels.map((label, index) => `${index + 1}. ${label}`).join("\n") : "还没有公开动态。", {
        inline_keyboard: entries.map((entry, index) => entryButtons(origin, entry.id)
          .map(button => ({ ...button, text: `${index + 1} ${button.text}` }))),
      });
    } else if (!edited) {
      await telegram.message("直接发送文字或链接即可发布。回复待发布卡片可以加点评。发送 /recent 可查看最近的动态。");
    }
    return new Response(null, { status: 204 });
  }
  if (message.reply_to_message) {
    const result = await store.saveCandidateNote(message.reply_to_message.message_id, message.message_id, text.trim(),
      (message.edit_date ?? message.date) * 1000, update.update_id, edited);
    if (result || !edited) {
      const status = result?.state === "published" ? "已更新点评" : result ? "已保存点评，可以点「发布」。"
        : "点评可添加到待发布卡片。要发布新动态，请发送一条独立消息。";
      const buttons = result?.state === "published" ? entryButtons(origin, result.id)
        : result ? candidateButtons(result.id) : null;
      await telegram.message(status, {
        reply_to: message.message_id,
        inline_keyboard: buttons ? [buttons] : undefined,
      });
    }
    return new Response(null, { status: 204 });
  }

  const revision = (message.edit_date ?? message.date) * 1000;
  const result = await store.saveMessage(`${ownerId}:${message.message_id}`, messageContent(text, message.entities),
    message.date * 1000, revision, update.update_id, edited);
  if (result) {
    await telegram.message(result.edited ? "已更新" : "已发布", {
      inline_keyboard: [entryButtons(origin, result.id)], reply_to: message.message_id,
    });
    await store.markReceiptSent(result.id, revision, update.update_id);
  }
  return new Response(null, { status: 204 });
}
