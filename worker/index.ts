import { DurableObject } from "cloudflare:workers";
import { hasWriteAccess } from "./auth";
import { serveFitness } from "./fitness";
import { serveDaily } from "./daily/public";
import { syncDailySources } from "./daily/sources";
import { handleDailyWebhook } from "./daily/telegram";

export { Daily } from "./daily/store";
export { Fitness } from "./fitness";

type PresenceStatus = "online" | "offline";

export class Presence extends DurableObject<Env> {
  status(): PresenceStatus {
    return this.ctx.storage.kv.get<PresenceStatus>("status") ?? "offline";
  }

  toggle(): PresenceStatus {
    // Synchronous storage keeps the read and write together during concurrent calls.
    const status = this.status() === "online" ? "offline" : "online";
    this.ctx.storage.kv.put("status", status);
    return status;
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === "/api/daily/telegram") {
      if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
      try {
        return await handleDailyWebhook(request, env, env.DAILY.getByName("leo"));
      } catch {
        console.error("Daily Telegram request failed");
        return new Response(null, { status: 503 });
      }
    }
    if (pathname === "/api/daily" || pathname === "/daily" || pathname.startsWith("/daily/")) {
      try {
        return await serveDaily(request, env, url);
      } catch {
        console.error("Daily public request failed");
        return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
      }
    }
    if (pathname === "/api/fitness" || pathname.startsWith("/api/puls/")) {
      return serveFitness(request, pathname, env);
    }
    const isToggle = pathname === "/api/presence/toggle";
    if (!isToggle && pathname !== "/api/presence") return env.ASSETS.fetch(request);

    const headers = new Headers({ "Cache-Control": "no-store" });
    const method = isToggle ? "POST" : "GET";
    if (request.method !== method) {
      headers.set("Allow", method);
      return Response.json({ error: "Method not allowed" }, { status: 405, headers });
    }

    if (isToggle) {
      if (!env.PRESENCE_TOKEN) {
        return Response.json({ error: "Status updates unavailable" }, { status: 503, headers });
      }
      if (!(await hasWriteAccess(request, env.PRESENCE_TOKEN))) {
        headers.set("WWW-Authenticate", "Bearer");
        return Response.json({ error: "Unauthorized" }, { status: 401, headers });
      }
    }

    try {
      const presence = env.PRESENCE.getByName("site");
      if (isToggle) {
        const status = await presence.toggle();
        return new Response(status === "online" ? "已上线" : "已离线", { headers });
      }
      return Response.json({ status: await presence.status() }, { headers });
    } catch (error) {
      console.error("Could not access website presence", error);
      return Response.json({ error: "Status unavailable" }, { status: 503, headers });
    }
  },
  scheduled(event, env, ctx) {
    ctx.waitUntil(syncDailySources(env, event.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
