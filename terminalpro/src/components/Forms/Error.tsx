import CloseCircleIcon from "~/components/Icons/CloseCircle";
import { cn } from "~/lib/utils";

export default function ErrorContent({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  if (!text) return null;
  return (
    <div
      id="form-error-message"
      className={cn(
        "bg-[#FFC5C5] text-black",
        "border-2 border-[#E03C3C1A]",
        "relative mt-8 rounded h-fit",
        "flex items-center p-5 gap-2",
        className,
      )}
    >
      <div className="self-start">
        <CloseCircleIcon className="text-[#B91C1C]" />
      </div>
      <p className="text-xs" role="alert">
        {text}
      </p>
    </div>
  );
}
