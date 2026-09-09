import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function updateIcons() {
  try {
    const spritePath = path.join(__dirname, "../public/assets/icons/sprite.svg");
    const iconTypesFilePath = path.join(__dirname, "../src/components/Icon.types.ts");

    const spriteContent = await fs.readFile(spritePath, "utf-8");
    const iconTypesFileContent = await fs.readFile(iconTypesFilePath, "utf-8");

    const symbolRegex = /<symbol[^>]*\sid="([^"]+)"[^>]*>/g;
    const matches = [...spriteContent.matchAll(symbolRegex)];
    const iconIds = matches.map((match) => match[1]);

    console.log(`Extracted ${iconIds.length} icon IDs: ${iconIds.join(", ")}`);
    iconIds.sort((a, b) => a.localeCompare(b));

    // Adds trailing comma to each icon ID
    const icons = JSON.stringify(iconIds, null, 2).replace(
      /\n\s*("[^"]+")(?=\n\s*\])/g,
      "\n  $1,",
    );

    // More specific regex to match the icons array declaration
    const newContent = iconTypesFileContent.replace(
      /const allIcons = \[[\s\S]*?\] as const;/,
      `const allIcons = ${icons} as const;`,
    );

    // Add check to ensure content was actually modified
    if (newContent === iconTypesFileContent) {
      console.log("⚠️ No changes were made to Icon.tsx - pattern not found");
      process.exit(1);
    }

    await fs.writeFile(iconTypesFilePath, newContent, "utf-8");
    console.log(`✅ Updated Icon.tsx with ${iconIds.length} icons.`);
  } catch (error) {
    console.error("Error updating icons:", error);
    process.exit(1);
  }
}

updateIcons();
