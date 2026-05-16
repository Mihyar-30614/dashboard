import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { sessionMiddleware } from "./auth/session.js";
import authRoutes from "./auth/routes.js";
import invitesRoutes from "./auth/invites.js";
import widgetsRoutes from "./routes/widgets.js";
import appsRoutes from "./routes/apps.js";
import metricsRoutes from "./routes/metrics.js";
import layoutsRoutes from "./routes/layouts.js";
import healthRoutes from "./routes/health.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_PROD = path.resolve(__dirname, "../web-prod");

let seedAdminFn;
if (process.env.NODE_ENV === "test") {
  ({ seedAdmin: seedAdminFn } = await import("./auth/seed.js"));
}

export function buildApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("combined"));
  }
  app.use(sessionMiddleware());

  app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (!origin) return next();
    if (origin === process.env.APP_ORIGIN) return next();
    return res.status(403).json({ error: "bad_origin" });
  });

  app.use("/health", healthRoutes);
  app.use("/api", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/invites", invitesRoutes);
  app.use("/api/widgets", widgetsRoutes);
  app.use("/api/apps", appsRoutes);
  app.use("/api/metrics", metricsRoutes);
  app.use("/api/layouts", layoutsRoutes);

  if (process.env.NODE_ENV === "test") {
    app.post("/api/test/seed", async (req, res) => {
      try {
        await seedAdminFn(req.body.email, req.body.password);
        res.json({ ok: true });
      } catch (e) {
        res.json({ ok: false, err: e.message });
      }
    });
  }

  app.use(express.static(WEB_PROD));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(WEB_PROD, "index.html"));
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "internal" });
  });
  return app;
}
