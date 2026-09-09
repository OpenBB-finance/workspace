import type { ReactNode } from "react";
import { getConfig } from "~/lib/runtimeConfig";
import { cn } from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import Icon from "../Icon";

const jsonData = [
  { date: "2024-01-01", price: 10.11, volume: 10000 },
  { date: "2024-01-02", price: 11.11, volume: 20000 },
  { date: "2024-01-03", price: 9.11, volume: 30000 },
  { date: "2024-01-04", price: 8.11, volume: 1000 },
  { date: "2024-01-05", price: 12.11, volume: 100 },
  { date: "2024-01-06", price: 7.11, volume: 5000 },
  { date: "2024-01-07", price: 15.11, volume: 8000 },
  { date: "2024-01-08", price: 4.11, volume: 3000 },
  { date: "2024-01-09", price: 18.11, volume: 4000 },
  { date: "2024-01-10", price: 19.11, volume: 6000 },
  { date: "2024-01-11", price: 17.11, volume: 8000 },
];

function download(data: string, filename: string, type: string) {
  const file = new Blob([data], { type });
  const a = document.createElement("a");
  const url = URL.createObjectURL(file);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 0);
}

function csvmaker(data: { date: string; price: number; volume: number }[]) {
  // Convert to CSV
  const csvText = data.reduce((acc, item) => {
    acc += `${item.date},${item.price},${item.volume}\n`;
    return acc;
  }, "Date,Price,Volume\n");
  return csvText;
}

export function DataAdder({
  title,
  children,
  submitName,
  onClick,
  example,
  tutorial,
  extraButtons,
  className,
  buttonClassName,
}: {
  title: string;
  children: ReactNode;
  submitName: string;
  onClick: () => void;
  example?: string;
  tutorial?: string;
  extraButtons?: ReactNode;
  className?: string;
  buttonClassName?: string;
}) {
  const uiShowExternalDocumentationLinksFF = getConfig().ui.showExternalDocLinks;

  return (
    <div
      className={cn(
        "col-span-2 flex flex-col gap-4 rounded-lg bg-light-50 p-4 dark:bg-dark-800 lg:col-span-1 overflow-auto",
        className,
      )}
    >
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-4">
          <h4 className="body-sm-medium">{title}</h4>
        </div>
        <p className="body-xs-regular">{children}</p>
        {uiShowExternalDocumentationLinksFF && tutorial && (
          <a
            href={tutorial}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center gap-1 whitespace-nowrap text-xs text-brand-main dark:text-brand-lighter"
          >
            <Icon id="play-icon" />
            Tutorial: How to {submitName.toLowerCase()}
          </a>
        )}
      </div>
      {submitName === "Upload file(s)" && (
        <div className="flex gap-4 overflow-x-auto">
          <Button
            className="whitespace-nowrap"
            onClick={() => {
              const csv = csvmaker(jsonData);
              download(csv, "sample_data.csv", "text/csv");
            }}
            variant="outlined"
            size="sm"
          >
            <Icon id="file-04" />
            Download Sample CSV
          </Button>
          <Button
            className="whitespace-nowrap"
            onClick={() => {
              const json = JSON.stringify(jsonData);
              download(json, "sample_data.json", "application/JSON");
            }}
            variant="outlined"
            size="sm"
          >
            <Icon id="file-04" />
            Download Sample JSON
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-4 whitespace-nowrap md:flex-row overflow-x-auto">
        <Button className={buttonClassName} onClick={onClick} size="sm">
          {submitName}
        </Button>
        {extraButtons}
        {example && (
          <Button
            onClick={() => window.open(example, "_blank").focus()}
            variant="outlined"
            size="sm"
          >
            Check Examples
          </Button>
        )}
      </div>
    </div>
  );
}
