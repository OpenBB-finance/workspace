import { createContext, type Dispatch, type SetStateAction, useContext } from "react";
import type { Extension } from "~/lib/constants";

export type FileType = {
  uuid: string;
  originalFileName: string;
  size: number;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  url: string;
  extension: Extension;
  name: string;
  description: string;
  source: string;
  category:
    | "Economy"
    | "Crypto"
    | "Stocks"
    | "Fixed Income"
    | "Equity"
    | "Currency"
    | "ETF"
    | "Index"
    | "Derivatives"
    | "Others";
  subCategory: string;
  status: "uploaded" | "pending" | "failed";
};

type FileContextType = {
  files: FileType[];
  setFiles: Dispatch<SetStateAction<FileType[]>>;
};

export const FileContext = createContext<FileContextType | undefined>(undefined);

export function useFileContext() {
  const context = useContext(FileContext);
  if (!context) {
    throw new Error("useFileContext must be used within a FileProvider");
  }
  return context;
}
