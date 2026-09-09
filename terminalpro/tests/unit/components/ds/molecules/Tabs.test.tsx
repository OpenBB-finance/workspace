import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ds/molecules/Tabs";

describe("Tabs Molecule", () => {
  it("renders tabs correctly", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );

    expect(screen.getByText("Content 1")).toBeInTheDocument();
    expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
  });

  it("switches tabs correctly", async () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );

    const user = userEvent.setup();
    const tab2 = screen.getByRole("tab", { name: "Tab 2" });
    await user.click(tab2);

    await waitFor(
      () => {
        expect(screen.getByText("Content 2")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
  });

  it("applies variant classes correctly", () => {
    const { container } = render(
      <Tabs variant="filled" defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    // Check if the trigger has the filled variant classes
    const trigger = screen.getByText("Tab 1");
    expect(trigger).toHaveClass("bg-tab-bg-secondary");
  });
});
