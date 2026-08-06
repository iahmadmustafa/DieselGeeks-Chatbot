<?php
/**
 * Diesel Geeks Parts Assistant — WordPress identity + in-widget login bridge
 *
 * The chat widget is a separate app (hosted on Vercel) embedded into this
 * WordPress site via a script tag (dieselgeeks-chat-loader.js). It cannot
 * read WordPress's cookie-based login session directly — cookies like
 * `wordpress_logged_in_*` only mean anything to PHP on this site. This file
 * is the bridge: it (1) prints a small config object the widget reads on
 * load, (2) exposes an AJAX endpoint that returns a short-lived signed
 * identity token for whoever is logged in, and (3) exposes an AJAX login
 * endpoint so the widget can sign people in with the site's real
 * WordPress/WooCommerce accounts (wp_signon) without sending them away to
 * /my-account/. Google Sign-In still uses Site Kit on My Account inside a
 * small popup; password login stays fully in the widget modal.
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
 * already on the site — that would double-load the chat.
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
 * Builds the signed identity payload the Next.js backend verifies.
 *
 * @param WP_User $user
 * @return array{loggedIn: bool, token: string, displayName: string}
 */
function dieselgeeks_chat_build_identity_response(WP_User $user): array
{
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

    return [
        'loggedIn' => true,
        'token' => $token,
        'displayName' => $user->display_name,
    ];
}

/**
 * Injects window.DIESELGEEKS_CHAT_IDENTITY so the Vercel-hosted widget
 * (loaded via a plain script tag, not wp_enqueue_script) knows how to call
 * our AJAX endpoints. Must be printed by PHP — the nonce can only be
 * created server-side. Head, not footer: the loader is usually async/
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
        // Where the Google Sign-In popup should open — Site Kit injects its
        // button into the WooCommerce My Account login form, so we reuse
        // that page inside a small window instead of inventing a second
        // Google OAuth client for the chat widget.
        'myAccountUrl' => function_exists('wc_get_page_permalink')
            ? (wc_get_page_permalink('myaccount') ?: home_url('/my-account/'))
            : home_url('/my-account/'),
    ];

    echo '<script>window.DIESELGEEKS_CHAT_IDENTITY = ' . wp_json_encode($identity_vars) . ';</script>' . "\n";
}
add_action('wp_head', 'dieselgeeks_chat_print_identity_config', 1);

/**
 * Handles GET (via admin-ajax) requests for the current visitor's identity.
 * Registered for both logged-in and guest requests so the widget always
 * gets a clean answer — `loggedIn: false` for guests — rather than guessing
 * from an HTTP error.
 */
function dieselgeeks_chat_identity_token(): void
{
    check_ajax_referer('dieselgeeks_chat_identity', 'nonce');

    if (!is_user_logged_in()) {
        wp_send_json(['loggedIn' => false]);
    }

    wp_send_json(dieselgeeks_chat_build_identity_response(wp_get_current_user()));
}
add_action('wp_ajax_dieselgeeks_chat_identity', 'dieselgeeks_chat_identity_token');
add_action('wp_ajax_nopriv_dieselgeeks_chat_identity', 'dieselgeeks_chat_identity_token');

/**
 * Signs a visitor in with the same WordPress credentials as My Account
 * (wp_signon sets the normal auth cookies). Used by the in-widget login
 * modal so people never leave the chat page for email/password login.
 */
function dieselgeeks_chat_login(): void
{
    check_ajax_referer('dieselgeeks_chat_identity', 'nonce');

    if (is_user_logged_in()) {
        wp_send_json(dieselgeeks_chat_build_identity_response(wp_get_current_user()));
    }

    $username = isset($_POST['username']) ? sanitize_text_field(wp_unslash((string) $_POST['username'])) : '';
    $password = isset($_POST['password']) ? (string) wp_unslash($_POST['password']) : '';
    $remember = !empty($_POST['remember']);

    if ($username === '' || $password === '') {
        wp_send_json(
            [
                'loggedIn' => false,
                'error' => 'Please enter your username/email and password.',
            ],
            400
        );
    }

    $user = wp_signon(
        [
            'user_login' => $username,
            'user_password' => $password,
            'remember' => $remember,
        ],
        is_ssl()
    );

    if (is_wp_error($user)) {
        wp_send_json(
            [
                'loggedIn' => false,
                // Generic copy on purpose — WordPress's default messages can
                // leak whether a username exists; keep it the same either way.
                'error' => 'Invalid username/email or password. Please try again.',
            ],
            401
        );
    }

    wp_send_json(dieselgeeks_chat_build_identity_response($user));
}
add_action('wp_ajax_dieselgeeks_chat_login', 'dieselgeeks_chat_login');
add_action('wp_ajax_nopriv_dieselgeeks_chat_login', 'dieselgeeks_chat_login');
