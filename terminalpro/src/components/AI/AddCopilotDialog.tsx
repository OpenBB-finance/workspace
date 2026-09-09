import { zodResolver } from "@hookform/resolvers/zod";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import {
  type CustomCopilot,
  fetchAgentsData,
  hasCopilotConflict,
  putCustomCopilot,
} from "~/api/auth.api";
import { convertHeadersToRecord } from "~/lib/api";
import { AGENT_ENABLED_FEATURES, ALL_AI_FEATURES } from "~/lib/constants";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowThemeStore } from "~/lib/state/theme";
import { createURLString, uuidv4 } from "~/lib/utils";
import { EndpointHeadersForm } from "../DataConnectors/SingleWidget";
import { Button } from "../ds/atoms/Button";
import { Input } from "../ds/atoms/Input";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogDescription, DialogHeader, DialogTitle } from "../ds/dialogs/Dialog";
import { ConnectionTestResult } from "../ds/molecules/ConnectionTestResult";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ds/molecules/Form";

const formSchema = z.object({
  url: z.string().refine((url) => url.trim() === "" || z.url().safeParse(url).success, {
    message: "Invalid URL format",
  }),
  endpointHeaders: z
    .array(
      z.object({
        key: z.string().min(1, "This field is required"),
        value: z.string().min(1, "This field is required"),
        location: z.enum(["headers", "query"]).default("headers").optional(),
      }),
    )
    .optional(),
});

type TestResult = { success: boolean; message: string };

export function AddCopilotDialog() {
  const { externalCopilotHolders, setExternalCopilotHolders, setSelectedCopilot } =
    useShallowCopilotStore((copilot) => ({
      externalCopilotHolders: copilot.externalCopilotHolders,
      setExternalCopilotHolders: copilot.setExternalCopilotHolders,
      setSelectedCopilot: copilot.setSelectedCopilot,
    }));

  const { showAddAgentsDialog, setShowAddAgentsDialog } = useShallowThemeStore(
    (state) => ({
      showAddAgentsDialog: state.showAddAgentsDialog,
      setShowAddAgentsDialog: state.setShowAddAgentsDialog,
    }),
  );

  const onClose = useCallback(
    () => setShowAddAgentsDialog(false),
    [setShowAddAgentsDialog],
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      endpointHeaders: [],
    },
  });

  const [isTesting, setIsTesting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  // Holder validated by the last successful test, reused on Add to avoid re-fetching.
  const testedHolderRef = useRef<CustomCopilot | null>(null);

  const resetTest = useCallback(() => {
    setTestResult(null);
    testedHolderRef.current = null;
  }, []);

  useEffect(() => {
    if (showAddAgentsDialog) {
      form.reset({
        url: "",
        endpointHeaders: [],
      });
      resetTest();
    }
  }, [showAddAgentsDialog, form, resetTest]);

  // A successful test only stays valid for the exact url/headers it ran against.
  useEffect(() => {
    const subscription = form.watch((_, { name }) => {
      if (name === "url" || name?.startsWith("endpointHeaders")) {
        resetTest();
      }
    });
    return () => subscription.unsubscribe();
  }, [form, resetTest]);

  const urlValue = useWatch({ control: form.control, name: "url" }) ?? "";
  const isUrlValid =
    urlValue.trim() !== "" && z.string().url().safeParse(urlValue).success;

  const handleAddPair = useCallback(() => {
    const endpointHeaders = form.getValues("endpointHeaders");
    form.setValue(
      "endpointHeaders",
      [...(endpointHeaders || []), { key: "", value: "" }],
      { shouldValidate: false },
    );
  }, [form.setValue, form.getValues]);

  const handleTest = useCallback(async () => {
    const values = form.getValues();
    if (!values.url) return;
    const url = createURLString(values.url);

    const isDuplicateUrl = externalCopilotHolders.some(
      (holder) => holder.url.toLowerCase() === url.toLowerCase(),
    );
    if (isDuplicateUrl) {
      toast.error("Agent URL already added.", {
        description: "Select a different agent URL to be added",
      });
      return;
    }

    const endpointHeaders = (values.endpointHeaders || [])
      .filter((header) => header.key && header.value)
      .reduce(
        (acc, header) => {
          acc[header.key] = header.value;
          return acc;
        },
        {} as Record<string, string>,
      );
    const { headers } = convertHeadersToRecord(endpointHeaders);

    setIsTesting(true);
    resetTest();
    try {
      const candidate: CustomCopilot = {
        uuid: uuidv4(),
        url,
        headers,
        enabled: true,
        copilots: [],
      };
      const copilots = await fetchAgentsData(candidate);
      candidate.copilots = copilots;
      testedHolderRef.current = candidate;
      setTestResult({
        success: true,
        message: `${copilots.length} agent${copilots.length !== 1 ? "s" : ""} found`,
      });
    } catch (e) {
      setTestResult({
        success: false,
        message: e instanceof Error ? e.message : "Failed to connect",
      });
    } finally {
      setIsTesting(false);
    }
  }, [externalCopilotHolders, form, resetTest]);

  const handleAdd = useCallback(async () => {
    const newHolder = testedHolderRef.current;
    if (!newHolder) return;

    setIsAdding(true);
    try {
      const allExistingAgents = externalCopilotHolders.flatMap(
        (holder) => holder.copilots || [],
      );
      if (hasCopilotConflict(newHolder.copilots, allExistingAgents)) {
        return;
      }

      await putCustomCopilot(newHolder);
      setExternalCopilotHolders([...externalCopilotHolders, newHolder]);

      const selectedCopilot = newHolder.copilots[0];
      setSelectedCopilot(selectedCopilot);
      if (posthog) {
        posthog.capture("added_custom_copilot", {
          copilot_name: selectedCopilot.name,
        });
      }

      // Show success toast including enabled features summary
      try {
        const features = selectedCopilot?.features || {};
        const enabledFeatureKeys = Object.entries(features)
          .map(([k, v]) => {
            if (typeof v === "boolean") return v ? k : undefined;
            if (v && typeof v === "object") return v?.default ? k : undefined;
            return undefined;
          })
          .filter(Boolean) as string[];

        const summary =
          enabledFeatureKeys.length > 0
            ? `Enabled features: ${enabledFeatureKeys.join(", ")}`
            : undefined;

        toast.success("AI Agent successfully added", {
          description: summary,
        });
      } catch (_) {
        toast.success("AI Agent successfully added");
      }

      // Warn about unexpected feature types/names (integrator guidance)
      try {
        const invalidStringKeys: string[] = [];
        const invalidBooleanCustomKeys: string[] = [];

        for (const agent of newHolder.copilots || []) {
          const feats = agent?.features || {};
          for (const [k, v] of Object.entries(feats)) {
            if (typeof v === "string" && !AGENT_ENABLED_FEATURES.has(k)) {
              invalidStringKeys.push(k);
            }
            // If it's not one of our recognized boolean features,
            // warn integrators to use object metadata
            else if (typeof v === "boolean" && !ALL_AI_FEATURES.has(k)) {
              invalidBooleanCustomKeys.push(k);
            }
          }
        }

        if (invalidStringKeys.length > 0 || invalidBooleanCustomKeys.length > 0) {
          const parts: string[] = [];
          if (invalidStringKeys.length > 0) {
            const messages = [
              `String-valued features won't render toggles: ${invalidStringKeys.join(", ")}.`,
              "Custom features should be objects { label, default?, description? }.",
              `Only accepted string features are: ${Array.from(AGENT_ENABLED_FEATURES).join(", ")}.`,
            ];
            parts.push(messages.join(" "));
          }
          if (invalidBooleanCustomKeys.length > 0) {
            const messages = [
              `Unrecognized boolean features won't render toggles: ${invalidBooleanCustomKeys.join(", ")}.`,
              "Define custom features as objects with label/default/description per docs.",
            ];
            parts.push(messages.join(" "));
          }

          parts.push(
            "See docs: https://docs.openbb.co/workspace/developers/json-specs/agents-json-reference`",
          );
          toast.warning("Custom feature not recognized", {
            description: parts.join(" \n"),
          });
        }
      } catch (_) {}
      onClose();
    } catch (e) {
      console.error(e);
      setTestResult({
        success: false,
        message: e instanceof Error ? e.message : "Failed to add agent",
      });
    } finally {
      setIsAdding(false);
    }
  }, [externalCopilotHolders, setExternalCopilotHolders, setSelectedCopilot, onClose]);

  return (
    <BaseDialog
      open={showAddAgentsDialog}
      onClose={onClose}
      className="w-[660px] max-w-[660px]"
      modal={true}
    >
      <DialogHeader>
        <DialogTitle>Add Agent</DialogTitle>
        <DialogDescription>
          Build your own agent and add it to the OpenBB Workspace.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()}>
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem className="mb-2">
                <FormLabel>URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com" {...field} />
                </FormControl>
                <FormDescription className="text-2xs">
                  Check{" "}
                  <a
                    href="https://github.com/OpenBB-finance/copilot-for-terminal-pro"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-bold hover:text-light-300"
                  >
                    this
                  </a>{" "}
                  open source repository with an example for more details.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <EndpointHeadersForm connectionType="single" />
          {testResult && (
            <ConnectionTestResult
              status={testResult.success ? "success" : "error"}
              message={testResult.message}
              className="mt-4"
            />
          )}
          <div className="mt-5 flex gap-2 justify-between">
            <Button type="button" onClick={handleAddPair} variant="outlined" size="sm">
              + Add Authentication
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleTest}
                disabled={!isUrlValid || isTesting}
                loading={isTesting}
              >
                Test
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAdd}
                disabled={!testResult?.success || isAdding}
                loading={isAdding}
              >
                Add
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </BaseDialog>
  );
}
