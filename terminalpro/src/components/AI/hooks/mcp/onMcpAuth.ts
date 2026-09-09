// callback.ts
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthMetadata } from "@modelcontextprotocol/sdk/shared/auth";
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { BrowserOAuthClientProvider } from "use-mcp";
import { fetchMcpProxyCb } from "~/components/AI/hooks/mcp/useMcp";

export interface StoredState {
  expiry: number;
  metadata?: OAuthMetadata; // Optional: might not be needed if auth() rediscovers
  serverUrlHash: string;
  // Add provider options needed on callback:
  providerOptions: {
    serverUrl: string;
    storageKeyPrefix: string;
    clientName: string;
    clientUri: string;
    callbackUrl: string;
    popupFeatures?: string;
  };
}

/**
 * Handles the OAuth callback using the SDK's auth() function.
 * Assumes it's running on the page specified as the callbackUrl.
 */
export async function onMcpAuthorization(queryParams: URLSearchParams) {
  const code = queryParams.get("code");
  const state = queryParams.get("state");
  const error = queryParams.get("error");
  const errorDescription = queryParams.get("error_description");

  const logPrefix = "[mcp-callback]"; // Generic prefix, or derive from stored state later
  console.log(`${logPrefix} Handling callback...`, {
    code,
    state,
    error,
    errorDescription,
  });

  let provider: BrowserOAuthClientProvider | null = null;
  let storedStateData: StoredState | null = null;
  let broadcastChannel: BroadcastChannel | null = null;

  const stateKey = state ? `mcp:auth:state_${state}` : null; // Reconstruct state key prefix assumption

  try {
    // --- Basic Error Handling ---
    if (error) {
      throw new Error(
        `OAuth error: ${error} - ${errorDescription || "No description provided."}`,
      );
    }
    if (!code) {
      throw new Error("Authorization code not found in callback query parameters.");
    }
    if (!(state && stateKey)) {
      throw new Error(
        "State parameter not found or invalid in callback query parameters.",
      );
    }

    // --- Retrieve Stored State & Provider Options ---
    const storedStateJSON = localStorage.getItem(stateKey);
    if (!storedStateJSON) {
      throw new Error(
        `Invalid or expired state parameter "${state}". No matching state found in storage.`,
      );
    }
    try {
      storedStateData = JSON.parse(storedStateJSON) as StoredState;
    } catch (e) {
      throw new Error("Failed to parse stored OAuth state.");
    }

    // Validate expiry
    if (!storedStateData.expiry || storedStateData.expiry < Date.now()) {
      localStorage.removeItem(stateKey); // Clean up expired state
      throw new Error(
        "OAuth state has expired. Please try initiating authentication again.",
      );
    }

    // Ensure provider options are present
    if (!storedStateData.providerOptions) {
      throw new Error("Stored state is missing required provider options.");
    }

    // Ensure we have a BroadcastChannel for communication
    broadcastChannel = new BroadcastChannel(
      `mcp-auth-${storedStateData.providerOptions.serverUrl}`,
    );
    const { serverUrl, ...providerOptions } = storedStateData.providerOptions;

    // --- Instantiate Provider ---
    console.log(`${logPrefix} Re-instantiating provider for server: ${serverUrl}`);
    provider = new BrowserOAuthClientProvider(serverUrl, providerOptions);

    // --- Call SDK Auth Function ---
    console.log(`${logPrefix} Calling SDK auth() to exchange code...`);
    // The SDK auth() function will internally:
    // 1. Use provider.clientInformation()
    // 2. Use provider.codeVerifier()
    // 3. Call exchangeAuthorization()
    // 4. Use provider.saveTokens() on success
    const getAuthResult = async (withProxy = false) => {
      const authResult = await auth(provider, {
        serverUrl,
        authorizationCode: code,
        fetchFn: withProxy ? fetchMcpProxyCb : undefined,
      });
      return authResult;
    };

    const authResult = await getAuthResult().catch(async (err) => {
      console.warn(
        `${logPrefix} Initial auth() attempt failed, possibly due to CORS. Retrying with proxy...`,
        err,
      );
      return await getAuthResult(true);
    });

    if (authResult === "AUTHORIZED") {
      console.log(
        `${logPrefix} Authorization successful via SDK auth(). Notifying opener...`,
      );
      // --- Notify Opener and Close (Success) ---
      broadcastChannel.postMessage({ type: "mcp_auth_callback", success: true });
      window.close();
      // Clean up state ONLY on success and after notifying opener
      localStorage.removeItem(stateKey);
    } else {
      // This case shouldn't happen if `authorizationCode` is provided to `auth()`
      console.warn(`${logPrefix} SDK auth() returned unexpected status: ${authResult}`);
      throw new Error(`Unexpected result from authentication library: ${authResult}`);
    }
  } catch (err) {
    console.error(`${logPrefix} Error during OAuth callback handling:`, err);
    const errorMessage = err instanceof Error ? err.message : String(err);

    // --- Notify Opener and Display Error (Failure) ---
    broadcastChannel?.postMessage({
      type: "mcp_auth_callback",
      success: false,
      error: errorMessage,
    });
    // Optionally close even on error, depending on UX preference
    // window.close();

    // Display error in the callback window
    try {
      document.body.innerHTML = `
            <div style="font-family: sans-serif; padding: 20px;">
            <h1>Authentication Error</h1>
            <p style="color: red; background-color: #ffebeb; border: 1px solid red; padding: 10px; border-radius: 4px;">
                ${errorMessage}
            </p>
            <p>You can close this window or <a href="#" onclick="window.close(); return false;">click here to close</a>.</p>
            <pre style="font-size: 0.8em; color: #555; margin-top: 20px; white-space: pre-wrap;">${
              err instanceof Error ? err.stack : ""
            }</pre>
            </div>
        `;
    } catch (displayError) {
      console.error(
        `${logPrefix} Could not display error in callback window:`,
        displayError,
      );
    }
    // Clean up potentially invalid state on error
    if (stateKey) {
      localStorage.removeItem(stateKey);
    }
    // Clean up potentially dangling verifier or last_auth_url if auth failed badly
    // Note: saveTokens should clean these on success
    if (provider) {
      localStorage.removeItem(provider.getKey("code_verifier"));
      localStorage.removeItem(provider.getKey("last_auth_url"));
    }
  }
}

export function useMcpAuthHandler() {
  const [searchParams] = useSearchParams();

  return useCallback(async () => {
    let error: Error | null = null;
    if (!searchParams.get("code")) return; // Not a callback URL
    try {
      await onMcpAuthorization(searchParams); // saves tokens
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
    }

    if (!error) window.close();
  }, [searchParams, searchParams.get("code")]);
}
