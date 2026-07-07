<?php
/**
 * Diesel Geeks Parts Assistant embed
 *
 * Add to the child theme functions.php:
 *   require_once get_stylesheet_directory() . '/dieselgeeks-chat-embed.php';
 *
 * Or paste the wp_footer hook below directly into functions.php.
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

    // Pass API base URL to the loader via a tiny inline prefix.
    wp_add_inline_script(
        'dieselgeeks-chat-loader',
        'window.DIESELGEEKS_CHAT_API_URL = ' . wp_json_encode($api_url) . ';',
        'before'
    );
}
add_action('wp_enqueue_scripts', 'dieselgeeks_enqueue_chat_widget');
