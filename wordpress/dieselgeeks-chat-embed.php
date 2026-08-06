<?php
/**
 * Diesel Geeks Parts Assistant embed
 *
 * Optional alternative to a manual script tag for loading the chat loader.
 * If the site already loads dieselgeeks-chat-loader.js via Elementor /
 * footer script tag, do NOT also require this file (it would double-load).
 *
 * Login/identity is handled separately by dieselgeeks-chat-identity.php —
 * that file is self-contained and is what you need for the WP login bridge
 * when using the script-tag loader.
 *
 * Add to the child theme functions.php (only if you are NOT using a script tag):
 *   require_once get_stylesheet_directory() . '/dieselgeeks-chat-embed.php';
 *   require_once get_stylesheet_directory() . '/dieselgeeks-chat-identity.php';
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Set this to your deployed Vercel app URL (no trailing slash).
 * Example: https://dieselgeeks-chat.vercel.app
 */
if (!defined('DIESELGEEKS_CHAT_API_URL')) {
    define('DIESELGEEKS_CHAT_API_URL', 'https://YOUR-VERCEL-APP.vercel.app');
}

function dieselgeeks_enqueue_chat_widget(): void
{
    if (is_admin()) {
        return;
    }

    $api_url = rtrim(DIESELGEEKS_CHAT_API_URL, '/');
    $loader = $api_url . '/dieselgeeks-chat-loader.js';

    wp_enqueue_script(
        'dieselgeeks-chat-loader',
        $loader,
        [],
        null,
        true
    );

    wp_script_add_data('dieselgeeks-chat-loader', 'async', true);
    wp_script_add_data('dieselgeeks-chat-loader', 'defer', true);

    // Identity config (ajaxUrl + nonce) is injected by dieselgeeks-chat-identity.php.
    wp_add_inline_script(
        'dieselgeeks-chat-loader',
        'window.DIESELGEEKS_CHAT_API_URL = ' . wp_json_encode($api_url) . ';',
        'before'
    );
}
add_action('wp_enqueue_scripts', 'dieselgeeks_enqueue_chat_widget');
