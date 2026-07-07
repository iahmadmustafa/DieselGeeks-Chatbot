export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 720 }}>
      <h1>Diesel Geeks Product Assistant API</h1>
      <p>Phase 1 service is running. Use the sync and catalog endpoints with your configured secrets.</p>
      <ul>
        <li>
          <code>GET /api/sync</code> — fetch WooCommerce products, normalize fitment, write Redis snapshot
        </li>
        <li>
          <code>GET /api/catalog</code> — read the latest snapshot and fitment review list
        </li>
        <li>
          <code>POST /api/chat</code> — grounded product chat (streaming)
        </li>
        <li>
          <code>/widget-demo</code> — local embed demo for the storefront widget
        </li>
      </ul>
    </main>
  );
}
