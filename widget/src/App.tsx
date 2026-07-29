import * as React from "react";

import { ChatWidget } from "./components/ChatWidget";
import { BrandLogo } from "./components/BrandLogo";
import { CartToast } from "./components/CartToast";
import { resolveMobileBottomOffsetPx } from "./config";

interface RootCSSVars extends React.CSSProperties {
  "--dg-mobile-bottom-offset"?: string;
}

function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false,
  );

  React.useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}

export function App({ apiBase }: { apiBase: string }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const logoUrl = `${apiBase}/dr-diesel-logo.png`;
  const mobileBottomOffsetPx = React.useMemo(() => resolveMobileBottomOffsetPx(), []);
  const rootStyle: RootCSSVars = { "--dg-mobile-bottom-offset": `${mobileBottomOffsetPx}px` };

  React.useEffect(() => {
    if (!isOpen || !isMobile) {
      document.documentElement.style.overflow = "";
      return;
    }

    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [isOpen, isMobile]);

  return (
    <div className="dg-root" style={rootStyle}>
      <CartToast isChatOpen={isOpen} />
      <button
        type="button"
        className={`dg-launcher${isOpen ? " dg-launcher-open" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="dieselgeeks-chat-panel"
      >
        <span className="dg-launcher-icon-wrap">
          <BrandLogo className="dg-launcher-logo" logoUrl={logoUrl} />
          <span className="dg-launcher-close-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          {isOpen ? null : <span className="dg-launcher-status-dot" aria-hidden="true" />}
        </span>
        <span className="dg-launcher-text">
          <span className="dg-launcher-title">Dr Diesel</span>
          <span className="dg-launcher-subtitle">Diesel injector &amp; fuel system specialist</span>
        </span>
      </button>

      <div id="dieselgeeks-chat-panel">
        <ChatWidget
          apiBase={apiBase}
          logoUrl={logoUrl}
          isOpen={isOpen}
          isMobile={isMobile}
          onClose={() => setIsOpen(false)}
        />
      </div>
    </div>
  );
}
