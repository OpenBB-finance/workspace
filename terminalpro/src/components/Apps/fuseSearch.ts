import type { IFuseOptions } from "fuse.js";

export type AppsFuseKey<T> = {
  name: string;
  weight: number;
  /** If provided, the field is tokenized into words and matched with a word-prefix
   *  operator (`^term`) so e.g. searching "velo" won't match "developers". */
  tokenize?: (item: T) => string[];
};

export const tokenizeWords = (s?: string): string[] =>
  s ? s.toLowerCase().split(/\W+/).filter(Boolean) : [];

const BASE_FUSE_OPTIONS = {
  threshold: 0.3,
  ignoreLocation: true,
  useExtendedSearch: true,
  minMatchCharLength: 2,
  includeScore: true,
} as const;

export function createAppsFuseOptions<T>(keys: AppsFuseKey<T>[]): IFuseOptions<T> {
  return {
    ...BASE_FUSE_OPTIONS,
    keys: keys.map((k) =>
      k.tokenize
        ? { name: k.name, weight: k.weight, getFn: k.tokenize }
        : { name: k.name, weight: k.weight },
    ),
  };
}

export function buildAppsFuseSearchQuery<T>(search: string, keys: AppsFuseKey<T>[]) {
  const trimmed = search.trim();
  if (trimmed.length < 2) return null;
  const terms = trimmed.split(/\s+/);
  return {
    $and: terms.map((term) => ({
      $or: keys.map((k) => ({ [k.name]: k.tokenize ? `^${term}` : term })),
    })),
  };
}
