/**
 * TeamBrain chunker — splits extracted document text into retrieval chunks.
 * Documents in the simulated workspace use "## " section headings; the
 * chunker keeps each chunk inside one section and merges short paragraphs
 * so chunks stay in the ~500–800 char range the retriever likes.
 */

export interface DocChunk {
  idx: number;
  section: string;
  content: string;
}

const TARGET_CHUNK_CHARS = 700;
const MIN_CHUNK_CHARS = 240;

export function chunkDocument(text: string): DocChunk[] {
  const lines = text.split(/\r?\n/);
  const sections: { heading: string; paragraphs: string[] }[] = [];
  let current = { heading: "Overview", paragraphs: [] as string[] };

  const flush = () => {
    if (current.paragraphs.length > 0) sections.push(current);
    current = { heading: "Overview", paragraphs: [] };
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+/.test(trimmed)) {
      flush();
      current.heading = trimmed.replace(/^##\s+/, "").trim() || "Section";
    } else if (trimmed.length > 0) {
      current.paragraphs.push(trimmed);
    }
  }
  flush();

  const chunks: DocChunk[] = [];
  for (const section of sections) {
    let buffer = "";
    const push = () => {
      if (buffer.trim().length > 0) {
        chunks.push({ idx: chunks.length, section: section.heading, content: buffer.trim() });
      }
      buffer = "";
    };
    for (const para of section.paragraphs) {
      if (buffer.length > 0 && buffer.length + para.length > TARGET_CHUNK_CHARS) push();
      if (para.length > TARGET_CHUNK_CHARS) {
        // hard-split unusually long paragraphs on sentence boundaries
        const sentences = para.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [para];
        for (const s of sentences) {
          if (buffer.length + s.length > TARGET_CHUNK_CHARS && buffer.length >= MIN_CHUNK_CHARS) push();
          buffer += (buffer.length > 0 ? " " : "") + s.trim();
        }
      } else {
        buffer += (buffer.length > 0 ? "\n" : "") + para;
      }
    }
    push();
  }

  return chunks;
}
