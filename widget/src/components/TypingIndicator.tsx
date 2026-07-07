export function TypingIndicator() {
  return (
    <div className="dg-typing" aria-live="polite" aria-label="Assistant is typing">
      <span>Finding parts</span>
      <span className="dg-typing-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
