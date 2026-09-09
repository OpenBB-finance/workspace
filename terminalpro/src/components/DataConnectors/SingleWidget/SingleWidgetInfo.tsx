import { type ChangeEvent, useCallback, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "~/components/ds/atoms/Button";
import { FormInput } from "~/components/ds/atoms/Input";
import { FormSelect } from "~/components/ds/atoms/Select";
import { FormTextarea } from "~/components/ds/atoms/TextArea";
import { FormField } from "~/components/ds/molecules/Form";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { cn } from "~/lib/utils";
import { CATEGORY_OPTIONS } from "../common/helpers";
import { useDataConnectorContext } from "../Providers/DataConnectorContext";
import { EndpointHeadersForm } from "./EndpointHeadersForm";
import type { SingleWidgetFormT } from "./types";
import { useSingleWidgetContext } from "./useSingleWidgetContext";
import { getLabel } from "./utils";

export function SingleWidgetInfo({ handleAddPair }: { handleAddPair: () => void }) {
  const { mode } = useDataConnectorContext();
  const { dispatch, state, onTestSource } = useSingleWidgetContext();
  const [isExtraSettingsOpen, setIsExtraSettingsOpen] = useState(mode === "edit");

  const form = useFormContext<SingleWidgetFormT>();

  const onChange = useCallback(
    (e: ChangeEvent<HTMLFormElement>) => {
      if (!state.isTested) return;

      const needsRetest = ["endpoint", "endpointHeaders"].some((name) =>
        e.target.name.includes(name),
      );

      if (needsRetest) dispatch({ isTested: false });
    },
    [state.isTested],
  );

  return (
    <form
      onSubmit={form.handleSubmit(onTestSource)}
      onChange={onChange}
      className="flex flex-col gap-2 text-xs text-[#A2A2A2] dark:text-[#8A8A90] max-h-[calc(100%-100px)] overflow-y-auto pr-2"
    >
      <FormField
        name="name"
        control={form.control}
        render={({ field }) => (
          <FormInput label="Name" placeholder="Historical Chain TVL" {...field} />
        )}
      />
      <FormField
        name="endpoint"
        control={form.control}
        render={({ field }) => (
          <FormInput
            label="Endpoint URL"
            placeholder="https://api.llama.fi/v2/historicalChainTvl"
            {...field}
          />
        )}
      />
      {state.selectOptions?.length > 0 && (
        <FormField
          name="dataKey"
          control={form.control}
          render={({ field }) => (
            <div className="relative">
              <FormSelect
                label={
                  <span className="flex items-center gap-2">
                    Data Key
                    <Tooltip
                      message={
                        "The key to the data in the response you want to display."
                      }
                    >
                      <button type="button">
                        <Icon id="info-outline-circle" className="size-4" />
                      </button>
                    </Tooltip>
                  </span>
                }
                options={state.selectOptions.map((item) => ({
                  label: getLabel(item.path, item.count),
                  value: item.path,
                }))}
                required={state.isTested}
                className={cn({ "border-red-500!": !!state.dataKeyError })}
                {...field}
              />
              {state.dataKeyError && (
                <p className="text-red-500">{state.dataKeyError}</p>
              )}
            </div>
          )}
        />
      )}
      <div className="mb-2">
        <EndpointHeadersForm />
        <Button
          type="button"
          onClick={handleAddPair}
          variant="outlined"
          size="xs"
          className="w-fit mt-1"
        >
          + Add Headers
        </Button>
      </div>
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
          <div className="flex flex-col gap-2 dark:bg-[#24242A] bg-[#F6F6F6] rounded">
            <FormField
              name="description"
              control={form.control}
              render={({ field }) => (
                <FormTextarea
                  label="Description"
                  placeholder="Total value locked (TVL) measures the U.S. dollar value of assets locked on a blockchain. It is an important indicator of investor and developer interest in a blockchain or decentralized application (dApp)."
                  {...field}
                  rows={3}
                />
              )}
            />
            <FormField
              name="category"
              control={form.control}
              render={({ field }) => (
                <FormSelect
                  label="Category"
                  options={CATEGORY_OPTIONS}
                  placeholder="Crypto"
                  {...field}
                />
              )}
            />
            <FormField
              name="subCategory"
              control={form.control}
              render={({ field }) => (
                <FormInput label="Sub-category" placeholder="Blockchain" {...field} />
              )}
            />
            <FormField
              name="source"
              control={form.control}
              render={({ field }) => (
                <FormInput label="Source" placeholder="DefiLlama" {...field} />
              )}
            />
          </div>
        )}
      </div>
    </form>
  );
}
