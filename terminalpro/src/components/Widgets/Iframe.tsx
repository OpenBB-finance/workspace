import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useDebounceValue } from "usehooks-ts";
import DraggableCard from "~/components/DraggableCard";
import { useStateReducer } from "~/hooks/useStateReducer";
import { IFRAME_SANDBOX_ATTRIBUTES } from "~/lib/constants";
import {
  registerIframeWidget,
  unregisterIframeWidget,
} from "~/lib/iframeWidgetRegistry";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowMcpToolsStore } from "~/lib/state/mcpTools";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import { getServerName } from "~/lib/utils/mcp";
import { type urlForm, urlSchema } from "~/utils/zodForms";
import { Button } from "../ds/atoms/Button";
import { FormInput } from "../ds/atoms/Input";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogDescription, DialogHeader, DialogTitle } from "../ds/dialogs/Dialog";
import { Form, FormField } from "../ds/molecules/Form";
import SearchResultsNotFound from "../General/SearchResultsNotFound";
import { useWidgetParamsPositions } from "../General/Table/NavBar/QueryParams";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import { useWidgetContext } from "../Widget.context";
import { IframeMcpPopover } from "./Helpers/IframeMcpPopover";
import { IframeParamControls } from "./Helpers/IframeParamControls";
import { useIframeProtocol } from "./Helpers/useIframeProtocol";
import { useParamGroupBindings } from "./Helpers/useParamGroupBindings";

const allowJsExecution = getConfig().data.allowHtmlJsExecution;

function normalizeParamRecord(params?: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params ?? {})
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(String).join(",") : String(value),
      ]),
  );
}

/**
 * Shallow equality for the flat `{ paramName: stringValue }` records that the
 * iframe-protocol pipeline produces. Used to short-circuit storage writes and
 * postMessage sends when nothing changed. We don't use `lodash.isEqual` because
 * (a) every value here is already a string (no recursion needed) and (b) one
 * side may legitimately be `null` (no prior snapshot yet) which we treat as
 * "not equal" so the first sync always fires.
 */
function paramsEqual(a: Record<string, string> | null, b: Record<string, string>) {
  if (!a) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

function filterSupportedParams(
  params: Record<string, string>,
  supportedParamNames: Set<string> | null,
) {
  if (!supportedParamNames) return params;
  return Object.fromEntries(
    Object.entries(params).filter(([key]) => supportedParamNames.has(key)),
  );
}

const GROUP_BINDINGS_PARAMS = { endpointParamsOnly: true, filterAllowedParams: false };

type IframeState = {
  open: boolean;
  scale: number;
  url: string;
  pendingStorageUpdate: {
    iframeParams?: Record<string, string>;
    params?: Record<string, string>;
    paramsUpdate?: Record<string, string>;
  };
};

export default function Iframe() {
  const { widget, updateWidget, isShared, activeDashboardId } = useWidgetContext();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const widgetCount = useShallowAppStore(
    (state) => state.items?.[activeDashboardId]?.data?.widgets?.length ?? 0,
  );
  const { autoHideWidgetNavbar, theme } = useShallowThemeStore((s) => ({
    autoHideWidgetNavbar: s.autoHideWidgetNavbar,
    theme: s.theme,
  }));
  const shouldAutoHide = autoHideWidgetNavbar || widgetCount === 1;

  const endpointUrl =
    typeof widget.endpoint === "string"
      ? widget.endpoint
      : (widget.endpoint?.url ?? "");
  const hasManagedEndpoint = !!endpointUrl;

  const [state, dispatch] = useStateReducer<IframeState>(null, () => {
    const url = widget.storage?.html || endpointUrl || "";
    const initialUrl = urlSchema.safeParse({ url });
    return {
      open: false,
      scale: widget.storage?.scale || 1.0,
      url: initialUrl.success ? initialUrl.data.url : "",
      pendingStorageUpdate: {},
    };
  });

  useEffect(() => {
    if (endpointUrl && endpointUrl !== state.url) {
      const url = urlSchema.safeParse({ url: endpointUrl });
      if (url.success) dispatch({ url: url.data.url });
    }
  }, [endpointUrl]);

  const [debouncedPending] = useDebounceValue(state.pendingStorageUpdate, 1000, {
    trailing: true,
    maxWait: 2000,
  });
  const supportedIframeParamNamesRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const hasPendingStorageUpdate = Object.keys(state.pendingStorageUpdate).length > 0;

    if (hasPendingStorageUpdate) {
      updateWidget((prev) => {
        const newWidget = { ...prev };
        const { paramsUpdate, ...storageUpdate } = state.pendingStorageUpdate;

        for (const [key, value] of Object.entries(storageUpdate)) {
          newWidget.storage[key] = { ...(newWidget.storage?.[key] ?? {}), ...value };
        }

        if (paramsUpdate) {
          newWidget.storage = {
            ...newWidget.storage,
            iframeParams: filterSupportedParams(
              {
                ...(newWidget.storage?.iframeParams ?? {}),
                ...paramsUpdate,
              },
              supportedIframeParamNamesRef.current,
            ),
            params: filterSupportedParams(
              {
                ...(newWidget.storage?.params ?? {}),
                ...paramsUpdate,
              },
              supportedIframeParamNamesRef.current,
            ),
          };
        }
        return newWidget;
      });
      dispatch({ pendingStorageUpdate: {} });
    }
  }, [debouncedPending, supportedIframeParamNamesRef]);

  const form = useForm({
    resolver: zodResolver(urlSchema),
    defaultValues: { url: state.url },
  });

  const persistIframeParams = useCallback((params: Record<string, string>) => {
    if (Object.keys(params).length === 0) return;
    dispatch({
      pendingStorageUpdate: (prev) => ({
        ...prev,
        paramsUpdate: {
          ...(prev.paramsUpdate ?? {}),
          ...params,
        },
      }),
    });
  }, []);

  // [paramName, group] for each widget group that binds to a widget param.
  // Shared by `updateGroupedParams` (writes group.value back) and
  // `visibleParamDefs` (hides param controls already driven by a group).
  const { bindings, updateGroupedParams } =
    useParamGroupBindings(GROUP_BINDINGS_PARAMS);

  const groupedParams = useMemo(() => {
    return Object.fromEntries(
      bindings
        .filter(([, group]) => group.value !== undefined && group.value !== null)
        .map(([paramName, group]) => [
          paramName,
          Array.isArray(group.value)
            ? group.value.map(String).join(",")
            : String(group.value),
        ]),
    );
  }, [bindings]);
  const handleIframeParamsUpdate = useCallback(
    (params: Record<string, string>) => {
      persistIframeParams(params);
      updateGroupedParams(params);
    },
    [persistIframeParams, updateGroupedParams],
  );

  const protocolParams = useMemo(
    () => ({
      iframeRef,
      onParamsUpdate: handleIframeParamsUpdate,
    }),
    [iframeRef, handleIframeParamsUpdate],
  );

  const { manifest, paramDefs, requestWidgetData, sendParamsUpdate } =
    useIframeProtocol(protocolParams);
  const hasProtocol = (manifest?.length ?? 0) > 0;

  const { supportedIframeParamNames, visibleParamDefs } = useMemo(() => {
    if (!paramDefs) return { supportedIframeParamNames: null, visibleParamDefs: null };
    const widgetParamNames = new Set(widget.params.map((param) => param.paramName));

    return {
      supportedIframeParamNames: widgetParamNames.union(
        new Set([...paramDefs.map((param) => param.paramName), "theme"]),
      ),
      visibleParamDefs: paramDefs.filter(
        (param) => !widgetParamNames.has(param.paramName),
      ),
    };
  }, [paramDefs, widget.params]);

  // Mirror the memoized set into a ref so `persistIframeParams` can read the
  // latest value without taking it as a dep (which would rebuild the callback
  // every time params change).
  useEffect(() => {
    supportedIframeParamNamesRef.current = supportedIframeParamNames;
  }, [supportedIframeParamNames]);

  // Initialize storage params from defaults when paramDefs first arrive.
  // We read existing params from `prev.storage` inside the updater rather than
  // depending on `effectiveIframeParams`, so this effect only re-runs when the
  // actual trigger (`paramDefs`) changes. Sending the params to the iframe is
  // owned by the "send on change" effect below, which fires once the storage
  // update propagates.
  const paramDefsInitializedRef = useRef(false);
  useEffect(() => {
    if (supportedIframeParamNames) {
      const currentIframeParams = normalizeParamRecord(widget.storage?.iframeParams);
      const currentParams = normalizeParamRecord(widget.storage?.params);
      const nextIframeParams = filterSupportedParams(
        currentIframeParams,
        supportedIframeParamNames,
      );
      const nextParams = filterSupportedParams(
        currentParams,
        supportedIframeParamNames,
      );

      if (
        !(
          paramsEqual(currentIframeParams, nextIframeParams) &&
          paramsEqual(currentParams, nextParams)
        )
      ) {
        dispatch({
          pendingStorageUpdate: (prev) => ({
            ...prev,
            iframeParams: nextIframeParams,
            params: nextParams,
          }),
        });
      }
    }

    if (!paramDefs || paramDefs.length === 0 || paramDefsInitializedRef.current) return;
    paramDefsInitializedRef.current = true;

    const existing = {
      ...normalizeParamRecord(widget.storage?.iframeParams),
      ...normalizeParamRecord(widget.storage?.params),
    };
    const defaults: Record<string, string> = {};
    let hasNew = false;
    for (const p of paramDefs) {
      if (!(p.paramName in existing) && p.value !== undefined) {
        defaults[p.paramName] = p.value;
        hasNew = true;
      }
    }
    if (!hasNew) return;
    dispatch({
      pendingStorageUpdate: (prev) => ({
        ...prev,
        iframeParams: {
          ...(prev?.iframeParams ?? {}),
          ...defaults,
        },
        params: {
          ...(prev?.params ?? {}),
          ...defaults,
        },
      }),
    });
  }, [paramDefs, supportedIframeParamNames, paramDefsInitializedRef]);

  // Sync iframe params to the MCP server so Ada sees current selections
  const { mcpServerId, updateMcpServer, addMcpServer, removeMcpServer } =
    useShallowMcpToolsStore((s) => ({
      addMcpServer: s.addServer,
      updateMcpServer: s.updateServer,
      removeMcpServer: s.removeServer,
      mcpServerId:
        s.servers.find((srv) => srv.iframeWidgetId === widget.id)?.id ?? null,
    }));
  const mcpServerIdRef = useRef<string | null>(null);

  useEffect(() => {
    mcpServerIdRef.current = mcpServerId;
  }, [mcpServerId]);

  useEffect(() => {
    return () => {
      const serverId = mcpServerIdRef.current;
      if (serverId) removeMcpServer(serverId, { clearStorage: false });
    };
  }, [mcpServerIdRef]);

  // Auto-connect MCP server pre-configured via widgets.json (storage.mcpUrl)
  const storedMcpUrl = widget.storage?.mcpUrl?.trim();
  useEffect(() => {
    if (!storedMcpUrl || mcpServerId) return;
    addMcpServer({
      id: `iframe-mcp-${widget.id}`,
      name: widget.name || getServerName(storedMcpUrl),
      url: storedMcpUrl,
      enabled: true,
      tools: [],
      iframeWidgetId: widget.id,
      isLocal: storedMcpUrl.includes("localhost") || storedMcpUrl.includes("127.0.0.1"),
    });
  }, [storedMcpUrl, widget.id, widget.name, mcpServerId, addMcpServer]);

  useEffect(() => {
    if (!mcpServerId) return;
    updateMcpServer(mcpServerId, {
      name: widget.name || (storedMcpUrl ? getServerName(storedMcpUrl) : undefined),
      ...(storedMcpUrl
        ? {
            url: storedMcpUrl,
            isLocal:
              storedMcpUrl.includes("localhost") || storedMcpUrl.includes("127.0.0.1"),
          }
        : {}),
    });
  }, [mcpServerId, storedMcpUrl, updateMcpServer, widget.name]);

  const effectiveIframeParams = useMemo(() => {
    const iframeParams: Record<string, string> = widget.storage?.iframeParams ?? {};
    const widgetParams = normalizeParamRecord(widget.storage?.params);
    return { ...iframeParams, ...widgetParams, ...groupedParams, theme };
  }, [groupedParams, widget.storage?.iframeParams, theme, widget.storage?.params]);

  const prevIframeParamsRef = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    if (!(hasProtocol || mcpServerId)) return;
    if (paramsEqual(prevIframeParamsRef.current, effectiveIframeParams)) return;
    prevIframeParamsRef.current = effectiveIframeParams;
    if (hasProtocol) sendParamsUpdate(effectiveIframeParams);
    if (mcpServerId && Object.keys(effectiveIframeParams).length > 0)
      updateMcpServer(mcpServerId, { iframeParams: effectiveIframeParams });
  }, [effectiveIframeParams, mcpServerId, hasProtocol, prevIframeParamsRef]);

  const handleParamChange = useCallback(
    (paramName: string, value: string) => {
      const changedParams = { [paramName]: value };
      const effectiveIframeParams = prevIframeParamsRef.current || {};
      const updated = { ...effectiveIframeParams, ...changedParams };
      persistIframeParams(changedParams);
      updateGroupedParams(changedParams);
      sendParamsUpdate(updated);
    },
    [prevIframeParamsRef, persistIframeParams, sendParamsUpdate, updateGroupedParams],
  );

  const iframeSrc = useMemo(() => {
    if (!state.url) return "";
    const paramEntries = Object.entries(effectiveIframeParams);
    if (paramEntries.length === 0) return state.url;
    try {
      const url = new URL(state.url);
      for (const [key, val] of paramEntries) {
        url.searchParams.set(key, val);
      }
      return url.toString();
    } catch {
      return state.url;
    }
  }, [state.url, effectiveIframeParams]);

  const onOpenChange = useCallback((open: boolean) => dispatch({ open }), []);

  const onSubmit = useCallback(
    (values: urlForm) => {
      updateWidget((prev) => ({
        ...prev,
        storage: { ...prev.storage, html: values.url },
      }));
      dispatch({ open: false, url: values.url });
    },
    [updateWidget],
  );

  const handleScaleChange = useCallback(
    (newScale: number) => {
      updateWidget((prev) => ({
        ...prev,
        storage: { ...prev.storage, scale: newScale },
      }));
      dispatch({ scale: newScale });
    },
    [updateWidget],
  );

  const handleRefresh = useCallback(() => {
    updateWidget((prev) => ({ ...prev, refreshQuery: Date.now() }));
  }, [updateWidget]);

  useEffect(() => {
    if (!manifest || manifest.length === 0) return;
    registerIframeWidget(widget.id, {
      requestWidgetData,
      sendRefresh: handleRefresh,
      manifest,
    });
    return () => unregisterIframeWidget(widget.id);
  }, [widget.id, manifest, requestWidgetData, handleRefresh]);

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  return (
    <DraggableCard
      title={widget.name}
      aiEnabled={false}
      showAIContextButton={false}
      forceAutoHideNavbar={shouldAutoHide}
      extraNavbarElements={
        state.url ? (
          <IframeMcpPopover
            widgetId={widget.id}
            widgetName={widget.name}
            mcpUrl={storedMcpUrl}
          />
        ) : undefined
      }
      elementLeftOfTitle={
        state.url ? (
          <Tooltip message="Refresh">
            <button
              type="button"
              className="obb-small-navbar-btn"
              onClick={handleRefresh}
            >
              <Icon id="refresh-icon-ds" className="w-4 h-4" />
            </button>
          </Tooltip>
        ) : undefined
      }
      elementNextToTitle={
        state.url ? (
          <div className="flex items-center gap-1">
            {!hasManagedEndpoint && (
              <Button
                size="xs"
                variant="secondary"
                onClick={() => !isShared && dispatch({ open: true })}
                className={cn({ "cursor-default": isShared })}
              >
                <Icon id="edit-03" />
                <span
                  className="obb-hyper-link font-normal whitespace-nowrap truncate max-w-[400px]"
                  title={state.url}
                >
                  {state.url}
                </span>
              </Button>
            )}
            <div
              className="flex flex-shrink-0 items-center justify-center
              dark:bg-dark-750 bg-light-50 rounded"
            >
              <Tooltip message="Zoom Out">
                <button
                  type="button"
                  className="obb-small-navbar-btn"
                  onClick={() => handleScaleChange(Math.max(0.2, state.scale - 0.1))}
                  disabled={state.scale <= 0.2}
                >
                  <Icon id="minus-icon" className="w-4 h-4" />
                </button>
              </Tooltip>
              <span className="text-xs text-light-600 dark:text-white min-w-[45px] text-center">
                {Math.round(state.scale * 100)}%
              </span>
              <Tooltip message="Zoom In">
                <button
                  type="button"
                  className="obb-small-navbar-btn"
                  onClick={() => handleScaleChange(state.scale + 0.1)}
                >
                  <Icon id="plus-icon" className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          </div>
        ) : undefined
      }
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={
        <>
          {renderBelowNavbarRows}
          {visibleParamDefs && visibleParamDefs.length > 0 && (
            <div className="flex gap-1.5 px-2.5 my-1 overflow-y-hidden overflow-x-auto h-[22px] text-2xs">
              <IframeParamControls
                paramDefs={visibleParamDefs}
                values={effectiveIframeParams}
                onChange={handleParamChange}
              />
            </div>
          )}
        </>
      }
      extraClassName="p-0!"
    >
      <BaseDialog
        open={state.open}
        onOpenChange={onOpenChange}
        onClose={() => onOpenChange(false)}
      >
        <DialogHeader>
          <DialogTitle>Iframe</DialogTitle>
          <DialogDescription>
            Insert the iframe URL and if it's allowed, we will run it.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="w-full mx-auto md:w-[408px]"
          >
            <FormField
              name="url"
              render={({ field }) => (
                <FormInput
                  type="text"
                  label="URL"
                  placeholder="Enter the URL"
                  {...field}
                />
              )}
            />
            <div className="mt-6 flex justify-end gap-3">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outlined"
                type="button"
                size="sm"
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" size="sm">
                {state.url ? "Update" : "Submit"}
              </Button>
            </div>
          </form>
        </Form>
      </BaseDialog>
      {state.url ? (
        <div className="w-full h-full overflow-auto">
          <div
            className="w-full h-full"
            style={{
              transform: `scale(${state.scale})`,
              transformOrigin: "top left",
              width: `${100 / state.scale}%`,
              height: `${100 / state.scale}%`,
            }}
          >
            <iframe
              key={widget?.refreshQuery}
              ref={iframeRef}
              src={iframeSrc}
              width="100%"
              height="100%"
              sandbox={allowJsExecution ? IFRAME_SANDBOX_ATTRIBUTES : ""}
            />
          </div>
        </div>
      ) : (
        <SearchResultsNotFound
          firstMessage="No URL provided"
          secondMessage="You need to add a URL to your iframe widget. If embedding is allowed, we will run it."
          children={
            <Button
              onClick={() => onOpenChange(true)}
              variant="secondary"
              size="xs"
              className="mt-4"
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.5} id="plus" />
              Add URL
            </Button>
          }
        />
      )}
    </DraggableCard>
  );
}
