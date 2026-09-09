const PROTECTED_MARKDOWN_SEGMENT_REGEX =
  /(```[\s\S]*?```|`[^`]*`|<(?:artifact|citation)\s+className="[^"]+"\s*\/>|(?:https?|ftp|file):\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+)/g;

function escapePlainTextUnderscores(text: string) {
  let escaped = "";

  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];

    if (character === "_" && text[i - 1] !== "\\") {
      escaped += "\\_";
      continue;
    }

    escaped += character;
  }

  return escaped;
}

export function escapeMarkdownUnderscores(text: string) {
  if (!text) return "";

  let escaped = "";
  let lastIndex = 0;

  for (const match of text.matchAll(PROTECTED_MARKDOWN_SEGMENT_REGEX)) {
    const index = match.index ?? 0;

    escaped += escapePlainTextUnderscores(text.slice(lastIndex, index));
    escaped += match[0];
    lastIndex = index + match[0].length;
  }

  escaped += escapePlainTextUnderscores(text.slice(lastIndex));
  return escaped;
}
