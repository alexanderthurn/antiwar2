<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/bootstrap.php';
require_once dirname(__DIR__) . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/Checksum.php';
require_once dirname(__DIR__) . '/lib/XorCodec.php';
require_once dirname(__DIR__) . '/lib/Leaderboard.php';
require_once dirname(__DIR__) . '/lib/RateLimit.php';

aw_apply_cors();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    aw_json_response(['error' => 'method_not_allowed'], 405);
}

$config = aw_config();
$limits = $config['rate_limit'] ?? [];
if (!AwRateLimit::check('submit', (int) ($limits['submit'] ?? 60))) {
    aw_json_response(['error' => 'rate_limited'], 429);
}

$payload = trim((string) ($_POST['payload'] ?? ''));
$clientId = trim((string) ($_POST['clientId'] ?? ''));
if ($payload === '' || $clientId === '' || strlen($clientId) > 64) {
    aw_json_response(['error' => 'missing_fields'], 400);
}

$fields = AwXorCodec::decode($payload);
if ($fields === null) {
    aw_json_response(['error' => 'invalid_payload'], 400);
}

$nick = aw_sanitize_nick((string) $fields['nick']);
if ($nick === '') {
    aw_json_response(['error' => 'invalid_nick'], 400);
}

$secret = (string) ($config['hmac_secret'] ?? '');
if ($secret === '' || str_contains($secret, 'CHANGE_ME')) {
    aw_json_response(['error' => 'server_misconfigured'], 500);
}

$ttl = (int) ($config['checksum_ttl'] ?? 86400);
$checksumInfo = AwChecksum::verify((string) $fields['checksum'], $secret, $ttl);
if ($checksumInfo === null) {
    aw_json_response(['error' => 'invalid_checksum'], 403);
}

$boardId = (string) $fields['board_id'];
if ($boardId !== $checksumInfo['boardId']) {
    aw_json_response(['error' => 'board_mismatch'], 403);
}

$replay = null;
if (!empty($_FILES['replay']) && is_uploaded_file($_FILES['replay']['tmp_name'])) {
    $maxBytes = aw_replay_max_bytes();
    $size = (int) ($_FILES['replay']['size'] ?? 0);
    if ($size > $maxBytes) {
        aw_json_response(['error' => 'replay_too_large'], 400);
    }
    $replay = file_get_contents($_FILES['replay']['tmp_name']);
    if ($replay === false) {
        aw_json_response(['error' => 'replay_read_failed'], 400);
    }
}

$timeMs = (int) $fields['time_ms'];
$score = (int) $fields['score'];
$version = (int) $fields['version'];
$submitChecksum = (string) $fields['checksum'];
$runStartedAt = (int) $checksumInfo['startedAt'];
$submittedAt = time();
$ip = aw_client_ip();
$payloadHash = sha1(serialize([
    $boardId,
    $nick,
    $timeMs,
    $score,
    $version,
    $submitChecksum,
]));

$db = aw_db();

$dup = $db->prepare('SELECT id FROM scores WHERE submit_checksum = ? LIMIT 1');
$dup->execute([$submitChecksum]);
if ($dup->fetch()) {
    aw_json_response(['error' => 'checksum_used'], 409);
}

$stmt = $db->prepare(
    'INSERT INTO scores
     (board_id, nick, time_ms, score, version, client_id, ip, submitted_at,
      submit_checksum, run_started_at, flagged, deleted, replay, payload_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)',
);
$stmt->execute([
    $boardId,
    $nick,
    $timeMs,
    $score,
    $version,
    $clientId,
    $ip,
    $submittedAt,
    $submitChecksum,
    $runStartedAt,
    $replay,
    $payloadHash,
]);

$id = (int) $db->lastInsertId();
$rank = AwLeaderboard::rankFor($db, $boardId, $timeMs, $score);
$wallGapMs = ($submittedAt - $runStartedAt) * 1000;

aw_json_response([
    'accepted' => true,
    'id' => $id,
    'rank' => $rank,
    'boardId' => $boardId,
    'wallGapMs' => $wallGapMs,
    'timeMs' => $timeMs,
]);
