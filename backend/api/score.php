<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/bootstrap.php';
require_once dirname(__DIR__) . '/lib/db.php';

aw_apply_cors();

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    aw_json_response(['error' => 'invalid_id'], 400);
}

$db = aw_db();
$stmt = $db->prepare(
    'SELECT id, board_id, nick, time_ms, score, version, submitted_at,
            (replay IS NOT NULL) AS has_replay
     FROM scores WHERE id = ? AND deleted = 0 LIMIT 1',
);
$stmt->execute([$id]);
$row = $stmt->fetch();

if (!$row) {
    aw_json_response(['error' => 'not_found'], 404);
}

aw_json_response([
    'id' => (int) $row['id'],
    'boardId' => (string) $row['board_id'],
    'nick' => (string) $row['nick'],
    'time' => (int) $row['time_ms'],
    'score' => (int) $row['score'],
    'version' => (int) $row['version'],
    'date' => (int) $row['submitted_at'],
    'hasReplay' => (bool) $row['has_replay'],
]);
