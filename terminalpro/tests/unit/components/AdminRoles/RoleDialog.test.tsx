import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { RoleDialog } from "~/components/AdminRoles/RoleDialog";
import type { RoleT } from "~/components/AdminRoles/types";

// --- mocks ------------------------------------------------------------------

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const usersData = [
  {
    uuid: "u1",
    email: "alice@example.com",
    first_name: "Alice",
    last_name: "Admin",
    fullName: "Alice Admin",
    source: "user",
    permissions_uuid: "perm-1",
    role: "User",
    billing_active: true,
    pro_entitlements: {},
    status: "active",
    last_login: null,
    last_active: null,
    renewed: false,
  },
];

vi.mock("~/components/AdminRoles/adminUseQueries", async () => {
  const actual = await vi.importActual<
    typeof import("~/components/AdminRoles/adminUseQueries")
  >("~/components/AdminRoles/adminUseQueries");
  return {
    ...actual,
    useUsers: () => ({
      data: usersData,
      isLoading: false,
      refetch: vi.fn(),
    }),
  };
});

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useMutation: vi.fn().mockImplementation((_opts: any) => {
      const map: Record<string, Mock> = {
        // postEntityRole.name might be minified — match by mutationFn reference
        // We use the call-order trick below: each test sets up explicit asserts.
      };
      void map;
      return {
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: false,
      };
    }),
    useQueryClient: vi.fn(() => ({
      refetchQueries: vi.fn(),
      invalidateQueries: vi.fn(),
    })),
  };
});

vi.mock("~/api/entity_roles.api", () => ({
  postEntityRole: (...args: unknown[]) => mockCreate(...args),
  patchEntityRole: (...args: unknown[]) => mockUpdate(...args),
  deleteEntityRole: (...args: unknown[]) => mockDelete(...args),
}));

// ---------------------------------------------------------------------------

function renderDialog(overrides?: {
  mode?: "create" | "edit";
  initialData?: RoleT;
  onClose?: () => void;
}) {
  const onClose = overrides?.onClose ?? vi.fn();
  const client = new QueryClient();
  const result = render(
    <QueryClientProvider client={client}>
      <RoleDialog
        open={true}
        onClose={onClose}
        mode={overrides?.mode ?? "create"}
        initialData={overrides?.initialData}
        roles={[]}
      />
    </QueryClientProvider>,
  );
  return { onClose, ...result };
}

async function typeName(value: string) {
  const input = screen.getByPlaceholderText("Enter name") as HTMLInputElement;

  await userEvent.clear(input);

  await userEvent.type(input, value);
  return input;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RoleDialog", () => {
  describe("close-intent gating", () => {
    it("calls onClose immediately when the form is clean", () => {
      const { onClose } = renderDialog();
      fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("opens the discard confirm when Cancel is clicked on a dirty form", async () => {
      const { onClose } = renderDialog();
      await typeName("Analyst");
      const unsaved = await screen.findByText("Unsaved");

      expect(unsaved).toBeInTheDocument();

      const cancelBtn = await screen.findByRole("button", { name: /^cancel$/i });
      userEvent.click(cancelBtn);
      const confirm = await screen.findByText("Discard changes?");

      expect(confirm).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("'Keep editing' dismisses the discard confirm and preserves the name input", async () => {
      const { onClose } = renderDialog();
      await typeName("Analyst");
      const cancelBtn = await screen.findByRole("button", { name: /^cancel$/i });
      userEvent.click(cancelBtn);

      const confirmTitle = await screen.findByText("Discard changes?");
      const confirm = confirmTitle.closest("[role='dialog']") as HTMLElement;
      const editBtn = await within(confirm).findByRole("button", {
        name: /keep editing/i,
      });
      userEvent.click(editBtn);

      await waitFor(() => {
        expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
      });
      expect(
        (screen.getByPlaceholderText("Enter name") as HTMLInputElement).value,
      ).toBe("Analyst");
      expect(onClose).not.toHaveBeenCalled();
    });

    it("'Discard' calls onClose", async () => {
      const { onClose } = renderDialog();
      await typeName("Analyst");
      const cancelBtn = await screen.findByRole("button", { name: /^cancel$/i });
      userEvent.click(cancelBtn);
      await waitFor(() => {
        expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
      });

      const confirmTitle = await screen.findByText("Discard changes?");
      const confirm = confirmTitle.closest("[role='dialog']") as HTMLElement;
      const discardBtn = await within(confirm).findByRole("button", {
        name: /^discard$/i,
      });
      userEvent.click(discardBtn);
      await waitFor(() => {
        expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Unsaved indicator", () => {
    it("renders an 'Unsaved' tag only when the form is dirty", async () => {
      renderDialog();
      expect(screen.queryByText("Unsaved")).not.toBeInTheDocument();

      await typeName("Analyst");
      await waitFor(() => {
        expect(screen.getByText("Unsaved")).toBeInTheDocument();
      });
    });
  });

  describe("Save button", () => {
    it("is disabled when the form is clean", () => {
      renderDialog();
      const save = screen.getByRole("button", { name: /^create role$/i });
      expect(save).toBeDisabled();
    });

    it("enables once the form is both dirty and valid", async () => {
      renderDialog();
      await typeName("Analyst");
      await waitFor(() => {
        const save = screen.getByRole("button", { name: /^create role$/i });
        expect(save).toBeEnabled();
      });
    });
  });

  describe("Edit mode: trash button dirties the form", () => {
    const role: RoleT = {
      uuid: "r1",
      name: "Analyst",
      description: "Reads dashboards",
      users: ["alice@example.com"],
      createdAt: 0,
    };

    it("removes a member via trash and the form becomes dirty", async () => {
      renderDialog({ mode: "edit", initialData: role });

      // Wait for the member list to render.
      await screen.findByText("Alice Admin");

      const trashBtn = screen.getByRole("button", {
        name: /remove alice admin from role/i,
      });
      fireEvent.click(trashBtn);

      // "Unsaved" tag appears, the user vanishes, and Save enables.
      await waitFor(() => {
        expect(screen.getByText("Unsaved")).toBeInTheDocument();
      });
      expect(screen.queryByText("Alice Admin")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
    });
  });
});
