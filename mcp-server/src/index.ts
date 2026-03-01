#!/usr/bin/env node
import { config } from "./config/env.js";
import { createApp } from "./http/app.js";
import { logger } from "./utils/logger.js";

const { app, mcpServer, closeAllTransports } = createApp();

app.listen(config.server.port, config.server.host, () => {
  logger.info(
    `Stateful server is running on http://${config.server.host}:${config.server.port}/mcp`,
  );
  if (process.env.NODE_ENV !== "production") {
    logger.info(`Local access: http://localhost:${config.server.port}/mcp`);
  }
});

// Graceful shutdown handler
const shutdown = async () => {
  logger.info("Shutting down server...");
  try {
    await closeAllTransports();
  } catch (error) {
    logger.error(`Error closing transports:`, error);
  }

  await mcpServer.close();
  logger.info("Server shutdown complete");
  process.exit(0);
};

// Handle SIGINT and SIGTERM
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
