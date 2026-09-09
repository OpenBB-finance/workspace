export default function NewsItem({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <button className="flex items-center gap-2.5 rounded px-2.5 py-1.5 w-full hover:bg-light-100 dark:hover:bg-[#303038] justify-between focus:bg-light-100 dark:focus:bg-[#303038] text-xs">
      <div className="flex flex-col gap-1">
        <span className="text-left">{name}</span>
        <span className="text-light-400 dark:text-light-500 text-left">
          {description}
        </span>
      </div>
    </button>
  );
}
