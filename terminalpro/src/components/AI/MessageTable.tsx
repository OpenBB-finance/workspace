import { memo, type ReactNode, useCallback, useRef } from "react";
import { toast } from "sonner";
import { parseValue } from "~/lib/utils";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import { useShallowStreamingStore } from "./hooks/useStreaming";
import { dispatchCreate } from "./hooks/utils";

type MessageTableProps = {
  children: ReactNode;
};

const MessageTable = memo((props: MessageTableProps) => {
  const { children } = props;
  const isStreaming = useShallowStreamingStore(
    (s) => s.streamingStatus === "streaming-started",
  );
  const tableRef = useRef<HTMLTableElement>(null);

  const convertTableToJson = useCallback(() => {
    const table = tableRef.current;
    if (!table) {
      console.warn("Table element not found.");
      return null;
    }

    const headersExist = table.querySelectorAll("thead th").length > 0;
    const tbody = table.querySelector("tbody");

    const headers = Array.from(
      table.querySelectorAll(headersExist ? "thead th" : "tr th"),
      (th: HTMLTableCellElement) => (th.innerText || th.textContent).trim(),
    );
    const rows = Array.from(table.querySelectorAll(tbody ? "tbody tr" : "tr")).filter(
      (row) => row.querySelectorAll("td").length > 0,
    );

    const jsonData = rows.reduce<Record<string, string | number | null>[]>(
      (acc, row) => {
        const rowData = Array.from(row.querySelectorAll("td")).reduce(
          (rowAcc, cell, index) => {
            const header = headers[index] || `Column ${index + 1}`;

            const cellText = (cell.innerText || cell.textContent).trim();
            const cellValue = parseValue(cellText);
            rowAcc[header] = cellValue;
            return rowAcc;
          },
          {} as Record<string, string | number | null>,
        );

        // Ensures first row has all keys
        if (acc.length > 0) {
          for (const key of Object.keys(rowData)) {
            if (!Object.keys(acc[0]).includes(key)) {
              acc[0][key] = null;
            }
          }
        }
        acc.push(rowData);
        return acc;
      },
      [],
    );

    return jsonData;
  }, [tableRef]);

  if (isStreaming) {
    return (
      <div className="bg-light-100 dark:bg-dark-400 rounded p-0.5 space-y-2 mb-2 overflow-auto">
        <table
          children={children}
          className="table-fixed rounded-[2px] w-full !m-0 dark:bg-dark-700 bg-light-200
          [&_tbody]:bg-white [&_tr]:even:bg-light-50 dark:[&_tbody]:bg-dark-600
          dark:[&_tr]:even:bg-dark-500 [&_td]:pl-1 [&_th]:pl-1 [&_th]:pt-1.5 [&_thead]:border-none"
        />
      </div>
    );
  }

  return (
    <div className="bg-light-100 dark:bg-dark-400 rounded p-0.5 space-y-2 mb-2">
      <div className="overflow-auto">
        <table
          ref={tableRef}
          children={children}
          className="overflow-auto table-auto rounded-[2px] w-full !m-0 dark:bg-dark-700 bg-light-200
        [&_tbody]:bg-white [&_tr]:even:bg-light-50 dark:[&_tbody]:bg-dark-600
        dark:[&_tr]:even:bg-dark-500 [&_td]:pl-1 [&_th]:pl-1 [&_th]:pt-1.5 [&_thead]:border-none"
        />
      </div>
      <div className="flex gap-x-2 pb-1">
        <Tooltip message="Copy table to clipboard">
          <button
            onClick={() => {
              const rowsData = convertTableToJson();
              if (!rowsData) return toast.error("Failed to extract table data");

              const headerKeys = Object.keys(rowsData[0] || {});
              const headers = headerKeys.join("\t");
              const rows = rowsData
                .map((row) =>
                  headerKeys
                    .map((col) => {
                      const cell = row[col];
                      return cell === null || cell === undefined ? "" : cell;
                    })
                    .join("\t"),
                )
                .join("\n");
              const content = `${headers}\n${rows}`;
              navigator.clipboard
                .writeText(content)
                .then(() => {
                  toast.success("Table copied to clipboard");
                })
                .catch((err) => {
                  toast.error("Failed to copy table to clipboard", {
                    description: err.message,
                  });
                });
            }}
            className="hover:text-black dark:hover:text-white h-3 w-3"
          >
            <Icon
              id="clipboard-icon"
              className="hover:text-black dark:hover:text-white h-3 w-3"
            />
          </button>
        </Tooltip>
        <Tooltip message="Create widget from table">
          <button
            onClick={() => {
              const rowsData = convertTableToJson();
              if (!rowsData) return toast.error("Failed to extract table data");

              dispatchCreate({
                widgetType: "table",
                content: rowsData,
                metadata: null,
              });
            }}
          >
            <Icon id="solar-widget-add-outline" className="h-3 w-3" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
});

export default MessageTable;

const getChildString = (child: any): string[] => {
  if (Array.isArray(child?.props?.children)) {
    return child.props.children.flatMap(getChildString);
  }
  if (typeof child === "string" || typeof child === "number") {
    return [child.toString()];
  }

  return [];
};

function extractChildrenText(children: any): string {
  if (Array.isArray(children)) {
    return children.flatMap(getChildString).join("");
  }

  return getChildString(children).join("");
}

function getHeaders(child: any) {
  const theadChildren = child.props?.children;
  if (!theadChildren?.props?.children) return getChildString(child).filter(Boolean);

  const headers = theadChildren.props.children;
  return headers
    .map((header: any) => {
      const headerContent = extractChildrenText(header.props.children);
      return typeof headerContent === "string" ? headerContent : null;
    })
    .filter((header) => header !== null);
}

function extractTableData(element: any) {
  if (!(element?.children && Array.isArray(element.children))) {
    throw new Error("Provided element is not valid");
  }

  let columns: string[] = [];
  const rowsData: Record<string, string | number | null>[] = [];

  for (const child of element.children) {
    if (child.type === "thead") {
      // Extract column headers
      columns = getHeaders(child);
    } else if (child.type === "tbody") {
      // Extract rows data
      const rows = child.props?.children;
      if (!rows) continue;

      for (const row of rows) {
        const cells = row.props?.children;
        if (!cells) return;
        const rowData = cells
          .map((cell: any, index: number) => {
            const cellContent = extractChildrenText(cell.props?.children);

            return typeof cellContent === "string" || typeof cellContent === "number"
              ? { [columns[index]]: cellContent === "" ? null : cellContent }
              : null;
          })
          .filter((cell) => cell !== null);

        if (rowData.length > 0) {
          rowsData.push(Object.assign({}, ...rowData));
        }
      }
    } else if (child.type === "tr") {
      if (columns.length === 0) {
        columns = getHeaders(child);
        continue;
      }
      const cells = child.props.children;
      const rowData = cells
        .map((cell: any, index: number) => {
          const cellContent = extractChildrenText(cell.props.children);

          return typeof cellContent === "string" || typeof cellContent === "number"
            ? { [columns[index]]: cellContent }
            : null;
        })
        .filter((cell) => cell !== null);

      if (rowData.length > 0) {
        rowsData.push(Object.assign({}, ...rowData));
      }
    }
  }

  return { columns, rowsData };
}
