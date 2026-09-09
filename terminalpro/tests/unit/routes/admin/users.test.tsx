import * as TabsPrimitive from "@radix-ui/react-tabs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "~/types/user.type";

const makeUser = (over: Partial<User>): User => ({
  uuid: "u",
  first_name: "",
  last_name: "",
  email: "",
  role: "",
  billing_active: true,
  pro_entitlements: {} as User["pro_entitlements"],
  status: "active",
  last_login: null,
  last_active: null,
  permissions_uuid: "p",
  source: "user" as User["source"],
  renewed: false,
  ...over,
});

const USERS: User[] = [
  makeUser({
    uuid: "u1",
    first_name: "Alice",
    last_name: "Anderson",
    email: "alice@example.com",
    last_active: "2026-02-01T10:00:00Z",
  }),
  makeUser({
    uuid: "u2",
    first_name: "Bob",
    last_name: "Brown",
    email: "bob@example.com",
    status: "pending",
  }),
];

vi.mock("~/components/AdminRoles/adminUseQueries", () => ({
  useUsers: () => ({ data: USERS, isLoading: false, isError: false, error: null }),
  useEntityMap: () => ({ data: [] }),
  useEntityRoles: () => ({ data: [] }),
  buildEntityNameMap: () => new Map(),
  buildUserRolesMap: () => new Map(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { seats: 10, used_seats: 3, expiration_date: null },
    isLoading: false,
  }),
}));

vi.mock("~/components/LayoutAuth/Skeleton/SettingsLayout", () => ({
  SettingsLayout: ({ children }: { children: ReactNode }) => (
    <TabsPrimitive.Root value="users">{children}</TabsPrimitive.Root>
  ),
}));

vi.mock("~/components/General/SnowflakeHide", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("~/components/AdminUsers/AdminUserDetailsDialog", () => ({
  default: ({ user }: { user: User }) => (
    <div data-testid="user-details-dialog">{user.email}</div>
  ),
}));

vi.mock("~/components/AdminUsers/AdminInviteUsersDialog", () => ({
  AdminInviteUsersDialog: () => null,
}));

vi.mock("~/components/AdminUsers/ExportUsersDialog", () => ({ default: () => null }));

import AdminUsers from "~/routes/admin/users";

let originalRO: typeof ResizeObserver;

beforeEach(() => {
  // jsdom has no layout; force the virtualized table to measure a viewport.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 1000,
    height: 500,
    top: 0,
    left: 0,
    right: 1000,
    bottom: 500,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  originalRO = global.ResizeObserver;
  global.ResizeObserver = class {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(el: Element) {
      this.cb(
        [
          {
            target: el,
            contentRect: { width: 1000, height: 500 } as DOMRectReadOnly,
            borderBoxSize: [{ inlineSize: 1000, blockSize: 500 }],
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  global.ResizeObserver = originalRO;
  vi.restoreAllMocks();
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminUsers />
    </MemoryRouter>,
  );

describe("AdminUsers", () => {
  it("renders user names as plain text, not clickable links", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Anderson")).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: "Alice Anderson" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Alice Anderson" }),
    ).not.toBeInTheDocument();
  });

  it("reveals a per-row edit action that opens the details dialog", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Anderson")).toBeInTheDocument());

    const editButtons = screen.getAllByRole("button", { name: "Edit user" });
    expect(editButtons).toHaveLength(2);

    fireEvent.click(editButtons[0]);
    expect(screen.getByTestId("user-details-dialog")).toBeInTheDocument();
  });

  it("filters rows via the debounced search", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Bob Brown")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Search/), {
      target: { value: "Alice" },
    });

    await waitFor(
      () => expect(screen.queryByText("Bob Brown")).not.toBeInTheDocument(),
      { timeout: 1500 },
    );
    expect(screen.getByText("Alice Anderson")).toBeInTheDocument();
  });
});
