# Staging embed — Diesel Geeks Parts Assistant

Use this after the chat API is deployed to Vercel (or another host serving this repo).

## 1. Deploy the API + widget bundle

Deploy this Next.js project to Vercel. The build outputs:

- `POST /api/chat` — chat backend
- `/dieselgeeks-chat-loader.js` — tiny async loader (~500 bytes)
- `/dieselgeeks-chat.js` — self-contained widget bundle (Shadow DOM, no theme CSS conflicts)

### Required Vercel environment variables

Copy from `.env.local` and set on Vercel:

- `WOOCOMMERCE_URL=https://stage2.dieselgeeks.com.au`
- `WOOCOMMERCE_CONSUMER_KEY`
- `WOOCOMMERCE_CONSUMER_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`
- `OPENAI_API_KEY`
- `ALLOWED_ORIGINS=https://stage2.dieselgeeks.com.au,https://dieselgeeks.com.au`
- `CONTACT_URL=https://stage2.dieselgeeks.com.au/contact-us/`

`ALLOWED_ORIGINS` is critical — without it the widget on staging cannot call `/api/chat`.

## 2. Local widget demo

```powershell
cd C:\Placentek\dieselgeeks
npm run build:widget
npm run dev
```

Open `http://localhost:3000/widget-demo` (or whichever port Next.js prints).

## 3. Embed on stage2.dieselgeeks.com.au

### Option A — WordPress snippet (recommended)

1. Copy `wordpress/dieselgeeks-chat-embed.php` into the **child theme** folder.
2. Set `DIESELGEEKS_CHAT_API_URL` to your Vercel deployment URL.
3. Add to `functions.php`:

```php
require_once get_stylesheet_directory() . '/dieselgeeks-chat-embed.php';
```

4. Clear any caching (LiteSpeed, Cloudflare, etc.) and hard-refresh the storefront.

### Option B — Raw script tag (footer)

Paste before `</body>` in the child theme footer template, or via a header/footer injection plugin:

```html
<script>
  window.DIESELGEEKS_CHAT_API_URL = 'https://YOUR-VERCEL-APP.vercel.app';
</script>
<script async defer src="https://YOUR-VERCEL-APP.vercel.app/dieselgeeks-chat-loader.js" data-api-url="https://YOUR-VERCEL-APP.vercel.app"></script>
```

Replace `YOUR-VERCEL-APP` with the real deployment hostname.

## 4. Verify on staging

1. Open `https://stage2.dieselgeeks.com.au` — launcher appears bottom-right.
2. Ask: `4JJ1 injectors for a 2010 Isuzu D-Max` → product cards with real prices/links.
3. Ask: `brake pads for a Honda Civic` → immediate polite dead-end + contact link.
4. In DevTools → Network, confirm `POST https://YOUR-VERCEL-APP.vercel.app/api/chat` returns `200`.

## 5. Performance notes

- Loader is `async defer` — does not block page render.
- Widget mounts in Shadow DOM — theme CSS cannot break it.
- Session id persists in `localStorage` (`dg_chat_session_id`) for multi-turn chat.
