<?php
/**
 * Copy to config.php on the web server and fill in real values.
 * config.php is gitignored.
 */
return [
    'db' => [
        'host' => 'localhost',
        'name' => 'antiwar2',
        'user' => 'antiwar2',
        'pass' => 'CHANGE_ME',
        'charset' => 'utf8mb4',
    ],

    /** HMAC secret for prepare checksums — long random string, server-only. */
    'hmac_secret' => 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',

    /** Checksum validity window in seconds (default 24h). */
    'checksum_ttl' => 86400,

    /** Max replay blob size per submit (bytes). Default 1 MiB. */
    'replay_max_bytes' => 1048576,

    /** Rate limits per IP per hour. */
    'rate_limit' => [
        'prepare' => 120,
        'submit' => 60,
    ],

    /**
     * Allowed CORS origins for api/*.php (browser game).
     * Use ['*'] for dev or list explicit origins in production.
     */
    'cors_origins' => ['*'],
];
