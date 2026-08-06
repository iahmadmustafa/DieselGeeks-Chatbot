<?php
/**
 * Diesel Geeks Parts Assistant — WordPress identity + in-widget login bridge
 *
 * The chat widget is a separate app (hosted on Vercel) embedded into this
 * WordPress site via a script tag (dieselgeeks-chat-loader.js). It cannot
 * read WordPress's cookie-based login session directly — cookies like
 * `wordpress_logged_in_*` only mean anything to PHP on this site. This file
 * is the bridge: it (1) prints a small config object the widget reads on
 * load, (2) exposes an AJAX identity endpoint, (3) email/password login via
 * wp_signon, and (4) Google Sign-In via Google Identity Services ID tokens
 * verified here (same Client ID as Site Kit) so login never leaves the chat
 * page for /my-account/.
 *
 * Deploy (script-tag loader already in place — you only need this one file):
 *   1. Upload this file into the child theme folder.
 *   2. In child theme functions.php, add:
 *        require_once get_stylesheet_directory() . '/dieselgeeks-chat-identity.php';
 *   3. In wp-config.php, above "That's all, stop editing!", add:
 *        define('DIESELGEEKS_CHAT_JWT_SECRET', 'PASTE_A_LONG_RANDOM_SECRET_HERE');
 *      Generate with e.g. `openssl rand -hex 32` — use a fresh value.
 *   4. Optional override if Site Kit's Client ID can't be auto-detected:
 *        define('DIESELGEEKS_CHAT_GOOGLE_CLIENT_ID', 'xxxx.apps.googleusercontent.com');
 *      (Usually not needed — we read it from Site Kit settings.)
 *   5. Set the same JWT secret as WP_CHAT_JWT_SECRET on the chatbot app
 *      (Vercel env + .env.local), then redeploy the widget.
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
 * Base64url-encodes a string (no padding, URL/JSON-safe).
 */
function dieselgeeks_chat_base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * Resolves the Google OAuth Client ID used by Site Kit's Sign in with Google
 * (or an explicit constant override). Exposed to the widget so Google
 * Identity Services can run on this page origin without opening My Account.
 */
function dieselgeeks_chat_get_google_client_id(): string
{
    if (defined('DIESELGEEKS_CHAT_GOOGLE_CLIENT_ID') && DIESELGEEKS_CHAT_GOOGLE_CLIENT_ID !== '') {
        return (string) DIESELGEEKS_CHAT_GOOGLE_CLIENT_ID;
    }

    $siwg_settings = get_option('googlesitekit_sign-in-with-google_settings');
    if (is_array($siwg_settings)) {
        foreach (['clientID', 'clientId', 'client_id'] as $key) {
            if (!empty($siwg_settings[$key]) && is_string($siwg_settings[$key])) {
                return $siwg_settings[$key];
            }
        }
    }

    $poc_client_id = get_option('googlesitekit_siwg_poc_client_id');
    if (is_string($poc_client_id) && $poc_client_id !== '') {
        return $poc_client_id;
    }

    return '';
}

/**
 * @param WP_User $user
 * @return array{loggedIn: bool, token: string, displayName: string}
 */
function dieselgeeks_chat_build_identity_response(WP_User $user): array
{
    $payload = [
        'uid' => $user->ID,
        'email' => $user->user_email,
        'name' => $user->display_name,
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
 * Verifies a Google ID token against Google's tokeninfo endpoint and our
 * expected Client ID. Returns the decoded payload array or WP_Error.
 *
 * @return array<string, mixed>|WP_Error
 */
function dieselgeeks_chat_verify_google_id_token(string $id_token, string $client_id)
{
    $response = wp_remote_get(
        'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($id_token),
        [
            'timeout' => 15,
            'headers' => ['Accept' => 'application/json'],
        ]
    );

    if (is_wp_error($response)) {
        return new WP_Error('google_unreachable', 'Could not verify Google sign-in. Please try again.');
    }

    $code = wp_remote_retrieve_response_code($response);
    $body = json_decode(wp_remote_retrieve_body($response), true);

    if ($code !== 200 || !is_array($body)) {
        return new WP_Error('google_invalid_token', 'Google sign-in could not be verified. Please try again.');
    }

    if (empty($body['aud']) || !hash_equals($client_id, (string) $body['aud'])) {
        return new WP_Error('google_wrong_audience', 'Google sign-in is misconfigured for this site.');
    }

    $email_verified = $body['email_verified'] ?? false;
    if ($email_verified !== true && $email_verified !== 'true') {
        return new WP_Error('google_email_unverified', 'Please use a verified Google account email.');
    }

    if (empty($body['email']) || !is_email($body['email'])) {
        return new WP_Error('google_no_email', 'Google did not return a valid email address.');
    }

    return $body;
}

/**
 * Finds or creates a WP user for a verified Google profile, matching how
 * Site Kit / WooCommerce expect customer accounts to exist.
 *
 * @param array<string, mixed> $google_payload
 * @return WP_User|WP_Error
 */
function dieselgeeks_chat_user_from_google_payload(array $google_payload)
{
    $email = sanitize_email((string) $google_payload['email']);
    $existing = get_user_by('email', $email);
    if ($existing instanceof WP_User) {
        return $existing;
    }

    if (!get_option('users_can_register') && !apply_filters('dieselgeeks_chat_allow_google_registration', true)) {
        return new WP_Error(
            'google_registration_disabled',
            'No account exists for this Google email. Please register on the site first, or sign in with email and password.'
        );
    }

    $display_name = '';
    if (!empty($google_payload['name']) && is_string($google_payload['name'])) {
        $display_name = sanitize_text_field($google_payload['name']);
    }

    $login_base = sanitize_user(current(explode('@', $email)), true);
    if ($login_base === '') {
        $login_base = 'user';
    }

    $login = $login_base;
    $suffix = 1;
    while (username_exists($login)) {
        $login = $login_base . $suffix;
        $suffix++;
    }

    $user_id = wp_insert_user(
        [
            'user_login' => $login,
            'user_email' => $email,
            'user_pass' => wp_generate_password(32, true, true),
            'display_name' => $display_name !== '' ? $display_name : $login,
            'role' => get_option('default_role', 'customer'),
        ]
    );

    if (is_wp_error($user_id)) {
        return $user_id;
    }

    $user = get_user_by('id', $user_id);
    return $user instanceof WP_User
        ? $user
        : new WP_Error('google_user_create_failed', 'Could not create your account. Please try again.');
}

function dieselgeeks_chat_print_identity_config(): void
{
    if (is_admin()) {
        return;
    }

    $identity_vars = [
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('dieselgeeks_chat_identity'),
        // Same Client ID Site Kit uses — widget runs Google Identity Services
        // on this page so Google login never navigates to /my-account/.
        'googleClientId' => dieselgeeks_chat_get_google_client_id(),
    ];

    echo '<script>window.DIESELGEEKS_CHAT_IDENTITY = ' . wp_json_encode($identity_vars) . ';</script>' . "\n";
}
add_action('wp_head', 'dieselgeeks_chat_print_identity_config', 1);

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
                'error' => 'Invalid username/email or password. Please try again.',
            ],
            401
        );
    }

    wp_send_json(dieselgeeks_chat_build_identity_response($user));
}
add_action('wp_ajax_dieselgeeks_chat_login', 'dieselgeeks_chat_login');
add_action('wp_ajax_nopriv_dieselgeeks_chat_login', 'dieselgeeks_chat_login');

/**
 * Completes Google Sign-In for the widget: verifies the GIS ID token, finds
 * or creates the WP user, sets the normal auth cookie, returns our identity
 * token. No redirect to My Account.
 */
function dieselgeeks_chat_google_login(): void
{
    check_ajax_referer('dieselgeeks_chat_identity', 'nonce');

    if (is_user_logged_in()) {
        wp_send_json(dieselgeeks_chat_build_identity_response(wp_get_current_user()));
    }

    $client_id = dieselgeeks_chat_get_google_client_id();
    if ($client_id === '') {
        wp_send_json(
            [
                'loggedIn' => false,
                'error' => 'Google sign-in isn’t configured on this site yet.',
            ],
            503
        );
    }

    $credential = isset($_POST['credential']) ? (string) wp_unslash($_POST['credential']) : '';
    if ($credential === '') {
        wp_send_json(
            [
                'loggedIn' => false,
                'error' => 'Missing Google credential. Please try again.',
            ],
            400
        );
    }

    $payload = dieselgeeks_chat_verify_google_id_token($credential, $client_id);
    if (is_wp_error($payload)) {
        wp_send_json(
            [
                'loggedIn' => false,
                'error' => $payload->get_error_message(),
            ],
            401
        );
    }

    $user = dieselgeeks_chat_user_from_google_payload($payload);
    if (is_wp_error($user)) {
        wp_send_json(
            [
                'loggedIn' => false,
                'error' => $user->get_error_message(),
            ],
            400
        );
    }

    wp_set_current_user($user->ID);
    wp_set_auth_cookie($user->ID, true, is_ssl());

    wp_send_json(dieselgeeks_chat_build_identity_response($user));
}
add_action('wp_ajax_dieselgeeks_chat_google_login', 'dieselgeeks_chat_google_login');
add_action('wp_ajax_nopriv_dieselgeeks_chat_google_login', 'dieselgeeks_chat_google_login');
