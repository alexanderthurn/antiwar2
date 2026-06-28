<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/bootstrap.php';
require_once dirname(__DIR__) . '/lib/db.php';

$db = aw_db();

$stats = [
    'total' => (int) $db->query('SELECT COUNT(*) FROM scores')->fetchColumn(),
    'flagged' => (int) $db->query('SELECT COUNT(*) FROM scores WHERE flagged = 1')->fetchColumn(),
    'deleted' => (int) $db->query('SELECT COUNT(*) FROM scores WHERE deleted = 1')->fetchColumn(),
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Highscore Admin</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; }
    a { margin-right: 1rem; }
  </style>
</head>
<body>
  <h1>Highscore Admin</h1>
  <p>
    <strong><?= (int) $stats['total'] ?></strong> scores,
    <strong><?= (int) $stats['flagged'] ?></strong> flagged,
    <strong><?= (int) $stats['deleted'] ?></strong> soft-deleted
  </p>
  <nav>
    <a href="scores.php">Scores</a>
  </nav>
</body>
</html>
