import type React from "react";
import Icon from "~/components/Icon";

interface NoteBoxProps {
  children: React.ReactNode;
}

const NoteBox = ({ children }: NoteBoxProps) => {
  return (
    <div className="mt-4 rounded bg-brand-lighter/50 dark:bg-brand-lighter/25 p-2 text-white">
      <div className="mb-1 font-medium flex items-center gap-1">
        <Icon id="info-circle" className="size-4" />
        <strong>Note:</strong>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
};

export default NoteBox;
