import { countItemsPerKey } from "~/components/General/Table/utils";

export function getLabel(path: string, count: string | number): string {
  if (path === "None") {
    return path;
  }
  return `${path} (${count})`;
}

export async function getOptions<T extends { key?: string; value?: string }>(
  endpoint: string,
  headers: T[] = [],
) {
  try {
    const res = await fetch(endpoint, {
      headers: headers
        .filter((pair) => pair.key !== "" && pair.value !== "")
        .reduce((acc, { key, value }) => Object.assign(acc, { [key]: value }), {}),
    });
    const data = await res.json();

    if (res.status !== 200) {
      throw new Error(data?.error?.message ?? data?.message ?? "Unknown error");
    }

    if (Array.isArray(data)) {
      return [];
    }
    const counts = countItemsPerKey(data);

    if (Object.values(counts).every((item) => item.count === 1)) return [];

    // Call the function to get the top 5 keys with the highest counts

    // Log the top 5 keys and their counts
    // console.log("Top 5 keys with the highest counts:");
    // top5KeysByCount.forEach((key) => {
    //   console.log(`Key: ${key}, Count: ${counts[key]}`);
    // });

    //sort these by highest to lowest - do we want top 5?
    counts.sort((a, b) => b.count - a.count);
    return [{ path: "None", count: "" }, ...counts];
  } catch (err) {
    if (err?.message === "Failed to fetch") {
      throw new Error(`A network error occurred.
        This could be a CORS issue or the endpoint is not reachable.
        Please check developer console for more details.`);
    }
    throw new Error(
      err?.message?.startsWith("Unexpected token")
        ? "Invalid endpoint URL/response"
        : err.message,
    );
  }
}

export async function getKeys(
  endpoint: string,
  headers: { key: string; value: string }[],
) {
  return await getOptions(endpoint, headers || []).catch((e) => {
    console.error(e);
    return [];
  });
}
