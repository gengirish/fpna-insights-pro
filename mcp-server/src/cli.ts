#!/usr/bin/env node
import { logger } from "./utils/logger.js";

const args = process.argv.slice(2);
const transport = args[0];

async function main() {
  if (transport === "stdio") {
    // Import and run stdio version
    await import("./stdioIndex.js");
  } else if (transport === "http" || !transport) {
    // Import and run HTTP version (default)
    await import("./index.js");
  } else {
    logger.error("Usage: postgres-mcp-server [http|stdio]");
    logger.error("  http  - Start HTTP server (default)");
    logger.error("  stdio - Start stdio server");
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error("Error starting server:", error);
  process.exit(1);
});
