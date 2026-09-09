import { zodResolver } from "@hookform/resolvers/zod";
import posthog from "posthog-js";
import {
  type ChangeEvent as ReactChangeEvent,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useUpdateEffect } from "usehooks-ts";
import { z } from "zod";
import {
  addDatabase,
  addDatabaseExisting,
  type SnowDatabase,
  snowflakeTables,
  snowflakeTablesExisting,
  snowflakeWarehouses,
  snowflakeWarehousesExisting,
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
import InfoIcon from "~/components/Icons/Info";
import Tooltip from "~/components/Tooltip";
import type { WidgetT } from "~/components/types";
import { useStateReducer } from "~/hooks/useStateReducer";
import {
  type SnowflakeDatabase,
  useDataConnectorStore,
} from "~/lib/state/dataConnector";
import { dispatchSaveState } from "~/lib/utils";
import { handleConnectionAdded } from "~/lib/utils/dataConnectors";
import { type Form2Type, formatUrl } from "~/utils/dataConnectorsHelpers";
import { dangerousQuery } from "~/utils/validators";
import { DatabaseSubmitSchema, type SnowflakeIntroForm } from "~/utils/zodForms";
import { useDataConnectorContext } from "../Providers/DataConnectorContext";

const form2Schema = z
  .object({
    role: z.string().min(1, "This field is required"),
    warehouse: z.string().min(1, "This field is required"),
    schema: z.string().min(1, "This field is required"),
    table: z.string().optional(),
  })
  .merge(DatabaseSubmitSchema);

type TForm2 = z.infer<typeof form2Schema>;

function findWordAfterFrom(text: string | undefined): string | null {
  // This regex is used to find the word after the FROM keyword in a SQL query
  if (text === undefined) return null;
  const regex = /from\s+(\w+)/i;
  const match = text.match(regex);
  return match ? match[1] : null;
}

function TableInfo() {
  return (
    <div className="flex">
      <span className="mr-1">Table or View</span>
      <Tooltip message="Selecting a table is only used to generate a simple SQL query, and is not required">
        <div>
          <InfoIcon className="size-4" />
        </div>
      </Tooltip>
    </div>
  );
}

function getBaseOptions(
  activeItem: SnowflakeDatabase | undefined,
  isEdit: boolean,
  role: string,
): { database: string; schema: string; table: string }[] {
  if (activeItem === undefined) return [];
  const { database, database_schema: schema } = activeItem;
  if (!isEdit) return [];
  if (role !== activeItem?.role) return [];
  return [{ database, schema, table: "" }];
}

function getBaseWarehouses(
  activeItem: SnowflakeDatabase | undefined,
  isEdit: boolean,
  role: string,
): string[] {
  if (!isEdit) return [];
  if (role !== activeItem?.role) return [];
  return [activeItem?.warehouse];
}

export function Form2({
  activeItem, // activeItem is the snowflake object
  setSecondPage,
  data,
  selectItems,
  error,
}: Form2Type<SnowflakeDatabase, SnowflakeIntroForm>) {
  const dashboardId = useParams()?.id;

  const { mode, setOpen, pendingNavigate, onWidgetAdded } = useDataConnectorContext();
  const { setDatabases, dataConnectorUrl } = useDataConnectorStore();
  const isEdit = mode === "edit";
  const warehouses = getBaseWarehouses(activeItem, isEdit, activeItem?.role ?? "");

  const [state, dispatch] = useStateReducer({
    loading: false,
    options: getBaseOptions(activeItem, isEdit, activeItem?.role ?? ""),
    error: "",
    warehouses,
    // I am not sure this is the best design pattern, but I don't want a bunch
    // of useMemos, so I am just putting the variables in state
    realId: activeItem?.id,
    isEdit,
  });
  const noWarehouses = state.warehouses.length === 0;

  const form = useForm<TForm2>({
    resolver: zodResolver(form2Schema),
    defaultValues: {
      // Don't set the name or query if were creating a new one
      name: state.isEdit ? activeItem?.name : "",
      query: state.isEdit ? (activeItem?.query ?? "") : "",
      role: activeItem?.role ?? "",
      warehouse: activeItem?.warehouse ?? "",
      database: activeItem?.database ?? "",
      schema: activeItem?.database_schema ?? "",
      table: findWordAfterFrom(activeItem?.query) ?? "",
      category: state.isEdit ? (activeItem?.category ?? "") : "",
      sub_category: state.isEdit ? (activeItem?.subCategory ?? "") : "",
      description: state.isEdit ? (activeItem?.description ?? "") : "",
    },
  });

  const role = form.watch("role");
  const warehouse = form.watch("warehouse");
  const database = form.watch("database");
  const schema = form.watch("schema");

  const cleanData = useMemo(() => {
    return {
      username: data.username,
      password: data.password,
      account_identifier: formatUrl(data.account),
    };
  }, [data.username, data.password, data.account]);

  const databases = [...new Set(state.options.map((option) => option.database))];
  const schemas = [
    ...new Set(
      state.options
        .filter((option) => option.database === database)
        .map((option) => option.schema),
    ),
  ];
  const tables = [
    ...new Set(
      state.options
        .filter((option) => option.schema === schema && option.database === database)
        .map((option) => option.table),
    ),
  ];

  function handleNewData(items, location: "warehouses" | "options") {
    if (Array.isArray(items)) {
      dispatch({ [location]: items });
    } else {
      dispatch({ error: items?.detail ?? "Unexpected error occurred" });
    }
  }

  useEffect(() => {
    if (!role) return;
    if (activeItem) {
      snowflakeWarehousesExisting(state.realId, role).then((items) => {
        handleNewData(items, "warehouses");
      });
    } else {
      snowflakeWarehouses({ ...cleanData, role }).then((items) => {
        handleNewData(items, "warehouses");
      });
    }
  }, [role]);

  useUpdateEffect(() => {
    form.setValue("warehouse", "");
    form.setValue("database", "");
    form.setValue("schema", "");
    form.setValue("table", "");
    dispatch({ options: [] });
  }, [role]);

  useEffect(() => {
    if (!warehouse) return;
    if (activeItem) {
      snowflakeTablesExisting(state.realId, role, warehouse).then((items) => {
        handleNewData(items, "options");
      });
    } else {
      snowflakeTables({ ...cleanData, role, warehouse }).then((items) => {
        handleNewData(items, "options");
      });
    }
  }, [warehouse]);

  const sendData = useCallback(
    async (values: TForm2) => {
      const { table, ...rest } = values;
      dispatch({ loading: true });
      const tempData: SnowDatabase = { ...cleanData, ...rest };
      const dbType = "snowflake";

      const newDbs = state.realId
        ? mode !== "edit"
          ? await addDatabaseExisting(dbType, state.realId, tempData)
          : await updateDatabaseNonsensitive(dbType, state.realId, tempData)
        : await addDatabase(dbType, tempData);
      if (posthog) {
        posthog.capture("added_snowflake_backend", {
          backend_name: tempData.name,
        });
      }

      if (Array.isArray(newDbs)) {
        setDatabases(dbType, newDbs || []);
        const widgetId = state.isEdit
          ? state.realId
          : Math.max(...newDbs.map((db) => db.id));
        updateWidgets(dbType, state.realId, values);
        const widgetToAdd = {
          endpoint: `${dataConnectorUrl.toString()}snowflake/query/${widgetId}`,
          type: "table",
          external: true,
          category: values.category ?? "My Data",
          widgetId: `snowflake-${widgetId}`,
          dataKey: "data",
          description: values.query,
          name: values.name,
          sourceDatabase: values.database,
          connectionType: "snowflake",
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
      dispatch({
        loading: false,
        error: newDbs?.detail ?? "Unexpected error occurred",
      });
      toast.error("Unable to update the snowflake database");
    },
    [
      cleanData,
      state.realId,
      dataConnectorUrl,
      pendingNavigate,
      dispatch,
      state.isEdit,
      dashboardId,
      onWidgetAdded,
    ],
  );

  const handleSubmit = useCallback(
    async (values: TForm2) => {
      dispatch({ loading: false });
      const dangerous = dangerousQuery(values.query);
      const body = `Your query contains the keyword "${dangerous}" which is potentially dangerous. Would you still like to run the query?`;
      if (dangerous) {
        toast.warning("Dangerous Keyword", {
          description: body,
          duration: 100000,
          onDismiss: () => dispatch({ loading: false }),
          action: {
            label: "Run Query",
            onClick: () => sendData(values),
          },
          cancel: {
            label: "Cancel",
            onClick: () => dispatch({ loading: false }),
          },
        });
      } else {
        await sendData(values);
      }
    },
    [sendData, dispatch],
  );

  function handleFormChange(e: ReactChangeEvent<HTMLFormElement>) {
    if (e.target.name === "table") {
      form.setValue("query", `SELECT * FROM ${e.target.value} LIMIT 500`);
    }
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4 text-xs text-[#A2A2A2] dark:text-[#8A8A90] pr-1"
        onSubmit={form.handleSubmit(handleSubmit)}
        onChange={handleFormChange}
      >
        <FormField
          name="name"
          control={form.control}
          render={({ field }) => {
            return <FormInput label="Name" placeholder="OpenBB" {...field} />;
          }}
        />
        <FormField
          name="role"
          control={form.control}
          render={({ field }) => (
            <FormSelect
              label="Role"
              options={listToSortedSet(selectItems)}
              placeholder="Select a role"
              onChange={(e) => console.log(e)}
              {...field}
            />
          )}
        />
        <FormField
          name="warehouse"
          control={form.control}
          render={({ field }) => (
            <FormSelect
              label="Warehouse"
              options={listToSortedSet(state.warehouses)}
              placeholder="Select a warehouse"
              disabled={noWarehouses}
              {...field}
            />
          )}
        />
        <FormField
          name="database"
          control={form.control}
          render={({ field }) => (
            <FormSelect
              label="Database"
              options={listToSortedSet(databases)}
              placeholder="Select a database"
              disabled={databases.length === 0 || noWarehouses}
              {...field}
            />
          )}
        />
        <FormField
          name="schema"
          control={form.control}
          render={({ field }) => (
            <FormSelect
              label="Schema"
              options={listToSortedSet(schemas)}
              placeholder="Select a schema"
              disabled={schemas.length === 0 || noWarehouses}
              {...field}
            />
          )}
        />
        {!state.isEdit && (
          <FormField
            name="table"
            control={form.control}
            render={({ field }) => (
              <FormSelect
                label={<TableInfo />}
                options={listToSortedSet(tables)}
                placeholder="Select a table or view"
                disabled={tables.length === 0 || noWarehouses}
                {...field}
              />
            )}
          />
        )}
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
            <FormSQLTextArea
              className="mb-4 mt-2"
              name="query"
              {...field}
              disabled={noWarehouses}
            />
          )}
        />
        {state.error && <p className="text-red-500">{state.error}</p>}
        <div className="mt-auto flex justify-end mb-2.5">
          {!state.realId && (
            <Button
              type="button"
              size="sm"
              disabled={state.loading}
              variant="outlined"
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
            loading={state.loading}
          >
            {state.isEdit ? "Update" : "Add"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
