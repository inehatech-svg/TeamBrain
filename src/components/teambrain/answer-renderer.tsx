"use client";

import { Fragment, type ReactNode } from "react";
import type { Citation } from "@/types/teambrain";

interface AnswerRendererProps {
  text: string;
  citations: Citation[];
  onCitationClick?: (c: Citation) => void;
}

/** Renders an LLM answer: paragraphs / simple lists, bold spans, and
 * inline [n] citation markers as clickable chips mapped to sources. */
export function AnswerRenderer({ text, citations, onCitationClick }: AnswerRendererProps) {
  const lines = text.split(/\n/).filter((l) => l.trim().length > 0);
  const blocks: ReactNode[] = [];
  let listBuffer: { items: string[]; ordered: boolean } | null = null;

  const flushList = (key: string) => {
    if (!listBuffer) return;
    const { items, ordered } = listBuffer;
    blocks.push(
      ordered ? (
        <ol key={key} className="ml-5 list-decimal space-y-1.5">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key} className="ml-5 list-disc space-y-1.5">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      )
    );
    listBuffer = null;
  };

  const renderInline = (line: string): ReactNode[] => {
    // split on citation markers [n] and bold **...**
    const parts: ReactNode[] = [];
    const regex = /\[(\d+)\]|\*\*([^*]+)\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = regex.exec(line)) !== null) {
      if (m.index > last) parts.push(<Fragment key={k++}>{line.slice(last, m.index)}</Fragment>);
      if (m[1] !== undefined) {
        const n = parseInt(m[1], 10);
        const cite = citations[n - 1];
        if (cite) {
          parts.push(
            <button
              key={k++}
              className={`tb-cite ${cite.cited ? "" : "tb-cite-uncited"}`}
              title={`${cite.name} — ${cite.path}`}
              aria-label={`Open source ${n}: ${cite.name}`}
              onClick={() => onCitationClick?.(cite)}
              type="button"
            >
              {n}
            </button>
          );
        } else {
          parts.push(
            <span key={k++} className="tb-cite tb-cite-uncited">
              {n}
            </span>
          );
        }
      } else if (m[2] !== undefined) {
        parts.push(
          <strong key={k++} className="font-semibold">
            {m[2]}
          </strong>
        );
      }
      last = regex.lastIndex;
    }
    if (last < line.length) parts.push(<Fragment key={k++}>{line.slice(last)}</Fragment>);
    return parts;
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (/^[-•]\s+/.test(trimmed)) {
      if (!listBuffer || listBuffer.ordered) flushList(`list-${i}`);
      listBuffer = listBuffer ?? { items: [], ordered: false };
      listBuffer.items.push(trimmed.replace(/^[-•]\s+/, ""));
      return;
    }
    if (/^\d+[.)]\s+/.test(trimmed)) {
      if (!listBuffer || !listBuffer.ordered) flushList(`list-${i}`);
      listBuffer = listBuffer ?? { items: [], ordered: true };
      listBuffer.items.push(trimmed.replace(/^\d+[.)]\s+/, ""));
      return;
    }
    flushList(`list-${i}`);
    blocks.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {renderInline(trimmed)}
      </p>
    );
  });
  flushList("list-end");

  return <div className="space-y-2.5 text-[0.94rem]">{blocks}</div>;
}
