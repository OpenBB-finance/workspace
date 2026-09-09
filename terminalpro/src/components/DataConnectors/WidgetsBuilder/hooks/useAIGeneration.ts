import { useCallback } from "react";
import { toast } from "sonner";
import { getAiApiUrl } from "~/lib/constants";
import { useShallowAuthStore } from "~/lib/state/auth";
import { testEndpoint } from "../utils";
import { useWidgetConfigContext } from "../WidgetConfigContext";

export function useAIGeneration() {
  const userToken = useShallowAuthStore((s) => s.user?.token);
  const context = useWidgetConfigContext((state) => ({
    getWidgetConfig: state.getWidgetConfig,
    updateWidgetConfig: state.updateWidgetConfig,
    getFormState: state.getFormState,
    dispatch: state.dispatchFormState,
  }));

  const handleGenerateWithAI = useCallback(
    async (e: any) => {
      e.stopPropagation();
      const state = context.getFormState();

      if (!state.endpoint.trim()) {
        toast.error("No endpoint configured", {
          description: "Please configure an endpoint first",
        });
        return;
      }

      if (!state.endpoint.startsWith("http")) {
        toast.error("Invalid endpoint URL", {
          description: "Endpoint must be a valid HTTP/HTTPS URL",
        });
        return;
      }

      context.dispatch({ isGeneratingWithAI: true });

      try {
        // First, fetch data from the widget endpoint

        // Get widget configuration to access params
        const widgetConfig = context.getWidgetConfig();
        const dataKey = widgetConfig.dataKey;
        const paramDefs = (widgetConfig.params ?? [])?.filter((p) => p.value);

        const { data } = await testEndpoint({
          endpoint: state.endpoint,
          state,
          paramDefs,
          dataKey,
        });

        // Now send the fresh data to the AI generation endpoint
        const requestPayload = {
          widget_generation_request: {
            widget_data: JSON.stringify(data),
            metadata: {
              name: widgetConfig.name,
              description: widgetConfig.description,
              type: widgetConfig.type,
              category: widgetConfig.category,
              subCategory: widgetConfig.subCategory,
              endpoint: state.endpoint,
              params:
                widgetConfig.params
                  ?.filter(
                    (param) =>
                      param.paramName &&
                      param.value !== undefined &&
                      param.value !== null,
                  )
                  .map((param) => ({
                    name: param.paramName,
                    value: param.value,
                    type: param.type,
                    description: param.description,
                  })) || [],
            },
          },
        };

        const response = await fetch(`${getAiApiUrl()}/v1/generate/widget_info`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          } as HeadersInit,
          body: JSON.stringify(requestPayload),
        });

        if (!response.ok) {
          throw new Error(
            `API call failed with status ${response.status}: ${response.statusText}.`,
          );
        }

        const result = await response.json();

        const updatedFields = Object.fromEntries(
          Object.entries({
            name: result.title,
            description: result.description,
            category: result.category,
            subCategory: result.subcategory,
          }).filter(([, value]) => Boolean(value)),
        );

        if (Object.keys(updatedFields).length === 0) {
          toast.error("AI did not return any metadata", {
            description: "Please try again or modify your endpoint",
          });
          return;
        }
        context.updateWidgetConfig(updatedFields);

        toast.success("Widget metadata generated successfully", {
          description: "AI has populated the widget name, description, and categories",
        });
      } catch (error) {
        console.error("Error generating widget metadata:", error);
        toast.error("Failed to generate widget metadata", {
          description:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      } finally {
        context.dispatch({ isGeneratingWithAI: false });
      }
    },
    [context, userToken],
  );

  return handleGenerateWithAI;
}
