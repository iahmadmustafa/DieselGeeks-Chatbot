<?php
/**
 * Diesel Geeks chatbot — expose fitment meta in WooCommerce REST API.
 *
 * Add this snippet to the Mobex child theme functions.php (staging first).
 * After deploy, verify: GET /wp-json/wc/v3/products/{id} includes mobex_child_fitment_info.
 */
add_action('init', function () {
    register_post_meta('product', 'mobex_child_fitment_info', [
        'type'              => 'string',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'sanitize_textarea_field',
        'auth_callback'     => function () {
            return current_user_can('edit_posts');
        },
    ]);
});
