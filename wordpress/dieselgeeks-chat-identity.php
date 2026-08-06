<?php
/**
 * Diesel Geeks Parts Assistant — WordPress identity bridge
 *
 * The chat widget is a separate app (hosted on Vercel) embedded into this
 * WordPress site via a script tag (dieselgeeks-chat-loader.js). It cannot
 * read WordPress's cookie-based login session directly — cookies like
 * `wordpress_logged_in_*` only mean anything to PHP on this site. This file
 * is the bridge: it (1) prints a small config object the widget reads on
 * load, and (2) exposes an AJAX endpoint that, using the visitor's WP
 * cookies, returns a short-lived signed token proving who they are. The
 * widget forwards that token to our Next.js backend, which verifies the
 * signature with the same shared secret.
 *
 * Deploy (script-tag loader already in place — you only need this one file):
 *   1. Upload this file into the child theme folder.
 *   2. In child theme functions.php, add:
 *        require_once get_stylesheet_directory() . '/dieselgeeks-chat-identity.php';
 *   3. In wp-config.php, above "That's all, stop editing!", add:
 *        define('DIESELGEEKS_CHAT_JWT_SECRET', 'PASTE_A_LONG_RANDOM_SECRET_HERE');
 *      Generate with e.g. `openssl rand -hex 32` — use a fresh value.
 *   4. Set the same value as WP_CHAT_JWT_SECRET on the chatbot app
 *      (Vercel env + .env.local for local dev), then redeploy.
 *
 * Do NOT also upload dieselgeeks-chat-embed.php if the loader script tag is
 * already on the site — that would double-load the chat. This file is
 * self-contained for the identity feature.
 *
 * Without step 3, this file intentionally does nothing rather than issuing
 * unsigned/insecure tokens.
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('DIESELGEEKS_CHAT_JWT_SECRET') || DIESELGEEKS_CHAT_JWT_SECRET === '') {
    return;
}

/**
 * Base64url-encodes a string (no padding, URL/JSON-safe) — plain base64's
 * `+`, `/` and `=` characters would need extra escaping wherever this token
 * ends up (query strings, headers), so this avoids that entirely.
 */
function dieselgeeks_chat_base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * Injects window.DIESELGEEKS_CHAT_IDENTITY so the Vercel-hosted widget
 * (loaded via a plain script tag, not wp_enqueue_script) knows how to call
 * our AJAX identity endpoint. Must be printed by PHP — the nonce can only
 * be created server-side. Head, not footer: the loader is usually async/
 * defer, so putting this early avoids a race where the widget mounts
 * before the config exists and permanently treats the visitor as logged out.
 */
function dieselgeeks_chat_print_identity_config(): void
{
    if (is_admin()) {
        return;
    }

    $identity_vars = [
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('dieselgeeks_chat_identity'),
    ];

    echo '<script>window.DIESELGEEKS_CHAT_IDENTITY = ' . wp_json_encode($identity_vars) . ';</script>' . "\n";
}
add_action('wp_head', 'dieselgeeks_chat_print_identity_config', 1);

/**
 * Handles GET (via admin-ajax) requests for the current visitor's identity.
 * Registered for both logged-in and guest requests (see the two
 * add_action calls below) so the widget always gets a clean, well-formed
 * answer — `loggedIn: false` for guests — rather than needing to guess
 * from an HTTP error why nothing came back.
 */
function dieselgeeks_chat_identity_token(): void
{
    // Verifies the request actually came from a page render on this site
    // (not a forged cross-site request) — see the nonce printed above.
    // Dies with a 403-style response on failure, which the widget treats
    // the same as "not logged in".
    check_ajax_referer('dieselgeeks_chat_identity', 'nonce');

    if (!is_user_logged_in()) {
        wp_send_json(['loggedIn' => false]);
    }

    $user = wp_get_current_user();

    $payload = [
        'uid' => $user->ID,
        'email' => $user->user_email,
        'name' => $user->display_name,
        // Short expiry — this token only needs to live long enough for the
        // widget to pick it up and hand it to our backend once per page
        // load/session refresh, not to act as a long-lived credential.
        'exp' => time() + 300,
    ];

    $payload_b64 = dieselgeeks_chat_base64url_encode(wp_json_encode($payload));
    $signature = hash_hmac('sha256', $payload_b64, DIESELGEEKS_CHAT_JWT_SECRET);
    $token = $payload_b64 . '.' . $signature;

    wp_send_json([
        'loggedIn' => true,
        'token' => $token,
        'displayName' => $user->display_name,
    ]);
}
add_action('wp_ajax_dieselgeeks_chat_identity', 'dieselgeeks_chat_identity_token');
add_action('wp_ajax_nopriv_dieselgeeks_chat_identity', 'dieselgeeks_chat_identity_token');
