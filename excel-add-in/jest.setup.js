const mockOffice = {
  onReady: async (callback) => {
    await callback();
  },
  actions: {
    associate: async () => {
      await jest.fn();
    },
  },
  addin: {
    showAsTaskpane: async () => {
      await jest.fn();
    },
  },
};

// @ts-expect-error - Office is mocked
global.Office = mockOffice;

// Mock environment variables
jest.mock("~/constants", () => {
  const { loadEnv } = require('vite');
  const packageJson = require("./package.json");

  // Load environment variables for the "test" environment
  const env = loadEnv("test", process.cwd(), "");

  // Merge environment variables with process.env
  process.env = { ...process.env, ...env };

  return {
    VITE_PLATFORM_URL: process.env.VITE_PLATFORM_URL,
    VITE_ADDIN_BASE_URL: process.env.VITE_ADDIN_BASE_URL,
    VERSION: `1.${packageJson.version}.test`,
  };
});

class ErrorConstructor extends Error {
  constructor(code, message) {
    super(message);
    this.name = code;
  }
}

global.CustomFunctions = {
  associate: jest.fn(),
  Error: ErrorConstructor,
  ErrorCode: {
    invalidValue: "invalidValue",
  },
};
