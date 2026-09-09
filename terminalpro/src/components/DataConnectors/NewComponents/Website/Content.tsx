import { zodResolver } from "@hookform/resolvers/zod";
import { usePostHog } from "posthog-js/react";
import {
  createRef,
  forwardRef,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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

const WebsiteSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z
    .string()
    .min(1, "URL is required")
    .refine(
      (value) => {
        // Regular expression to match various URL formats
        const urlPattern =
          /^(https?:\/\/)?(localhost(:\d{1,5})?|([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(\/\S*)?$/;
        return urlPattern.test(value);
      },
      {
        message: "Invalid URL format",
      },
    ),
  description: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  source: z.string().optional(),
});

type WebsiteFormData = z.infer<typeof WebsiteSchema>;

type WebsiteFormProps = {
  initialValues: WebsiteFormData;
  onChange: (data: WebsiteFormData) => void;
};

const WebsiteForm = forwardRef<HTMLFormElement, WebsiteFormProps>((props, _ref) => {
  const [isExtraSettingsOpen, setIsExtraSettingsOpen] = useState(true);
  const { initialValues, onChange } = props;
  const form = useForm<WebsiteFormData>({
    resolver: zodResolver(WebsiteSchema),
    defaultValues: initialValues,
    mode: "onChange",
  });

  useEffect(() => {
    const subscription = form.watch((value) => {
      onChange(value as WebsiteFormData);
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
              placeholder="e.g. Iframe"
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
            <FormInput label="Iframe URL" placeholder="https://openbb.co" {...field} />
          )}
        />
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
                control={form.control}
                render={({ field }) => (
                  <FormTextarea
                    label="Description"
                    placeholder="Iframe from OpenBB, the company building an AI-powered Research Workspace"
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
                  <FormInput label="Sub-category" placeholder="Startup" {...field} />
                )}
              />
              <FormField
                name="source"
                control={form.control}
                render={({ field }) => (
                  <FormInput label="Source" placeholder="OpenBB" {...field} />
                )}
              />
            </div>
          )}
        </div>
      </form>
    </Form>
  );
});

interface WebsiteFormState {
  id: string;
  ref: RefObject<HTMLFormElement>;
  data: WebsiteFormData;
}

const getDefault = () => ({
  url: "",
  name: "Website",
  description: "",
  category: "",
  subCategory: "",
  source: "",
});

export default function WebsiteContent() {
  const { setWidgetMetadata, getWidgetMetadataById } = useBackendConnectorStore();
  const { getWidgetsByAttribute, updateWidget } = useShallowAppStore((s) => ({
    getWidgetsByAttribute: s.getWidgetsByAttribute,
    updateWidget: s.updateWidget,
  }));
  const dashboardId = useParams()?.id;

  const { setOpen, pendingNavigate, mode, id, onWidgetAdded } =
    useDataConnectorContext();
  const posthog = usePostHog();

  const [websiteForms, setWebsiteForms] = useState<WebsiteFormState[]>([
    {
      id: uuidv4(),
      ref: createRef(),
      data: {
        url: "",
        name: "Iframe",
        description: "",
        category: "",
        subCategory: "",
        source: "",
      },
    },
  ]);

  const metadata = useMemo(() => {
    return getWidgetMetadataById(id);
  }, [id]);

  const [websiteData, setWebsiteData] = useState<WebsiteFormData>({
    url: metadata?.storage?.html as string,
    name: metadata?.name,
    description: metadata?.description,
    category: metadata?.category,
    subCategory: metadata?.subCategory,
    source: metadata?.source,
  });

  const updateEditFormData = useCallback((data: WebsiteFormData) => {
    setWebsiteData(data);
  }, []);

  const [selectedTab, setSelectedTab] = useState<string>(websiteForms[0].id);

  const addWebsiteForm = useCallback(() => {
    const newId = uuidv4();
    setWebsiteForms((prev) => [
      ...prev,
      { id: newId, ref: createRef(), data: getDefault() },
    ]);
    setSelectedTab(newId);
  }, []);

  const removeWebsiteForm = useCallback(
    (id: string) => {
      setWebsiteForms((prev) => prev.filter((form) => form.id !== id));
    },
    [websiteForms],
  );

  useEffect(() => {
    // Check if the currently selected tab still exists
    const tabExists = websiteForms.some((form) => form.id === selectedTab);

    // If the selected tab doesn't exist, select the last tab
    if (!tabExists && websiteForms.length > 0) {
      setSelectedTab(websiteForms[websiteForms.length - 1].id);
    }
  }, [websiteForms, selectedTab]);

  const updateFormData = useCallback((id: string, data: WebsiteFormData) => {
    setWebsiteForms((prev) =>
      prev.map((form) => (form.id === id ? { ...form, data } : form)),
    );
  }, []);

  const enableSubmit = useMemo(() => {
    if (mode === "edit") {
      return WebsiteSchema.safeParse(websiteData);
    }
    return websiteForms.every((form) => WebsiteSchema.safeParse(form.data).success);
  }, [mode, websiteData, websiteForms]);

  const onSubmit = useCallback(async () => {
    if (mode === "edit") {
      try {
        const widgetMetadata = {
          widgetId: id,
          widgetType: "iframe" as const,
          name: websiteData.name,
          description: websiteData.description ?? "",
          category: websiteData.category ?? "",
          subCategory: websiteData.subCategory ?? "",
          source: websiteData.source ?? "",
          storage: {
            html:
              websiteData.url.startsWith("http://") ||
              websiteData.url.startsWith("https://")
                ? websiteData.url
                : `https://${websiteData.url}`,
          },
        };
        const result = await patchWidgetMetadata(widgetMetadata, id);

        if (result.success) {
          // Update the global widget metadata state
          const updatedMetadata = await getWidgetMetadata();
          setWidgetMetadata(updatedMetadata);

          const identifier = `iframe-${id}`;
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
      } finally {
      }
    } else {
      const validForms = websiteForms.filter((form) => {
        return WebsiteSchema.safeParse(form.data).success;
      });

      if (validForms.length !== websiteForms.length) {
        toast.error("Please ensure all iframe URLs are valid");
        return;
      }

      if (validForms.length === 0) {
        toast.error("Please enter at least one iframe URL");
        return;
      }
      try {
        const widgets = await Promise.all(
          validForms.map(async (form) => {
            const widgetId = uuidv4();
            const widgetMetadata = {
              widgetId: widgetId,
              widgetType: "iframe" as const,
              name: form.data.name,
              description: form.data.description ?? "",
              category: form.data.category ?? "",
              subCategory: form.data.subCategory ?? "",
              source: form.data.source ?? "",
              storage: {
                html:
                  form.data.url.startsWith("http://") ||
                  form.data.url.startsWith("https://")
                    ? form.data.url
                    : `https://${form.data.url}`,
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
              widgetId: `iframe-${widgetId}`,
              name: form.data.name,
              description: form.data.description ?? "",
              storage: {
                html: widgetMetadata.storage.html,
              },
            } as unknown as WidgetT;
          }),
        );

        const result = await getWidgetMetadata();
        setWidgetMetadata(result);

        setWebsiteForms([{ id: uuidv4(), ref: createRef(), data: getDefault() }]);
        setOpen(false);
        onWidgetAdded?.();
        handleConnectionAdded(dashboardId, widgets, pendingNavigate);

        if (posthog) {
          for (const website of widgets) {
            posthog.capture("added_website", {
              name: website.name,
              category: website.category,
              source: website.source,
              url: website.storage?.html,
            });
          }
        }
      } catch (error) {
        console.error("Error adding iframe widgets:", error);
        toast.error("An error occurred while adding iframe widgets");
      }
    }
  }, [websiteForms, setOpen, pendingNavigate, dashboardId, mode, id, websiteData]);

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
              {websiteForms.map((websiteForm) => (
                <TabsTrigger
                  key={websiteForm.id}
                  value={websiteForm.id}
                  className="flex items-center justify-between gap-2 dark:bg-dark-500 whitespace-nowrap"
                >
                  {websiteForm.data.name || "Untitled"}
                  {websiteForms.length > 1 && (
                    <Icon
                      id="x-outline-circle"
                      className="w-3"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeWebsiteForm(websiteForm.id);
                      }}
                    />
                  )}
                </TabsTrigger>
              ))}
              <button
                className="BB-TabTrigger transition text-nowrap rounded-t-sm px-2.5 disabled:pointer-events-none disabled:opacity-50 bg-light-100 text-light-500 hover:text-light-750 radix-state-active:bg-brand-main radix-state-active:text-light-50 [&.active]:bg-brand-main [&.active]:text-light-50 dark:bg-dark-700 dark:text-dark-50 dark:hover:text-light-200 dark:radix-state-active:bg-brand-main dark:radix-state-active:text-light-50 dark:[&.active]:bg-brand-main dark:[&.active]:text-light-50"
                onClick={addWebsiteForm}
              >
                <Icon id="plus" />
              </button>
            </div>
          </TabsList>
          <div className="bg-light-100 p-2.5 dark:bg-dark-750 rounded-br rounded-tr rounded-bl">
            {websiteForms.map((websiteForm) => (
              <TabsContent key={websiteForm.id} value={websiteForm.id}>
                <WebsiteForm
                  ref={websiteForm.ref}
                  initialValues={websiteForm.data}
                  onChange={(data) => updateFormData(websiteForm.id, data)}
                />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      )}
      {mode === "edit" && (
        <WebsiteForm
          initialValues={websiteData}
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
