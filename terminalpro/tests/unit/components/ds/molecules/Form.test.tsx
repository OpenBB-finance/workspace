import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ds/molecules/Form";

const testSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
});

function TestForm() {
  const form = useForm({
    resolver: zodResolver(testSchema),
    defaultValues: {
      username: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <input {...field} placeholder="Enter username" />
              </FormControl>
              <FormDescription>Min 3 characters</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Submit</button>
      </form>
    </Form>
  );
}

describe("Form Molecule", () => {
  it("renders form elements correctly", () => {
    render(<TestForm />);
    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter username")).toBeInTheDocument();
    expect(screen.getByText("Min 3 characters")).toBeInTheDocument();
  });

  it("shows validation error message on invalid submit", async () => {
    const user = userEvent.setup();
    render(<TestForm />);

    const input = screen.getByPlaceholderText("Enter username");
    await user.type(input, "ab");
    await user.click(screen.getByText("Submit"));

    expect(
      await screen.findByText("Username must be at least 3 characters"),
    ).toBeInTheDocument();
  });

  it("sets accessibility attributes correctly", async () => {
    const user = userEvent.setup();
    render(<TestForm />);

    const input = screen.getByPlaceholderText("Enter username");

    // Initial state
    expect(input).toHaveAttribute("aria-describedby");
    expect(input).toHaveAttribute("aria-invalid", "false");

    // After error
    await user.type(input, "ab");
    await user.click(screen.getByText("Submit"));

    await waitFor(() => {
      expect(input).toHaveAttribute("aria-invalid", "true");
    });
  });
});
