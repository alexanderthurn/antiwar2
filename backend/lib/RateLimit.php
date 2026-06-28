<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

final class AwRateLimit
{
    public static function check(string $bucket, int $limit): bool
    {
        if ($limit <= 0) {
            return true;
        }
        $ip = aw_client_ip();
        $key = hash('sha256', $bucket . '|' . $ip);
        $path = aw_cache_dir() . '/rl_' . $key . '.json';
        $now = time();
        $windowStart = $now - 3600;
        $hits = [];
        if (is_readable($path)) {
            $raw = file_get_contents($path);
            $decoded = is_string($raw) ? json_decode($raw, true) : null;
            if (is_array($decoded)) {
                foreach ($decoded as $ts) {
                    if (is_int($ts) && $ts >= $windowStart) {
                        $hits[] = $ts;
                    }
                }
            }
        }
        if (count($hits) >= $limit) {
            return false;
        }
        $hits[] = $now;
        file_put_contents($path, json_encode($hits), LOCK_EX);
        return true;
    }
}
