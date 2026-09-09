/**
 * JSDOM Polyfills
 *
 * Polyfills and mocks for browser APIs not implemented in JSDOM.
 * These are required for testing components that use modern browser APIs.
 */
import { vi } from "vitest";

// ResizeObserver - used by many UI components for responsive behavior
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserver;

// URL.createObjectURL - used for file handling, blob URLs
global.URL.createObjectURL = vi.fn();

// Promise.withResolvers - TC39 proposal, not yet in all environments
if (!("withResolvers" in Promise)) {
  (Promise as any).withResolvers = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve, reject };
  };
}

// Pointer capture methods - required by Radix UI components
if (typeof Element.prototype.hasPointerCapture !== "function") {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
}
if (typeof Element.prototype.setPointerCapture !== "function") {
  Element.prototype.setPointerCapture = vi.fn();
}
if (typeof Element.prototype.releasePointerCapture !== "function") {
  Element.prototype.releasePointerCapture = vi.fn();
}

// scrollIntoView - used by focus management and scrolling utilities
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = vi.fn();
}

// matchMedia - required by vaul/Drawer and responsive components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Enhanced getComputedStyle - vaul library expects transform properties
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (element: Element, pseudoElt?: string | null) => {
  const style = originalGetComputedStyle(element, pseudoElt);
  return new Proxy(style, {
    get(target, prop) {
      const value = target[prop as keyof CSSStyleDeclaration];
      // Return "none" for transform-related properties if undefined
      if (
        (prop === "transform" ||
          prop === "webkitTransform" ||
          prop === "mozTransform") &&
        !value
      ) {
        return "none";
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as CSSStyleDeclaration;
};
