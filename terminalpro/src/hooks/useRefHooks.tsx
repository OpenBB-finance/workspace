import {
  type ForwardedRef,
  type MutableRefObject,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
} from "react";

// Note: This is a generic type and can accept any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericFunc = (...args: any[]) => any;
type ObjectType<T> = { [K in keyof T]: T[K] };
type RecordRefsType<T> = MutableRefObject<ObjectType<T>>;

export function useRecordRef<T extends object>(initialValue: T): RecordRefsType<T> {
  const refs = useRef(initialValue);

  useEffect(() => {
    refs.current = initialValue;
  });

  return refs;
}

export function useCreateRef<T>(initialValue: T): RefObject<T> {
  const ref = useRef(initialValue);

  useEffect(() => {
    ref.current = initialValue;
  });

  return ref;
}

/**
 * Stabilize a callback with React.useRef
 *
 * A custom hook that converts a callback to a ref to avoid triggering re-renders when passed as a
 * prop or avoid re-executing effects when passed as a dependency
 *
 * Ref: https://github.com/radix-ui/primitives/tree/main/packages/react/use-callback-ref
 */
export const useCallbackRef = <T extends GenericFunc>(callback: T | undefined): T => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  return useMemo(
    () => ((...args) => callbackRef.current?.(...args)) as T,
    [callbackRef],
  );
};

export function useComposeRefs<T>(...refs: (RefObject<T> | ForwardedRef<T> | null)[]) {
  return useMemo(() => {
    if (refs.every((ref) => ref == null)) {
      return null;
    }
    return (value: T) => {
      for (const ref of refs) {
        if (ref != null) {
          (ref as MutableRefObject<T | null>).current = value;
        }
      }
    };
  }, refs);
}
