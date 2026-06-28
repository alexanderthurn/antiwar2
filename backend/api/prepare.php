<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/bootstrap.php';
require_once dirname(__DIR__) . '/lib/Checksum.php';
require_once dirname(__DIR__) . '/lib/RateLimit.php';

aw_apply_cors();

$config = aw_config();
$limits = $config['rate_limit'] ?? [];
if (!AwRateLimit::check('prepare', (int) ($limits['prepare'] ?? 120))) {
    aw_json_response(['error' => 'rate_limited'], 429);
}

$boardId = trim((string) ($_GET['boardId'] ?? $_POST['boardId'] ?? ''));
if ($boardId === '' || strlen($boardId) > 64) {
    aw_json_response(['error' => 'invalid_board_id'], 400);
}

$secret = (string) ($config['hmac_secret'] ?? '');
if ($secret === '' || str_contains($secret, 'CHANGE_ME')) {
    aw_json_response(['error' => 'server_misconfigured'], 500);
}

$ttl = (int) ($config['checksum_ttl'] ?? 86400);
$result = AwChecksum::create($boardId, $secret, $ttl);

aw_json_response([
    'boardId' => $boardId,
    'checksum' => $result['checksum'],
    'expiresIn' => $result['expiresIn'],
]);
