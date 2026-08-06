import * as React from "react";

/**
 * Inline markdown we support inside a line:
 * - **bold**
 * - [label](https://...)  (preferred — short link text)
 * - bare https://... URLs (shown as a short label, never the full string)
 */
const INLINE_PATTERN = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+)/g;

function linkLabelForUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.includes("/product/")) {
      return "View product";
    }
    if (parsed.pathname.includes("contact")) {
      return "Contact us";
    }
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Open link";
  }
}

/** Render **bold**, markdown links, and bare URLs within a single line of text. */
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
    } else if (match[2] !== undefined && match[3] !== undefined) {
      nodes.push(
        <a
          key={`${keyPrefix}-ml-${idx++}`}
          className="dg-msg-link"
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[2]}
        </a>,
      );
    } else if (match[4] !== undefined) {
      nodes.push(
        <a
          key={`${keyPrefix}-l-${idx++}`}
          className="dg-msg-link"
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {linkLabelForUrl(match[4])}
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
const NUMBERED_PATTERN = /^\s*(\d+)[.)]\s+(.*)$/;

/**
 * Lightweight formatter for assistant replies: groups consecutive bullet /
 * numbered lines into real lists, bolds **text**, turns [label](url) and bare
 * URLs into short links. No external markdown dependency.
 */
export function renderMessageBody(text: string): React.ReactNode {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: { kind: "ul" | "ol"; items: string[] } | null = null;
  let blockIndex = 0;
  let previousWasBlank = true;

  function flushList(): void {
    if (!listBuffer || listBuffer.items.length === 0) {
      listBuffer = null;
      return;
    }
    const { kind, items } = listBuffer;
    listBuffer = null;
    const ListTag = kind === "ol" ? "ol" : "ul";
    blocks.push(
      <ListTag className={`dg-msg-list${kind === "ol" ? " dg-msg-list-ordered" : ""}`} key={`list-${blockIndex++}`}>
        {items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderInline(item, `li-${blockIndex}-${itemIndex}`)}</li>
        ))}
      </ListTag>,
    );
  }

  function pushListItem(kind: "ul" | "ol", item: string): void {
    if (!listBuffer || listBuffer.kind !== kind) {
      flushList();
      listBuffer = { kind, items: [] };
    }
    listBuffer.items.push(item);
    previousWasBlank = false;
  }

  for (const line of lines) {
    const bulletMatch = line.match(BULLET_PATTERN);
    if (bulletMatch) {
      pushListItem("ul", bulletMatch[1]);
      continue;
    }

    const numberedMatch = line.match(NUMBERED_PATTERN);
    if (numberedMatch) {
      pushListItem("ol", numberedMatch[2]);
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

  return <div className="dg-msg-body">{blocks}</div>;
}
