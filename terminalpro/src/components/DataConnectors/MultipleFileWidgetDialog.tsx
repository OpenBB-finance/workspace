import clsx from "clsx";
import { useCallback, useEffect, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { z } from "zod";
import { deleteUploadedFile } from "~/api/auth.api";
import { CATEGORY_OPTIONS } from "~/components/DataConnectors/common/helpers";
import { UploadedFile } from "~/components/General/UploadedFile";
import { useStateReducer } from "~/hooks/useStateReducer";
import { fetchWithToken } from "~/lib/api";
import { ExtensionOptions } from "~/lib/constants";
import { FormInput } from "../ds/atoms/Input";
import { FormSelect } from "../ds/atoms/Select";
import { FormTextarea } from "../ds/atoms/TextArea";
import { FormField } from "../ds/molecules/Form";
import { countItemsPerKey } from "../General/Table/utils";
import Icon from "../Icon";
import { type FileType, useFileContext } from "./FileContext";
import { getExtension, getLabel } from "./NewComponents/File/UploadFilesTab1";

const filesSchema = z.record(
  z.string(),
  z.object({
    uuid: z.string().optional(),
    name: z.string().min(1, "This field is required"),
    description: z.string().optional(),
    url: z.string().min(1, "This field is required").url(),
    originalFileName: z.string().optional(),
    dataKey: z.string().optional(),
    extension: z.enum(ExtensionOptions),
    category: z.enum(CATEGORY_OPTIONS).optional(),
    subCategory: z.string().optional(),
    source: z.string().optional(),
  }),
);

type FilesForm = z.infer<typeof filesSchema>;

type FileFormElementProps = {
  fileIndex: number;
  file: FileType;
  handleSubmit: (values: FilesForm) => void;
};

type FileExtraSettingsProps = {
  fileIndex: number;
  fileKey: string;
  selectOptions: { path: string; count: number | string }[];
};

export function FileExtraSettings(props: FileExtraSettingsProps) {
  const form = useFormContext<FilesForm>();
  const { fileIndex, fileKey, selectOptions } = props;

  return (
    <div className="collapsible-content mt-2" key={`${fileKey}-collapsible-content`}>
      <div className="flex grid-cols-2 gap-4">
        <div className="gap-y-6 col-span-2 md:col-span-1 md:w-2/5 ">
          <FormField
            name={`${fileIndex}.category`}
            control={form.control}
            render={({ field }) => (
              <FormSelect
                className=""
                label={<p className="">Category</p>}
                options={CATEGORY_OPTIONS}
                {...field}
              />
            )}
          />
          <div className="my-2" />
          <FormField
            name={`${fileIndex}.subCategory`}
            render={({ field }) => (
              <FormInput
                className=""
                label={<p className="">Sub-category</p>}
                {...field}
              />
            )}
          />
          <div className="my-2" />
          <FormField
            name={`${fileIndex}.source`}
            render={({ field }) => (
              <FormInput className="" label={<p className="">Source</p>} {...field} />
            )}
          />

          {selectOptions?.length > 0 && (
            <>
              <div className="my-2" />
              <FormField
                name={`${fileIndex}.dataKey`}
                control={form.control}
                render={({ field }) => (
                  <FormSelect
                    className=""
                    label={<p className="">Data Key (optional)</p>}
                    options={selectOptions.map((item) => ({
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
        <div className="w-full col-span-2 md:col-span-1 md:w-3/5">
          <FormField
            name={`${fileIndex}.description`}
            control={form.control}
            render={({ field }) => (
              <div>
                <FormTextarea
                  className="min-h-[173px] max-h-[173px]"
                  label={<p className="">Description</p>}
                  placeholder="Investment report on NVDA written by Bobby Axelrod at Axe Capital"
                  {...field}
                />
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}

export function FileFormElement(props: FileFormElementProps) {
  const { setFiles } = useFileContext();
  const { file, fileIndex, handleSubmit } = props;
  const form = useFormContext<FilesForm>();

  const [state, dispatch] = useStateReducer({
    isOpen: false,
    selectOptions: [] as { path: string; count: number | string }[],
  });

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
    if (file?.url) {
      const extension = getExtension(file?.url);
      if (extension === "json") {
        fetchWithToken(file?.url)
          .then(async (response) => {
            const data = await response.json();
            getKeys(data);
          })
          .catch((error) => {
            console.error("Error fetching file: ", error);
          });
      }
    }
  }, [file?.url, getKeys]);

  const fileKey = useMemo(
    () => `${file?.originalFileName}_${fileIndex}`,
    [fileIndex, file?.originalFileName],
  );

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} key={`${fileKey}-form`}>
      <div
        className="my-4 flex flex-col gap-2 dark:bg-dark-750 bg-white p-2 rounded"
        key={`${fileKey}-form-div`}
      >
        <div className="flex gap-2 items-center" key={`${fileKey}-name`}>
          <div className="w-1/2 flex gap-2 items-center">
            <label>Name</label>
            <div className="w-full">
              <FormField
                name={`${fileIndex}.name`}
                control={form.control}
                render={({ field }) => <FormInput className="" {...field} />}
              />
            </div>
          </div>
          <UploadedFile
            className="w-1/2 [&>div]:max-w-[80%]"
            status="uploaded"
            name={file.originalFileName}
            onClick={() => {
              deleteUploadedFile(file.uuid)
                .then(async ({ status }) => {
                  if (status === 200) {
                    setFiles((prevFiles) => {
                      const newFiles = prevFiles.filter((f) => f.uuid !== file.uuid);
                      /*       if (newFiles.length === 0) {
                          setSearchParams({ currentTab });
                        }*/
                      return newFiles;
                    });
                  }
                })
                .catch((error) => {
                  console.error("Error deleting file: ", error);
                });
            }}
          />
        </div>
        <div
          className="collapsible dark:bg-dark-700 bg-light-50 rounded p-1.5"
          key={`${fileKey}-collapsible`}
        >
          <div
            className="collapsible-trigger cursor-pointer flex"
            key={`${fileKey}-collapsible-trigger`}
            onClick={() => dispatch({ isOpen: (open) => !open })}
          >
            <Icon
              id="chevron-right"
              className={clsx(
                "size-4 min-w-4 ease-[cubic-bezier(0.87,_0,_0.13,_1)] transition-transform duration-300 text-light-400 mr-2",
                { "rotate-90": state.isOpen },
              )}
            />
            <p className="text-light-600 dark:text-light-100 font-bold">Metadata</p>
            <p className="text-dark-50 ml-2 italic">(optional)</p>
          </div>
          {state.isOpen && (
            <FileExtraSettings
              fileIndex={fileIndex}
              fileKey={fileKey}
              selectOptions={state.selectOptions}
            />
          )}
        </div>
      </div>
    </form>
  );
}
