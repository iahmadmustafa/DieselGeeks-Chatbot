import * as React from "react";

const INLINE_PATTERN = /\*\*(.+?)\*\*|(https?:\/\/[^\s]+)/g;

/** Render **bold** spans and bare URLs as links within a single line of text. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;
  const pattern = new RegExp(INLINE_PATTERN);

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <React.Fragment key={`${keyPrefix}-t-${idx++}`}>
          {text.slice(lastIndex, match.index)}
        </React.Fragment>,
      );
    }

    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b-${idx++}`}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      nodes.push(
        <a key={`${keyPrefix}-l-${idx++}`} href={match[2]} target="_blank" rel="noopener noreferrer">
          {match[2]}
        </a>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(<React.Fragment key={`${keyPrefix}-t-${idx++}`}>{text.slice(lastIndex)}</React.Fragment>);
  }

  return nodes;
}

const BULLET_PATTERN = /^\s*[-*•]\s+(.*)$/;

/**
 * Lightweight formatter for assistant replies: groups consecutive "- " lines
 * into a real list, bolds **text**, and linkifies bare URLs. Falls back to
 * plain wrapped text for anything else — no external markdown dependency.
 */
export function renderMessageBody(text: string): React.ReactNode {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let blockIndex = 0;
  let previousWasBlank = true;

  function flushList(): void {
    if (listBuffer.length === 0) {
      return;
    }
    const items = listBuffer;
    listBuffer = [];
    blocks.push(
      <ul className="dg-msg-list" key={`list-${blockIndex++}`}>
        {items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderInline(item, `li-${blockIndex}-${itemIndex}`)}</li>
        ))}
      </ul>,
    );
  }

  for (const line of lines) {
    const bulletMatch = line.match(BULLET_PATTERN);
    if (bulletMatch) {
      listBuffer.push(bulletMatch[1]);
      previousWasBlank = false;
      continue;
    }

    flushList();

    if (line.trim() === "") {
      if (!previousWasBlank) {
        blocks.push(<div className="dg-msg-spacer" key={`sp-${blockIndex++}`} />);
      }
      previousWasBlank = true;
      continue;
    }

    previousWasBlank = false;
    blocks.push(
      <p className="dg-msg-line" key={`p-${blockIndex++}`}>
        {renderInline(line, `p-${blockIndex}`)}
      </p>,
    );
  }

  flushList();

  return blocks;
}
