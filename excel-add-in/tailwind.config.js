import conf from "@openbb/ui/tailwind.config";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    ...conf.content,
    "./index.html",
    "./commands.html",
    "./src/**/*.{js,jsx,ts,tsx,mdx}",
  ],
  presets: [conf],
};
