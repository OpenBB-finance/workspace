import { type Dispatch, useReducer, useRef } from "react";

export type FunctionAction<S> = (prevState: S) => S;
type SelectiveAction<S> = {
  [K in keyof S]?: S[K] | FunctionAction<S[K]>;
};

export type DispatchAction<S extends object> = SelectiveAction<S> | FunctionAction<S>;

export type StateReducer<S extends object> = (state: S, action: DispatchAction<S>) => S;
export type StateDispatch<S extends object> = Dispatch<DispatchAction<S>>;

export type UseStateReducer<S extends object> = [S, StateDispatch<S>];

export const reducerAction = <S extends object>(
  state: S,
  action: DispatchAction<S>,
): S => {
  if (typeof action === "function") {
    return action(state);
  }
  return Object.keys(action).reduce(
    (acc, key) => {
      const value = action[key] as S[keyof S];
      if (typeof value === "function") {
        acc[key] = value(state[key]);
      } else {
        acc[key] = value;
      }
      return acc;
    },
    { ...state },
  );
};

export function useStateReducer<S extends object>(
  initialState: null | undefined | Partial<S>,
  initializer: (arg: S) => S,
): UseStateReducer<S>;
export function useStateReducer<S extends object>(
  initialState: S,
  initializer?: undefined,
): UseStateReducer<S>;
export function useStateReducer<S extends object, I>(
  initialState: I,
  initializer?: (arg: I & S) => S,
): UseStateReducer<S> {
  const initialStateRef = useRef(initialState);
  return useReducer(
    reducerAction,
    initialStateRef.current,
    initializer,
  ) as UseStateReducer<S>;
}
