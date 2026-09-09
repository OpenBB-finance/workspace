export function parseCSVContent(content: string) {
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  let sep = ",";
  if (lines[0].startsWith("sep=")) {
    sep = lines[0].substring(4).trim();
    lines.shift();
  }

  const data = lines.map((row) =>
    row.split(sep).map((cell) => cell.trim().replaceAll("\r", "")),
  );

  const valid = data.every((row) => row.length === data[0].length);
  return { data, valid };
}
