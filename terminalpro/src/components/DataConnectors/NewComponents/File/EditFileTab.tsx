import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getFileWidgets, type PostFileWidget, postFileWidget } from "~/api/auth.api";
import { Button } from "~/components/ds/atoms/Button";
import { FormInput } from "~/components/ds/atoms/Input";
import { FormSelect } from "~/components/ds/atoms/Select";
import { FormTextarea } from "~/components/ds/atoms/TextArea";
import { FormField } from "~/components/ds/molecules/Form";
import { countItemsPerKey } from "~/components/General/Table/utils";
import Icon from "~/components/Icon";
import { useStateReducer } from "~/hooks/useStateReducer";
import { fetchWithToken } from "~/lib/api";
import { useShallowAppStore } from "~/lib/state/app";
import { useBackendConnectorStore } from "~/lib/state/backendConnector";
import { cn, dispatchSaveState } from "~/lib/utils";
import { CATEGORY_OPTIONS } from "../../common/helpers";
import { useDataConnectorContext } from "../../Providers/DataConnectorContext";
import { getExtension, getLabel } from "./UploadFilesTab1";

const fileSchema = z.object({
  name: z.string().min(1, "This field is required"),
  description: z.string().optional(),
  category: z.enum(CATEGORY_OPTIONS).optional(),
  subCategory: z.string().optional(),
  source: z.string().optional(),
  dataKey: z.string().optional(),
});

type FileForm = z.infer<typeof fileSchema>;

const CATEGORY_SELECT_OPTIONS = CATEGORY_OPTIONS.map((v) => ({ value: v, label: v }));

export default function EditFileTab() {
  const { id, setOpen, mode } = useDataConnectorContext();
  const { setStoredFiles, storedFiles } = useBackendConnectorStore();
  const [state, dispatch] = useStateReducer({
    isExtraSettingsOpen: mode === "edit",
    selectOptions: [] as { path: string; count: number | string }[],
    loading: false,
  });

  const { getWidgetsByAttribute, updateWidget } = useShallowAppStore((s) => ({
    getWidgetsByAttribute: s.getWidgetsByAttribute,
    updateWidget: s.updateWidget,
  }));

  const currentFile = useMemo(
    () => storedFiles.find((file) => file.id === id),
    [id, storedFiles],
  );

  const form = useForm<FileForm>({
    resolver: zodResolver(fileSchema),
    defaultValues: {
      category: currentFile?.category,
      subCategory: currentFile?.subCategory,
      description: currentFile?.description,
      name: currentFile?.name,
      source: currentFile?.source || "",
      dataKey: currentFile?.dataKey,
    },
  });

  function updateWidgets(newWidget: PostFileWidget) {
    const identifier = `file-${id}`;
    const selectedWidgets = getWidgetsByAttribute("widgetId", identifier);
    const { name, description, category, subCategory, source, dataKey, url } =
      newWidget;
    for (const [dashId, widgets] of Object.entries(selectedWidgets)) {
      for (const widget of widgets) {
        updateWidget(dashId, {
          ...widget,
          name,
          description,
          category,
          subCategory,
          source: source ? [source] : [],
          data: {
            ...(widget.data || {}),
            dataKey,
          },
          endpoint: { url, method: "GET" },
        });
      }
    }
  }

  const handleSubmit = useCallback(
    async (values: FileForm) => {
      if (!id) return;
      dispatch({ loading: true });

      const dataKey = values.dataKey !== "None" ? values.dataKey || "" : "";

      const cleanData = {
        stored_file_uuid: currentFile?.uuid,
        originalFileName: currentFile?.originalFileName,
        url: currentFile?.url,
        extension: currentFile?.extension,
        name: values.name,
        description: values.description,
        category: values.category,
        subCategory: values.subCategory,
        source: values.source,
        dataKey,
      } as PostFileWidget;

      try {
        const { status } = await postFileWidget(id, cleanData);
        if (status !== 200) {
          toast.error("Something went wrong. Please try again.", {
            description: "Unknown error occurred",
          });
          dispatch({ loading: false });
          return;
        }

        updateWidgets(cleanData);

        const fileWidgets = await getFileWidgets();
        setStoredFiles(fileWidgets);
        dispatchSaveState();
        toast.success("File updated successfully");
        setOpen(false);
      } catch (error) {
        console.error("Error updating file: ", error);
        toast.error("Failed to update the widget. Please try again.");
      } finally {
        dispatch({ loading: false });
      }
    },
    [id, currentFile, setStoredFiles],
  );

  const getKeys = useCallback(async (parsed: any) => {
    if (Array.isArray(parsed)) {
      return;
    }
    const counts = countItemsPerKey(parsed);

    if (Object.values(counts).every((item) => item.count === 1)) return;

    counts.sort((a, b) => b.count - a.count);
    dispatch({ selectOptions: [{ path: "None", count: "" }, ...counts] });
  }, []);

  useEffect(() => {
    // we populate the data key options
    if (currentFile?.url) {
      const extension = getExtension(currentFile?.url);
      if (extension === "json") {
        fetchWithToken(currentFile?.url)
          .then(async (response) => {
            const data = await response.json();
            getKeys(data);
          })
          .catch((error) => {
            console.error("Error fetching file: ", error);
          });
      }
    }
  }, [currentFile?.url, getKeys]);

  const onClick = useCallback(
    () => dispatch({ isExtraSettingsOpen: (prev) => !prev }),
    [dispatch],
  );
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full">
        <div className="space-y-4">
          <FormField
            name="name"
            control={form.control}
            render={({ field }) => <FormInput label="Name" className="" {...field} />}
          />

          <hr className="my-2" />

          <div className="collapsible">
            <div className="collapsible-trigger cursor-pointer flex" onClick={onClick}>
              <Icon
                id="chevron-right"
                className={cn(
                  "size-4 min-w-4 ease-[cubic-bezier(0.87,_0,_0.13,_1)]",
                  "transition-transform duration-300 text-light-4000 mr-2",
                  { "rotate-90": state.isExtraSettingsOpen },
                )}
              />
              <p className="text-light-600 dark:text-light-100 font-bold">Metadata</p>
              <p className="text-dark-50 ml-2 italic">(optional)</p>
            </div>

            {state.isExtraSettingsOpen && (
              <div className="collapsible-content mt-2">
                <div className="flex grid-cols-2 gap-4">
                  <div className="col-span-2 md:col-span-1 md:w-2/5 space-y-4">
                    <FormField
                      name="category"
                      control={form.control}
                      render={({ field }) => (
                        <FormSelect
                          label={
                            <p className="text-light-600 dark:text-light-300">
                              Category
                            </p>
                          }
                          options={CATEGORY_SELECT_OPTIONS}
                          {...field}
                        />
                      )}
                    />
                    <FormField
                      name="subCategory"
                      control={form.control}
                      render={({ field }) => (
                        <FormInput
                          className=""
                          label={
                            <p className="text-light-600 dark:text-light-300">
                              Sub-category
                            </p>
                          }
                          {...field}
                        />
                      )}
                    />
                    <FormField
                      name="source"
                      control={form.control}
                      render={({ field }) => (
                        <FormInput
                          className=""
                          label={
                            <p className="text-light-600 dark:text-light-300">Source</p>
                          }
                          {...field}
                        />
                      )}
                    />
                    {state.selectOptions.length > 0 && (
                      <>
                        <div className="my-2" />
                        <FormField
                          name="dataKey"
                          control={form.control}
                          render={({ field }) => (
                            <FormSelect
                              className="border-2 dark:border-[#46464F]"
                              label={
                                <p className="text-light-600 dark:text-light-300">
                                  Data Key (optional)
                                </p>
                              }
                              options={state.selectOptions.map((item) => ({
                                label: getLabel(item.path, item.count),
                                value: item.path,
                              }))}
                              {...field}
                            />
                          )}
                        />
                      </>
                    )}
                  </div>
                  <div className="w-full col-span-2 md:col-span-1 md:w-3/5 overflow-hidden max-h-[215px]">
                    {/* This thing behaves really weird - need to revisit - this helps
                    for now */}
                    <FormField
                      name="description"
                      control={form.control}
                      render={({ field }) => (
                        <FormTextarea
                          className=""
                          label={
                            <p className="text-light-600 dark:text-light-300 overflow-hidden">
                              Description
                            </p>
                          }
                          {...field}
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-auto flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} size="sm">
            Cancel
          </Button>
          <Button
            className="[&_svg]:h-4"
            loading={state.loading}
            type="submit"
            size="sm"
          >
            Update
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
