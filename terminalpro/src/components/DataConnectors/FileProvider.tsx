import { useMemo, useState } from "react";
import { FileContext } from "./FileContext";

export function FileProvider({ children }) {
  const [files, setFiles] = useState([]);

  const childrenMemo = useMemo(() => children, [children]);

  return (
    <FileContext.Provider value={{ files, setFiles }}>
      {childrenMemo}
    </FileContext.Provider>
  );
}
