import { expect, it } from "vitest";

it("checks if vitest setup is loaded", () => {
  expect(global.URL.createObjectURL).toBeDefined();
});

it("should have access to the document object", () => {
  expect(document.body).toBeDefined();
});
