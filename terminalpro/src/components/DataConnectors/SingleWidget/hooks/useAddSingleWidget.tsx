import { zodResolver } from "@hookform/resolvers/zod";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import {
  getSingleWidgets,
  type PostSingleWidget,
  postSingleWidget,
} from "~/api/auth.api";
import type { WidgetT } from "~/components/types";
import type { StateDispatch } from "~/hooks/useStateReducer";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { useShallowTutorialStore } from "~/lib/state/tutorial";
import { getAllWidgets } from "~/lib/utils";
import { handleConnectionAdded } from "~/lib/utils/dataConnectors";
import { useDataConnectorContext } from "../../Providers/DataConnectorContext";
import {
  type SingleWidgetDialogState,
  type SingleWidgetFormT,
  WidgetSchema,
} from "../types";
import { getKeys, getOptions } from "../utils";

type AddSingleWidgetProps = {
  state: SingleWidgetDialogState;
  dispatch: StateDispatch<SingleWidgetDialogState>;
};

export default function useAddSingleWidget(props: AddSingleWidgetProps) {
  const { dispatch, state } = props;
  const allWidgets = useMemo(() => getAllWidgets(), []);
  const [searchParams] = useSearchParams();

  const id = searchParams.get("id");
  const dashboardId = useParams()?.id;

  const { pendingNavigate, setOpen, onWidgetAdded } = useDataConnectorContext();

  const { getWidgetsByAttribute, updateWidget } = useShallowAppStore((state) => ({
    getWidgetsByAttribute: state.getWidgetsByAttribute,
    updateWidget: state.updateWidget,
  }));
  const { currentTutorial, currentStep, goToStep } = useShallowTutorialStore(
    (state) => ({
      currentTutorial: state.currentTutorial,
      currentStep: state.currentStep,
      goToStep: state.goToStep,
    }),
  );
  const { singleWidgets, setSingleWidgets, widget } = useShallowBackendConnectorStore(
    (state) => ({
      singleWidgets: state.singleWidgets,
      setSingleWidgets: state.setSingleWidgets,
      widget: state.singleWidgets.find((widget) => widget.widgetId === id),
    }),
  );

  const form = useForm({
    resolver: zodResolver(WidgetSchema),
    defaultValues: {
      name: widget?.name || searchParams.get("name") || "",
      description: widget?.description || searchParams.get("description") || "",
      endpoint: widget?.endpoint || searchParams.get("endpoint") || "",
      category: widget?.category || undefined,
      subCategory: widget?.subCategory || "",
      source: widget?.source || "",
      dataKey: widget?.dataKey || "None",
      endpointHeaders: widget?.endpointHeaders || [],
    },
  });

  const onTestSource = useCallback(
    async (values: SingleWidgetFormT) => {
      // Check if a widget with the same name already exists
      if (
        allWidgets
          .filter((widget) => widget.widgetId !== id)
          .some((widget) => widget.name.toLowerCase() === values.name.toLowerCase())
      ) {
        toast.error("A widget with the same name already exists.", {
          description: "Please choose a different name.",
        });
        return;
      }
      dispatch({ loading: true });

      getOptions(values.endpoint, values.endpointHeaders || [])
        .then((options) => {
          dispatch({
            selectOptions: options || [],
            isTested: true,
            loading: false,
          });
          if (currentTutorial === "data_connectors" && currentStep === 3) {
            setTimeout(() => {
              goToStep(4);
            }, 500);
          }
        })
        .catch((e) => {
          form.setError("endpoint", { message: e.message });
          console.error(e);
          dispatch({ loading: false });
        });
    },
    [dispatch, form.setError, currentTutorial, currentStep, goToStep, allWidgets],
  );

  const updateWidgets = useCallback(
    (widgetToAdd: PostSingleWidget) => {
      const { dataKey, description, name, endpoint, endpointHeaders } = widgetToAdd;
      const selectedWidgets = getWidgetsByAttribute("widgetId", id);
      for (const [dashId, widgets] of Object.entries(selectedWidgets)) {
        for (const widget of widgets) {
          updateWidget(dashId, {
            ...widget,
            name,
            description,
            data: { ...widget.data, dataKey },
            endpoint: {
              url: endpoint,
              method: "GET",
              headers: endpointHeaders as any,
            },
          });
        }
      }
    },
    [updateWidget, getWidgetsByAttribute, id],
  );

  const onAddWidget = useCallback(
    async (values: SingleWidgetFormT) => {
      const sameUrl = widget?.endpoint === values.endpoint;
      if (!(state.isTested || sameUrl)) {
        toast.warning("Please test the widget before adding it.");
        return;
      }

      if (values.dataKey === "None" && state.selectOptions?.length > 0) {
        dispatch({ dataKeyError: "Please select a data key." });
        return;
      }

      try {
        const currentId = widget ? id : uuidv4();

        const cleanData: PostSingleWidget = {
          name: values.name,
          description: values.description,
          category: values.category,
          subCategory: values.subCategory,
          endpoint: values.endpoint,
          gridData: { w: 20, h: 7 },
          data: { table: { showAll: true, enableCharts: true } },
          endpointHeaders:
            values.endpointHeaders?.filter(
              (header) => header.key.trim() !== "" || header.value.trim() !== "",
            ) || [],
          source: values.source ? [values.source] : undefined,
          dataKey: values.dataKey !== "None" ? values.dataKey : "",
        };

        const { status } = await postSingleWidget(currentId, cleanData);
        if (status !== 200) {
          toast.error("Something went wrong. Please try again.", {
            description: "Unknown error",
          });
          return;
        }
        const result = await getSingleWidgets();
        setSingleWidgets(result);
        if (widget) {
          updateWidgets(cleanData);
          toast.success("Widget updated successfully!");
          setOpen(false);
        } else {
          if (posthog) {
            posthog.capture("added_api_endpoint", {
              name: cleanData.name,
              endpoint: cleanData.endpoint,
              description: cleanData.description,
            });
          }
          if (currentTutorial === "data_connectors" && currentStep === 4) {
            setTimeout(() => {
              goToStep(5);
            }, 500);
          }

          const finalWidget = {
            ...cleanData,
            connectionType: "single",
            external: true,
            widgetId: currentId as any,
          } as unknown as WidgetT;

          handleConnectionAdded(dashboardId, [finalWidget], pendingNavigate);
          setOpen(false);
          onWidgetAdded?.();
        }
      } catch (e) {
        toast.error("Something went wrong. Please try again.", {
          description: e.message,
        });
      }
    },
    [
      state.isTested,
      singleWidgets,
      id,
      currentTutorial,
      currentStep,
      dispatch,
      dashboardId,
      pendingNavigate,
      onWidgetAdded,
    ],
  );

  useEffect(() => {
    if (widget) {
      getKeys(widget.endpoint, widget.endpointHeaders).then((options) => {
        if (options) {
          dispatch({ selectOptions: options });
        }
      });
    }
  }, [widget]);

  useEffect(() => {
    dispatch({ dataKeyError: undefined });
  }, [form.watch("dataKey")]);

  return { form, onTestSource, onAddWidget };
}
