const TARGET_TOKENS = 500;
const OVERLAP_TOKENS = 50;
const CHARS_PER_TOKEN = 4;

const targetChars = TARGET_TOKENS * CHARS_PER_TOKEN;
const overlapChars = OVERLAP_TOKENS * CHARS_PER_TOKEN;

const HEADING_PATTERN = /^(#{1,6}\s|(?:Chapter|Section|Unit|Lecture|Topic)\s+\d|[A-Z][A-Z0-9\s]{2,}:)/im;

const splitByHeadings = (text: string): string[] => {
  const lines = text.split("\n");
  const sections: string[] = [];
  let current = "";

  for (const line of lines) {
    if (HEADING_PATTERN.test(line.trim()) && current.trim()) {
      sections.push(current.trim());
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }

  if (current.trim()) {
    sections.push(current.trim());
  }

  return sections.length > 0 ? sections : [text];
};

const splitByParagraphs = (section: string): string[] => {
  const paragraphs = section
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : [section];
};

const preserveFormulaBlocks = (paragraph: string): string[] => {
  const formulaPattern = /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g;
  if (!formulaPattern.test(paragraph)) {
    return [paragraph];
  }

  return [paragraph];
};

const mergeIntoChunks = (units: string[]): string[] => {
  const chunks: string[] = [];
  let buffer = "";

  for (const unit of units) {
    const candidate = buffer ? `${buffer}\n\n${unit}` : unit;

    if (candidate.length <= targetChars) {
      buffer = candidate;
      continue;
    }

    if (buffer) {
      chunks.push(buffer);
      const tail = buffer.slice(-overlapChars);
      buffer = tail ? `${tail}\n\n${unit}` : unit;
    } else if (unit.length <= targetChars) {
      buffer = unit;
    } else {
      let start = 0;
      while (start < unit.length) {
        const end = Math.min(start + targetChars, unit.length);
        chunks.push(unit.slice(start, end));
        if (end >= unit.length) break;
        start = Math.max(end - overlapChars, start + 1);
      }
      buffer = "";
    }
  }

  if (buffer.trim()) {
    chunks.push(buffer.trim());
  }

  return chunks;
};

export const estimateTokens = (text: string): number =>
  Math.ceil(text.length / CHARS_PER_TOKEN);

export const splitIntoChunks = (text: string): string[] => {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  if (normalized.length <= targetChars) {
    return [normalized];
  }

  const sections = splitByHeadings(normalized);
  const units = sections.flatMap((section) =>
    splitByParagraphs(section).flatMap(preserveFormulaBlocks),
  );

  return mergeIntoChunks(units);
};
