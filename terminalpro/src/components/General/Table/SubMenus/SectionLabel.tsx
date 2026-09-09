import { cn } from "~/components/ds/utils";

export default function SectionLabel({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mb-1.5 text-light-400 body-xs-regular dark:text-dark-50",
        className,
      )}
    >
      {text}
    </p>
  );
}
