import BrandedLogo from "~/components/General/BrandedLogo";

interface BrandedLoadingStateProps {
  message?: string;
}

export default function BrandedLoadingState({
  message = "Loading...",
}: BrandedLoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      <BrandedLogo className="w-[150px]" />
      {message && <p className="text-sm text-ds-text-caption mt-4">{message}</p>}
    </div>
  );
}
