<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/bootstrap.php';
require_once dirname(__DIR__) . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/Leaderboard.php';

aw_apply_cors();

$boardId = trim((string) ($_GET['boardId'] ?? ''));
if ($boardId === '') {
    aw_json_response(['error' => 'invalid_board_id'], 400);
}

$distinct = !isset($_GET['distinct']) || $_GET['distinct'] !== '0';
$limit = max(1, min(100, (int) ($_GET['limit'] ?? 25)));
$offset = max(0, (int) ($_GET['offset'] ?? 0));

$db = aw_db();
$entries = AwLeaderboard::fetch($db, $boardId, $distinct, $limit, $offset);
$total = AwLeaderboard::count($db, $boardId, $distinct);

aw_json_response([
    'boardId' => $boardId,
    'distinct' => $distinct,
    'total' => $total,
    'limit' => $limit,
    'offset' => $offset,
    'entries' => array_map(static function (array $row): array {
        $submittedAt = (int) $row['submitted_at'];
        $runStartedAt = (int) $row['run_started_at'];
        $timeMs = (int) $row['time_ms'];
        $wallGapMs = ($submittedAt - $runStartedAt) * 1000;
        return [
            'id' => (int) $row['id'],
            'rank' => (int) $row['rank'],
            'nick' => (string) $row['nick'],
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
