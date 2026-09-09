module.exports = {
  tailwindConfig: "./tailwind.config.ts",
  tailwindFunctions: ["cva", "twMerge"],
  plugins: ["prettier-plugin-organize-imports"],

  pluginSearchDirs: [],
  overrides: [
    // Only load `prettier-plugin-tailwindcss` when scanning the src dir
    // this is needed to avoid `Internal Error: require() of ES Module` errors
    // on external packages that use Prettier v2
    {
      files: ["src/*"],
      options: {
        plugins: ["prettier-plugin-tailwindcss"],
      },
    },
  ],
};
