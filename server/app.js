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

  app.get("/health", (_req, res) =>
    res.json({ ok: true, uptime_s: process.uptime() }),
  );
  app.use("/api/auth", authRoutes);
  app.use("/api/invites", invitesRoutes);
  app.use("/api/widgets", widgetsRoutes);
  app.use("/api/apps", appsRoutes);
  app.use("/api/metrics", metricsRoutes);
  app.use("/api/layouts", layoutsRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "internal" });
  });
  return app;
}
