import { useCallback } from "react";
import type { ParamDef } from "~/components/types";
import type { StateDispatch } from "~/hooks/useStateReducer";
import type { FormState } from "../types";
import { analyzeDataForWidgetType } from "../utils";
import { useWidgetConfigContext } from "../WidgetConfigContext";

export function useEndpointTesting(
  state: FormState,
  dispatch: StateDispatch<FormState>,
) {
  const { updateWidgetConfig, getWidgetConfig } = useWidgetConfigContext((state) => ({
    updateWidgetConfig: state.updateWidgetConfig,
    getWidgetConfig: state.getWidgetConfig,
  }));

  const handleTestAndFetchData = useCallback(
    async (e: any) => {
      const endpoint = typeof e === "string" ? e : state.endpoint;
      dispatch({ isLoading: true, error: null, previewData: null });

      if (!endpoint.startsWith("http")) {
        return dispatch({ isLoading: false, error: "Invalid endpoint URL" });
      }

      const paramDefs = getWidgetConfig().params?.filter((p) => p.value);
      try {
        const { data, headers, contentType } = await testEndpoint(
          endpoint,
          state,
          paramDefs,
        );

        const widgetVizType = analyzeDataForWidgetType(data, contentType);
        updateWidgetConfig({ type: widgetVizType, endpoint, headers });

        dispatch({ previewData: data, error: null, lastTestedEndpoint: endpoint });
      } catch (error) {
        console.error("Error testing endpoint:", error);
        dispatch({
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch data from endpoint",
        });
      } finally {
        dispatch({ isLoading: false });
      }
    },
    [
      state.endpoint,
      state.authRequired,
      state.authHeaderKey,
      state.tokenBearer,
      dispatch,
      updateWidgetConfig,
      getWidgetConfig,
    ],
  );

  return handleTestAndFetchData;
}

export async function testEndpoint(
  endpoint: string,
  state?: Pick<FormState, "authRequired" | "authHeaderKey" | "tokenBearer">,
  paramDefs?: ParamDef[],
  method: "GET" | "POST" = "GET",
) {
  if (!endpoint.startsWith("http")) {
    throw new Error("Invalid endpoint URL");
  }

  const url = new URL(endpoint);
  if (method === "GET" && paramDefs?.length) {
    for (const param of paramDefs) {
      url.searchParams.append(param.paramName, param.value.toString());
    }
  }

  const headers: Record<string, string> = {};

  if (state?.authRequired && state?.authHeaderKey && state?.tokenBearer) {
    headers[state.authHeaderKey] = state.tokenBearer;
  }

  const response = await fetch(url, { method, headers });

  if (response.status === 405) {
    return await testEndpoint(endpoint, state, paramDefs, "POST");
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  let data: any;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else if (contentType.includes("text/")) {
    data = await response.text();
  } else {
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }
  }

  return { data, contentType, headers };
}
