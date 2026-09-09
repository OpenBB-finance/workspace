import { zodResolver } from "@hookform/resolvers/zod";
import { usePostHog } from "posthog-js/react";
import React, { forwardRef, useCallback, useEffect, useMemo, useState } from "react";
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
import { FormInput, Input } from "~/components/ds/atoms/Input";
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

const RSSFeedSchema = z.object({
  tag: z.string().min(1, "Tag is required"),
  source: z.string().min(1, "Source is required"),
  url: z.string().url().min(1, "URL is required"),
});

const RSSWidgetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  feeds: z.array(RSSFeedSchema).min(1, "At least one feed is required"),
});

type RSSWidgetData = z.infer<typeof RSSWidgetSchema>;

type RSSWidgetFormProps = {
  initialValues: RSSWidgetData;
  onChange: (data: RSSWidgetData) => void;
};

const RSSWidgetForm = forwardRef<HTMLFormElement, RSSWidgetFormProps>((props, _ref) => {
  const [isExtraSettingsOpen, setIsExtraSettingsOpen] = useState(true);
  const { initialValues, onChange } = props;
  const form = useForm<RSSWidgetData>({
    resolver: zodResolver(RSSWidgetSchema),
    defaultValues: initialValues,
    mode: "onChange",
  });

  useEffect(() => {
    const subscription = form.watch((value) => {
      onChange(value as RSSWidgetData);
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  const addFeed = useCallback(() => {
    const currentFeeds = form.getValues("feeds") || [];
    form.setValue("feeds", [...currentFeeds, { tag: "", source: "", url: "" }]);
  }, [form.getValues, form.setValue]);

  const removeFeed = useCallback(
    (index: number) => {
      const currentFeeds = form.getValues("feeds") || [];
      form.setValue(
        "feeds",
        currentFeeds.filter((_, i) => i !== index),
      );
    },
    [form.getValues, form.setValue],
  );

  const allFeeds = form.watch("feeds");

  const uniqueSources = allFeeds?.map((feed) => feed.source)?.join(", ");

  return (
    <Form {...form}>
      <form className="space-y-2.5">
        <FormField
          name="name"
          control={form.control}
          render={({ field }) => (
            <FormInput label="Widget Name" placeholder="e.g. Tech News" {...field} />
          )}
        />
        {allFeeds?.map((_, index) => (
          <div
            key={index}
            className="border border-light-200 dark:border-dark-500 p-4 rounded-md space-y-2"
          >
            <div className="grid grid-cols-2 gap-2">
              <FormField
                name={`feeds.${index}.tag`}
                control={form.control}
                render={({ field }) => (
                  <FormInput label="Tag" placeholder="e.g. Technology" {...field} />
                )}
              />
              <FormField
                name={`feeds.${index}.source`}
                control={form.control}
                render={({ field }) => (
                  <FormInput label="Source" placeholder="e.g. TechCrunch" {...field} />
                )}
              />
            </div>
            <FormField
              name={`feeds.${index}.url`}
              control={form.control}
              render={({ field }) => (
                <FormInput
                  label="RSS / Atom Feed URL"
                  placeholder="https://techcrunch.com/feed/"
                  {...field}
                />
              )}
            />
            {allFeeds?.length > 1 && (
              <Button
                type="button"
                onClick={() => removeFeed(index)}
                variant="outlined"
                size="sm"
              >
                Remove Feed
              </Button>
            )}
          </div>
        ))}
        <Button type="button" onClick={addFeed} variant="outlined" size="sm">
          Add Feed
        </Button>
        <div className="collapsible border-t dark:border-dark-500 border-light-200 py-1">
          <div
            className="collapsible-trigger cursor-pointer flex my-2"
            onClick={() => setIsExtraSettingsOpen(!isExtraSettingsOpen)}
          >
            <Icon
              id="chevron-right"
              className={cn(
                "size-4 min-w-4 ease-[cubic-bezier(0.87,_0,_0.13,_1)] transition-transform duration-300 text-light-400 mr-2",
                { "rotate-90": isExtraSettingsOpen },
              )}
            />
            <p className="text-light-600 dark:text-light-100 font-bold">Metadata</p>
            <p className="text-dark-50 ml-2 italic">(optional)</p>
          </div>
          {isExtraSettingsOpen && (
            <div className="flex flex-col gap-2">
              <FormField
                name="description"
                //control={form.control}
                render={({ field }) => (
                  <FormTextarea
                    label="Description"
                    placeholder="RSS feeds provide real-time updates from various sources, allowing you to stay informed about the latest news, articles, and content from your favorite websites and blogs."
                    {...field}
                    rows={3}
                  />
                )}
              />
              <FormField
                name="category"
                //control={form.control}
                render={({ field }) => (
                  <FormSelect label="Category" options={CATEGORY_OPTIONS} {...field} />
                )}
              />
              <FormField
                name="subCategory"
                //control={form.control}
                render={({ field }) => (
                  <FormInput label="Sub-category" placeholder="" {...field} />
                )}
              />
              <Input
                label="Source"
                placeholder="CNBC,Reuters"
                value={uniqueSources}
                disabled={true}
              />
            </div>
          )}
        </div>
      </form>
    </Form>
  );
});

interface RSSWidgetFormState {
  id: string;
  ref: React.RefObject<HTMLFormElement>;
  data: RSSWidgetData;
}

export default function RSSContent() {
  const { setOpen, pendingNavigate, mode, id, onWidgetAdded } =
    useDataConnectorContext();
  const dashboardId = useParams()?.id;

  const { setWidgetMetadata, getWidgetMetadataById } = useBackendConnectorStore();
  const { getWidgetsByAttribute, updateWidget } = useShallowAppStore((s) => ({
    getWidgetsByAttribute: s.getWidgetsByAttribute,
    updateWidget: s.updateWidget,
  }));
  const posthog = usePostHog();

  const metadata = useMemo(() => {
    return getWidgetMetadataById(id);
  }, [id]);

  const [rssWidgetForms, setRSSWidgetForms] = useState<RSSWidgetFormState[]>([
    {
      id: uuidv4(),
      ref: React.createRef(),
      data: {
        name: "",
        description: "",
        category: "",
        subCategory: "",
        feeds: [{ tag: "", source: "", url: "" }],
      },
    },
  ]);

  const [rssWidgetData, setRSSWidgetData] = useState<RSSWidgetData>({
    name: metadata?.name ?? "",
    description: metadata?.description ?? "",
    category: metadata?.category ?? "",
    subCategory: metadata?.subCategory ?? "",
    feeds: metadata?.storage?.feeds ?? [{ tag: "", source: "", url: "" }],
  });

  const updateEditFormData = useCallback((data: RSSWidgetData) => {
    setRSSWidgetData(data);
  }, []);

  const [selectedTab, setSelectedTab] = useState<string>(rssWidgetForms[0].id);

  const addRSSFeedForm = useCallback(() => {
    const newId = uuidv4();
    setRSSWidgetForms((prev) => [
      ...prev,
      {
        id: newId,
        ref: React.createRef(),
        data: {
          name: "",
          description: "",
          category: "",
          subCategory: "",
          source: "",
          feeds: [{ tag: "", source: "", url: "" }],
        },
      },
    ]);
    setSelectedTab(newId);
  }, []);

  const removeRSSFeedForm = useCallback(
    (id: string) => {
      setRSSWidgetForms((prev) => prev.filter((form) => form.id !== id));
    },
    [rssWidgetForms],
  );

  useEffect(() => {
    // Check if the currently selected tab still exists
    const tabExists = rssWidgetForms.some((form) => form.id === selectedTab);

    // If the selected tab doesn't exist, select the last tab
    if (!tabExists && rssWidgetForms.length > 0) {
      setSelectedTab(rssWidgetForms[rssWidgetForms.length - 1].id);
    }
  }, [rssWidgetForms, selectedTab]);

  const updateFormData = useCallback((id: string, data: RSSWidgetData) => {
    setRSSWidgetForms((prev) =>
      prev.map((form) => (form.id === id ? { ...form, data } : form)),
    );
  }, []);

  const enableSubmit = useMemo(() => {
    if (mode === "edit") {
      return RSSWidgetSchema.safeParse(rssWidgetData).success;
    }
    return rssWidgetForms.every((form) => RSSWidgetSchema.safeParse(form.data).success);
  }, [mode, rssWidgetData, rssWidgetForms]);

  const onSubmit = useCallback(async () => {
    if (mode === "edit") {
      try {
        const widgetMetadata = {
          widgetId: id,
          widgetType: "rss_viewer" as const,
          name: rssWidgetData.name,
          description: rssWidgetData.description ?? "",
          category: rssWidgetData.category ?? "",
          subCategory: rssWidgetData.subCategory ?? "",
          source: rssWidgetData.feeds.map((feed) => feed.source).join(", "),
          storage: {
            feeds: rssWidgetData.feeds.map((feed) => ({ ...feed, enabled: true })),
          },
        };

        const result = await patchWidgetMetadata(widgetMetadata, id);

        if (result.success) {
          // Update the global widget metadata state
          const updatedMetadata = await getWidgetMetadata();
          setWidgetMetadata(updatedMetadata);

          const identifier = `rss_viewer-${id}`;
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

          toast.success("Widget updated successfully", {
            description:
              "All widgets inside dashboards created from this widget were also updated.",
          });
          setOpen(false);
        } else {
          toast.error("Failed to update widget");
        }
      } catch (error) {
        console.error("Error updating widget:", error);
        toast.error("An error occurred while updating the widget");
      }
    } else {
      try {
        const widgets = await Promise.all(
          rssWidgetForms.map(async (form) => {
            const widgetId = uuidv4();
            const widgetMetadata = {
              widgetId: widgetId,
              widgetType: "rss_viewer" as const,
              name: form.data.name,
              description: form.data.description ?? "",
              category: form.data.category ?? "",
              subCategory: form.data.subCategory ?? "",
              source: form.data.feeds.map((feed) => feed.source).join(", "),
              storage: {
                feeds: form.data.feeds.map((feed) => ({ ...feed, enabled: true })),
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
              widgetId: `rss_viewer-${widgetId}`,
              name: widgetMetadata.name,
              description: widgetMetadata.description,
              source: widgetMetadata.source,
              storage: {
                feeds: widgetMetadata.storage.feeds,
              },
            } as unknown as WidgetT;
          }),
        );

        const result = await getWidgetMetadata();
        setWidgetMetadata(result);

        setRSSWidgetForms([
          {
            id: uuidv4(),
            ref: React.createRef(),
            data: {
              name: "",
              description: "",
              category: "",
              subCategory: "",
              feeds: [{ tag: "", source: "", url: "" }],
            },
          },
        ]);
        setOpen(false);
        onWidgetAdded?.();
        handleConnectionAdded(dashboardId, widgets, pendingNavigate);

        if (posthog) {
          for (const widget of widgets) {
            posthog.capture("added_rss_widget", {
              name: widget.name,
              category: widget.category,
              source: widget.source,
              feedCount: widget.storage?.feeds.length,
            });
          }
        }
      } catch (error) {
        console.error("Error adding RSS widgets:", error);
        toast.error("An error occurred while adding RSS widgets");
      }
    }
  }, [rssWidgetForms, setOpen, pendingNavigate, dashboardId, mode, id, rssWidgetData]);

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
              {rssWidgetForms.map((rssWidgetForm, _index) => (
                <TabsTrigger
                  key={rssWidgetForm.id}
                  value={rssWidgetForm.id}
                  className="flex items-center justify-between gap-2 dark:bg-dark-500 whitespace-nowrap"
                >
                  {rssWidgetForm.data.name || "Untitled"}
                  {rssWidgetForms.length > 1 && (
                    <Icon
                      id="x-outline-circle"
                      className="w-3"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeRSSFeedForm(rssWidgetForm.id);
                      }}
                    />
                  )}
                </TabsTrigger>
              ))}
              <button
                className="BB-TabTrigger transition text-nowrap rounded-t-sm px-2.5 disabled:pointer-events-none disabled:opacity-50 bg-light-100 text-light-500 hover:text-light-750 radix-state-active:bg-brand-main radix-state-active:text-light-50 [&.active]:bg-brand-main [&.active]:text-light-50 dark:bg-dark-700 dark:text-dark-50 dark:hover:text-light-200 dark:radix-state-active:bg-brand-main dark:radix-state-active:text-light-50 dark:[&.active]:bg-brand-main dark:[&.active]:text-light-50"
                onClick={addRSSFeedForm}
              >
                <Icon id="plus" />
              </button>
            </div>
          </TabsList>
          <div className="bg-light-100 p-2.5 dark:bg-dark-750 rounded-br rounded-tr rounded-bl">
            {rssWidgetForms.map((rssWidgetForm) => (
              <TabsContent key={rssWidgetForm.id} value={rssWidgetForm.id}>
                <RSSWidgetForm
                  ref={rssWidgetForm.ref}
                  initialValues={rssWidgetForm.data}
                  onChange={(data) => updateFormData(rssWidgetForm.id, data)}
                />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      )}
      {mode === "edit" && (
        <RSSWidgetForm
          initialValues={rssWidgetData}
          onChange={(data) => updateEditFormData(data)}
        />
      )}

      <div className="self-end mt-auto pb-2.5">
        <Button size="sm" onClick={onSubmit} disabled={!enableSubmit}>
          {mode === "create" ? "Add" : "Update"}
        </Button>
      </div>
    </>
  );
}
