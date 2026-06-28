<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/bootstrap.php';
require_once dirname(__DIR__) . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/Leaderboard.php';

aw_apply_cors();

$clientId = trim((string) ($_GET['clientId'] ?? ''));
if ($clientId === '' || strlen($clientId) > 64) {
    aw_json_response(['error' => 'invalid_client_id'], 400);
}

$db = aw_db();
$entries = AwLeaderboard::fetchByClientId($db, $clientId);

aw_json_response([
    'clientId' => $clientId,
    'entries' => array_map(static function (array $row): array {
        $submittedAt = (int) $row['submitted_at'];
        $runStartedAt = (int) $row['run_started_at'];
        $timeMs = (int) $row['time_ms'];
        $wallGapMs = ($submittedAt - $runStartedAt) * 1000;
        return [
            'boardId' => (string) $row['board_id'],
            'nick' => (string) $row['nick'],
            'rank' => (int) $row['rank'],
            'time' => $timeMs,
            'score' => (int) $row['score'],
            'version' => (int) $row['version'],
            'date' => $submittedAt,
            'wallGapMs' => $wallGapMs,
            'suspicious' => $timeMs > $wallGapMs + 5000,
        ];
    }, $entries),
]);
