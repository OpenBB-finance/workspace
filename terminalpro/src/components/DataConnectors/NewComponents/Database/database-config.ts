import { z } from "zod";
import type { IconId } from "~/components/Icon.types";

// Database connector types that match your backend
export const DATABASE_CONNECTORS = [
  {
    id: "sqlite",
    name: "SQLite",
    description: "File-based lightweight database",
    icon: "database-01" as IconId,
    color: "bg-blue-500",
  },
  {
    id: "snowflake",
    name: "Snowflake",
    description: "Cloud data warehouse",
    icon: "snowflake-01" as IconId,
    color: "bg-cyan-500",
  },
  {
    id: "mysql",
    name: "MySQL",
    description: "Popular open-source database",
    icon: "database-01" as IconId,
    color: "bg-orange-500",
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    description: "Advanced open-source database",
    icon: "database-01" as IconId,
    color: "bg-blue-600",
  },
  {
    id: "clickhouse",
    name: "ClickHouse",
    description: "High-performance columnar database",
    icon: "database-01" as IconId,
    color: "bg-yellow-500",
  },
] as const;

export type ConnectorType = (typeof DATABASE_CONNECTORS)[number]["id"];

// Zod schemas for different connector types
export const sqliteSchema = z.object({
  db_path: z.string().min(1, "Database path is required"),
});

export const snowflakeSchema = z.object({
  account: z.string().min(1, "Account is required"),
  user: z.string().min(1, "Username is required"),
  warehouse: z.string().min(1, "Warehouse is required"),
  database: z.string().min(1, "Database is required"),
  schema: z.string().optional(),
  role: z.string().optional(),
  password: z.string().optional(),
  private_key_path: z.string().optional(),
  private_key_passphrase: z.string().optional(),
});

export const mysqlSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.number().min(1).max(65535).default(3306),
  database: z.string().min(1, "Database name is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const postgresqlSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.number().min(1).max(65535).default(5432),
  database: z.string().min(1, "Database name is required"),
  user: z.string().min(1, "Username is required"),
  password: z.string().optional(),
  sslmode: z.string().default("prefer"),
});

export const clickhouseSchema = z.object({
  host: z.string().min(1, "Host is required"),
  user: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Type definitions
export type SQLiteForm = z.infer<typeof sqliteSchema>;
export type SnowflakeForm = z.infer<typeof snowflakeSchema>;
export type MySQLForm = z.infer<typeof mysqlSchema>;
export type PostgreSQLForm = z.infer<typeof postgresqlSchema>;
export type ClickHouseForm = z.infer<typeof clickhouseSchema>;

// Form field configuration interfaces
export interface FormFieldConfig {
  name: string;
  label: string;
  placeholder: string;
  type?: "text" | "password" | "number" | "select";
  options?: { value: string; label: string }[];
  colSpan?: 1 | 2;
}

export interface ConnectorFormConfig {
  schema: any;
  defaultValues: any;
  fields: FormFieldConfig[];
  gridCols?: 1 | 2;
}

// Form configurations for each database type
export const FORM_CONFIGS: Record<ConnectorType, ConnectorFormConfig> = {
  sqlite: {
    schema: sqliteSchema,
    defaultValues: { db_path: "" },
    fields: [
      { name: "db_path", label: "Database Path", placeholder: "/path/to/database.db" },
    ],
  },
  snowflake: {
    schema: snowflakeSchema,
    defaultValues: {
      account: "",
      user: "",
      warehouse: "",
      database: "",
      schema: "",
      role: "",
      password: "",
    },
    gridCols: 2,
    fields: [
      { name: "account", label: "Account", placeholder: "xy12345.us-east-1" },
      { name: "user", label: "Username", placeholder: "your_username" },
      { name: "warehouse", label: "Warehouse", placeholder: "your_warehouse" },
      { name: "database", label: "Database", placeholder: "your_database" },
      { name: "schema", label: "Schema (Optional)", placeholder: "your_schema" },
      { name: "role", label: "Role (Optional)", placeholder: "your_role" },
      {
        name: "password",
        label: "Password",
        placeholder: "Your password",
        type: "password",
        colSpan: 2,
      },
    ],
  },
  mysql: {
    schema: mysqlSchema,
    defaultValues: {
      host: "localhost",
      port: 3306,
      database: "",
      username: "",
      password: "",
    },
    gridCols: 2,
    fields: [
      { name: "host", label: "Host", placeholder: "localhost" },
      { name: "port", label: "Port", placeholder: "3306", type: "number" },
      { name: "database", label: "Database", placeholder: "database_name" },
      { name: "username", label: "Username", placeholder: "your_username" },
      {
        name: "password",
        label: "Password",
        placeholder: "Your password",
        type: "password",
        colSpan: 2,
      },
    ],
  },
  postgresql: {
    schema: postgresqlSchema,
    defaultValues: {
      host: "localhost",
      port: 5432,
      database: "testdb",
      user: "postgres",
      password: "",
      sslmode: "prefer",
    },
    gridCols: 2,
    fields: [
      { name: "host", label: "Host", placeholder: "localhost" },
      { name: "port", label: "Port", placeholder: "5432", type: "number" },
      { name: "database", label: "Database", placeholder: "testdb" },
      { name: "user", label: "Username", placeholder: "postgres" },
      {
        name: "password",
        label: "Password (Optional)",
        placeholder: "Leave blank if not required",
        type: "password",
      },
      {
        name: "sslmode",
        label: "SSL Mode",
        placeholder: "",
        type: "select",
        options: [
          { value: "disable", label: "Disable" },
          { value: "allow", label: "Allow" },
          { value: "prefer", label: "Prefer" },
          { value: "require", label: "Require" },
          { value: "verify-ca", label: "Verify CA" },
          { value: "verify-full", label: "Verify Full" },
        ],
      },
    ],
  },
  clickhouse: {
    schema: clickhouseSchema,
    defaultValues: {
      host: "localhost",
      user: "",
      password: "",
    },
    fields: [
      { name: "host", label: "Host", placeholder: "localhost" },
      { name: "user", label: "Username", placeholder: "your_username" },
      {
        name: "password",
        label: "Password",
        placeholder: "Your password",
        type: "password",
      },
    ],
  },
};
