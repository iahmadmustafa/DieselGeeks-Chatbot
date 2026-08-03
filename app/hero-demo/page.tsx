import Script from "next/script";

export const metadata = {
  title: "Hero Chat Demo | Dr Diesel — Diesel Geeks",
  description: "Local demo page for the homepage hero chat interface.",
};

export default function HeroDemoPage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
      <div style={{ padding: "2rem", maxWidth: 760, margin: "0 auto" }}>
        <h1>Hero chat demo</h1>
        <p>
          This simulates the Elementor container that will replace the homepage slider — a
          plain <code>&lt;div id=&quot;dg-hero-chat&quot;&gt;</code> placeholder with a background
          behind it. The widget bundle mounts the inline hero interface into it below.
        </p>
        <p>
          <strong>Works locally:</strong> the idle search box, expand-in-place behaviour, chat
          replies, and product cards (all via <code>/api/chat</code> on this origin).
          <br />
          <strong>Won&apos;t work locally:</strong> add-to-cart / cart / checkout inside the hero —
          those call the live WooCommerce Store API on this page&apos;s origin, which only exists
          on the real WordPress site. Test that part on staging.
        </p>
      </div>

      {/*
        Full-bleed placeholder matching the real Elementor container this
        replaces (see 1st screenshot in the request) — edge to edge, no
        centering/max-width/padding wrapper, sized like an actual hero
        section rather than a boxed-in preview.
      */}
      <div id="dg-hero-chat" style={{ width: "100%" }} />

      <Script src="/dieselgeeks-chat-loader.js" strategy="lazyOnload" />
    </main>
  );
}
