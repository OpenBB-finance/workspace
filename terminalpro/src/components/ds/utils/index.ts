export * from "./cn";
export * from "./react";

/* Promisify */

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* Math */


export function clamp(x: number, min: number, max: number) {
  return Math.min(Math.max(x, min), max);
}

/* String */

export function capitalizeString<T extends string>(string: T) {
  return (string.charAt(0).toUpperCase() + string.slice(1)) as Capitalize<T>;
}

/* Types */

export type CanBeImmutable<T> = T | Readonly<T>;
