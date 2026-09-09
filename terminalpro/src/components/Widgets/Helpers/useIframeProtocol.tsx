import isEqual from "lodash.isequal";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import { getConfig } from "~/lib/runtimeConfig";
import { convertHeadersToRecord } from "~/lib/utils/widgetParams";
import {
  isWidgetParamMessageType,
  type OpenBBAuthMessage,
  OpenBBConnectMessageSchema,
  type OpenBBDataMessage,
  OpenBBDataMessageSchema,
  OpenBBErrorMessageSchema,
  type OpenBBParamDef,
  type OpenBBParamsUpdateMessage,
  type OpenBBRequestMessage,
  type OpenBBWidgetManifest,
  parseIframeParamsMessage,
  stringifyParamValue,
} from "~/types/iframeProtocol";

const REQUEST_TIMEOUT_MS = 10_000;

interface UseIframeProtocolOptions {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onAiData?: (data: string) => void;
  onParamsUpdate?: (params: Record<string, string>) => void;
}

const getIframeOrigin = (iframeRef: React.RefObject<HTMLIFrameElement | null>) => {
  try {
    return new URL(iframeRef.current?.src ?? "").origin;
  } catch {
    return null;
  }
};

type PendingRequest = {
  resolve: (msg: OpenBBDataMessage) => void;
  reject: (err: Error) => void;
};

export function useIframeProtocol(params: UseIframeProtocolOptions) {
  const { iframeRef, onAiData, onParamsUpdate } = params;
  const [state, dispatch] = useStateReducer({
    manifest: null as OpenBBWidgetManifest[] | null,
    paramDefs: null as OpenBBParamDef[] | null,
  });
  const authHeaders = useWidgetContext()?.widget?.endpoint?.headers;

  const pendingRequestsRef = useRef<Map<string, PendingRequest>>(new Map());

  // Store the actual source window from the handshake message.
  // Needed because iframes like Streamlit nest content in sub-iframes,
  // so event.source won't be iframeRef.current.contentWindow.
  const bridgeSourceRef = useRef<MessageEventSource | null>(null);
  // Store the origin from the handshake to scope outgoing postMessage calls.
  const bridgeOriginRef = useRef<string>("*");

  const isFromIframe = useCallback(
    (event: MessageEvent) => {
      if (event.source === iframeRef.current?.contentWindow) return true;
      if (bridgeSourceRef.current && event.source === bridgeSourceRef.current)
        return true;

      const iframeOrigin = getIframeOrigin(iframeRef);
      if (iframeOrigin && event.origin === iframeOrigin) return true;

      return false;
    },
    [iframeRef, bridgeSourceRef],
  );

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const { data } = event;
      if (!data?.type) return;

      const isOpenBBMessage =
        data.type === "openbb-connect" ||
        data.type === "openbb-data" ||
        data.type === "openbb-error" ||
        data.type === "aiData" ||
        isWidgetParamMessageType(data.type);
      if (!isOpenBBMessage) return;

      const fromIframe = isFromIframe(event);

      console.debug("[iframe-protocol] message received", {
        type: data.type,
        fromIframe,
        origin: event.origin,
      });

      if (!fromIframe) return;

      if (data.type === "openbb-connect") {
        const parsed = OpenBBConnectMessageSchema.safeParse(data);
        if (!parsed.success) {
          console.warn(
            "[iframe-protocol] invalid openbb-connect message — check your widget manifest.",
            parsed.error.issues,
          );
          return;
        }
        const msg = parsed.data;
        bridgeSourceRef.current = event.source;
        bridgeOriginRef.current = event.origin || "*";
        console.debug(
          "[iframe-protocol] handshake received, widgets:",
          msg.widgets,
          "params:",
          msg.params,
        );

        const stateUpdates = { manifest: msg.widgets, paramDefs: msg.params ?? null };

        dispatch((prev) => {
          if (!isEqual(prev, stateUpdates)) {
            return stateUpdates;
          }
          return prev;
        });

        const { headers } = convertHeadersToRecord(authHeaders);
        const iframeOrigin = getIframeOrigin(iframeRef);
        if (Object.keys(headers).length > 0 && event.origin === iframeOrigin) {
          const message: OpenBBAuthMessage = { type: "openbb-auth", headers };
          (event.source as Window).postMessage(message, event.origin);
          console.debug("[iframe-protocol] sent openbb-auth to", event.origin);
        }
        return;
      }

      if (data.type === "openbb-data") {
        const parsed = OpenBBDataMessageSchema.safeParse(data);
        if (!parsed.success) {
          console.warn(
            "[iframe-protocol] invalid openbb-data message — check your data response shape.",
            parsed.error.issues,
          );
          return;
        }
        const msg = parsed.data;
        console.debug("[iframe-protocol] data received for widget:", msg.widgetId);
        const pending = pendingRequestsRef.current.get(msg.widgetId);
        if (pending) {
          pendingRequestsRef.current.delete(msg.widgetId);
          pending.resolve(msg);
        }
        return;
      }

      if (data.type === "openbb-error") {
        const parsed = OpenBBErrorMessageSchema.safeParse(data);
        if (!parsed.success) {
          console.warn(
            "[iframe-protocol] invalid openbb-error message.",
            parsed.error.issues,
          );
          return;
        }
        const msg = parsed.data;
        console.debug(
          "[iframe-protocol] error received for widget:",
          msg.widgetId,
          msg.error,
        );
        const pending = pendingRequestsRef.current.get(msg.widgetId);
        if (pending) {
          pendingRequestsRef.current.delete(msg.widgetId);
          pending.reject(new Error(msg.error));
        }
        return;
      }

      if (data.type === "aiData") {
        console.debug("[iframe-protocol] aiData received");
        onAiData?.(JSON.stringify(data.data));
        return;
      }

      if (isWidgetParamMessageType(data.type)) {
        const parsed = parseIframeParamsMessage(data);
        if (!parsed) return;
        const params = Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [k, stringifyParamValue(v)]),
        );
        if (Object.keys(params).length > 0) {
          console.debug("[iframe-protocol] params update received", params);
          onParamsUpdate?.(params);
        }
      }
    },
    [
      isFromIframe,
      onAiData,
      onParamsUpdate,
      iframeRef,
      bridgeSourceRef,
      bridgeOriginRef,
      pendingRequestsRef,
      authHeaders,
    ],
  );

  useEffect(() => {
    if (!getConfig().data.allowHtmlJsExecution) {
      console.debug("[iframe-protocol] disabled, skipping listener setup");
      return;
    }

    const ctrl = new AbortController();
    console.debug("[iframe-protocol] listener active, waiting for messages");
    window.addEventListener("message", handleMessage, { signal: ctrl.signal });

    return () => {
      ctrl?.abort();
      bridgeSourceRef.current = null;
      bridgeOriginRef.current = "*";
    };
  }, [handleMessage, bridgeSourceRef, bridgeOriginRef]);

  const requestWidgetData = useCallback(
    (widgetId: string): Promise<OpenBBDataMessage> => {
      return new Promise((resolve, reject) => {
        // Prefer the stored bridge source (handles nested iframes)
        const target = bridgeSourceRef.current ?? iframeRef.current?.contentWindow;
        if (!target) {
          reject(new Error("Iframe not available"));
          return;
        }

        pendingRequestsRef.current.set(widgetId, { resolve, reject });

        const message: OpenBBRequestMessage = {
          type: "openbb-request",
          widgetId,
        };
        (target as Window).postMessage(message, bridgeOriginRef.current);

        console.debug("[iframe-protocol] sent openbb-request for:", widgetId);

        setTimeout(() => {
          const pending = pendingRequestsRef.current.get(widgetId);
          if (pending) {
            pendingRequestsRef.current.delete(widgetId);
            pending.reject(new Error(`Request for widget "${widgetId}" timed out`));
          }
        }, REQUEST_TIMEOUT_MS);
      });
    },
    [iframeRef, bridgeSourceRef, bridgeOriginRef, pendingRequestsRef],
  );

  const sendParamsUpdate = useCallback(
    (params: Record<string, string>) => {
      const target = bridgeSourceRef.current ?? iframeRef.current?.contentWindow;
      if (!target) return;

      const message: OpenBBParamsUpdateMessage = {
        type: "openbb-params-update",
        params,
      };
      (target as Window).postMessage(message, bridgeOriginRef.current);
      console.debug("[iframe-protocol] sent openbb-params-update", params);
    },
    [iframeRef, bridgeSourceRef, bridgeOriginRef],
  );

  return useMemo(
    () => ({
      manifest: state.manifest,
      paramDefs: state.paramDefs,
      requestWidgetData,
      sendParamsUpdate,
    }),
    [state.manifest, state.paramDefs, requestWidgetData, sendParamsUpdate],
  );
}
