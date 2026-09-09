import { type ReactNode, useRef, useState } from "react";
import Tooltip from "~/components/Tooltip";

function TruncatedItem({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isClamped, setIsClamped] = useState(false);

  const checkClamped = () => {
    if (ref.current) {
      setIsClamped(ref.current.scrollHeight > ref.current.clientHeight);
    }
  };

  const content = (
    <span ref={ref} onMouseEnter={checkClamped} className="line-clamp-2 cursor-default">
      {text}
    </span>
  );

  if (!isClamped) return content;

  return (
    <Tooltip
      message={
        <div className="max-h-[200px] overflow-y-auto overscroll-contain">{text}</div>
      }
      position="right"
      sideOffset={8}
      className="max-w-[300px]"
    >
      {content}
    </Tooltip>
  );
}

export function PopoverContent({
  id,
  title,
  items,
  totalItems = items ? items.length : undefined,
  children,
}: {
  id: string;
  title: string;
  items?: (string | ReactNode)[];
  totalItems?: number;
  children?: ReactNode;
}) {
  return (
    <div
      key={id}
      className="flex flex-col min-w-[250px] max-w-[350px] max-h-[300px] overflow-y-auto overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-semibold text-ds-text-heading mb-1">
        {title}
        {totalItems !== undefined ? ` (${totalItems})` : ""}
      </p>
      {items ? (
        <div className="flex flex-col w-full">
          {items.length > 0 ? (
            items.map((item, index) => (
              <div
                key={`${title}-item-${index}`}
                className="text-xs text-ds-text-body py-1.5"
              >
                {typeof item === "string" ? <TruncatedItem text={item} /> : item}
              </div>
            ))
          ) : (
            <div className="text-xs text-ds-text-body">
              No {title.toLowerCase()} found for this app
            </div>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
