import { zodResolver } from "@hookform/resolvers/zod";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
  getWidgetMetadata,
  patchWidgetMetadata,
  postWidgetMetadata,
} from "~/api/auth.api";
import { Button } from "~/components/ds/atoms/Button";
import { FormInput } from "~/components/ds/atoms/Input";
import { FormSelect } from "~/components/ds/atoms/Select";
import { FormTextarea } from "~/components/ds/atoms/TextArea";
import { Form, FormField } from "~/components/ds/molecules/Form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ds/molecules/Tabs";
import Icon from "~/components/Icon";
import type { WidgetT } from "~/components/types";
import { useShallowAppStore } from "~/lib/state/app";
import { useBackendConnectorStore } from "~/lib/state/backendConnector";
import { cn } from "~/lib/utils";
import { handleConnectionAdded } from "~/lib/utils/dataConnectors";
import { CATEGORY_OPTIONS } from "../../common/helpers";
import { useDataConnectorContext } from "../../Providers/DataConnectorContext";

const YouTubeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z
    .string()
    .min(1, "YouTube URL is required")
    .refine(
      (value) => {
        // Regular expression to match YouTube URL formats
        const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
        return youtubePattern.test(value);
      },
      {
        message: "Invalid YouTube URL format",
      },
    ),
  description: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  source: z.string().optional(),
});

type YouTubeFormData = z.infer<typeof YouTubeSchema>;

type YouTubeFormProps = {
  initialValues: YouTubeFormData;
  onChange: (data: YouTubeFormData) => void;
};

const YouTubeForm = (props: YouTubeFormProps) => {
  const [isExtraSettingsOpen, setIsExtraSettingsOpen] = useState(true);
  const { initialValues, onChange } = props;
  const form = useForm<YouTubeFormData>({
    resolver: zodResolver(YouTubeSchema),
    defaultValues: initialValues,
    mode: "onChange",
  });

  useEffect(() => {
    const subscription = form.watch((value) => {
      onChange(value as YouTubeFormData);
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  return (
    <Form {...form}>
      <form className="space-y-2.5">
        <FormField
          name="name"
          control={form.control}
          render={({ field }) => (
            <FormInput
              label="Name"
              placeholder="e.g. YouTube Video"
              {...field}
              onChange={(value) => {
                form.setValue("name", value?.toString(), { shouldValidate: true });
              }}
            />
          )}
        />
        <FormField
          name="url"
          control={form.control}
          render={({ field }) => (
            <FormInput
              label="YouTube URL"
              placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              {...field}
            />
          )}
        />
        <div className="collapsible border-t border-general-border-secondary py-1">
          <div
            className="collapsible-trigger cursor-pointer flex my-2"
            onClick={() => setIsExtraSettingsOpen(!isExtraSettingsOpen)}
          >
            <Icon
              id="chevron-right"
              className={cn(
                "size-4 min-w-4 ease-[cubic-bezier(0.87,_0,_0.13,_1)] transition-transform duration-300 text-ds-text-caption mr-2",
                { "rotate-90": isExtraSettingsOpen },
              )}
            />
            <p className="text-ds-text-body font-bold">Metadata</p>
            <p className="text-ds-text-caption ml-2 italic">(optional)</p>
          </div>
          {isExtraSettingsOpen && (
            <div className="flex flex-col gap-2">
              <FormField
                name="description"
                control={form.control}
                render={({ field }) => (
                  <FormTextarea
                    label="Description"
                    placeholder="YouTube video about..."
                    {...field}
                    rows={3}
                  />
                )}
              />
              <FormField
                name="category"
                control={form.control}
                render={({ field }) => (
                  <FormSelect label="Category" options={CATEGORY_OPTIONS} {...field} />
                )}
              />
              <FormField
                name="subCategory"
                control={form.control}
                render={({ field }) => (
                  <FormInput label="Sub-category" placeholder="Tutorial" {...field} />
                )}
              />
              <FormField
                name="source"
                control={form.control}
                render={({ field }) => (
                  <FormInput label="Source" placeholder="YouTube" {...field} />
                )}
              />
            </div>
          )}
        </div>
      </form>
    </Form>
  );
};

interface YouTubeFormState {
  id: string;
  data: YouTubeFormData;
}

export default function YouTubeContent() {
  const { setWidgetMetadata, getWidgetMetadataById } = useBackendConnectorStore();
  const { getWidgetsByAttribute, updateWidget } = useShallowAppStore((s) => ({
    getWidgetsByAttribute: s.getWidgetsByAttribute,
    updateWidget: s.updateWidget,
  }));
  const { setOpen, pendingNavigate, mode, id, onWidgetAdded } =
    useDataConnectorContext();
  const dashboardId = useParams()?.id;
  const posthog = usePostHog();

  const [youtubeForms, setYoutubeForms] = useState<YouTubeFormState[]>([
    {
      id: uuidv4(),
      data: {
        url: "",
        name: "YouTube Video",
        description: "",
        category: "",
        subCategory: "",
        source: "",
      },
    },
  ]);

  const metadata = useMemo(() => {
    return getWidgetMetadataById(id);
  }, [id, getWidgetMetadataById]);

  const [youtubeData, setYoutubeData] = useState<YouTubeFormData>({
    url: metadata?.storage?.youtubeUrl ?? "",
    name: metadata?.name ?? "",
    description: metadata?.description ?? "",
    category: metadata?.category ?? "",
    subCategory: metadata?.subCategory ?? "",
    source: metadata?.source ?? "",
  });

  const updateEditFormData = useCallback((data: YouTubeFormData) => {
    setYoutubeData(data);
  }, []);

  const [selectedTab, setSelectedTab] = useState<string>(youtubeForms[0].id);

  const addYouTubeForm = useCallback(() => {
    const newId = uuidv4();
    setYoutubeForms((prev) => [
      ...prev,
      {
        id: newId,
        data: {
          url: "",
          name: "YouTube Video",
          description: "",
          category: "",
          subCategory: "",
          source: "",
        },
      },
    ]);
    setSelectedTab(newId);
  }, []);

  const removeYouTubeForm = useCallback((id: string) => {
    setYoutubeForms((prev) => prev.filter((form) => form.id !== id));
  }, []);

  useEffect(() => {
    // Check if the currently selected tab still exists
    const tabExists = youtubeForms.some((form) => form.id === selectedTab);

    // If the selected tab doesn't exist, select the last tab
    if (!tabExists && youtubeForms.length > 0) {
      setSelectedTab(youtubeForms[youtubeForms.length - 1].id);
    }
  }, [youtubeForms, selectedTab]);

  const updateFormData = useCallback((id: string, data: YouTubeFormData) => {
    setYoutubeForms((prev) =>
      prev.map((form) => (form.id === id ? { ...form, data } : form)),
    );
  }, []);

  const enableSubmit = useMemo(() => {
    if (mode === "edit") {
      return YouTubeSchema.safeParse(youtubeData).success;
    }
    return youtubeForms.every((form) => YouTubeSchema.safeParse(form.data).success);
  }, [mode, youtubeData, youtubeForms]);

  const onSubmit = useCallback(async () => {
    if (mode === "edit") {
      try {
        const widgetMetadata = {
          widgetId: id,
          widgetType: "youtube" as const,
          name: youtubeData.name,
          description: youtubeData.description ?? "",
          category: youtubeData.category ?? "",
          subCategory: youtubeData.subCategory ?? "",
          source: youtubeData.source ?? "",
          storage: {
            youtubeUrl: youtubeData.url,
          },
        };
        const result = await patchWidgetMetadata(widgetMetadata, id);

        if (result.success) {
          // Update the global widget metadata state
          const updatedMetadata = await getWidgetMetadata();
          setWidgetMetadata(updatedMetadata);

          const identifier = `youtube-${id}`;
          const selectedWidgets = getWidgetsByAttribute("widgetId", identifier);
          for (const [dashId, widgets] of Object.entries(selectedWidgets)) {
            for (const widget of widgets) {
              updateWidget(dashId, {
                ...widget,
                name: widgetMetadata.name,
                description: widgetMetadata.description,
                category: widgetMetadata.category,
                subCategory: widgetMetadata.subCategory,
                source: widgetMetadata.source,
                storage: {
                  ...widget.storage,
                  ...widgetMetadata.storage,
                },
              });
            }
          }

          toast.success("YouTube widget updated successfully", {
            description:
              "All widgets inside dashboards created from this widget were also updated.",
          });
          setOpen(false);
        } else {
          toast.error("Failed to update YouTube widget");
        }
      } catch (error) {
        console.error("Error updating YouTube widget:", error);
        toast.error("An error occurred while updating the YouTube widget");
      }
    } else {
      const validForms = youtubeForms.filter((form) => {
        return YouTubeSchema.safeParse(form.data).success;
      });

      if (validForms.length !== youtubeForms.length) {
        toast.error("Please ensure all YouTube URLs are valid");
        return;
      }

      if (validForms.length === 0) {
        toast.error("Please enter at least one YouTube URL");
        return;
      }
      try {
        const widgets = await Promise.all(
          validForms.map(async (form) => {
            const widgetId = uuidv4();
            const widgetMetadata = {
              widgetId: widgetId,
              widgetType: "youtube" as const,
              name: form.data.name,
              description: form.data.description ?? "",
              category: form.data.category ?? "",
              subCategory: form.data.subCategory ?? "",
              source: form.data.source ?? "",
              storage: {
                youtubeUrl: form.data.url,
              },
            };

            const data = await postWidgetMetadata(widgetMetadata);
            if (!data.success) {
              toast.error("Something went wrong. Please try again.", {
                description: "Unknown error",
              });
              return;
            }

            return {
              id: widgetId,
              type: "youtube",
              widgetId: `youtube-${widgetId}`,
              name: form.data.name,
              description: form.data.description ?? "",
              category: form.data.category ?? "",
              subCategory: form.data.subCategory ?? "",
              source: form.data.source ?? "",
              storage: {
                youtubeUrl: widgetMetadata.storage.youtubeUrl,
              },
            } as WidgetT;
          }),
        );

        // Filter out undefined values from failed API calls
        const successfulWidgets = widgets.filter(
          (widget): widget is WidgetT => widget !== undefined,
        );

        if (successfulWidgets.length === 0) {
          toast.error("Failed to add YouTube widgets");
          return;
        }

        const result = await getWidgetMetadata();
        setWidgetMetadata(result);

        setYoutubeForms([
          {
            id: uuidv4(),
            data: {
              url: "",
              name: "YouTube Video",
              description: "",
              category: "",
              subCategory: "",
              source: "",
            },
          },
        ]);
        setOpen(false);
        onWidgetAdded?.();
        handleConnectionAdded(dashboardId, successfulWidgets, pendingNavigate);

        if (posthog) {
          for (const youtube of successfulWidgets) {
            posthog.capture("added_youtube", {
              name: youtube.name,
              category: youtube.category,
              source: youtube.source,
              url: youtube.storage?.youtubeUrl,
            });
          }
        }
      } catch (error) {
        console.error("Error adding YouTube widgets:", error);
        toast.error("An error occurred while adding YouTube widgets");
      }
    }
  }, [
    youtubeForms,
    setOpen,
    pendingNavigate,
    dashboardId,
    mode,
    id,
    youtubeData,
    onWidgetAdded,
  ]);

  return (
    <>
      {mode === "create" && (
        <Tabs
          variant="filled"
          className="mb-2"
          value={selectedTab}
          onValueChange={setSelectedTab}
        >
          <TabsList className="overflow-x-auto overflow-y-hidden flex-nowrap max-w-full">
            <div className="flex min-w-fit gap-1">
              {youtubeForms.map((youtubeForm, _index) => (
                <TabsTrigger
                  key={youtubeForm.id}
                  value={youtubeForm.id}
                  className="flex items-center justify-between gap-2 bg-tab-bg-secondary whitespace-nowrap"
                >
                  {youtubeForm.data.name || "Untitled"}
                  {youtubeForms.length > 1 && (
                    <Icon
                      id="x-outline-circle"
                      className="w-3"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeYouTubeForm(youtubeForm.id);
                      }}
                    />
                  )}
                </TabsTrigger>
              ))}
              <button
                className="BB-TabTrigger transition text-nowrap rounded-t-sm px-2.5 disabled:pointer-events-none disabled:opacity-50 bg-tab-bg-secondary text-ds-text-caption hover:text-general-label radix-state-active:bg-tab-filled-primary-bg-active radix-state-active:text-tab-filled-primary-text-active [&.active]:bg-tab-filled-primary-bg-active [&.active]:text-tab-filled-primary-text-active"
                onClick={addYouTubeForm}
              >
                <Icon id="plus" />
              </button>
            </div>
          </TabsList>
          <div className="bg-surface-card p-2.5 rounded-br rounded-tr rounded-bl">
            {youtubeForms.map((youtubeForm) => (
              <TabsContent key={youtubeForm.id} value={youtubeForm.id}>
                <YouTubeForm
                  initialValues={youtubeForm.data}
                  onChange={(data) => updateFormData(youtubeForm.id, data)}
                />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      )}
      {mode === "edit" && (
        <div className="bg-surface-card mb-2 p-4 rounded-br rounded-tr rounded-bl">
          <YouTubeForm
            initialValues={youtubeData}
            onChange={(data) => updateEditFormData(data)}
          />
        </div>
      )}
      <div className="self-end mt-auto">
        <Button size="sm" onClick={onSubmit} disabled={!enableSubmit}>
          {mode === "create" ? "Add" : "Update"}
        </Button>
      </div>
    </>
  );
}
