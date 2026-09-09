module.exports = {
  tailwindConfig: "./tailwind.config.js",
  tailwindFunctions: ["cva", "twMerge"],
  plugins: [
    "prettier-plugin-organize-imports",
    "prettier-plugin-tailwindcss",
    "@prettier/plugin-xml",
  ],
};
