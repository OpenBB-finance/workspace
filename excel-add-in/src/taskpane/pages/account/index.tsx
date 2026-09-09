import clsx from "clsx";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import OPENBB_SANDBOX_WIDGETS from "~/assets/openbb-sandbox-widgets.json";
import { getUserProfile, getWidgetDefinitionMap } from "~/backend";
import { ADDIN_FUNCS_SUFFIX, OPENBB_SANDBOX_ID } from "~/constants";
import { isEmpty } from "~/functions/fetcher/utils";
import { useAuthStore } from "~/store/auth";
import { useCustomBackendsStore } from "~/store/custom.backends";
import Icon from "~/taskpane/components/Icon.tsx";
import Layout from "~/taskpane/components/layout.tsx";
import Tooltip from "~/taskpane/components/Tooltip.tsx";
import { Backend, User } from "~/types/user.types";
import { BackendsMap, WidgetDefinition } from "~/types/widget.types";
import { usePrivateRoute } from "~/utils/router";

type AccountProps = {
  user: User;
};

function Account({ user }: AccountProps) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <Icon className="size-4 min-w-4 text-light-blue-400" id="user-icon" />
        <div className="text-grey-400 body-sm-regular">
          {user?.username || user?.email}
        </div>
      </div>
    </div>
  );
}

function copyToClipboardFallback(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed"; // Avoid scrolling
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const successful = document.execCommand("copy");
    console.log(
      "Fallback: Copy command was " +
        (successful ? "successful" : "unsuccessful"),
    );
  } catch (err) {
    console.error("Fallback: Unable to copy", err);
  }

  document.body.removeChild(textarea);
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext)
    return navigator.clipboard.writeText(text).catch((err) => {
      console.warn("Clipboard API failed, falling back", err);
      copyToClipboardFallback(text);
    });
  else copyToClipboardFallback(text);
}

function CopyFormulaButton({
  backend,
  widget,
}: {
  backend: Backend;
  widget: WidgetDefinition;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      const backendName = backend.name;
      const widgetName = widget.name;
      const params = (widget?.params ?? []).reduce(
        (acc, p) => {
          if (!p.show) return acc;

          const pValue =
            p.type === "text" || p.type === "ticker" || p.type === "date"
              ? `"${
                  p.value === undefined || p.value === null ? "???" : p.value
                }"`
              : p.value;
            
          if (pValue !== undefined) acc[p.paramName] = pValue;
          return acc;
        },
        {} as Record<string, string | number | boolean>,
      );
      const paramDelimiter = ",";
      const rowDelimiter = ";";
      const widgetParams = Object.entries(params ?? {})
        .map(([key, value]) => `"${key}"${paramDelimiter}${value}`)
        .join(rowDelimiter);

      const widgetParamsArray = widgetParams ? `{${widgetParams}}` : "";
      const func = `=OBB.${ADDIN_FUNCS_SUFFIX}WIDGET("${backendName}"${paramDelimiter}"${widgetName}"${paramDelimiter}${widgetParamsArray})`;
      await copyToClipboard(func);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (error) {
      console.error("❌ Failed to copy backend URL to clipboard:", error);
    }
  };

  return (
    <Tooltip position="top" align="end" message="Copy formula to clipboard">
      <button onClick={handleCopy}>
        <Icon
          className={clsx(
            "h-[14px] w-[14px]",
            copied ? "text-green-500" : "text-grey-400 hover:text-white",
          )}
          id={copied ? "checkmark-icon" : "clipboard-check"}
        />
      </button>
    </Tooltip>
  );
}

function InfoButton({ widget }: { widget: WidgetDefinition }) {
  return (
    <Tooltip
      position="top"
      align="end"
      message={
        <div className="min-w-48 custom-scrollbar max-h-40 max-w-xs space-y-2 overflow-y-auto rounded-md p-2">
          <div className="text-sm font-medium text-grey-100">{widget.name}</div>
          <div className="text-xs text-grey-400">{widget.widgetId}</div>
          <hr className="my-2 border-t border-dark-400" />
          <div className="whitespace-pre-wrap break-words text-xs text-grey-400">
            {widget.description}
          </div>
        </div>
      }
    >
      <button type="button">
        <Icon
          id="info-outline-circle"
          className="text-grey-400 hover:text-white"
        />
      </button>
    </Tooltip>
  );
}

type BackendState = {
  expanded: boolean;
  status: "success" | "stale" | "error" | undefined;
};

type WidgetState = {
  parametersExpanded: boolean;
};

function initBackendsState(
  backends: Backend[], 
  getBackendWidgets: (id: string) => any
): Record<string, BackendState> {
  return backends.reduce((acc, backend) => {
    let status: BackendState["status"];
    
    if (backend.id === OPENBB_SANDBOX_ID) {
      status = "success";
    } else {
      // If backend has cached widgets, mark as "stale" (connected but not tested)
      // If no cached widgets, mark as undefined (not connected)
      status = getBackendWidgets(backend.id) ? "stale" : undefined;
    }
    
    acc[backend.id] = {
      expanded: false,
      status,
    };
    return acc;
  }, {});
}

function Backends() {
  const { update: updateAuthStore, getBackends } = useAuthStore();
  const { getBackendWidgets, update: updateCustomBackendsStore } =
    useCustomBackendsStore();
  const customBackends = getBackends();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [backendsState, setBackendsState] = useState(
    initBackendsState(customBackends, getBackendWidgets),
  );
  const [widgetsState, setWidgetsState] = useState<Record<string, WidgetState>>({});
  const [showNotConnected, setShowNotConnected] = useState(false);

  // Auto-refresh backend connections when user views this page
  useEffect(() => {
    handleRefresh();
  }, []);

  function toggleBackend(backendId: string) {
    setBackendsState((prevState) => ({
      ...prevState,
      [backendId]: {
        ...prevState[backendId],
        expanded: !prevState[backendId]?.expanded,
      },
    }));
  }

  function toggleWidgetParameters(widgetId: string) {
    setWidgetsState((prevState) => ({
      ...prevState,
      [widgetId]: {
        parametersExpanded: !prevState[widgetId]?.parametersExpanded,
      },
    }));
  }

  async function handleRefresh() {
    try {
      const profile = await getUserProfile();
      updateAuthStore({ profile });
      console.log("🔄 User profile refreshed with success");
    } catch (error) {
      if (error?.response?.status === 401) {
        console.log("🚫 User token is not valid.");
        return;
      }
      console.log("❌ Error getting user profile:", error);
    }

    try {
      const results = await Promise.all(
        customBackends.map(async (backend) => {
          if (backend.id === OPENBB_SANDBOX_ID)
            return { [OPENBB_SANDBOX_ID]: OPENBB_SANDBOX_WIDGETS };
          try {
            const widgetDefinitionMap = await getWidgetDefinitionMap(backend);
            if (isEmpty(widgetDefinitionMap))
              throw new Error(`Widget not found for backend: ${backend.name}`);
            return { [backend.id]: widgetDefinitionMap };
          } catch (error) {
            console.log(
              `❌ Error connecting to custom backend ${backend.name}:`,
              error,
            );
            return { [backend.id]: null };
          }
        }),
      );
      const merged = Object.assign(
        {},
        ...results.filter((result) => Object.values(result)[0] !== null),
      ) as BackendsMap;
      updateCustomBackendsStore(merged);
      setBackendsState((prevState) => {
        const newState = { ...prevState };
        results.forEach((result) => {
          const [backendId, incomingWidgets] = Object.entries(result)[0];
          const cachedWidgets = getBackendWidgets(backendId);
          const status = incomingWidgets
            ? "success"
            : cachedWidgets
            ? "stale"
            : "error";
          if (newState[backendId]) {
            newState[backendId].status = status;
          } else {
            newState[backendId] = { expanded: false, status };
          }
        });
        return newState;
      });
    } catch (error) {
      console.error("❌ Error fetching custom backends:", error);
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-4 min-w-4 text-light-blue-400" id="grid-01" />
          <h4 className="font-medium">Backends</h4>
        </div>
        <button
          className="_btn-outlined"
          onClick={async () => {
            setIsRefreshing(true);
            await handleRefresh();
            setIsRefreshing(false);
          }}
        >
          <Icon
            id="refresh-right"
            className={clsx({
              "animate-spin": isRefreshing,
            })}
          />
        </button>
      </div>
      <ul className="custom-scrollbar mt-3 flex flex-col gap-1 overflow-y-auto rounded-sm py-2 body-sm-regular">
        {customBackends.length === 0 ? (
          <li className="text-grey-400">No backends found.</li>
        ) : (
          <>
            {customBackends
              .filter((backend) => {
                const backendState = backendsState[backend.id];
                return backendState?.status === "success" || backendState?.status === "stale";
              })
              .map((backend: Backend) => {
                const widgetsById = getBackendWidgets(backend.id);
                const backendState = backendsState[backend.id];
                return (
                  <li key={backend.id}>
                    <button
                      type="button"
                      className={clsx(
                        "flex w-full items-center justify-between rounded-sm bg-dark-750 px-1.5 py-1",
                        {
                          "cursor-pointer hover:bg-dark-600 ": !!widgetsById,
                          "opacity-50": !widgetsById,
                        },
                      )}
                      onClick={() => widgetsById && toggleBackend(backend.id)}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                        <Icon
                          className="size-4 min-w-4 shrink-0 text-white"
                          id={
                            widgetsById
                              ? backendState?.expanded
                                ? "chevron-down"
                                : "chevron-right"
                              : "_"
                          }
                        />
                        <div className="ml-1 flex flex-col items-start overflow-hidden">
                          <p className="shrink-0 whitespace-nowrap">
                            {backend.name}
                          </p>
                          <Tooltip message={backend.url}>
                            <p className="max-w-full truncate whitespace-nowrap text-grey-400">
                              {backend.url}
                            </p>
                          </Tooltip>
                        </div>
                      </div>
                      <Tooltip
                        message={
                          backendState?.status === "error"
                            ? "Connection failed, no backends found - see the console logs for more information."
                            : backendState?.status === "stale"
                            ? "Connection stale, using cached data - see the console logs for more information."
                            : backendState?.status === "success"
                            ? "Connection successful."
                            : "Click the refresh button to update your backends."
                        }
                      >
                        <span
                          className={clsx("ml-1 h-3 w-3 shrink-0 rounded-full", {
                            "bg-dark-500": !backendState?.status,
                            "bg-red-500": backendState?.status === "error",
                            "bg-green-500": backendState?.status === "success",
                            "bg-yellow-500": backendState?.status === "stale",
                          })}
                        />
                      </Tooltip>
                    </button>
                    {widgetsById && backendState?.expanded && (
                      <ul className="custom-scrollbar my-1 flex max-h-120 cursor-pointer flex-col gap-1 overflow-y-auto overflow-x-hidden">
                        {Object.entries(widgetsById).map(([widgetId, widget]) => {
                          const widgetParams = (widget.params ?? []).filter((p) => p.show);
                          const hasParameters = widgetParams.length > 0;
                          const isParametersExpanded = widgetsState[widgetId]?.parametersExpanded;
                          
                          return (
                            <li key={widgetId}>
                              <div className="ml-6 flex flex-col rounded-sm bg-dark-750 p-2 hover:bg-dark-600">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {hasParameters && (
                                      <button
                                        type="button"
                                        onClick={() => toggleWidgetParameters(widgetId)}
                                        className="shrink-0"
                                      >
                                        <Icon
                                          className="size-3 text-grey-400 hover:text-white"
                                          id={isParametersExpanded ? "chevron-down" : "chevron-right"}
                                        />
                                      </button>
                                    )}
                                    <Tooltip message={widget.name}>
                                      <p className="truncate">{widget.name}</p>
                                    </Tooltip>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <CopyFormulaButton
                                      backend={backend}
                                      widget={widget}
                                    />
                                    <InfoButton widget={widget} />
                                  </div>
                                </div>
                                <Tooltip message={widgetId}>
                                  <p className={clsx("shrink-0 truncate text-grey-400", {
                                    "ml-5": hasParameters,
                                    "ml-0": !hasParameters
                                  })}>
                                    {widgetId}
                                  </p>
                                </Tooltip>
                                {hasParameters && isParametersExpanded && (
                                  <div className="mt-2 ml-5 rounded-sm bg-dark-800 p-2">
                                    <ul className="space-y-2 text-xs">
                                      {widgetParams.map((p) => (
                                        <li key={p.paramName} className="flex flex-col">
                                          <span className="font-medium text-grey-200">{p.paramName}</span>
                                          {p?.description && (
                                            <p className="text-grey-400 mt-0.5">
                                              {p.description}
                                            </p>
                                          )}
                                          {p.value !== undefined && p.value !== null && (
                                            <p className="text-grey-400 mt-0.5">
                                              default: {String(p.value)}
                                            </p>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            {customBackends.some((backend) => {
              const backendState = backendsState[backend.id];
              return backendState?.status === "error" || !backendState?.status;
            }) && (
              <>
                <li className="mt-3">
                  <button
                    type="button"
                    className="flex items-center gap-2 mb-2 text-xs font-medium text-grey-400 hover:text-white"
                    onClick={() => setShowNotConnected(!showNotConnected)}
                  >
                    <Icon
                      className="size-3 text-grey-400"
                      id={showNotConnected ? "chevron-down" : "chevron-right"}
                    />
                    Not connected
                  </button>
                </li>
                {showNotConnected && customBackends
                  .filter((backend) => {
                    const backendState = backendsState[backend.id];
                    return backendState?.status === "error" || !backendState?.status;
                  })
                  .map((backend: Backend) => {
                    const backendState = backendsState[backend.id];
                    return (
                      <li key={backend.id}>
                        <div className="flex w-full items-center justify-between rounded-sm bg-dark-750 px-1.5 py-1 opacity-50">
                          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                            <Icon
                              className="size-4 min-w-4 shrink-0 text-white"
                              id="_"
                            />
                            <div className="ml-1 flex flex-col items-start overflow-hidden">
                              <p className="shrink-0 whitespace-nowrap">
                                {backend.name}
                              </p>
                              <Tooltip message={backend.url}>
                                <p className="max-w-full truncate whitespace-nowrap text-grey-400">
                                  {backend.url}
                                </p>
                              </Tooltip>
                            </div>
                          </div>
                          <Tooltip
                            message={
                              backendState?.status === "error"
                                ? "Connection failed, no backends found - see the console logs for more information."
                                : "Click the refresh button to update your backends."
                            }
                          >
                            <span
                              className={clsx("ml-1 h-3 w-3 shrink-0 rounded-full", {
                                "bg-dark-500": !backendState?.status,
                                "bg-red-500": backendState?.status === "error",
                              })}
                            />
                          </Tooltip>
                        </div>
                      </li>
                    );
                  })}
              </>
            )}
          </>
        )}
      </ul>
    </div>
  );
}

export default function Page() {
  usePrivateRoute();

  const { logout, user } = useAuthStore();

  function handleLogout() {
    logout();
  }

  return (
    <Layout>
      <div className="flex flex-col items-center justify-stretch">
        <div className="flex w-full items-center justify-between">
          <h1 className="w-full subtitle-md-bold">Account</h1>
          <Link to="/auth/login" onClick={handleLogout}>
            <button
              type="button"
              className="inline-flex h-6 items-center justify-center gap-2 rounded px-2 py-1 text-center text-xs transition duration-150 ease-out cursor-pointer text-grey-400 hover:text-white focus-visible:text-white disabled:cursor-not-allowed disabled:text-grey-400 disabled:hover:text-grey-400"
            >
              <Icon id="log-out-01" />
              Logout
            </button>
          </Link>
        </div>

        {user && (
          <>
            <Account user={user} />
            <div className="my-5" />
            <Backends />
          </>
        )}
      </div>
    </Layout>
  );
}
