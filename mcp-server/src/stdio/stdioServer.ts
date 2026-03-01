import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "../server/server.js";
import { logger } from "../utils/logger.js";

export async function runStdioServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  logger.info("Starting MCP stdio server...");
  await server.connect(transport);
  logger.info("MCP stdio server started successfully");

  let isShuttingDown = false;

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info("Gracefully shutting down MCP stdio server...");
    try {
      await transport.close();
    } catch (error) {
      logger.error("Error closing transport:", error);
    }

    logger.info("MCP stdio server shut down completed.");
    process.exit(0);
  };

  // Handle termination signals
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception:", err);
    shutdown();
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    shutdown();
  });
}

export async function startStdioServer() {
  try {
    await runStdioServer();
  } catch (error) {
    logger.error("Failed to start stdio server:", error);
    process.exit(1);
  }
}
