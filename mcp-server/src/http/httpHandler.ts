import { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../utils/logger.js";

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

export async function handleMcpRequest(
  mcpServer: McpServer,
  req: Request,
  res: Response,
) {
  const startTime = Date.now();
  logger.info(`[${startTime}] Starting MCP request handling`);
  logger.info(`Request method: ${req.body?.method}`);
  logger.info(`Request body:`, JSON.stringify(req.body, null, 2));

  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    logger.info(`Session ID from header: ${sessionId}`);

    // Handle initialization requests
    if (
      (isInitializeRequest(req.body) || req.body.method === "initialize") &&
      !sessionId
    ) {
      logger.info("=== HANDLING INITIALIZE REQUEST ===");

      const eventStore = new InMemoryEventStore();
      const newSessionId = randomUUID();
      logger.info(`Generated new session ID: ${newSessionId}`);

      try {
        logger.info("Creating StreamableHTTPServerTransport...");
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
          eventStore,
          onsessioninitialized: (sessionId) => {
            logger.info(
              `✓ Session initialized callback fired with ID: ${sessionId}`,
            );
          },
        });
        logger.info("✓ Transport created successfully");

        // Store the transport immediately
        transports[newSessionId] = transport;
        logger.info(`✓ Transport stored with session ID: ${newSessionId}`);

        transport.onclose = () => {
          const sid = transport.sessionId || newSessionId;
          logger.info(`Transport close event fired for session ID: ${sid}`);
          if (transports[sid]) {
            delete transports[sid];
            logger.info(`✓ Transport removed from store: ${sid}`);
          }
        };

        logger.info("Connecting MCP server to transport...");
        await mcpServer.connect(transport);
        logger.info("✓ MCP server connected to transport");

        logger.info("Handling initialize request...");

        // Set the session ID header before handling the request
        res.setHeader("Mcp-Session-Id", newSessionId);
        logger.info(`✓ Set Mcp-Session-Id header: ${newSessionId}`);

        await transport.handleRequest(req, res, req.body);

        const endTime = Date.now();
        logger.info(
          `✓ Initialize request completed in ${endTime - startTime}ms`,
        );
        return;
      } catch (initError) {
        logger.error("Error during initialization:", initError);
        // Clean up the transport if initialization failed
        if (transports[newSessionId]) {
          delete transports[newSessionId];
        }
        // Send error response if headers not sent
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: `Initialization failed: ${initError instanceof Error ? initError.message : "Unknown error"}`,
            },
            id: req.body?.id || null,
          });
        }
        return;
      }
    }

    // Handle requests with existing session (including server/info)
    if (sessionId && transports[sessionId]) {
      logger.info(
        `=== HANDLING REQUEST WITH EXISTING SESSION: ${sessionId} ===`,
      );
      const transport = transports[sessionId];
      await transport.handleRequest(req, res, req.body);

      const endTime = Date.now();
      logger.info(`✓ Session request completed in ${endTime - startTime}ms`);
      return;
    }

    // Invalid session or missing session ID
    logger.warn(`Invalid or missing session ID: ${sessionId}`);
    logger.warn(`Available sessions: ${Object.keys(transports).join(", ")}`);
    logger.warn(`Request method: ${req.body?.method}`);

    // Provide more specific error message
    const errorMessage =
      req.body?.method === "server/info"
        ? "server/info requires a valid session. Please initialize first."
        : "Bad Request: No valid session ID provided";

    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: errorMessage,
      },
      id: req.body?.id || null,
    });
  } catch (error) {
    const endTime = Date.now();
    logger.error(
      `Error handling MCP request after ${endTime - startTime}ms:`,
      error,
    );
    logger.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: req.body?.id || null,
      });
    }
  }
}

export async function handleMcpDelete(req: Request, res: Response) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  logger.info(`DELETE request for session: ${sessionId}`);

  if (!sessionId || !transports[sessionId]) {
    logger.warn(`Invalid session ID for DELETE: ${sessionId}`);
    res
      .status(400)
      .send(
        "Invalid or missing session ID. Please provide a valid session ID.",
      );
    return;
  }

  logger.info(`Closing session for ID: ${sessionId}`);

  try {
    const transport = transports[sessionId];
    await transport.close();
    delete transports[sessionId];
    logger.info(`✓ Session ${sessionId} closed successfully`);

    res.status(200).json({
      jsonrpc: "2.0",
      result: { success: true },
      id: null,
    });
  } catch (error) {
    logger.error("Error closing transport:", error);
    if (!res.headersSent) {
      res.status(500).send("Error closing transport");
    }
  }
}

export async function handleMcpGet(req: Request, res: Response) {
  logger.info("Received GET MCP request - responding with 405");
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
}

export async function closeAllTransports() {
  const sessionIds = Object.keys(transports);
  logger.info(`Closing ${sessionIds.length} active transports`);

  for (const sessionId of sessionIds) {
    const transport = transports[sessionId];
    if (transport) {
      try {
        await transport.close();
        logger.info(`✓ Transport closed for session ID: ${sessionId}`);
      } catch (error) {
        logger.error(
          `Error closing transport for session ${sessionId}:`,
          error,
        );
      }
    }
  }

  // Clear the transports object
  Object.keys(transports).forEach((key) => delete transports[key]);
  logger.info("✓ All transports cleared");
}
