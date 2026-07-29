import { BrandLogo } from "./BrandLogo";

export function TypingIndicator({ logoUrl }: { logoUrl: string }) {
  return (
    <div className="dg-typing-row">
      <span className="dg-avatar" aria-hidden="true">
        <BrandLogo logoUrl={logoUrl} />
      </span>
      <div className="dg-typing" aria-live="polite" aria-label="Assistant is typing">
        <span className="dg-typing-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}
