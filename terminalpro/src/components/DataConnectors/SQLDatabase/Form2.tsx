import { zodResolver } from "@hookform/resolvers/zod";
import posthog from "posthog-js";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  addDatabase,
  addDatabaseExisting,
  type SQLDatabase,
  updateDatabaseNonsensitive,
} from "~/api/dataConnectors";
import {
  CATEGORY_OPTIONS,
  listToSortedSet,
  updateWidgets,
} from "~/components/DataConnectors/common/helpers";
import { Button } from "~/components/ds/atoms/Button";
import { FormInput } from "~/components/ds/atoms/Input";
import { FormSelect } from "~/components/ds/atoms/Select";
import { Form, FormField } from "~/components/ds/molecules/Form";
import { FormSQLTextArea } from "~/components/General/Table/SubMenus/SQLTextArea";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import type { WidgetT } from "~/components/types";
import { type Database, useShallowDataConnectorStore } from "~/lib/state/dataConnector";
import { dispatchSaveState } from "~/lib/utils";
import { handleConnectionAdded } from "~/lib/utils/dataConnectors";
import type { Form2Type } from "~/utils/dataConnectorsHelpers";
import { dangerousQuery } from "~/utils/validators";
import type { DatabaseSubmitForm, SQLIntroForm } from "~/utils/zodForms";
import { DatabaseSubmitSchema } from "~/utils/zodForms";
import { useDataConnectorContext } from "../Providers/DataConnectorContext";

export function Form2({
  activeItem,
  data,
  setSecondPage,
  selectItems,
  error,
}: Form2Type<Database, SQLIntroForm>) {
  const dashboardId = useParams()?.id;

  const { mode, setOpen, pendingNavigate, onWidgetAdded } = useDataConnectorContext();
  const { setDatabases, dataConnectorUrl } = useShallowDataConnectorStore((state) => ({
    setDatabases: state.setDatabases,
    dataConnectorUrl: state.dataConnectorUrl,
  }));
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const realId = activeItem?.id;
  const isEdit = mode === "edit";
  const isSqlite =
    data?.database_type === undefined
      ? activeItem?.database_type === "sqlite"
      : data?.database_type === "sqlite";

  const form = useForm<DatabaseSubmitForm>({
    resolver: zodResolver(DatabaseSubmitSchema),
    defaultValues: {
      name: isEdit ? (activeItem?.name ?? "") : "",
      database: isEdit ? (activeItem?.database ?? "") : "",
      query: isEdit ? (activeItem?.query ?? "") : "",
      category: isEdit ? (activeItem?.category ?? "") : "",
      sub_category: isEdit ? (activeItem?.subCategory ?? "") : "",
      description: isEdit ? (activeItem?.description ?? "") : "",
    },
  });

  const sendData = useCallback(
    async (values: DatabaseSubmitForm) => {
      const finalData = { ...data, ...values } as SQLDatabase;
      const dbType = "database";

      const newDbs = realId
        ? mode !== "edit"
          ? await addDatabaseExisting(dbType, realId, values as Database)
          : await updateDatabaseNonsensitive(dbType, realId, values as Database)
        : await addDatabase(dbType, finalData);

      if (Array.isArray(newDbs)) {
        setDatabases(dbType, newDbs || []);
        const widgetId = isEdit ? realId : Math.max(...newDbs.map((db) => db.id));
        updateWidgets(dbType, realId, values);

        if (posthog && mode !== "edit") {
          posthog.capture("added_database_backend", {
            backend_name: finalData.name,
            backend_type: finalData.database_type,
          });
        }

        const widgetToAdd = {
          endpoint: `${dataConnectorUrl.toString()}sql/query/${widgetId}`,
          type: "table" as const,
          external: true,
          category: values.category ?? "My Data",
          widgetId: `database-${widgetId}`,
          dataKey: "data",
          description: values.query,
          name: values.name,
          sourceDatabase: values.database,
          connectionType: "database",
          subCategory: values.sub_category,
        } as unknown as WidgetT;
        dispatchSaveState();
        setOpen(false);
        onWidgetAdded?.();
        handleConnectionAdded(
          dashboardId,
          [widgetToAdd],
          pendingNavigate,
          mode === "edit",
        );
        return;
      }
      const error = newDbs?.detail ?? "Unexpected error occurred";
      setErrorMessage(error);
      setLoading(false);
      toast.error("Unable to update the database");
    },
    [
      data,
      realId,
      setDatabases,
      dataConnectorUrl,
      pendingNavigate,
      dashboardId,
      onWidgetAdded,
    ],
  );

  const handleSubmit = useCallback(
    async (values: DatabaseSubmitForm) => {
      setLoading(true);
      const dangerous = dangerousQuery(values.query);
      if (dangerous) {
        const body = `Your query contains the keyword "${dangerous}" which is potentially dangerous. Would you still like to run the query?`;
        toast.warning("Dangerous Keyword", {
          duration: 100000,
          description: body,
          onDismiss: () => setLoading(false),
          action: {
            label: "Run Query",
            onClick: () => sendData(values),
          },
          cancel: {
            label: "Cancel",
            onClick: () => setLoading(false),
          },
        });
      } else {
        await sendData(values);
      }
    },
    [sendData],
  );

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4 text-xs text-[#A2A2A2] dark:text-[#8A8A90] pr-1"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FormField
          name="name"
          render={({ field }) => (
            <FormInput label="Name" placeholder="OpenBB" {...field} />
          )}
        />
        <FormField
          name="database"
          control={form.control}
          render={({ field }) =>
            isSqlite ? (
              <div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <label>Database</label>
                  <Tooltip message="Paste the full path to your SQLite database below">
                    <button
                      type="button"
                      style={{ border: "none", background: "none", cursor: "pointer" }}
                    >
                      <Icon id="info-circled-icon" className="size-3 ml-1" />
                    </button>
                  </Tooltip>
                </div>
                <FormInput {...field} />
              </div>
            ) : (
              <FormSelect
                label="Database"
                options={listToSortedSet(selectItems)}
                disabled={selectItems.length === 0}
                placeholder="Select a database"
                {...field}
              />
            )
          }
        />
        <div
          className="border-[#DCDCDC] dark:border-[#36363F] my-2"
          style={{ borderTopWidth: "1px" }}
        />
        <FormField
          name="category"
          control={form.control}
          render={({ field }) => (
            <FormSelect
              label={
                <p>
                  Category<span className="text-[#5A5961]"> (optional)</span>
                </p>
              }
              options={CATEGORY_OPTIONS}
              {...field}
            />
          )}
        />
        <FormField
          name="sub_category"
          render={({ field }) => (
            <FormInput
              label={
                <p>
                  Sub Category<span className="text-[#5A5961]"> (optional)</span>
                </p>
              }
              placeholder="e.g. Fundamental Analysis"
              {...field}
            />
          )}
        />
        <FormField
          name="description"
          render={({ field }) => (
            <FormInput
              label={
                <p>
                  Description<span className="text-[#5A5961]"> (optional)</span>
                </p>
              }
              placeholder="e.g. The top 10 CEOs by salary for 2015"
              {...field}
            />
          )}
        />
        <div
          className="border-[#DCDCDC] dark:border-[#36363F] my-2"
          style={{ borderTopWidth: "1px" }}
        />
        <FormField
          name="query"
          control={form.control}
          render={({ field }) => (
            <FormSQLTextArea className="mb-4 mt-2" name="query" {...field} />
          )}
        />
        {errorMessage && <p className="text-red-500">{errorMessage}</p>}
        <div className="mt-auto flex justify-end mb-2.5">
          {!realId && (
            <Button
              type="button"
              size="sm"
              variant="outlined"
              disabled={loading}
              className="mr-2"
              onClick={(e) => {
                e.preventDefault();
                setSecondPage(false);
              }}
            >
              Go Back
            </Button>
          )}
          <Button
            className="[&_svg]:h-4"
            disabled={error}
            type="submit"
            variant="primary"
            size="sm"
            loading={loading}
          >
            {isEdit ? "Update" : "Add"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
