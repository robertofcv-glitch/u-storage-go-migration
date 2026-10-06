import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '15mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '15mb' }));

// Rate limiting for expensive public endpoints.
// These endpoints trigger paid third-party API calls (OpenAI, Google) or heavy
// server-side processing and are accessible without authentication.  Without
// limits a single attacker script can run up bills or exhaust server resources.

// Clara AI chat and file-upload: very tight window because every request
// can trigger one or two OpenAI calls plus CPU/disk work.
const claraLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

// Google Places proxy: tighter than pages but looser than AI — each call
// hits the paid Places API with the server-side key.
const placesLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

// Quote estimate: triggers Google Distance Matrix call + DB write per request.
const estimateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

// Storage recommendation: triggers up to two paid Google geocoding calls per request.
const storageRecommendationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

// The temporary U-Storage public-site adapter makes multiple upstream requests
// per lookup. Keep both proxy endpoints bounded independently of cache keys.
const storageAvailabilityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many storage availability requests. Please try again later." },
});

// Email login: tight limit to defend against brute-force / credential-stuffing.
// 10 attempts per 15 minutes per IP is generous enough for legitimate users
// (who rarely fail more than 1-2 times) but blocks automated attack scripts.
const emailLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});

// Forgot-password: rate limit per IP to prevent inbox flooding and email quota abuse.
// 5 requests per 15 minutes is more than enough for any legitimate user.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset requests. Please try again later." },
});

app.use("/api/clara/", claraLimiter);
app.use("/api/places/", placesLimiter);
app.use("/api/quotes/calculate-estimate", estimateLimiter);
app.use("/api/quotes/storage-recommendation", storageRecommendationLimiter);
app.use("/api/quotes/validate-storage-address", storageRecommendationLimiter);
app.use("/api/ustorage/availability", storageAvailabilityLimiter);
app.use("/api/ustorage/reservation-handoff", storageAvailabilityLimiter);
app.use("/api/auth/email-login", emailLoginLimiter);
app.use("/api/auth/forgot-password", forgotPasswordLimiter);

// Framing / embed-safety headers.
// - `/embed/*` routes are allowed to be framed by the configured partner hosts
//   (u-storage.com.mx by default) and are marked noindex.
// - Every other route is protected from framing in production (admin,
//   dashboards, etc.). In development we deliberately skip the restrictive
//   headers so the Replit preview iframe keeps working.
const EMBED_FRAME_ANCESTORS =
  process.env.EMBED_FRAME_ANCESTORS ||
  "https://u-storage.com.mx https://*.u-storage.com.mx";
app.use((req, res, next) => {
  if (req.path.startsWith("/embed")) {
    res.setHeader(
      "Content-Security-Policy",
      `frame-ancestors 'self' ${EMBED_FRAME_ANCESTORS}`,
    );
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.removeHeader("X-Frame-Options");
  } else if (process.env.NODE_ENV === "production") {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
  }
  next();
});

// CSRF protection via Origin/Referer validation.
//
// In production the session cookie is SameSite=None so that the /embed/*
// partner widget works inside cross-site iframes.  That relaxed attribute
// means the browser will also attach the cookie to forged cross-site POST
// requests, so we must validate the request origin server-side.
//
// Rules:
//  - Only state-changing methods are checked (GET/HEAD/OPTIONS are safe).
//  - /embed/* routes are intentionally cross-site; they are excluded.
//  - In development SameSite=Lax is used, so the attack surface does not
//    exist there; we skip enforcement to avoid breaking local tooling.
//  - When Origin is present it must match the server's Host header.
//  - When Origin is absent but Referer is present, Referer host is checked.
//  - When neither header is present the request is allowed through (direct
//    API clients / curl do not carry a session cookie so auth will stop them).
app.use((req: Request, res: Response, next: NextFunction) => {
  const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  if (!STATE_CHANGING_METHODS.has(req.method)) return next();
  if (req.path.startsWith('/embed/')) return next();
  if (process.env.NODE_ENV !== 'production') return next();

  const serverHost = req.headers['host'];
  const originHeader = req.headers['origin'] as string | undefined;
  const refererHeader = req.headers['referer'] as string | undefined;

  const reject = () =>
    res.status(403).json({ message: 'CSRF validation failed: cross-site request rejected' });

  if (originHeader) {
    try {
      const originHost = new URL(originHeader).host;
      if (originHost !== serverHost) return reject();
    } catch {
      return reject();
    }
  } else if (refererHeader) {
    try {
      const refererHost = new URL(refererHeader).host;
      if (refererHost !== serverHost) return reject();
    } catch {
      return reject();
    }
  }

  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
