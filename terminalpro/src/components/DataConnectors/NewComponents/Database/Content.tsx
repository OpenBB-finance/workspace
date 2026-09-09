import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "~/components/ds/atoms/Button";
import { Input } from "~/components/ds/atoms/Input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "~/components/ds/molecules/Form";
import Icon from "~/components/Icon";
import type { WidgetT } from "~/components/types";
import { getConfig } from "~/lib/runtimeConfig";
import { useAppStore } from "~/lib/state/app";
import { cn, uuidv4 } from "~/lib/utils";
import {
  type ConnectorFormConfig,
  type ConnectorType,
  DATABASE_CONNECTORS,
  FORM_CONFIGS,
  type FormFieldConfig,
} from "./database-config";

// Type definitions for better type safety
interface DatabaseColumn {
  name: string;
  type: string;
}

interface SchemaData {
  [tableName: string]: DatabaseColumn[];
}

interface ConnectionDetails {
  [key: string]: string | number | boolean;
}

// Utility functions for column type mapping
const getCellDataType = (columnType: string): string => {
  if (columnType.includes("VARCHAR")) return "text";
  if (columnType.includes("INT") || columnType.includes("NUMBER")) return "number";
  if (columnType.includes("DATE") || columnType.includes("TIMESTAMP")) return "date";
  return "text";
};

const getChartDataType = (columnType: string): string => {
  if (columnType.includes("DATE") || columnType.includes("TIMESTAMP"))
    return "category";
  return "series";
};

const renderFormField = (field: FormFieldConfig, form: any) => {
  const { name, label, placeholder, type = "text", options, colSpan = 1 } = field;

  return (
    <FormField
      key={name}
      control={form.control}
      name={name}
      render={({ field: fieldProps }) => (
        <FormItem className={colSpan === 2 ? "sm:col-span-2" : ""}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {type === "select" ? (
              <select
                className="flex h-10 w-full rounded-sm border border-gray-200
                bg-white px-3 py-2 text-sm ring-offset-background
                file:border-0 file:bg-transparent file:text-sm file:font-medium
                placeholder:text-gray-500 focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-gray-300
                focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
                dark:border-dark-600 dark:bg-dark-800 dark:text-gray-50
                dark:placeholder:text-gray-400 dark:focus-visible:ring-gray-700"
                {...fieldProps}
              >
                {options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type={type}
                placeholder={placeholder}
                {...fieldProps}
                onChange={
                  type === "number"
                    ? (value) => fieldProps.onChange(Number(value))
                    : fieldProps.onChange
                }
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

const StandardDatabaseForm = ({
  config,
  onSubmit,
  isLoading,
}: {
  config: ConnectorFormConfig;
  onSubmit: (data: ConnectionDetails) => void;
  isLoading: boolean;
}) => {
  const form = useForm({
    resolver: zodResolver(config.schema),
    defaultValues: config.defaultValues,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div
          className={`grid grid-cols-1 gap-4 ${config.gridCols === 2 ? "sm:grid-cols-2" : ""}`}
        >
          {config.fields.map((field) => renderFormField(field, form))}
        </div>
        <Button type="submit" loading={isLoading} className="w-full">
          Test Connection
        </Button>
      </form>
    </Form>
  );
};

interface FormComponentProps {
  onSubmit: (data: ConnectionDetails) => void;
  isLoading: boolean;
}

const getFormComponent =
  (connectorType: ConnectorType) =>
  ({ onSubmit, isLoading }: FormComponentProps) => (
    <StandardDatabaseForm
      config={FORM_CONFIGS[connectorType]}
      onSubmit={onSubmit}
      isLoading={isLoading}
    />
  );

interface DatabaseTileProps {
  connector: (typeof DATABASE_CONNECTORS)[number];
  isSelected: boolean;
  onSelect: () => void;
}

function DatabaseTile({ connector, isSelected, onSelect }: DatabaseTileProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative w-full rounded-lg border-2 p-4 text-left transition-all hover:shadow-md",
        isSelected
          ? "border-brand-main bg-brand-main/5 dark:bg-brand-main/10"
          : "border-gray-200 bg-white hover:border-gray-300 dark:border-dark-600 dark:bg-dark-800 dark:hover:border-dark-500",
      )}
    >
      <div className="flex items-start space-x-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md text-white",
            connector.color,
          )}
        >
          <Icon id={connector.icon} className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            {connector.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {connector.description}
          </p>
        </div>
        {isSelected && <Icon id="check-circle" className="h-5 w-5 text-brand-main" />}
      </div>
    </button>
  );
}

export default function DatabaseContent() {
  const { id: currentDashboardId } = useParams();
  const navigate = useNavigate();
  const [selectedConnector, setSelectedConnector] = useState<ConnectorType | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | null>(
    null,
  );
  const [schemaData, setSchemaData] = useState<SchemaData | null>(null);
  const [showTables, setShowTables] = useState(false);

  const handleCreateOmniWidget = useCallback(
    (tableName: string, columns: DatabaseColumn[]) => {
      if (!(selectedConnector && connectionDetails)) return;

      try {
        const widgetUuid = uuidv4();
        // im doing this because if the widgetID starts with Snowflake it is annoying and makes a dif widget type
        // and i want to be able to have a widget type for snowflake and a widget type for omni not affect that
        const widgetId = `connection_${selectedConnector}_${tableName.toLowerCase()}`;

        // Create the omni widget similar to OmniWidget structure
        const newWidget = {
          id: widgetUuid,
          name: `${tableName} Table`,
          type: "omni" as const,
          widgetId: widgetId,
          external: true,
          params: [
            {
              type: "text",
              paramName: "prompt",
              value: `SELECT * FROM ${tableName} LIMIT 100`,
              label: "SQL Query",
              language: "sql",
            },
          ],
          endpoint: {
            url: `${getConfig().urls.database}/api/query`,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: {
              connector_type: selectedConnector,
              connection_details: connectionDetails,
              query: `SELECT * FROM ${tableName} LIMIT 100`,
            },
          },
          storage: {
            params: {
              prompt: `SELECT * FROM ${tableName} LIMIT 100`,
              connector_type: selectedConnector,
              connection_details: connectionDetails,
            },
            schema: {
              tableName: tableName,
              columns: columns.map((col) => ({
                name: col.name,
                type: col.type,
              })),
            },
            response: null,
          },
          data: {
            table: {
              enableCharts: true,
              columnsDefs: columns.slice(0, 10).map((col) => ({
                headerName: col.name,
                field: col.name.toLowerCase(),
                cellDataType: getCellDataType(col.type),
                chartDataType: getChartDataType(col.type),
              })),
            },
          },
        } as WidgetT;

        // Add widget to the current dashboard or create a new one
        if (currentDashboardId) {
          useAppStore.getState().addWidget(currentDashboardId, newWidget);
        } else {
          // Create a new dashboard if none exists
          const newDashboardId = uuidv4();
          useAppStore.getState().addTab({
            index: newDashboardId,
            data: {
              name: "Database Dashboard",
              type: "custom",
              widgets: [newWidget],
            },
          });
          navigate(`/app/${newDashboardId}`);

          console.log("Created new dashboard for database widgets");
        }
        console.log(`Created ${tableName} omni widget successfully!`);
      } catch (error) {
        console.error("Failed to create omni widget:", error);
      }
    },
    [selectedConnector, connectionDetails, currentDashboardId, navigate],
  );

  const handleTestConnection = useCallback(
    async (connectorType: ConnectorType, connectionDetails: ConnectionDetails) => {
      setIsLoading(true);

      try {
        const response = await fetch(`${getConfig().urls.database}/api/schema`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            connector_type: connectorType,
            connection_details: connectionDetails,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("Connection successful! Schema:", result);

        // Store the connection details and schema data
        setConnectionDetails(connectionDetails);
        setSchemaData(result);
        setShowTables(true);
      } catch (error) {
        console.error("Connection failed:", error);
        alert(
          `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const renderForm = useCallback(() => {
    if (!selectedConnector) return null;
    const FormComponent = getFormComponent(selectedConnector);
    return (
      <FormComponent
        onSubmit={(data) => handleTestConnection(selectedConnector, data)}
        isLoading={isLoading}
      />
    );
  }, [selectedConnector, handleTestConnection, isLoading]);

  return (
    <div className="flex h-full flex-col space-y-4">
      {selectedConnector ? (
        showTables && schemaData ? (
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-3">
              <Button
                variant="outlined"
                size="sm"
                onClick={() => {
                  setShowTables(false);
                  setSchemaData(null);
                  setConnectionDetails(null);
                }}
              >
                <Icon id="arrow-left" className="h-4 w-4 mr-1" />
                Back to Form
              </Button>
              <div className="flex items-center space-x-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-white",
                    DATABASE_CONNECTORS.find((c) => c.id === selectedConnector)?.color,
                  )}
                >
                  <Icon
                    id={
                      DATABASE_CONNECTORS.find((c) => c.id === selectedConnector)
                        ?.icon || "database-01"
                    }
                    className="h-4 w-4"
                  />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {DATABASE_CONNECTORS.find((c) => c.id === selectedConnector)?.name} -
                  Available Tables
                </h3>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
                  <div className="flex items-center space-x-2">
                    <Icon
                      id="check-circle"
                      className="h-5 w-5 text-green-600 dark:text-green-400"
                    />
                    <span className="font-medium text-green-800 dark:text-green-300">
                      Connection Successful!
                    </span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                    Found {Object.keys(schemaData).length} tables/views. Click on a
                    table to generate its widget JSON.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {Object.entries(schemaData).map(([tableName, columns]) => (
                    <div
                      key={tableName}
                      className="border border-gray-200 dark:border-dark-600 rounded-lg p-4 bg-white dark:bg-dark-800 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                          <Icon id="database-01" className="h-4 w-4 text-blue-500" />
                          <span>{tableName}</span>
                        </h4>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {columns.length} columns
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        <strong>SQL Query:</strong>
                        <code className="ml-2 bg-gray-100 dark:bg-dark-700 px-2 py-1 rounded text-xs">
                          SELECT * FROM {tableName} LIMIT 100
                        </code>
                      </div>

                      <div className="max-h-32 overflow-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-dark-600">
                              <th className="text-left py-1 pr-4 font-medium">
                                Column
                              </th>
                              <th className="text-left py-1 font-medium">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {columns.slice(0, 10).map((column, idx: number) => (
                              <tr
                                key={idx}
                                className="border-b border-gray-100 dark:border-dark-700"
                              >
                                <td className="py-1 pr-4 text-gray-900 dark:text-gray-100">
                                  {column.name}
                                </td>
                                <td className="py-1 text-gray-600 dark:text-gray-400">
                                  {column.type}
                                </td>
                              </tr>
                            ))}
                            {columns.length > 10 && (
                              <tr>
                                <td
                                  colSpan={2}
                                  className="py-1 text-gray-500 dark:text-gray-400 italic"
                                >
                                  ... and {columns.length - 10} more columns
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleCreateOmniWidget(tableName, columns)}
                          className="flex-1"
                        >
                          <Icon
                            id="solar-widget-add-outline"
                            className="h-3 w-3 mr-1"
                          />
                          Create Widget
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-3">
              <Button
                variant="outlined"
                size="sm"
                onClick={() => setSelectedConnector(null)}
              >
                <Icon id="arrow-left" className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="flex items-center space-x-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-white",
                    DATABASE_CONNECTORS.find((c) => c.id === selectedConnector)?.color,
                  )}
                >
                  <Icon
                    id={
                      DATABASE_CONNECTORS.find((c) => c.id === selectedConnector)
                        ?.icon || "database-01"
                    }
                    className="h-4 w-4"
                  />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {DATABASE_CONNECTORS.find((c) => c.id === selectedConnector)?.name}
                </h3>
              </div>
            </div>
            <div className="flex-1">{renderForm()}</div>
          </div>
        )
      ) : (
        <>
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Select Database Type
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Choose the type of database you want to connect to.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {DATABASE_CONNECTORS.map((connector) => (
              <DatabaseTile
                key={connector.id}
                connector={connector}
                isSelected={false}
                onSelect={() => setSelectedConnector(connector.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
