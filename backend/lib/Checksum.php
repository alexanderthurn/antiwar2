<?php

declare(strict_types=1);

final class AwChecksum
{
    /**
     * Create a stateless submit checksum (not stored until score insert).
     *
     * @return array{checksum:string,startedAt:int,expiresIn:int}
     */
    public static function create(string $boardId, string $secret, int $ttl): array
    {
        $startedAt = time();
        $nonce = bin2hex(random_bytes(16));
        $payload = $boardId . "\n" . $startedAt . "\n" . $nonce;
        $sig = hash_hmac('sha256', $payload, $secret);
        $checksum = base64_encode($payload . "\n" . $sig);

        return [
            'checksum' => $checksum,
            'startedAt' => $startedAt,
            'expiresIn' => $ttl,
        ];
    }

    /**
     * @return array{boardId:string,startedAt:int,nonce:string}|null
     */
    public static function verify(string $checksum, string $secret, int $ttl): ?array
    {
        $raw = base64_decode($checksum, true);
        if ($raw === false) {
            return null;
        }
        $parts = explode("\n", $raw);
        if (count($parts) !== 4) {
            return null;
        }
        [$boardId, $startedAtRaw, $nonce, $sig] = $parts;
        if ($boardId === '' || $nonce === '' || $sig === '') {
            return null;
        }
        $startedAt = (int) $startedAtRaw;
        if ($startedAt <= 0) {
            return null;
        }
        if (time() - $startedAt > $ttl) {
            return null;
        }
        $payload = $boardId . "\n" . $startedAt . "\n" . $nonce;
        $expected = hash_hmac('sha256', $payload, $secret);
        if (!hash_equals($expected, $sig)) {
            return null;
        }
        return [
            'boardId' => $boardId,
            'startedAt' => $startedAt,
            'nonce' => $nonce,
        ];
    }
}
