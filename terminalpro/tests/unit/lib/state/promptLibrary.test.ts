/**
 * Tests for promptLibrary Zustand store
 *
 * Tests the prompt library state management including:
 * - Prompt CRUD operations
 * - Dialog state management
 * - Prompt reordering
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePromptLibraryStore, type Prompt } from "~/lib/state/promptLibrary";

// Mock API calls
vi.mock("~/api/auth.api", () => ({
  getUserPrompts: vi.fn().mockResolvedValue([]),
  postUserPrompts: vi.fn().mockResolvedValue({}),
}));

// Mock uuidv4
vi.mock("~/lib/utils", () => ({
  uuidv4: vi.fn(() => `uuid-${Math.random().toString(36).substr(2, 9)}`),
}));

describe("usePromptLibraryStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    act(() => {
      usePromptLibraryStore.setState({
        prompts: [],
        addPromptDialogOpen: false,
        editingPromptId: null,
      });
    });
  });

  describe("initial state", () => {
    it("should have empty prompts initially", () => {
      const state = usePromptLibraryStore.getState();
      expect(state.prompts).toEqual([]);
    });

    it("should have addPromptDialogOpen as false initially", () => {
      const state = usePromptLibraryStore.getState();
      expect(state.addPromptDialogOpen).toBe(false);
    });

    it("should have editingPromptId as null initially", () => {
      const state = usePromptLibraryStore.getState();
      expect(state.editingPromptId).toBeNull();
    });
  });

  describe("setAddPromptDialogOpen", () => {
    it("should set dialog open state to true", () => {
      act(() => {
        usePromptLibraryStore.getState().setAddPromptDialogOpen(true);
      });

      expect(usePromptLibraryStore.getState().addPromptDialogOpen).toBe(true);
    });

    it("should set dialog open state to false", () => {
      act(() => {
        usePromptLibraryStore.getState().setAddPromptDialogOpen(true);
      });

      act(() => {
        usePromptLibraryStore.getState().setAddPromptDialogOpen(false);
      });

      expect(usePromptLibraryStore.getState().addPromptDialogOpen).toBe(false);
    });
  });

  describe("setEditingPromptId", () => {
    it("should set editing prompt id", () => {
      act(() => {
        usePromptLibraryStore.getState().setEditingPromptId("prompt-123");
      });

      expect(usePromptLibraryStore.getState().editingPromptId).toBe("prompt-123");
    });

    it("should clear editing prompt id", () => {
      act(() => {
        usePromptLibraryStore.getState().setEditingPromptId("prompt-123");
      });

      act(() => {
        usePromptLibraryStore.getState().setEditingPromptId(null);
      });

      expect(usePromptLibraryStore.getState().editingPromptId).toBeNull();
    });
  });

  describe("addPrompt", () => {
    it("should add a new prompt", () => {
      act(() => {
        usePromptLibraryStore.getState().addPrompt({
          prompt: "Test prompt content",
          widgets: ["widget-1"],
        });
      });

      const prompts = usePromptLibraryStore.getState().prompts;
      expect(prompts).toHaveLength(1);
      expect(prompts[0].prompt).toBe("Test prompt content");
      expect(prompts[0].widgets).toEqual(["widget-1"]);
    });

    it("should generate id, createdAt, and updatedAt", () => {
      act(() => {
        usePromptLibraryStore.getState().addPrompt({
          prompt: "Test",
        });
      });

      const prompt = usePromptLibraryStore.getState().prompts[0];
      expect(prompt.id).toBeDefined();
      expect(prompt.createdAt).toBeDefined();
      expect(prompt.updatedAt).toBeDefined();
    });

    it("should add new prompts at the beginning", () => {
      act(() => {
        usePromptLibraryStore.getState().addPrompt({ prompt: "First" });
      });

      act(() => {
        usePromptLibraryStore.getState().addPrompt({ prompt: "Second" });
      });

      const prompts = usePromptLibraryStore.getState().prompts;
      expect(prompts[0].prompt).toBe("Second");
      expect(prompts[1].prompt).toBe("First");
    });
  });

  describe("removePrompt", () => {
    it("should remove a prompt by id", () => {
      const mockPrompt: Prompt = {
        id: "prompt-to-remove",
        prompt: "Test",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        usePromptLibraryStore.setState({ prompts: [mockPrompt] });
      });

      act(() => {
        usePromptLibraryStore.getState().removePrompt("prompt-to-remove");
      });

      expect(usePromptLibraryStore.getState().prompts).toHaveLength(0);
    });

    it("should only remove the specified prompt", () => {
      const prompts: Prompt[] = [
        {
          id: "keep-1",
          prompt: "Keep 1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "remove",
          prompt: "Remove",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "keep-2",
          prompt: "Keep 2",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      act(() => {
        usePromptLibraryStore.setState({ prompts });
      });

      act(() => {
        usePromptLibraryStore.getState().removePrompt("remove");
      });

      const remaining = usePromptLibraryStore.getState().prompts;
      expect(remaining).toHaveLength(2);
      expect(remaining.find((p) => p.id === "remove")).toBeUndefined();
    });

    it("should not throw when removing non-existent prompt", () => {
      expect(() => {
        act(() => {
          usePromptLibraryStore.getState().removePrompt("non-existent");
        });
      }).not.toThrow();
    });
  });

  describe("updatePrompt", () => {
    it("should update prompt content", () => {
      const mockPrompt: Prompt = {
        id: "prompt-1",
        prompt: "Original",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        usePromptLibraryStore.setState({ prompts: [mockPrompt] });
      });

      act(() => {
        usePromptLibraryStore
          .getState()
          .updatePrompt("prompt-1", { prompt: "Updated" });
      });

      expect(usePromptLibraryStore.getState().prompts[0].prompt).toBe("Updated");
    });

    it("should update updatedAt timestamp", () => {
      const oldDate = "2023-01-01T00:00:00.000Z";
      const mockPrompt: Prompt = {
        id: "prompt-1",
        prompt: "Test",
        createdAt: oldDate,
        updatedAt: oldDate,
      };

      act(() => {
        usePromptLibraryStore.setState({ prompts: [mockPrompt] });
      });

      act(() => {
        usePromptLibraryStore.getState().updatePrompt("prompt-1", { prompt: "New" });
      });

      const updatedPrompt = usePromptLibraryStore.getState().prompts[0];
      expect(new Date(updatedPrompt.updatedAt).getTime()).toBeGreaterThan(
        new Date(oldDate).getTime(),
      );
    });

    it("should preserve other fields when updating", () => {
      const mockPrompt: Prompt = {
        id: "prompt-1",
        prompt: "Original",
        widgets: ["widget-1", "widget-2"],
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
      };

      act(() => {
        usePromptLibraryStore.setState({ prompts: [mockPrompt] });
      });

      act(() => {
        usePromptLibraryStore.getState().updatePrompt("prompt-1", { prompt: "New" });
      });

      const updatedPrompt = usePromptLibraryStore.getState().prompts[0];
      expect(updatedPrompt.widgets).toEqual(["widget-1", "widget-2"]);
      expect(updatedPrompt.createdAt).toBe("2023-01-01T00:00:00.000Z");
    });

    it("should update widgets", () => {
      const mockPrompt: Prompt = {
        id: "prompt-1",
        prompt: "Test",
        widgets: ["widget-1"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        usePromptLibraryStore.setState({ prompts: [mockPrompt] });
      });

      act(() => {
        usePromptLibraryStore
          .getState()
          .updatePrompt("prompt-1", { widgets: ["widget-2", "widget-3"] });
      });

      expect(usePromptLibraryStore.getState().prompts[0].widgets).toEqual([
        "widget-2",
        "widget-3",
      ]);
    });
  });

  describe("getPromptById", () => {
    it("should return prompt by id", () => {
      const mockPrompt: Prompt = {
        id: "find-me",
        prompt: "Found it",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        usePromptLibraryStore.setState({ prompts: [mockPrompt] });
      });

      const result = usePromptLibraryStore.getState().getPromptById("find-me");
      expect(result?.prompt).toBe("Found it");
    });

    it("should return undefined for non-existent id", () => {
      const result = usePromptLibraryStore.getState().getPromptById("non-existent");
      expect(result).toBeUndefined();
    });
  });

  describe("reorderPrompts", () => {
    it("should reorder prompts", () => {
      const prompts: Prompt[] = [
        {
          id: "a",
          prompt: "A",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "b",
          prompt: "B",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "c",
          prompt: "C",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      act(() => {
        usePromptLibraryStore.setState({ prompts });
      });

      // Reorder: C, A, B
      const newOrder = [prompts[2], prompts[0], prompts[1]];

      act(() => {
        usePromptLibraryStore.getState().reorderPrompts(newOrder);
      });

      const reordered = usePromptLibraryStore.getState().prompts;
      expect(reordered[0].id).toBe("c");
      expect(reordered[1].id).toBe("a");
      expect(reordered[2].id).toBe("b");
    });
  });

  describe("complex interactions", () => {
    it("should handle full prompt lifecycle", () => {
      // Add prompt
      act(() => {
        usePromptLibraryStore.getState().addPrompt({
          prompt: "Initial content",
          widgets: ["widget-1"],
        });
      });

      const addedPrompt = usePromptLibraryStore.getState().prompts[0];
      expect(addedPrompt.prompt).toBe("Initial content");

      // Update prompt
      act(() => {
        usePromptLibraryStore
          .getState()
          .updatePrompt(addedPrompt.id, { prompt: "Updated content" });
      });

      expect(usePromptLibraryStore.getState().prompts[0].prompt).toBe("Updated content");

      // Get prompt by id
      const retrievedPrompt = usePromptLibraryStore
        .getState()
        .getPromptById(addedPrompt.id);
      expect(retrievedPrompt?.prompt).toBe("Updated content");

      // Remove prompt
      act(() => {
        usePromptLibraryStore.getState().removePrompt(addedPrompt.id);
      });

      expect(usePromptLibraryStore.getState().prompts).toHaveLength(0);
    });

    it("should handle editing workflow", () => {
      const mockPrompt: Prompt = {
        id: "prompt-1",
        prompt: "Test",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        usePromptLibraryStore.setState({ prompts: [mockPrompt] });
      });

      // Start editing
      act(() => {
        usePromptLibraryStore.getState().setEditingPromptId("prompt-1");
        usePromptLibraryStore.getState().setAddPromptDialogOpen(true);
      });

      expect(usePromptLibraryStore.getState().editingPromptId).toBe("prompt-1");
      expect(usePromptLibraryStore.getState().addPromptDialogOpen).toBe(true);

      // Save edit
      act(() => {
        usePromptLibraryStore
          .getState()
          .updatePrompt("prompt-1", { prompt: "Edited" });
        usePromptLibraryStore.getState().setEditingPromptId(null);
        usePromptLibraryStore.getState().setAddPromptDialogOpen(false);
      });

      expect(usePromptLibraryStore.getState().prompts[0].prompt).toBe("Edited");
      expect(usePromptLibraryStore.getState().editingPromptId).toBeNull();
      expect(usePromptLibraryStore.getState().addPromptDialogOpen).toBe(false);
    });
  });
});
