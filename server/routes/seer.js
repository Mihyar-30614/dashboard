import { Router } from "express";
import { requireAuth } from "../auth/session.js";

const router = Router();

const UPSTREAM = (process.env.SEER_API_URL || "https://seer.mihyarmas.com/api").replace(/\/+$/, "");
const API_KEY = process.env.SEER_API_KEY || process.env.API_KEY || "";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

router.use(requireAuth);

router.all(/.*/, async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({ error: "seer_api_key_missing" });
  }

  const url = UPSTREAM + req.originalUrl.replace(/^\/api\/seer/, "");
  const method = req.method;
  const hasBody = !["GET", "HEAD"].includes(method);

  const headers = {
    "X-API-Key": API_KEY,
    Accept: req.headers.accept || "application/json",
  };
  if (hasBody) headers["Content-Type"] = req.headers["content-type"] || "application/json";
  if (req.headers["x-request-id"]) headers["X-Request-ID"] = req.headers["x-request-id"];

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  try {
    const upstream = await fetch(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
      signal: controller.signal,
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) res.setHeader(key, value);
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    if (controller.signal.aborted) return;
    console.error("seer proxy error", err);
    res.status(502).json({ error: "seer_upstream_unreachable", detail: String(err?.message || err) });
  }
});

export default router;
