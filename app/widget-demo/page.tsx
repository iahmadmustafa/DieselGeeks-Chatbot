import Script from "next/script";

export const metadata = {
  title: "Widget Demo | Dr Diesel — Diesel Geeks",
  description: "Local demo page for the embeddable Dr Diesel chat widget.",
};

export default function WidgetDemoPage() {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        maxWidth: 760,
        margin: "0 auto",
        lineHeight: 1.5,
      }}
    >
      <h1>Widget demo</h1>
      <p>
        The Dr Diesel launcher should appear in the bottom-right corner. This page loads the
        same async embed bundle used on the WooCommerce store.
      </p>
      <ul>
        <li>Loader: <code>/dieselgeeks-chat-loader.js</code></li>
        <li>Bundle: <code>/dieselgeeks-chat.js</code></li>
        <li>API: <code>/api/chat</code> on this origin</li>
      </ul>
      <p>
        Try an in-scope query like <em>4JJ1 injectors for a 2010 Isuzu D-Max</em>, or an out-of-scope
        query like <em>brake pads for a Honda Civic</em> to confirm dead-end behaviour.
      </p>

      <Script src="/dieselgeeks-chat-loader.js" strategy="lazyOnload" />
    </main>
  );
}
