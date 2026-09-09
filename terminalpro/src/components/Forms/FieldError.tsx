import { cn } from "~/lib/utils";

export default function FieldError({
  id,
  error,
  className,
}: {
  id?: string;
  error: string;
  className?: string;
}) {
  if (!error) return null;
  return (
    <p
      className={cn("_capitalize-first-letter text-xs text-red-500", className)}
      role="alert"
      id={id}
    >
      {error}
    </p>
  );
}
