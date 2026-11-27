const token = process.env.DAILY_TELEGRAM_TOKEN;
const action = process.argv[2];

async function telegram(method, params = {}) {
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(`无法连接 Telegram（${method}）。`);
  }
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(`Telegram ${method} 请求失败（HTTP ${response.status}）。`);
  return data.result;
}

async function main() {
  if (!["owner", "install", "status"].includes(action)) throw new Error("请选择 owner、install 或 status。");
  if (!token || !/^\d+:[\w-]+$/.test(token)) throw new Error("请先设置 DAILY_TELEGRAM_TOKEN。");

  if (action === "owner") {
    const webhook = await telegram("getWebhookInfo");
    if (webhook.url) throw new Error("Bot 已启用 Webhook。可在已接入的配置中查看站主 ID。");
    const updates = await telegram("getUpdates", { allowed_updates: ["message"] });
    const owners = new Set(updates
      .map(update => update.message)
      .filter(message => message?.chat?.type === "private" && message.from?.id === message.chat.id
        && /^\/start(?:@\w+)?(?:\s|$)/.test(message.text ?? ""))
      .map(message => message.from.id));
    if (!owners.size) throw new Error("请先在 Telegram 私聊新 Bot 并发送 /start，然后重试。");
    console.log("向 Bot 发送 /start 的 Telegram 用户 ID");
    for (const owner of owners) console.log(owner);
    return;
  }

  if (action === "install") {
    const secret = process.env.DAILY_TELEGRAM_SECRET;
    const owner = Number(process.env.DAILY_TELEGRAM_OWNER_ID);
    if (!secret || !/^[\w-]{1,256}$/.test(secret) || !Number.isSafeInteger(owner) || owner <= 0) {
      throw new Error("请先设置 DAILY_TELEGRAM_SECRET 和 DAILY_TELEGRAM_OWNER_ID。");
    }
    await telegram("setWebhook", {
      url: "https://smileoleo.com/api/daily/telegram",
      secret_token: secret,
      allowed_updates: ["message", "edited_message", "callback_query"],
      max_connections: 1,
    });
  }

  const { url, pending_update_count, last_error_date, last_error_message } = await telegram("getWebhookInfo");
  console.log(JSON.stringify({ url, pending_update_count, last_error_date, last_error_message }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message.replaceAll(token || "\0", "[已隐藏]") : "配置 Telegram Bot 时失败。");
  process.exitCode = 1;
}
