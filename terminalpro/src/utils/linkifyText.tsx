import type { ReactNode } from "react";

// Matches either a markdown link `[label](https://url)` or a bare http(s) URL.
// Markdown is listed first so its inner URL isn't also matched as a bare URL.
//   group 1 = markdown label, group 2 = markdown url, group 3 = bare url
const LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/gi;
// Trailing punctuation that is unlikely to be part of a bare URL.
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

function ExternalLink({
  href,
  label,
  index,
}: {
  href: string;
  label: string;
  index: number;
}): ReactNode {
  return (
    <a
      key={`link-${index}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-link-color underline break-all hover:opacity-80"
    >
      {label}
    </a>
  );
}

/**
 * Splits `text` into plain strings and clickable external links. Supports both
 * markdown link syntax `[label](https://url)` and bare http(s) URLs. Any other
 * markdown (bold, headings, etc.) is left as-is. Returns an array of ReactNode
 * that can be rendered inline (e.g. inside a widget description tooltip).
 */
export function linkifyText(text: string): ReactNode[] {
  if (!text) return [];

  const nodes: ReactNode[] = [];
  const regex = new RegExp(LINK_REGEX);
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null = regex.exec(text);

  while (match !== null) {
    const [full, markdownLabel, markdownUrl, bareUrl] = match;
    const start = match.index;

    let href: string;
    let label: string;
    let consumedEnd: number;

    if (markdownUrl) {
      href = markdownUrl;
      label = markdownLabel;
      consumedEnd = start + full.length;
    } else {
      const trailing = bareUrl.match(TRAILING_PUNCTUATION)?.[0] ?? "";
      href = trailing ? bareUrl.slice(0, bareUrl.length - trailing.length) : bareUrl;
      label = href;
      // Leave trailing punctuation for the next plain-text slice.
      consumedEnd = start + href.length;
    }

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    nodes.push(
      <ExternalLink key={`link-${key}`} href={href} label={label} index={key} />,
    );
    key += 1;

    lastIndex = consumedEnd;
    regex.lastIndex = consumedEnd;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
