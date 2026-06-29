<?php

declare(strict_types=1);

/** MySQL `MEDIUMBLOB` max size for `scores.replay` (16 MiB). */
const AW_REPLAY_MEDIUMBLOB_BYTES = 16777216;

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

/** Max replay upload size (bytes); capped at MEDIUMBLOB capacity. */
function aw_replay_max_bytes(): int
{
    $cap = AW_REPLAY_MEDIUMBLOB_BYTES;
    $n = (int) (aw_config()['replay_max_bytes'] ?? $cap);
    if ($n < 1) {
        return $cap;
    }
    return min($n, $cap);
}

/** Build replay viewer query string for a score row. */
function aw_game_replay_query(int $scoreId, float $speed = 1, bool $playing = true): string
{
    return http_build_query([
        'replay' => (string) $scoreId,
        'speed' => (string) $speed,
        'playing' => $playing ? '1' : '0',
    ]);
}

/** Build replay viewer URL for a game client base (no trailing slash). */
function aw_game_replay_url(int $scoreId, ?string $base = null, float $speed = 1, bool $playing = true): string
{
    if ($base === null) {
        $cfg = aw_config();
        $base = trim((string) ($cfg['game_url_production'] ?? $cfg['game_url'] ?? ''));
        if ($base === '') {
            $base = 'http://localhost:5173';
        }
    }
    $base = trim($base);
    if ($base === '') {
        return '';
    }
    return rtrim($base, '/') . '/?' . aw_game_replay_query($scoreId, $speed, $playing);
}

/** Admin watch links for localhost and production game clients. */
function aw_game_replay_watch_links(int $scoreId): array
{
    $cfg = aw_config();
    $local = trim((string) ($cfg['game_url_localhost'] ?? ''));
    if ($local === '') {
        $local = 'http://localhost:5173';
    }
    $production = trim((string) ($cfg['game_url_production'] ?? $cfg['game_url'] ?? ''));
    $links = [
        ['label' => 'Local', 'url' => aw_game_replay_url($scoreId, $local)],
    ];
    if ($production !== '') {
        $links[] = ['label' => 'Prod', 'url' => aw_game_replay_url($scoreId, $production)];
    }
    return $links;
}

/** Public leaderboard / production replay link (no localhost fallback). */
function aw_game_production_replay_url(int $scoreId): string
{
    $cfg = aw_config();
    $base = trim((string) ($cfg['game_url_production'] ?? $cfg['game_url'] ?? ''));
    if ($base === '') {
        return '';
    }
    return aw_game_replay_url($scoreId, $base);
}
