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
$stmt = $db->prepare('SELECT replay FROM scores WHERE id = ? AND deleted = 0 LIMIT 1');
$stmt->execute([$id]);
$row = $stmt->fetch();

if (!$row || $row['replay'] === null) {
    aw_json_response(['error' => 'replay_not_found'], 404);
}

header('Content-Type: application/octet-stream');
header('Cache-Control: public, max-age=3600');
echo $row['replay'];
