import { render } from "@testing-library/react";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { FormParamElement } from "~/components/DraggableCard/FormParamDef";
import { useWidgetContext } from "~/components/Widget.context";
import { useJsonData } from "~/lib/api";

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  useJsonData: vi.fn().mockReturnValue({
    data: ["option-a", "option-b"],
    isLoading: false,
    error: null,
    dataUpdatedAt: 0,
  }),
  convertHeadersToRecord: (headers: Record<string, string> = {}) => ({
    headers,
    newParams: {},
  }),
  cleanSearchParams: (url: string) => url ?? "",
}));

vi.mock("~/components/ds/molecules/Form", () => ({
  FormField: ({ render: renderProp, name }: any) =>
    renderProp({ field: { value: "", onChange: vi.fn(), name } }),
}));

vi.mock("~/components/NewAdvancedSelect", () => ({
  AdvancedSelect: () => <div data-testid="advanced-select" />,
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const OPTIONS_ENDPOINT = "https://my-api.com/options/categories";
const CUSTOM_HEADERS = {
  "X-Api-Key": "secret-key",
  "X-Custom-Header": "custom-value",
};

const mockWidget = {
  id: "test-widget",
  endpoint: {
    url: "https://my-api.com/data",
    headers: CUSTOM_HEADERS,
  },
  params: [
    {
      type: "form",
      paramName: "form_param",
      label: "My Form",
      endpoint: "https://my-api.com/submit",
      method: "POST",
      inputParams: [
        {
          type: "endpoint",
          paramName: "category",
          label: "Category",
          optionsEndpoint: OPTIONS_ENDPOINT,
        },
      ],
    },
  ],
};

const createMockWidgetContext = (widget = mockWidget) => ({
  widget,
  updateWidget: vi.fn(),
  widgetRef: { current: widget },
  activeDashboardId: "test-dashboard",
  isShared: false,
  uuid: "test-uuid",
  getWidget: () => widget,
});

describe("FormParamElement - EndpointType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useWidgetContext as Mock).mockReturnValue(createMockWidgetContext());
  });

  it("passes endpoint headers as endpointHeaders to useJsonData when fetching options", () => {
    render(<FormParamElement />);

    expect(vi.mocked(useJsonData)).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointHeaders: CUSTOM_HEADERS,
        url: OPTIONS_ENDPOINT,
        addBearerToken: true,
      }),
      expect.anything(),
    );
  });

  it("does not pass headers under the wrong key name", () => {
    render(<FormParamElement />);

    const callArgs = vi.mocked(useJsonData).mock.calls[0]?.[0];
    expect(callArgs).not.toHaveProperty("headers");
  });

  it("still fetches options when widget has no endpoint headers", () => {
    const widgetWithoutHeaders = {
      ...mockWidget,
      endpoint: { url: "https://my-api.com/data", headers: {} },
    };
    (useWidgetContext as Mock).mockReturnValue(
      createMockWidgetContext(widgetWithoutHeaders as any),
    );

    render(<FormParamElement />);

    expect(vi.mocked(useJsonData)).toHaveBeenCalledWith(
      expect.objectContaining({
        url: OPTIONS_ENDPOINT,
        endpointHeaders: {},
      }),
      expect.anything(),
    );
  });
});
