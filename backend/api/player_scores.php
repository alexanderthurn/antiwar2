<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/bootstrap.php';
require_once dirname(__DIR__) . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/Leaderboard.php';

aw_apply_cors();

$nick = aw_sanitize_nick((string) ($_GET['nick'] ?? ''));
if ($nick === '') {
    aw_json_response(['error' => 'invalid_nick'], 400);
}

$db = aw_db();
$entries = AwLeaderboard::fetchByNick($db, $nick);

aw_json_response([
    'nick' => $nick,
    'entries' => array_map(static function (array $row): array {
        $submittedAt = (int) $row['submitted_at'];
        $runStartedAt = (int) $row['run_started_at'];
        $timeMs = (int) $row['time_ms'];
        $wallGapMs = ($submittedAt - $runStartedAt) * 1000;
        return [
            'id' => (int) ($row['id'] ?? 0),
            'boardId' => (string) $row['board_id'],
            'nick' => (string) $row['nick'],
            'rank' => (int) $row['rank'],
            'time' => $timeMs,
            'score' => (int) $row['score'],
            'version' => (int) $row['version'],
            'date' => $submittedAt,
            'hasReplay' => (bool) ($row['has_replay'] ?? false),
            'wallGapMs' => $wallGapMs,
            'suspicious' => $timeMs > $wallGapMs + 5000,
        ];
    }, $entries),
]);
