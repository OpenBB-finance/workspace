import { useCallback } from "react";
import { useFormContext } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { Button } from "../ds/atoms/Button";
import Icon from "../Icon";
import {
  type SingleWidgetFormT,
  SingleWidgetInfo,
  useSingleWidgetContext,
} from "./SingleWidget";

export function SingleWidgetDialogElement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const id = searchParams.get("id");

  const form = useFormContext<SingleWidgetFormT>();

  const {
    state: { loading, isTested },
    onTestSource,
    onAddWidget,
  } = useSingleWidgetContext();

  const handleAddPair = useCallback(() => {
    const endpointHeaders = form.getValues("endpointHeaders");
    const index = endpointHeaders?.length || 0;
    form.setValue(`endpointHeaders.${index}`, { key: "", value: "" });
  }, [form.getValues, form.setValue]);

  return (
    <>
      <SingleWidgetInfo handleAddPair={handleAddPair} />
      <div className="mt-auto flex gap-2 self-end">
        {isTested && (
          <p className="inline-flex items-center gap-1 text-alert-success">
            <Icon id="checkmark-icon" className="h-4 w-4" />
            Successful!
          </p>
        )}
        <Button
          size="sm"
          onClick={form.handleSubmit(onTestSource)}
          loading={loading}
          className="_test-single-widget [&_svg]:h-4"
          variant="secondary"
        >
          Test Source
        </Button>
        <Button
          size="sm"
          onClick={form.handleSubmit(onAddWidget)}
          disabled={!(isTested || id)}
          className="_add-single-widget"
          variant="primary"
        >
          {id ? "Update" : "Add"}
        </Button>
      </div>
    </>
  );
}
