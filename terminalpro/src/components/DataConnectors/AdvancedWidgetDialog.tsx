import { zodResolver } from "@hookform/resolvers/zod";
import { usePostHog } from "posthog-js/react";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { getApiSources, postApiSource } from "~/api/auth.api";
import { EndpointHeadersForm } from "~/components/DataConnectors/SingleWidget/EndpointHeadersForm";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useShallowAuthStore } from "~/lib/state/auth";
import {
  type Source,
  useShallowBackendConnectorStore,
} from "~/lib/state/backendConnector";
import { dispatchSaveState } from "~/lib/utils";
import { handleConnectionAdded } from "~/lib/utils/dataConnectors";
import { NotificationId, showNotificationWithRememberMe } from "~/lib/utils/toast";
import { validateSource } from "~/lib/utils/validateBackend";
import { formatZodErrorMessage } from "~/utils/zodErrors";
import { TroubleshootMessage } from "../Apps/ManageAppDialog";
import { Button } from "../ds/atoms/Button";
import { FormInput } from "../ds/atoms/Input";
import { FormSelect } from "../ds/atoms/Select";
import { Form, FormField } from "../ds/molecules/Form";
import { Notice } from "../ds/molecules/Notice";
import Icon from "../Icon";
import { getSourceWidgetsToAdd, updateWidgetEndpoints } from "./common/helpers";
import { useDataConnectorContext } from "./Providers/DataConnectorContext";
export const AdvancedSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().min(1, "This field is required"),
  url: z.url().min(1, "This field is required"),
  endpointHeaders: z
    .array(
      z.object({
        key: z.string().min(1, "This field is required"),
        value: z.string().min(1, "This field is required"),
        location: z.enum(["headers", "query"]).default("headers").optional(),
      }),
    )
    .optional(),
  validateWidgets: z.enum(["true", "false"]).default("false").optional(),
});

export type AdvancedForm = z.infer<typeof AdvancedSchema>;

const initialState = {
  loading: false,
  saveLoading: false,
  isSuccess: false,
  message: null as null | string,
  errorMessage: null as null | string,
  templateErrorMessage: null as null | string,
  backendToAdd: null as Partial<Source> | null,
  isLocalhost: false,
  isConnected: false,
};

const getInitialState = () => ({ ...initialState });

type DialogState = typeof initialState;

export default function AdvancedWidgetDialog() {
  const { isAdmin } = useShallowAuthStore((state) => ({
    isAdmin: state.user?.role === "Admin",
  }));
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const dashboardId = useParams()?.id;

  const id = searchParams.get("id");
  const { pendingNavigate, setOpen, onWidgetAdded } = useDataConnectorContext();

  const { updateApiSource, apiSource, checkExistingBackend } =
    useShallowBackendConnectorStore((state) => ({
      updateApiSource: state.updateApiSource,
      apiSource: id ? state.getApiSourceById(id) : null,
      checkExistingBackend: state.checkExistingBackend,
    }));

  const [state, dispatch] = useStateReducer<DialogState>(null, getInitialState);

  const posthog = usePostHog();

  const form = useForm<AdvancedForm>({
    resolver: zodResolver(AdvancedSchema),
    defaultValues: {
      id: id || undefined,
      name: apiSource?.name || searchParams.get("name") || "",
      url: apiSource?.url || searchParams.get("url") || "",
      endpointHeaders: apiSource?.endpointHeaders || [],
      validateWidgets: "false",
    },
  });

  const onFieldChange = useCallback(
    (params: { name?: string; url?: string }) => {
      const { id, url, name } = { ...form.getValues(), ...params };

      const generalError = checkExistingBackend({ name, url, id });
      for (const field of ["name", "url"] as const) {
        if (params[field]) {
          if (!generalError?.[field]) return form.clearErrors(field);
          form.setError(field, { message: generalError[field] || "" });
          dispatch({ isSuccess: false });
        }
      }
    },
    [form.setError, form.getValues, checkExistingBackend],
  );

  const onSubmit = useCallback(
    async ({ name, url, endpointHeaders, validateWidgets }: AdvancedForm) => {
      const newstate = getInitialState();
      newstate.isLocalhost = ["localhost", "127.0.0.1"].some((host) =>
        url.includes(host),
      );

      dispatch({ ...newstate, loading: true });

      try {
        const cleanUrl = url.trim().replace(/\/+$/, "").trim();
        const source = { name, url: cleanUrl, endpointHeaders } as Source;

        const {
          widgets,
          errorMessage,
          templateErrorMessage,
          totalFailed,
          templates,
          isOpenBBPlatform,
        } = await validateSource(source, validateWidgets === "true");

        const widgetsCount = Object.keys(widgets).length;

        if (errorMessage && widgetsCount === 0) {
          throw new Error(errorMessage);
        }

        const appsCount = templates?.length || 0;
        const failed = totalFailed > 0 ? `, ${totalFailed} failed` : "";

        // Count prompts and MCP servers across all templates
        const { promptsCount, mcpCount } = templates?.reduce(
          (acc, template) => {
            acc.promptsCount += template.prompts?.length || 0;
            acc.mcpCount += template.mcpServers?.length || 0;
            return acc;
          },
          { promptsCount: 0, mcpCount: 0 },
        ) ?? { promptsCount: 0, mcpCount: 0 };

        // Create a more detailed success message
        const messageParts = [
          `${widgetsCount} ${widgetsCount === 1 ? "Widget" : "Widgets"} found${failed}`,
          `${appsCount} ${appsCount === 1 ? "App" : "Apps"} found`,
          `${promptsCount} ${promptsCount === 1 ? "Prompt" : "Prompts"} found`,
        ];
        if (mcpCount > 0) {
          messageParts.push(
            `${mcpCount} MCP ${mcpCount === 1 ? "Server" : "Servers"} found`,
          );
        }
        const detailedMessage = `${messageParts.join(", ")}.`;

        const isSuccess = !(errorMessage || templateErrorMessage);

        Object.assign(newstate, {
          isConnected: isSuccess,
          message: detailedMessage,
          errorMessage: errorMessage || null,
          templateErrorMessage: templateErrorMessage || null,
          isSuccess,
          backendToAdd: {
            name,
            url: cleanUrl,
            widgets,
            endpointHeaders,
            isOpenBBPlatform,
          },
        });
      } catch (err) {
        newstate.errorMessage =
          err?.message === "Failed to fetch"
            ? "Unknown error occurred, check your API console for more detailed error message"
            : err.message;
      } finally {
        dispatch({ loading: false, ...newstate });
      }
    },
    [],
  );

  const onAddBackend = useCallback(async () => {
    if (!state.backendToAdd) return;
    const { name, url, endpointHeaders = [], isOpenBBPlatform } = state.backendToAdd;
    const backendId = id ?? uuidv4();
    const data = { name, url, endpointHeaders };
    const { status } = await postApiSource(backendId, data);
    if (status !== 200) {
      toast.error("Something went wrong. Please try again.", {
        description: "Unknown error",
      });
      return;
    }

    dispatchSaveState();
    const result = (await getApiSources()).find((source) => source.id === backendId);
    const source = result || ({ id: backendId, ...data } as Source);

    const { templates, widgets, errorMessage } = await updateApiSource(source);
    Object.assign(source, {
      templates,
      widgets,
      status: errorMessage ? "error" : "success",
    });

    if (id) {
      const prevName = apiSource?.name;
      updateWidgetEndpoints({ ...source, prevName });
      dispatchSaveState();
      setOpen(false);

      toast.success("Backend updated", {
        description: "Backend has been updated.",
      });
      return;
    }

    const widgetsToAdd = getSourceWidgetsToAdd(widgets, source);

    setOpen(false);
    onWidgetAdded?.();
    handleConnectionAdded(dashboardId, widgetsToAdd, pendingNavigate);

    if (isAdmin && !id && status === 200) {
      showNotificationWithRememberMe({
        id: NotificationId.ConfigureBackendPermissions,
        message: "Configure backend permissions",
        description:
          "Your custom backend was successfully set up! You can now configure permissions for your Organization in the Admin Portal.",
        toastType: "info",
        action: {
          label: "Go to Admin Portal",
          onClick: () => {
            navigate("/admin/roles");
          },
        },
      });
    }
    if (posthog) {
      posthog.capture("added_custom_backend", {
        backend_name: name,
        backend_url: url,
        number_of_widgets: widgetsToAdd.length,
        isOpenBBPlatform,
      });
    }
  }, [
    apiSource?.name,
    state.backendToAdd,
    id,
    updateApiSource,
    posthog,
    dashboardId,
    pendingNavigate,
    setSearchParams,
    onWidgetAdded,
  ]);

  const handleAddPair = useCallback(() => {
    const endpointHeaders = form.getValues("endpointHeaders");
    form.setValue(
      "endpointHeaders",
      [...(endpointHeaders || []), { key: "", value: "", location: "headers" }],
      { shouldValidate: false },
    );
  }, [form.getValues, form.setValue]);

  return (
    <>
      <Form {...form}>
        <form
          id="manage-app-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-2 text-xs max-h-[calc(100%-100px)] overflow-y-auto pr-2"
        >
          <FormField
            name="name"
            control={form.control}
            render={({ field }) => {
              return (
                <FormInput
                  label="Name"
                  placeholder="OpenBB Platform"
                  {...field}
                  onChange={(name: string) => {
                    onFieldChange({ name });
                    field.onChange(name);
                  }}
                />
              );
            }}
          />
          <FormField
            name="url"
            control={form.control}
            render={({ field }) => {
              return (
                <FormInput
                  label="URL"
                  placeholder="http://localhost:3000"
                  {...field}
                  onChange={(url: string) => {
                    if (apiSource?.url && url !== apiSource.url) {
                      dispatch({ isSuccess: false });
                    }
                    onFieldChange({ url });
                    field.onChange(url);
                  }}
                />
              );
            }}
          />
          <FormField
            name="validateWidgets"
            control={form.control}
            render={({ field }) => {
              return (
                <FormSelect
                  label="Validate Widgets"
                  options={[
                    {
                      label: "Yes",
                      value: "true",
                    },
                    {
                      label: "No",
                      value: "false",
                    },
                  ]}
                  {...field}
                />
              );
            }}
          />

          <EndpointHeadersForm connectionType="advanced" />

          {state.isSuccess && (
            <Notice
              variant="success"
              title="Test successful"
              className="mt-2 mb-4 w-full max-w-full"
            >
              {state.message}
            </Notice>
          )}

          {(state.errorMessage || state.templateErrorMessage) && (
            <Notice
              variant="error"
              title="Error"
              className="mt-2 mb-2 w-[560px] max-w-full"
            >
              {formatZodErrorMessage(state.errorMessage, "!text-ds-text-body")}
              {state.errorMessage?.includes("(Status: ") && state.isLocalhost && (
                <TroubleshootMessage />
              )}
            </Notice>
          )}
        </form>
      </Form>
      <div className="mt-auto flex justify-between">
        <Button type="button" onClick={handleAddPair} variant="outlined" size="sm">
          <Icon id="plus-icon" className="h-4 w-4 mr-1" />
          Add Authentication
        </Button>
        <div className="flex gap-2">
          <Button
            className="[&_svg]:h-4"
            disabled={
              form.formState?.errors?.url !== undefined ||
              form.formState?.errors?.name !== undefined ||
              !form.formState.isValid ||
              state.loading
            }
            onClick={() => onSubmit(form.getValues())}
            loading={state.loading}
            size="sm"
            variant="secondary"
          >
            Test
          </Button>
          <Button
            disabled={
              !form.formState.isValid ||
              state.loading ||
              !(state.isSuccess || apiSource?.id) ||
              (apiSource?.id &&
                (form.formState.dirtyFields?.url
                  ? !state.isSuccess
                  : !(form.formState.isDirty && state.isConnected)))
            }
            onClick={onAddBackend}
            size="sm"
            variant="primary"
          >
            {id ? "Update" : "Add"}
          </Button>
        </div>
      </div>
    </>
  );
}
