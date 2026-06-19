const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 120;

export const splitIntoChunks = (text: string): string[] => {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  if (normalized.length <= CHUNK_SIZE) {
    return [normalized];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    chunks.push(normalized.slice(start, end));

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
};
