import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";
export default function AuthedAppNotFound() {
  return (
    <div className="mx-4 my-3 h-[96.5vh] rounded bg-white p-5 dark:bg-[#151518]">
      <SearchResultsNotFound
        icon={true}
        firstMessage="Page not found"
        secondMessage="We couldn't find the page you're looking for."
      />
    </div>
  );
}
