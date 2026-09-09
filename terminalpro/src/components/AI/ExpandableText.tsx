import { memo, useEffect, useRef, useState } from "react";
import TextStyle from "~/components/AI/TextStyle";

export const ExpandableText = memo(function ExpandableText({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldTruncate, setShouldTruncate] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setShouldTruncate(
        contentRef.current.scrollHeight > contentRef.current.clientHeight,
      );
    }
  }, [content]);

  return (
    <div className="flex flex-col gap-2">
      <div ref={contentRef} className={isExpanded ? "" : "line-clamp-3 p-1 -m-1"}>
        <TextStyle
          content={content}
          className={className ?? "text-xs text-light-900 dark:text-light-100"}
        />
      </div>
      {(shouldTruncate || isExpanded) && (
        <button
          type="button"
          className="text-brand-main hover:text-brand-darker dark:text-brand-lighter dark:hover:text-brand-main font-medium text-xs self-start transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded((prev) => !prev);
          }}
        >
          {isExpanded ? "Read less" : "...Read more"}
        </button>
      )}
    </div>
  );
});
