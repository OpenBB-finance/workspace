export default function Disclaimer() {
  return (
    <div className="mt-auto flex flex-col items-center justify-center gap-4">
      <div className="relative mx-auto w-[90%] rounded bg-grey-50 p-2.5 text-[10px] text-grey-600 dark:bg-[#1F1E23] dark:text-grey-50">
        <p className="mb-1.5 font-bold">OpenBB Add-in for Excel</p>
        <p className="text-grey-600 dark:text-grey-300">
          The add-in is still in development.
        </p>
        <p className="text-grey-600 dark:text-grey-300">
          Unexpected errors may occur.
        </p>
        <p className="text-grey-600 dark:text-grey-300">
          Found bugs, or potential improvements?
        </p>
        <p className="text-grey-600 dark:text-grey-300">
          Email{" "}
          <a
            href="mailto:support@openbb.finance"
            className="text-[#0088CC] underline dark:text-[#33BBFF]"
          >
            support@openbb.finance
          </a>{" "}
        </p>
        <p className="text-grey-600 dark:text-grey-300">
        or use the form above.
        </p>
      </div>
    </div>
  );
}
