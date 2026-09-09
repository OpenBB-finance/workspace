/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: "node",
  globals: {},
  verbose: false,
  projects: [
    {
      displayName: "unit",
      preset: "ts-jest",
      moduleNameMapper: {
        "^~/(.*)$": "<rootDir>/src/$1",
      },
      setupFilesAfterEnv: ["./jest.setup.js"],
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
    },
    {
      displayName: "integration-full",
      preset: "ts-jest",
      moduleNameMapper: {
        "^~/(.*)$": "<rootDir>/src/$1",
      },
      setupFilesAfterEnv: ["./jest.setup.js"],
      testMatch: ["<rootDir>/tests/integration/**/*.full.test.ts"],
    },
    {
      displayName: "integration-smoke",
      preset: "ts-jest",
      moduleNameMapper: {
        "^~/(.*)$": "<rootDir>/src/$1",
      },
      setupFilesAfterEnv: ["./jest.setup.js"],
      testMatch: ["<rootDir>/tests/integration/**/*.smoke.test.ts"],
    },
  ],
};
