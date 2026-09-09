import type { ReactNode } from "react";

export default function ReactourItem({
  title,
  content,
  children,
}: {
  title: string;
  content: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-base font-medium">{title}</h1>
      <p className="text-xs">{content}</p>
      {children}
    </div>
  );
}
