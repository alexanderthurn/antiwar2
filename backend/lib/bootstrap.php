<?php

declare(strict_types=1);

function aw_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    $path = dirname(__DIR__) . '/config.php';
    if (!is_readable($path)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'config_missing', 'message' => 'Copy config.example.php to config.php']);
        exit;
    }
    $config = require $path;
    return $config;
}

function aw_json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function aw_client_ip(): string
{
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($parts[0]);
    }
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

function aw_apply_cors(): void
{
    $origins = aw_config()['cors_origins'] ?? ['*'];
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if (in_array('*', $origins, true)) {
        header('Access-Control-Allow-Origin: *');
    } elseif ($origin !== '' && in_array($origin, $origins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function aw_sanitize_nick(string $nick): string
{
    $nick = preg_replace('/[\x00-\x1f=]/', '', $nick) ?? '';
    return trim($nick);
}

function aw_cache_dir(): string
{
    $dir = dirname(__DIR__) . '/cache';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    return $dir;
}

/** URL to open the game client in replay mode for a score row. */
function aw_game_replay_url(int $scoreId): string
{
    $base = trim((string) (aw_config()['game_url'] ?? ''));
    if ($base === '') {
        return '../../production/?replay=' . $scoreId;
    }
    return rtrim($base, '/') . '/?replay=' . $scoreId;
}
