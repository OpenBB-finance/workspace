import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FormulasToolPanel from "~/components/General/Table/SubMenus/FormulasToolPanel";
import type { WidgetContextType } from "~/components/types";
import { WidgetContext } from "~/components/Widget.context";

/** Minimal AG Grid column mock for IToolPanelParams["api"]. */
function createMockApi(
  columns: { colId: string; headerName: string; chartDataType?: string }[] = [],
) {
  return {
    isPivotMode: () => false,
    addEventListener: () => null,
    removeEventListener: () => null,
    isDestroyed: () => false,
    getColumns: () =>
      columns.map((col) => ({
        getColId: () => col.colId,
        getColDef: () => ({
          headerName: col.headerName,
          chartDataType: col.chartDataType ?? "series",
        }),
      })),
  } as any;
}

const DEFAULT_COLUMNS = [
  { colId: "revenue", headerName: "Revenue" },
  { colId: "cost", headerName: "Cost" },
  { colId: "price", headerName: "Price" },
];

function renderPanel({
  formulas,
  updateWidget,
}: {
  formulas?: any[];
  updateWidget?: ReturnType<typeof vi.fn>;
} = {}) {
  const mockUpdate = updateWidget ?? vi.fn();
  const widget = {
    uuid: "test",
    id: "test",
    name: "Test",
    type: "custom",
    widgetId: "w1",
    storage: { formulas: formulas ?? [], params: {} },
    data: { table: { columnsDefs: [] } },
  } as any;

  return {
    updateWidget: mockUpdate,
    ...render(
      <WidgetContext.Provider
        value={
          {
            widget,
            widgetRef: { current: widget },
            widgetFromJSON: null,
            activeDashboardId: "dash",
            isShared: false,
            isPreview: false,
            uuid: "test",
            updateWidget: mockUpdate,
            getWidget: () => widget,
          } as unknown as WidgetContextType
        }
      >
        <FormulasToolPanel {...({ api: createMockApi(DEFAULT_COLUMNS) } as any)} />
      </WidgetContext.Provider>,
    ),
  };
}

describe("FormulasToolPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with an empty formula editor", () => {
    renderPanel();
    expect(screen.getByPlaceholderText("Formula Name")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("save button is disabled when name is empty", () => {
    renderPanel();
    const saveButton = screen.getByText("Save");
    expect(saveButton).toBeDisabled();
  });

  it("save button is disabled when expression is empty", () => {
    renderPanel();
    const nameInput = screen.getByPlaceholderText("Formula Name");
    fireEvent.change(nameInput, { target: { value: "My Formula" } });
    const saveButton = screen.getByText("Save");
    expect(saveButton).toBeDisabled();
  });

  it("typing in expression textarea parses the input", () => {
    renderPanel();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();

    fireEvent.change(textarea, { target: { value: "[Revenue] + [Cost]" } });

    // The highlight layer should show the parsed expression
    const highlightLayer = textarea.parentElement?.querySelector("[aria-hidden]");
    expect(highlightLayer).toBeTruthy();
    expect(highlightLayer?.textContent).toContain("Revenue");
    expect(highlightLayer?.textContent).toContain("Cost");
  });

  it("shows validation error for invalid expression", () => {
    renderPanel();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "[Revenue] +" } });

    // Should show an error message
    expect(screen.getByText(/cannot end with an operator/i)).toBeInTheDocument();
  });

  it("operator buttons insert operators at cursor", () => {
    renderPanel();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;

    // Type a column first
    fireEvent.change(textarea, { target: { value: "[Revenue]" } });

    // Click the + operator button
    const plusButton = screen.getByRole("button", { name: "+" });
    fireEvent.click(plusButton);

    // The textarea should now contain the operator
    expect(textarea.value).toContain("+");
  });

  it("function dropdown inserts function with parens", async () => {
    const user = userEvent.setup();
    renderPanel();

    // Open the function dropdown
    const fxButton = screen.getByTitle("Functions");
    await user.click(fxButton);

    // Click SUM in the dropdown
    const sumItem = screen.getByText("SUM");
    await user.click(sumItem);

    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toContain("SUM()");
  });

  it("shows syntax hint when function is used in expression", () => {
    renderPanel();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;

    fireEvent.change(textarea, {
      target: { value: "AVG([Revenue], [Cost])" },
    });

    expect(screen.getByText(/AVG\(value, value, \.\.\.\)/)).toBeInTheDocument();
  });

  it("clear button clears the expression", () => {
    renderPanel();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "[Revenue] + [Cost]" } });
    expect(textarea.value).toBe("[Revenue] + [Cost]");

    const clearButton = screen.getByTitle("Clear expression");
    fireEvent.click(clearButton);

    expect(textarea.value).toBe("");
  });

  it("enables save when name and valid expression are provided", () => {
    renderPanel();
    const nameInput = screen.getByPlaceholderText("Formula Name");
    fireEvent.change(nameInput, { target: { value: "Total" } });

    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "[Revenue] + [Cost]" } });

    const saveButton = screen.getByText("Save");
    expect(saveButton).not.toBeDisabled();
  });

  it("save persists formula to widget storage", () => {
    const { updateWidget } = renderPanel();

    const nameInput = screen.getByPlaceholderText("Formula Name");
    fireEvent.change(nameInput, { target: { value: "Total" } });

    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "[Revenue] + [Cost]" } });

    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    expect(updateWidget).toHaveBeenCalled();
  });

  it("highlights unknown columns in red", () => {
    renderPanel();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "[Unknown]" } });

    const highlightLayer = textarea.parentElement?.querySelector("[aria-hidden]");
    const redSpan = highlightLayer?.querySelector(".text-red-500");
    expect(redSpan).toBeTruthy();
    expect(redSpan?.textContent).toContain("Unknown");
  });

  it("highlights operators and functions in blue", () => {
    renderPanel();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: "SUM([Revenue], [Cost])" },
    });

    const highlightLayer = textarea.parentElement?.querySelector("[aria-hidden]");
    const blueSpans = highlightLayer?.querySelectorAll(".text-brand-main");
    // Should have blue spans for: SUM, (, ,, )
    expect(blueSpans?.length).toBeGreaterThanOrEqual(4);
  });

  it("deleting the last saved formula creates a new empty formula without crashing", async () => {
    const savedFormula = {
      id: "saved-1",
      name: "Total",
      expression: [
        { type: "column" as const, value: "revenue", headerName: "Revenue" },
        { type: "operator" as const, value: "+" },
        { type: "column" as const, value: "cost", headerName: "Cost" },
      ],
    };

    const { updateWidget } = renderPanel({ formulas: [savedFormula] });

    // Verify the saved formula is loaded
    const nameInput = screen.getByPlaceholderText("Formula Name");
    expect(nameInput).toHaveValue("Total");

    // Delete the formula
    const deleteButton = screen.getByTitle("Delete Formula");
    fireEvent.click(deleteButton);

    // Should have called updateWidget to remove from storage
    expect(updateWidget).toHaveBeenCalled();

    const formulaNameInput = await screen.findByPlaceholderText("Formula Name"); // Wait for the component to update
    // Panel should still render with a new empty formula (no crash)
    expect(formulaNameInput).toHaveValue("");
    expect(screen.getByText("Save")).toBeDisabled();
  });

  it("deleting one of multiple formulas selects the remaining one", async () => {
    const formulas = [
      {
        id: "f1",
        name: "First",
        expression: [{ type: "number" as const, value: "1" }],
      },
      {
        id: "f2",
        name: "Second",
        expression: [{ type: "number" as const, value: "2" }],
      },
    ];

    renderPanel({ formulas });

    // First formula should be selected
    const nameInput = screen.getByPlaceholderText("Formula Name");
    expect(nameInput).toHaveValue("First");

    // Delete the first formula
    const deleteButton = screen.getByTitle("Delete Formula");
    fireEvent.click(deleteButton);

    const formulaNameInput = await screen.findByPlaceholderText("Formula Name"); // Wait for the component to update

    // Should select the remaining formula
    expect(formulaNameInput).toHaveValue("Second");
  });
});
