export const formatText = (input: string, searchQuery = "", exactMatch = false) => {
  const paragraphs = input.split("\n");

  return (
    <div className="space-y-6">
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="mb-4">
          {formatParagraph(paragraph, searchQuery, exactMatch)}
        </p>
      ))}
    </div>
  );
};

export const formatParagraph = (
  paragraph: string,
  searchQuery: string,
  exactMatch = false,
) => {
  if (searchQuery && paragraph.toLowerCase().includes(searchQuery.toLowerCase())) {
    const lines = paragraph.split(":");

    if (lines.length >= 2) {
      const [title, ...content] = lines;
      const highlightedTitle = highlightSearch(title.trim(), searchQuery, exactMatch);
      const highlightedContent = highlightSearch(
        content.join(":").trim(),
        searchQuery,
        exactMatch,
      );

      return (
        <span>
          <strong>{highlightedTitle}:</strong>
          <br /> {highlightedContent}
        </span>
      );
    }

    return highlightSearch(paragraph, searchQuery, exactMatch);
  }

  const lines = paragraph.split(":");

  if (lines.length >= 2) {
    const [title, ...content] = lines;
    return (
      <span>
        <strong>{title.trim()}:</strong>
        <br /> {content.join(":").trim()}
      </span>
    );
  }

  return paragraph;
};

export const highlightSearch = (
  text: string,
  searchQuery: string,
  exactMatch: boolean,
) => {
  searchQuery = searchQuery.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const pattern = exactMatch ? `\\b(${searchQuery})\\b` : `(${searchQuery})`;
  const regex = new RegExp(pattern, "gi");
  const highlightedText = text.replace(
    regex,
    (match) => `<span class="match bg-warning-50">${match}</span>`,
  );
  return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
};
