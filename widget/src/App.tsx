import * as React from "react";

import { ChatWidget } from "./components/ChatWidget";
import { BrandLogo } from "./components/BrandLogo";

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
    <div className="dg-root">
      <button
        type="button"
        className="dg-launcher"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="dieselgeeks-chat-panel"
      >
        <BrandLogo className="dg-launcher-logo" logoUrl={logoUrl} />
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
