// Load environment variables from .env file FIRST
import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorTracking } from "./services/error-tracking";
import { prometheusMetrics } from "./services/prometheus-metrics";
// import { setupNextAuth } from "./auth/nextauth-routes"; // Temporarily disabled

const app = express();

// Trust proxy for proper auth behind reverse proxy
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add error tracking and metrics middleware
app.use(errorTracking.requestIdMiddleware());
app.use(prometheusMetrics.requestTrackingMiddleware());

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

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Mount NextAuth before catch-all routes
  // setupNextAuth(app); // Temporarily disabled due to import issues
  
  const server = await registerRoutes(app);

  app.use(errorTracking.errorHandler());
  
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, async () => {
    log(`serving on port ${port}`);
    
    // Initialize sync scheduler for production operations
    log('Server ready - Production sync enabled');
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Trying port ${port + 1}...`);
      const newPort = port + 1;
      server.listen({
        port: newPort,
        host: "0.0.0.0",
      }, () => {
        log(`serving on port ${newPort} (fallback port)`);
        log('Server ready - Production sync enabled');
      });
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
})();
