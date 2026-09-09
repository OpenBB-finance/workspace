import { auth, UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
// Import both transport types
import {
  SSEClientTransport,
  type SSEClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/sse.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js"; // Added
import {
  InvalidClientError,
  InvalidGrantError,
  InvalidRequestError,
} from "@modelcontextprotocol/sdk/server/auth/errors";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"; // Added for type safety
// useMcp.ts
import {
  CallToolResultSchema,
  GetPromptResultSchema,
  type JSONRPCMessage,
  ListPromptsResultSchema,
  ListResourcesResultSchema,
  ListToolsResultSchema,
  type Prompt,
  ReadResourceResultSchema,
  type Resource,
  type ResourceTemplate,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { UseMcpOptions, UseMcpResult } from "use-mcp/react";
import { useStateReducer } from "~/hooks/useStateReducer";
import { convertHeadersToRecord, fetchWithToken } from "~/lib/api";
import { getConfig } from "~/lib/runtimeConfig";
import { useMcpToolsStore } from "~/lib/state/mcpTools";
import { useThemeStore } from "~/lib/state/theme";
import { BrowserOAuthClientProvider } from "./browser-provider";

/**
 * Asserts that a condition is true, throwing an error if not.
 * Useful for type narrowing.
 * @param condition The condition to check.
 * @param message The error message to throw if the condition is false.
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const MCP_PROXY_URL = `${getConfig().urls.backend}/pro/mcp-proxy`;

const DEFAULT_RECONNECT_DELAY = 3000;
const DEFAULT_RETRY_DELAY = 5000;
const AUTH_TIMEOUT = 2 * 60 * 1000; // 2 minutes for auth flow
const TOOL_CALL_TIMEOUT = 5 * 60 * 1000; // 5 minutes for long-running tool calls

// Define Transport types literal for clarity
type TransportType = "http" | "sse";

type MCPDataType = {
  state: UseMcpResult["state"];
  tools: Tool[];
  resources: Resource[];
  resourceTemplates: ResourceTemplate[];
  prompts: Prompt[];
  error: string | undefined;
  log: UseMcpResult["log"];
  authUrl: string | undefined;
  broadcastChannel: BroadcastChannel | null;
};

export type UseMcpOptionsT = UseMcpOptions & {
  serverId?: string;
  serverName?: string;
  handleDisconnect?: () => void;
  isLocal?: boolean;
  /** "token" suppresses the OAuth flow: a 401 fails the connection instead of prompting auth. */
  authType?: "oauth" | "token";
};

function getOptions(options: UseMcpOptionsT) {
  const newOptions: UseMcpOptionsT = {
    callbackUrl:
      typeof window !== "undefined"
        ? new URL("/oauth/callback", window.location.origin).toString()
        : "/oauth/callback",
    storageKeyPrefix: "mcp:auth",
    clientConfig: {},
    customHeaders: {},
    debug: false,
    autoRetry: false,
    autoReconnect: DEFAULT_RECONNECT_DELAY,
    transportType: "auto",
    preventAutoAuth: false,
    popupFeatures: "width=600,height=700,resizable=yes,scrollbars=yes,status=yes",
    ...options,
  };
  return newOptions;
}

export async function fetchMcpProxyCb(url: string | URL, init?: RequestInit) {
  const headers = {};
  if (init?.headers instanceof Headers) {
    for (const [key, value] of init.headers.entries()) {
      headers[key] = value;
    }
  } else if (init?.headers && typeof init.headers === "object") {
    Object.assign(headers, init.headers);
  }

  let bodyContent = null;
  if (typeof init?.body === "string") {
    bodyContent = JSON.parse(init.body);
  } else if (init?.body instanceof URLSearchParams) {
    bodyContent = Object.fromEntries(init.body.entries());
  } else if (init?.body && typeof init.body === "object") {
    bodyContent = init.body;
  }

  const data = {
    headers: headers,
    url: url.toString(),
    method: init?.method || "GET",
    body: bodyContent,
  };

  return fetchWithToken(
    MCP_PROXY_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    init?.signal,
  ).then(async (r) => {
    const noContent = r.status === 204;
    // Some servers may return 204 No Content on ping requests,
    // which creates an infinite loop of retries. Treat 204 as success with empty response.
    if (noContent) return new Response(null, { status: 200 });

    // Check if response is JSON and contains an error message indicating a POST method was used on a GET endpoint,
    // which can happen with some MCP server configurations.
    // If so, return a 405 Method Not Allowed to prevent infinite retries.
    if (r.headers.get("Content-Type")?.includes("application/json")) {
      try {
        const data = await r.clone().json();
        const message = data?.message?.toLowerCase();
        if (
          message?.includes("use post") ||
          message?.includes("json-rpc payload") ||
          message?.includes("method not allowed")
        ) {
          return new Response(null, { status: 405, statusText: "Method Not Allowed" });
        }
      } catch (e) {
        // If response is not JSON, ignore and return original response
      }
    }

    return r;
  });
}

function isAuthError(error: Error, errorMessage?: string): boolean {
  if (!errorMessage)
    errorMessage = error instanceof Error ? error.message : String(error);

  return (
    error instanceof UnauthorizedError ||
    error instanceof InvalidRequestError ||
    error instanceof InvalidClientError ||
    error instanceof InvalidGrantError ||
    errorMessage.includes("Unauthorized") ||
    errorMessage.includes("401")
  );
}

export function useMcp(options: UseMcpOptionsT): UseMcpResult {
  const {
    url,
    serverId,
    serverName,
    clientName,
    clientUri,
    callbackUrl,
    storageKeyPrefix,
    clientConfig,
    customHeaders,
    debug,
    autoRetry,
    autoReconnect,
    transportType,
    preventAutoAuth,
    popupFeatures,
    isLocal,
    authType,
    handleDisconnect,
    onPopupWindow,
  } = useMemo(() => getOptions(options), [options]); // Memoize options to prevent unnecessary effect runs

  const usesTokenAuth = authType === "token";

  const [data, dispatch] = useStateReducer<MCPDataType>({
    state: "discovering",
    tools: [],
    resources: [],
    resourceTemplates: [],
    prompts: [],
    log: [],
    error: undefined,
    authUrl: undefined,
    broadcastChannel: null,
  });

  const clientRef = useRef<Client | null>(null);
  // Transport ref can hold either type now
  const transportRef = useRef<Transport | null>(null);
  const authProviderRef = useRef<BrowserOAuthClientProvider | null>(null);
  const connectingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const connectAttemptRef = useRef<number>(0);
  const authTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Refs for values used in callbacks ---
  const stateRef = useRef(data.state);
  const autoReconnectRef = useRef(autoReconnect);
  // Ref to store the type of transport that successfully connected
  const successfulTransportRef = useRef<TransportType | null>(null);

  // --- Effect to keep refs updated ---
  useEffect(() => {
    stateRef.current = data.state;
    autoReconnectRef.current = autoReconnect;
  }, [data.state, autoReconnect]);

  // --- Stable Callbacks ---
  // addLog is stable (empty dependency array)
  const addLog = useCallback(
    (level: UseMcpResult["log"][0]["level"], message: string, ...args: unknown[]) => {
      if (!debug) return;
      const fullMessage =
        args.length > 0
          ? `${message} ${args.map((arg) => JSON.stringify(arg)).join(" ")}`
          : message;
      console[level](`[useMcp] ${fullMessage}`);
      // Use isMountedRef to prevent state updates after unmount
      if (isMountedRef.current) {
        dispatch({
          log: (prevLog) => [
            ...prevLog.slice(-100),
            { level, message: fullMessage, timestamp: Date.now() },
          ],
        });
      }
    },
    [isMountedRef, debug], // Empty dependency array makes this stable
  );

  // disconnect is stable (depends only on stable addLog)
  const disconnect = useCallback(
    async (quiet = false) => {
      if (!quiet) addLog("info", "Disconnecting...");
      connectingRef.current = false;
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = null;

      const transport = transportRef.current;
      clientRef.current = null; // Ensure client is cleared
      transportRef.current = null; // Ensure transport is cleared

      // Only reset state if mounted and not a quiet disconnect
      if (isMountedRef.current && !quiet) {
        dispatch({
          state: "discovering",
          tools: [],
          resources: [],
          resourceTemplates: [],
          prompts: [],
          error: undefined,
          authUrl: undefined,
        });
      }

      if (transport) {
        try {
          await transport.close();
          if (!quiet) addLog("debug", "Transport closed");
        } catch (err) {
          if (!quiet) addLog("warn", "Error closing transport:", err);
        }
      }
    },
    [addLog, connectingRef, authTimeoutRef, isMountedRef, transportRef, clientRef], // Depends only on stable addLog
  );

  // failConnection is stable (depends only on stable addLog)
  const failConnection = useCallback(
    (errorMessage: string, connectionError?: Error) => {
      addLog("error", errorMessage, connectionError ?? "");
      if (isMountedRef.current) {
        const updatedData = { state: "failed", error: errorMessage } as MCPDataType;
        const manualUrl = authProviderRef.current?.getLastAttemptedAuthUrl();
        if (manualUrl) {
          updatedData.authUrl = manualUrl; // Update authUrl in state
          addLog("info", "Manual authentication URL may be available.", manualUrl);
        }
        dispatch(updatedData);
      }
      connectingRef.current = false; // Ensure connection attempt is marked as finished
      // Do not call disconnect here - allow user to see error and retry
    },
    [addLog, isMountedRef, authProviderRef, connectingRef],
  ); // Depends only on stable addLog

  // When auth never completes (user left the popup open), fail the connection and
  // disable the server so it stops re-triggering the popup on every reload.
  const handleAuthTimeout = useCallback(() => {
    failConnection("Authentication timed out. Please try again.");
    if (serverId) {
      useMcpToolsStore.getState().disableServerAfterAuthCancel(serverId);
    }
  }, [failConnection, serverId]);

  // connect needs to be stable. Remove state/autoReconnect deps, use refs inside.
  const connect = useCallback(async () => {
    // Prevent concurrent connections
    if (connectingRef.current) {
      addLog("debug", "Connection attempt already in progress.");
      return;
    }
    if (!isMountedRef.current) {
      addLog("debug", "Connect called after unmount, aborting.");
      return;
    }

    const fetchMcpProxy = isLocal ? fetch : fetchMcpProxyCb;

    connectingRef.current = true; // Mark start of connection sequence
    connectAttemptRef.current += 1;
    successfulTransportRef.current = null; // Reset successful transport type
    dispatch({ state: "discovering", error: undefined, authUrl: undefined });
    addLog("info", `Connecting attempt #${connectAttemptRef.current} to ${url}...`);

    // Initialize provider/client if needed (idempotent)1
    // Ensure provider/client are initialized (idempotent check)
    if (!authProviderRef.current) {
      const left = window.screenX + (window.innerWidth - 600) / 2;
      const top = window.screenY + (window.innerHeight - 600) / 2;
      authProviderRef.current = new BrowserOAuthClientProvider(url, {
        storageKeyPrefix,
        serverName,
        clientName,
        clientUri,
        callbackUrl,
        preventAutoAuth,
        popupFeatures: `${popupFeatures},left=${left},top=${top}`,
        onPopupWindow,
      });
      addLog("debug", "BrowserOAuthClientProvider initialized in connect.");
    }
    if (!clientRef.current) {
      clientRef.current = new Client(
        {
          name: clientConfig.name || "use-mcp-react-client",
          version: clientConfig.version || "0.1.0",
        },
        { capabilities: {} },
      );
      addLog("debug", "MCP Client initialized in connect.");
    }

    // --- Helper function for a single connection attempt ---
    const tryConnectWithTransport = async (
      transportType: TransportType,
    ): Promise<"success" | "fallback" | "auth_redirect" | "failed"> => {
      addLog(
        "info",
        `Attempting connection with ${transportType.toUpperCase()} transport...`,
      );
      // Ensure state reflects current attempt phase, unless already authenticating
      if (stateRef.current !== "authenticating") {
        dispatch({ state: "connecting" });
      }

      let transportInstance: Transport; // Use base Transport type

      // 1. Create Transport Instance & Close Previous
      try {
        assert(authProviderRef.current, "Auth Provider must be initialized");
        assert(clientRef.current, "Client must be initialized");

        // Close existing transport before creating new one
        if (transportRef.current) {
          await transportRef.current
            .close()
            .catch((e) =>
              addLog("warn", `Error closing previous transport: ${e.message}`),
            );
          transportRef.current = null;
        }

        const { headers } = convertHeadersToRecord(customHeaders);

        const commonOptions: SSEClientTransportOptions = {
          authProvider: authProviderRef.current,
          requestInit: {
            headers: {
              accept: "application/json, text/event-stream",
              ...headers,
            },
          },
          fetch: fetchMcpProxy,
        };
        // Sanitize the URL to prevent XSS attacks from malicious server URLs
        const sanitizedUrl = url;
        const targetUrl = new URL(sanitizedUrl);

        addLog(
          "debug",
          `Creating ${transportType.toUpperCase()} transport for URL: ${targetUrl.toString()}`,
        );
        addLog("debug", "Transport options:", {
          authProvider: !!authProviderRef.current,
          headers,
          url: targetUrl.toString(),
        });

        if (transportType === "http") {
          addLog("debug", "Creating StreamableHTTPClientTransport...");
          transportInstance = new StreamableHTTPClientTransport(
            targetUrl,
            commonOptions,
          );
          addLog("debug", "StreamableHTTPClientTransport created successfully");
        } else {
          // sse
          addLog("debug", "Creating SSEClientTransport...");
          transportInstance = new SSEClientTransport(targetUrl, commonOptions);
          addLog("debug", "SSEClientTransport created successfully");
        }
        transportRef.current = transportInstance; // Assign to ref immediately
        addLog(
          "debug",
          `${transportType.toUpperCase()} transport created and assigned to ref.`,
        );
      } catch (err) {
        // Use stable failConnection
        failConnection(
          `Failed to create ${transportType.toUpperCase()} transport: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err : undefined,
        );
        return "failed"; // Indicate definitive failure
      }

      // 2. Setup Handlers for the new transportInstance
      transportInstance.onmessage = (message: JSONRPCMessage) => {
        // Use stable addLog
        addLog("debug", `[Transport] Received: ${JSON.stringify(message)}`);
        // @ts-expect-error
        clientRef.current?.handleMessage?.(message); // Forward to current client
      };
      transportInstance.onerror = (err: Error) => {
        // Transport errors usually mean connection is lost/failed definitively for this transport
        addLog("warn", `Transport error event (${transportType.toUpperCase()}):`, err);
        addLog("debug", "Error details:", {
          message: err.message,
          stack: err.stack,
          name: err.name,
          cause: err.cause,
        });
        if (isAuthError(err)) return; // Let the onclose handler manage the flow after auth failure
        if (!(err instanceof StreamableHTTPError && err.code === 504))
          // Use stable failConnection
          failConnection(
            `Transport error (${transportType.toUpperCase()}): ${err.message}`,
            err,
          );
      };
      transportInstance.onclose = () => {
        // Use refs for checks and stable callbacks
        if (!isMountedRef.current || connectingRef.current) return; // Ignore if connecting/unmounted

        addLog(
          "info",
          `Transport connection closed (${successfulTransportRef.current || "unknown"} type).`,
        );
        const currentState = stateRef.current;
        const currentAutoReconnect = autoReconnectRef.current;

        if (currentState === "ready" && currentAutoReconnect) {
          const delay =
            typeof currentAutoReconnect === "number"
              ? currentAutoReconnect
              : DEFAULT_RECONNECT_DELAY;
          addLog("info", `Attempting to reconnect in ${delay}ms...`);
          dispatch({ state: "connecting" });
          setTimeout(() => {
            if (isMountedRef.current) {
              connect(); // Start full connect logic again (will default to HTTP)
            }
          }, delay);
        } else if (currentState !== "failed" && currentState !== "authenticating") {
          // Use stable failConnection
          failConnection("Connection closed unexpectedly.");
        }
      };

      // 3. Attempt client.connect()
      try {
        addLog("info", `Connecting client via ${transportType.toUpperCase()}...`);
        addLog("debug", "About to call client.connect() with transport instance");
        addLog(
          "debug",
          `Transport instance type: ${transportInstance.constructor.name}`,
        );

        await clientRef.current!.connect(transportInstance);

        // --- Success Path ---
        addLog(
          "info",
          `Client connected via ${transportType.toUpperCase()}. Loading tools, resources, and prompts...`,
        );
        successfulTransportRef.current = transportType; // Store successful type

        // Load resources after tools (optional - not all servers support resources)
        let resourcesResponse: {
          resources: Resource[];
          resourceTemplates?: ResourceTemplate[];
        } = { resources: [], resourceTemplates: [] };
        try {
          resourcesResponse = (await clientRef.current!.request(
            { method: "resources/list" },
            ListResourcesResultSchema,
          )) as { resources: Resource[]; resourceTemplates?: ResourceTemplate[] }; // Ensure type safety
        } catch (err) {
          if (isAuthError(err)) throw err; // Let the outer catch handle it
          addLog("debug", "Server does not support resources/list method", err);
        }

        dispatch({ state: "loading" });
        const toolsResponse = await clientRef.current!.request(
          { method: "tools/list" },
          ListToolsResultSchema,
        );

        // Load prompts after resources (optional - not all servers support prompts)
        let promptsResponse: { prompts: Prompt[] } = { prompts: [] };
        try {
          promptsResponse = (await clientRef.current!.request(
            { method: "prompts/list" },
            ListPromptsResultSchema,
          )) as { prompts: Prompt[] }; // Ensure type safety
        } catch (err) {
          if (isAuthError(err)) throw err; // Let the outer catch handle it
          addLog("debug", "Server does not support prompts/list method", err);
        }

        if (isMountedRef.current) {
          // Check mount before final state updates
          dispatch({
            tools: toolsResponse.tools,
            resources: resourcesResponse.resources,
            resourceTemplates: Array.isArray(resourcesResponse.resourceTemplates)
              ? resourcesResponse.resourceTemplates
              : [],
            prompts: promptsResponse.prompts,
          });

          const summary = [`Loaded ${toolsResponse.tools.length} tools`];
          if (
            resourcesResponse.resources.length > 0 ||
            (resourcesResponse.resourceTemplates &&
              resourcesResponse.resourceTemplates.length > 0)
          ) {
            summary.push(`${resourcesResponse.resources.length} resources`);
            if (
              Array.isArray(resourcesResponse.resourceTemplates) &&
              resourcesResponse.resourceTemplates.length > 0
            ) {
              summary.push(
                `${resourcesResponse.resourceTemplates.length} resource templates`,
              );
            }
          }
          if (promptsResponse.prompts.length > 0) {
            summary.push(`${promptsResponse.prompts.length} prompts`);
          }

          addLog("info", `${summary.join(", ")}.`);
          dispatch({ state: "ready" }); // Final success state
          // connectingRef will be set to false after orchestration logic
          connectAttemptRef.current = 0; // Reset on success
          return "success";
        }
        return "failed"; // Failed due to unmount after connect but before ready
      } catch (connectErr) {
        // --- Error Handling Path ---
        addLog(
          "debug",
          `Client connect error via ${transportType.toUpperCase()}:`,
          connectErr,
        );
        addLog("debug", "Connect error details:", {
          message:
            connectErr instanceof Error ? connectErr.message : String(connectErr),
          stack: connectErr instanceof Error ? connectErr.stack : "N/A",
          name: connectErr instanceof Error ? connectErr.name : "Unknown",
          cause: connectErr instanceof Error ? connectErr.cause : undefined,
        });
        const errorInstance =
          connectErr instanceof Error ? connectErr : new Error(String(connectErr));

        // Check for 404/405 specifically for HTTP transport
        const errorMessage = errorInstance.message;
        const is404 =
          errorMessage.includes("404") || errorMessage.includes("Not Found");
        const is405 =
          errorMessage.includes("405") || errorMessage.includes("Method Not Allowed");
        const isLikelyCors =
          errorMessage === "Failed to fetch" /* Chrome */ ||
          errorMessage ===
            "NetworkError when attempting to fetch resource." /* Firefox */ ||
          errorMessage === "Load failed"; /* Safari */

        if (transportType === "http" && (is404 || is405 || isLikelyCors)) {
          addLog(
            "warn",
            `HTTP transport failed (${isLikelyCors ? "CORS" : is404 ? "404" : "405"}).`,
          );
          return "fallback"; // Signal that fallback should be attempted
        }

        // Check for Auth error (Simplified - requires more thought for interaction with fallback)
        if (isAuthError(errorInstance, errorMessage)) {
          addLog("info", "Authentication required.");

          // Token-auth servers never fall back to the OAuth flow: a 401 means the
          // static token is missing/invalid, so surface a token-specific error.
          if (usesTokenAuth) {
            failConnection(
              `Couldn't authenticate with ${serverName || "the MCP server"}. Check that your token is valid and not expired.`,
              errorInstance,
            );
            return "failed";
          }

          if (
            errorInstance instanceof InvalidGrantError ||
            errorInstance instanceof InvalidRequestError ||
            errorInstance instanceof InvalidClientError
          ) {
            // Clear storage on invalid client/request/grant errors to prevent loops
            authProviderRef.current?.clearStorage();
          }

          // Check if we have existing tokens before triggering auth flow
          assert(authProviderRef.current, "Auth Provider not available for auth flow");
          const existingTokens = await authProviderRef.current.tokens();

          // If preventAutoAuth is enabled and no valid tokens exist, go to pending_auth state
          if (preventAutoAuth && !existingTokens) {
            addLog(
              "info",
              "Authentication required but auto-auth prevented. User action needed.",
            );
            dispatch({ state: "pending_auth" });
            // We'll set the auth URL when the user manually triggers auth
            return "auth_redirect"; // Signal that we need user action
          }

          // Ensure state is set only once if multiple attempts trigger auth
          if (
            stateRef.current !== "authenticating" &&
            stateRef.current !== "pending_auth"
          ) {
            authProviderRef.current.setPreventAutoAuth(false);

            dispatch({ state: "authenticating" });
            if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
            authTimeoutRef.current = setTimeout(() => {
              handleAuthTimeout();
            }, AUTH_TIMEOUT);
          }

          try {
            const authResult = await auth(authProviderRef.current, {
              serverUrl: url,
              fetchFn: fetchMcpProxy,
            });

            if (!isMountedRef.current) return "failed"; // Unmounted during auth

            if (authResult === "AUTHORIZED") {
              addLog(
                "info",
                "Authentication successful via existing token or refresh. Re-attempting connection...",
              );
              if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
              // Re-trigger the *entire* connect sequence after successful auth
              // It will start with HTTP again.
              // We return 'failed' here to stop current sequence, connect() below will handle restart.
              // Set connectingRef false so outer connect call can proceed
              connectingRef.current = false;
              connect(); // Restart full connection sequence
              return "failed"; // Stop this attempt sequence, new one started
            }
            if (authResult === "REDIRECT") {
              addLog("info", "Redirecting for authentication. Waiting for callback...");
              return "auth_redirect"; // Signal that we are waiting for redirect
            }
          } catch (sdkAuthError) {
            if (!isMountedRef.current) return "failed";
            if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
            // Use stable failConnection
            failConnection(
              `Failed to initiate authentication: ${sdkAuthError instanceof Error ? sdkAuthError.message : String(sdkAuthError)}`,
              sdkAuthError instanceof Error ? sdkAuthError : undefined,
            );
            return "failed"; // Auth initiation failed
          }
        }

        // Handle other connection errors
        // For HTTP transport, consider fallback only for specific error types
        // "Not connected" errors should still be treated as failures, not fallback triggers
        failConnection(
          `Failed to connect via ${transportType.toUpperCase()}: ${errorMessage}`,
          errorInstance,
        );
        return "failed";
      }
    }; // End of tryConnectWithTransport helper

    // --- Orchestrate Connection Attempts ---
    let finalStatus: "success" | "auth_redirect" | "failed" | "fallback" = "failed"; // Default to failed

    if (transportType === "sse") {
      // SSE only - skip HTTP entirely
      addLog("debug", "Using SSE-only transport mode");
      finalStatus = await tryConnectWithTransport("sse");
    } else if (transportType === "http") {
      // HTTP only - no fallback
      addLog("debug", "Using HTTP-only transport mode");
      finalStatus = await tryConnectWithTransport("http");
    } else {
      // Auto mode - try HTTP first, fallback to SSE
      addLog("debug", "Using auto transport mode (HTTP with SSE fallback)");
      const httpResult = await tryConnectWithTransport("http");

      // Try SSE only if HTTP requested fallback and we haven't redirected for auth
      // Allow fallback even if state is 'failed' from a previous HTTP attempt in auto mode
      if (
        httpResult === "fallback" &&
        isMountedRef.current &&
        stateRef.current !== "authenticating"
      ) {
        addLog("info", "HTTP failed, attempting SSE fallback...");
        const sseResult = await tryConnectWithTransport("sse");
        finalStatus = sseResult; // Use SSE result as final status

        // If SSE also failed, we need to properly fail the connection since HTTP didn't call failConnection
        if (sseResult === "failed" && isMountedRef.current) {
          // SSE failure already called failConnection, so we don't need to do anything else
        }
      } else {
        finalStatus = httpResult; // Use HTTP result if no fallback was needed/possible
      }
    }

    // --- Finalize Connection State ---
    // Set connectingRef based on the final outcome.
    // It should be false if 'success' or 'failed'.
    // It should remain true if 'auth_redirect'.
    if (finalStatus === "success" || finalStatus === "failed") {
      connectingRef.current = false;
    }

    if (finalStatus === "failed" && isMountedRef.current) handleDisconnect?.();

    // If finalStatus is 'auth_redirect', connectingRef remains true (set at the start).
    authProviderRef.current.setPreventAutoAuth(true);
    addLog("debug", `Connection sequence finished with status: ${finalStatus}`);
  }, [
    // Stable callback dependencies
    addLog,
    failConnection,
    handleAuthTimeout,
    disconnect,
    auth, // Include SDK auth function if used directly
    handleDisconnect,
    // Configuration dependencies
    url,
    isLocal,
    usesTokenAuth,
    storageKeyPrefix,
    serverName,
    clientName,
    clientUri,
    callbackUrl,
    customHeaders,
    clientConfig.name,
    clientConfig.version,
    popupFeatures,
    // No state/autoReconnect dependency here

    stateRef,
    clientRef,
    transportRef,
    authProviderRef,
    connectingRef,
    connectAttemptRef,
    isMountedRef,
    successfulTransportRef,
    authTimeoutRef,
    autoReconnectRef,
  ]);

  // callTool is stable (depends on stable addLog, failConnection, connect, and URL)
  const callTool = useCallback(
    async (name: string, args?: Record<string, unknown>) => {
      const state = data.state; // Use current state from data
      // Use stateRef for check, state for throwing error message
      if (stateRef.current !== "ready" || !clientRef.current) {
        throw new Error(
          `MCP client is not ready (current state: ${state}). Cannot call tool "${name}".`,
        );
      }
      const fetchMcpProxy = isLocal ? fetch : fetchMcpProxyCb;
      addLog("info", `Calling tool: ${name}`, args);
      try {
        const result = await clientRef.current.request(
          { method: "tools/call", params: { name, arguments: args } },
          CallToolResultSchema,
          { timeout: TOOL_CALL_TIMEOUT },
        );
        addLog("info", `Tool "${name}" call successful:`, result);
        return result;
      } catch (err) {
        addLog(
          "error",
          `Error calling tool "${name}": ${err instanceof Error ? err.message : String(err)}`,
          err,
        );
        const errorInstance = err instanceof Error ? err : new Error(String(err));

        if (
          errorInstance instanceof UnauthorizedError ||
          errorInstance.message.includes("Unauthorized") ||
          errorInstance.message.includes("401")
        ) {
          // Token-auth servers never re-authenticate via OAuth on a 401.
          if (usesTokenAuth) {
            failConnection(
              `Couldn't authenticate with ${serverName || "the MCP server"}. Check that your token is valid and not expired.`,
              errorInstance,
            );
            throw err;
          }
          addLog("warn", "Tool call unauthorized, attempting re-authentication...");
          dispatch({ state: "authenticating" }); // Update UI state
          if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current); // Reset timeout
          authTimeoutRef.current = setTimeout(() => {
            handleAuthTimeout();
          }, AUTH_TIMEOUT);

          try {
            assert(
              authProviderRef.current,
              "Auth Provider not available for tool re-auth",
            );
            const authResult = await auth(authProviderRef.current, {
              serverUrl: url,
              fetchFn: fetchMcpProxy,
            });

            if (!isMountedRef.current) return; // Check mount

            if (authResult === "AUTHORIZED") {
              addLog(
                "info",
                "Re-authentication successful. Retrying tool call is recommended, or reconnecting.",
              );
              if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
              // Option 1: Just set state ready and let user retry tool?
              // setState('ready');
              // Option 2: Reconnect client completely? Safer.
              connectingRef.current = false;
              connect(); // Reconnect session
            } else if (authResult === "REDIRECT") {
              addLog("info", "Redirecting for re-authentication for tool call.");
              // State is authenticating, wait for callback
            }
          } catch (sdkAuthError) {
            if (!isMountedRef.current) return;
            if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
            failConnection(
              `Re-authentication failed: ${sdkAuthError instanceof Error ? sdkAuthError.message : String(sdkAuthError)}`,
              sdkAuthError instanceof Error ? sdkAuthError : undefined,
            );
          }
        }
        // Re-throw original error unless handled by re-auth redirect
        // @ts-expect-error
        if (stateRef.current !== "authenticating") {
          // Only re-throw if not waiting for redirect
          throw err;
        }
        // If authenticating, we might want to signal the caller differently,
        // but for now, we don't re-throw, assuming the UI will react to the 'authenticating' state.
        return undefined; // Or indicate auth required?
      }
    },
    [
      data.state,
      url,
      isLocal,
      usesTokenAuth,
      serverName,
      addLog,
      failConnection,
      handleAuthTimeout,
      connect,

      stateRef,
      clientRef,
      authProviderRef,
      connectingRef,
      authTimeoutRef,
      isMountedRef,
    ], // Depends on state for error message, url, and stable callbacks
  );

  // retry is stable (depends on stable addLog, connect)
  const retry = useCallback(() => {
    // Use stateRef for check
    if (stateRef.current === "failed") {
      addLog("info", "Retry requested...");
      // connect() will handle resetting state and error internally
      connect();
    } else {
      addLog(
        "warn",
        `Retry called but state is not 'failed' (state: ${stateRef.current}). Ignoring.`,
      );
    }
  }, [addLog, connect, stateRef]); // Depends only on stable callbacks

  // authenticate is stable (depends on stable addLog, retry, connect)
  const authenticate = useCallback(async () => {
    addLog("info", "Manual authentication requested...");
    const currentState = stateRef.current; // Use ref
    const fetchMcpProxy = isLocal ? fetch : fetchMcpProxyCb;

    if (currentState === "failed") {
      addLog("info", "Attempting to reconnect and authenticate via retry...");
      retry();
    } else if (currentState === "pending_auth") {
      addLog("info", "Proceeding with authentication from pending state...");
      dispatch({ state: "authenticating" });
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = setTimeout(() => {
        handleAuthTimeout();
      }, AUTH_TIMEOUT);

      try {
        assert(authProviderRef.current, "Auth Provider not available for manual auth");
        const authResult = await auth(authProviderRef.current, {
          serverUrl: url,
          fetchFn: fetchMcpProxy,
        });

        if (!isMountedRef.current) return;

        if (authResult === "AUTHORIZED") {
          addLog(
            "info",
            "Manual authentication successful. Re-attempting connection...",
          );
          if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
          connectingRef.current = false;
          connect(); // Restart full connection sequence
        } else if (authResult === "REDIRECT") {
          addLog(
            "info",
            "Redirecting for manual authentication. Waiting for callback...",
          );
          // State is already authenticating, wait for callback
        }
      } catch (authError) {
        if (!isMountedRef.current) return;
        if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
        failConnection(
          `Manual authentication failed: ${authError instanceof Error ? authError.message : String(authError)}`,
          authError instanceof Error ? authError : undefined,
        );
      }
    } else if (currentState === "authenticating") {
      addLog(
        "warn",
        "Already attempting authentication. Check for blocked popups or wait for timeout.",
      );
      const manualUrl = authProviderRef.current?.getLastAttemptedAuthUrl();
      if (manualUrl && !data.authUrl) {
        // Use component state `authUrl` here
        dispatch({ authUrl: manualUrl });
        addLog("info", "Manual authentication URL retrieved:", manualUrl);
      }
    } else {
      addLog(
        "info",
        `Client not in a state requiring manual authentication trigger (state: ${currentState}). If needed, try disconnecting and reconnecting.`,
      );
      // Optionally, force re-auth even if ready?
      // addLog('info', 'Forcing re-authentication...');
      // setState('authenticating');
      // assert(authProviderRef.current, "Auth Provider not available");
      // auth(authProviderRef.current, { serverUrl: url }).catch(failConnection);
    }
  }, [
    addLog,
    retry,
    data.authUrl,
    url,
    isLocal,
    failConnection,
    handleAuthTimeout,
    connect,

    stateRef,
    clientRef,
    authProviderRef,
    connectingRef,
    authTimeoutRef,
    isMountedRef,
  ]); // Depends on stable callbacks and authUrl state

  // clearStorage is stable (depends on stable addLog, disconnect)
  const clearStorage = useCallback(() => {
    if (authProviderRef.current) {
      const count = authProviderRef.current.clearStorage();
      addLog("info", `Cleared ${count} item(s) from localStorage for ${url}.`);
      dispatch({ authUrl: undefined }); // Clear manual URL state
      // Disconnect should reset state appropriately
      disconnect();
    } else {
      addLog("warn", "Auth provider not initialized, cannot clear storage.");
    }
  }, [url, authProviderRef, addLog, disconnect]); // Depends on url and stable callbacks

  // listResources is stable (depends on stable addLog)
  const listResources = useCallback(async () => {
    const state = data.state; // Use current state from data
    // Use stateRef for check, state for throwing error message
    if (stateRef.current !== "ready" || !clientRef.current) {
      throw new Error(
        `MCP client is not ready (current state: ${state}). Cannot list resources.`,
      );
    }
    addLog("info", "Listing resources...");
    try {
      const resourcesResponse = await clientRef.current.request(
        { method: "resources/list" },
        ListResourcesResultSchema,
      );
      if (isMountedRef.current) {
        dispatch({
          resources: resourcesResponse.resources,
          resourceTemplates: Array.isArray(resourcesResponse.resourceTemplates)
            ? resourcesResponse.resourceTemplates
            : [],
        });
        addLog(
          "info",
          `Listed ${resourcesResponse.resources.length} resources, ${Array.isArray(resourcesResponse.resourceTemplates) ? resourcesResponse.resourceTemplates.length : 0} resource templates.`,
        );
      }
    } catch (err) {
      addLog(
        "error",
        `Error listing resources: ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
      throw err;
    }
  }, [data.state, addLog]); // Depends on state for error message and stable addLog

  // readResource is stable (depends on stable addLog)
  const readResource = useCallback(
    async (uri: string) => {
      const state = data.state; // Use current state from data
      // Use stateRef for check, state for throwing error message
      if (stateRef.current !== "ready" || !clientRef.current) {
        throw new Error(
          `MCP client is not ready (current state: ${state}). Cannot read resource "${uri}".`,
        );
      }
      addLog("info", `Reading resource: ${uri}`);
      try {
        const result = await clientRef.current.request(
          { method: "resources/read", params: { uri } },
          ReadResourceResultSchema,
        );
        addLog("info", `Resource "${uri}" read successfully`);
        return result;
      } catch (err) {
        addLog(
          "error",
          `Error reading resource "${uri}": ${err instanceof Error ? err.message : String(err)}`,
          err,
        );
        throw err;
      }
    },
    [data.state, addLog, stateRef, clientRef],
  ); // Depends on state for error message and stable addLog

  // listPrompts is stable (depends on stable addLog)
  const listPrompts = useCallback(async () => {
    const state = data.state; // Use current state from data
    // Use stateRef for check, state for throwing error message
    if (stateRef.current !== "ready" || !clientRef.current) {
      throw new Error(
        `MCP client is not ready (current state: ${state}). Cannot list prompts.`,
      );
    }
    addLog("info", "Listing prompts...");
    try {
      const promptsResponse = await clientRef.current.request(
        { method: "prompts/list" },
        ListPromptsResultSchema,
      );
      if (isMountedRef.current) {
        dispatch({ prompts: promptsResponse.prompts });
        addLog("info", `Listed ${promptsResponse.prompts.length} prompts.`);
      }
    } catch (err) {
      addLog(
        "error",
        `Error listing prompts: ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
      throw err;
    }
  }, [data.state, addLog, stateRef, isMountedRef, clientRef]); // Depends on state for error message and stable addLog

  // getPrompt is stable (depends on stable addLog)
  const getPrompt = useCallback(
    async (name: string, args?: Record<string, string>) => {
      const state = data.state; // Use current state from data
      // Use stateRef for check, state for throwing error message
      if (stateRef.current !== "ready" || !clientRef.current) {
        throw new Error(
          `MCP client is not ready (current state: ${state}). Cannot get prompt "${name}".`,
        );
      }
      addLog("info", `Getting prompt: ${name}`, args);
      try {
        const result = await clientRef.current.request(
          { method: "prompts/get", params: { name, arguments: args } },
          GetPromptResultSchema,
        );
        addLog("info", `Prompt "${name}" retrieved successfully`);
        return result;
      } catch (err) {
        addLog(
          "error",
          `Error getting prompt "${name}": ${err instanceof Error ? err.message : String(err)}`,
          err,
        );
        throw err;
      }
    },
    [data.state, addLog, clientRef, stateRef],
  ); // Depends on state for error message and stable addLog

  // ===== Effects =====

  // Effect for handling auth callback messages from popup (Stable dependencies)
  useEffect(() => {
    const broadcastChannel = data.broadcastChannel;
    if (!broadcastChannel) return;

    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "mcp_auth_callback") {
        addLog("info", "Received auth callback message.", event.data);
        if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);

        if (event.data.success) {
          useThemeStore.getState().setMcpAuthPopup(null);
          addLog("info", "Authentication successful via popup. Reconnecting client...");
          connectingRef.current = false;
          connect(); // Call stable connect
        } else {
          failConnection(
            `Authentication failed in callback: ${event.data.error || "Unknown reason."}`,
          ); // Call stable failConnection
        }
      }
    };
    broadcastChannel.addEventListener("message", messageHandler);
    addLog("debug", "Auth callback message listener added.");
    return () => {
      if (!broadcastChannel) return;
      broadcastChannel.removeEventListener("message", messageHandler);
      addLog("debug", "Auth callback message listener removed.");
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    };
    // Dependencies are stable callbacks
  }, [data.broadcastChannel, addLog, failConnection, connect]);

  // Initial Connection (depends on config and stable callbacks)
  useEffect(() => {
    /* ... as before, calls stable connect/disconnect ... */
    isMountedRef.current = true;
    addLog("debug", "useMcp mounted, initiating connection.");
    connectAttemptRef.current = 0;
    // Initialize provider here if needed
    if (!authProviderRef.current || authProviderRef.current.serverUrl !== url) {
      const left = window.screenX + (window.innerWidth - 600) / 2;
      const top = window.screenY + (window.innerHeight - 600) / 2;
      authProviderRef.current = new BrowserOAuthClientProvider(url, {
        storageKeyPrefix,
        serverName,
        clientName,
        clientUri,
        callbackUrl,
        preventAutoAuth: true,
        popupFeatures: `${popupFeatures},left=${left},top=${top}`,
        onPopupWindow,
      });
      addLog(
        "debug",
        "BrowserOAuthClientProvider initialized/updated on mount/option change.",
      );
      dispatch({ broadcastChannel: new BroadcastChannel(`mcp-auth-${url}`) });
    }
    connect(); // Call stable connect
    return () => {
      isMountedRef.current = false;
      addLog("debug", "useMcp unmounting, disconnecting.");
      disconnect(true); // Call stable disconnect
    };
  }, [
    url,
    storageKeyPrefix,
    callbackUrl,
    serverName,
    clientName,
    clientUri,
    clientConfig.name,
    clientConfig.version,
    connect,
    disconnect, // Stable callbacks
    isMountedRef,
    connectAttemptRef,
    authProviderRef,
  ]);

  // Auto-Retry (depends on state, config, stable callbacks)
  useEffect(() => {
    let retryTimeoutId: NodeJS.Timeout | null = null;
    // Use state directly here, as this effect *should* run when state changes to 'failed'
    if (data.state === "failed" && autoRetry && connectAttemptRef.current > 0) {
      const delay = typeof autoRetry === "number" ? autoRetry : DEFAULT_RETRY_DELAY;
      addLog("info", `Connection failed, auto-retrying in ${delay}ms...`);
      retryTimeoutId = setTimeout(() => {
        // Check mount status and state again before retrying
        if (isMountedRef.current && stateRef.current === "failed") {
          retry(); // Call stable retry
        }
      }, delay);
    }
    return () => {
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
    };
    // Depends on state (to trigger), autoRetry config, and stable retry/addLog callbacks
  }, [data.state === "failed", autoRetry, retry, addLog]);

  // --- Return Public API ---
  return {
    state: data.state,
    tools: data.tools,
    resources: data.resources,
    resourceTemplates: data.resourceTemplates,
    prompts: data.prompts,
    error: data.error,
    log: data.log,
    authUrl: data.authUrl,
    callTool,
    listResources,
    readResource,
    listPrompts,
    getPrompt,
    retry,
    disconnect,
    authenticate,
    clearStorage,
  } as UseMcpResult;
}
