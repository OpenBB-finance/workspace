import { createContext, useContext } from "react";
import { FormProvider } from "react-hook-form";
import { type StateDispatch, useStateReducer } from "~/hooks/useStateReducer";
import { SingleWidgetDialogElement } from "../SingleWidgetDialog";
import {
  type SingleWidgetDialogState,
  type SingleWidgetFormT,
  useAddSingleWidget,
} from ".";

type SingleWidgetProviderType = {
  state: SingleWidgetDialogState;
  dispatch: StateDispatch<SingleWidgetDialogState>;
  onTestSource: (values: SingleWidgetFormT) => Promise<void>;
  onAddWidget: (values: SingleWidgetFormT) => Promise<void>;
};

export const SingleWidgetContext = createContext<SingleWidgetProviderType | undefined>(
  undefined,
);

export function useSingleWidgetContext() {
  const context = useContext(SingleWidgetContext);
  if (!context) {
    throw new Error(
      "useSingleWidgetContext must be used within a SingleWidgetProvider",
    );
  }
  return context;
}

export function SingleWidgetProvider() {
  const [state, dispatch] = useStateReducer<SingleWidgetDialogState>({
    selectOptions: [],
    isTested: false,
    loading: false,
    dataKeyError: undefined,
  });

  const { form, onTestSource, onAddWidget } = useAddSingleWidget({
    state,
    dispatch,
  });

  return (
    <SingleWidgetContext.Provider
      value={{ state, dispatch, onTestSource, onAddWidget }}
    >
      <FormProvider {...form}>
        <SingleWidgetDialogElement />
      </FormProvider>
    </SingleWidgetContext.Provider>
  );
}
