<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/bootstrap.php';
require_once dirname(__DIR__) . '/lib/db.php';

function h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function fmt_time(int $ms): string
{
    $total = intdiv(max(0, $ms), 1000);
    $h = intdiv($total, 3600);
    $m = intdiv($total % 3600, 60);
    $s = $total % 60;
    return sprintf('%02d:%02d:%02d', $h, $m, $s);
}

$db = aw_db();

$boardId = trim((string) ($_GET['boardId'] ?? ''));
$nick = trim((string) ($_GET['nick'] ?? ''));
$ip = trim((string) ($_GET['ip'] ?? ''));
$clientId = trim((string) ($_GET['clientId'] ?? ''));
$flagged = ($_GET['flagged'] ?? '') === '1' ? 1 : (($_GET['flagged'] ?? '') === '0' ? 0 : null);
$deleted = ($_GET['deleted'] ?? '') === '1' ? 1 : (($_GET['deleted'] ?? '') === '0' ? 0 : null);
$suspiciousOnly = isset($_GET['suspicious']);
$limit = max(1, min(200, (int) ($_GET['limit'] ?? 50)));
$offset = max(0, (int) ($_GET['offset'] ?? 0));

$where = ['1=1'];
$params = [];

if ($boardId !== '') {
    $where[] = 'board_id = ?';
    $params[] = $boardId;
}
if ($nick !== '') {
    $where[] = 'nick LIKE ?';
    $params[] = '%' . $nick . '%';
}
if ($ip !== '') {
    $where[] = 'ip = ?';
    $params[] = $ip;
}
if ($clientId !== '') {
    $where[] = 'client_id = ?';
    $params[] = $clientId;
}
if ($flagged !== null) {
    $where[] = 'flagged = ?';
    $params[] = $flagged;
}
if ($deleted !== null) {
    $where[] = 'deleted = ?';
    $params[] = $deleted;
}
if ($suspiciousOnly) {
    $where[] = 'time_ms > (submitted_at - run_started_at) * 1000 + 5000';
}

$sqlWhere = implode(' AND ', $where);
$countStmt = $db->prepare("SELECT COUNT(*) FROM scores WHERE $sqlWhere");
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();

$sql = "SELECT id, board_id, nick, time_ms, score, version, client_id, ip,
               submitted_at, run_started_at, flagged, deleted,
               (replay IS NOT NULL) AS has_replay
        FROM scores WHERE $sqlWhere
        ORDER BY submitted_at DESC
        LIMIT $limit OFFSET $offset";
$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Scores — Admin</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1rem 2rem; font-size: 14px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.35rem 0.5rem; }
    th { background: #f0f0f0; }
    tr.suspicious { background: #ffe8e8; }
    form.filters { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; margin-bottom: 1rem; }
    .num { text-align: right; }
  </style>
</head>
<body>
  <p><a href="index.php">&larr; Admin</a></p>
  <h1>Scores</h1>
  <form class="filters" method="get">
    <label>Board <input name="boardId" value="<?= h($boardId) ?>"/></label>
    <label>Nick <input name="nick" value="<?= h($nick) ?>"/></label>
    <label>IP <input name="ip" value="<?= h($ip) ?>"/></label>
    <label>Client ID <input name="clientId" value="<?= h($clientId) ?>" size="24"/></label>
    <label>Flagged
      <select name="flagged">
        <option value="">any</option>
        <option value="1" <?= $flagged === 1 ? 'selected' : '' ?>>yes</option>
        <option value="0" <?= $flagged === 0 ? 'selected' : '' ?>>no</option>
      </select>
    </label>
    <label>Deleted
      <select name="deleted">
        <option value="">any</option>
        <option value="1" <?= $deleted === 1 ? 'selected' : '' ?>>yes</option>
        <option value="0" <?= $deleted === 0 ? 'selected' : '' ?>>no</option>
      </select>
    </label>
    <label><input type="checkbox" name="suspicious" <?= $suspiciousOnly ? 'checked' : '' ?>/> Suspicious timing only</label>
    <button type="submit">Filter</button>
  </form>

  <form method="post" action="action.php">
    <p><?= (int) $total ?> matching rows</p>
    <table>
      <thead>
        <tr>
          <th><input type="checkbox" onclick="document.querySelectorAll('.row-check').forEach(c=>c.checked=this.checked)"/></th>
          <th>ID</th>
          <th>Board</th>
          <th>Nick</th>
          <th class="num">Time</th>
          <th class="num">Score</th>
          <th class="num">Wall gap</th>
          <th>IP</th>
          <th>Client</th>
          <th>Submitted</th>
          <th>F</th>
          <th>D</th>
          <th>Replay</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($rows as $row): ?>
          <?php
            $timeMs = (int) $row['time_ms'];
            $wallGapMs = ((int) $row['submitted_at'] - (int) $row['run_started_at']) * 1000;
            $suspicious = $timeMs > $wallGapMs + 5000;
          ?>
          <tr class="<?= $suspicious ? 'suspicious' : '' ?>">
            <td><input class="row-check" type="checkbox" name="ids[]" value="<?= (int) $row['id'] ?>"/></td>
            <td><?= (int) $row['id'] ?></td>
            <td><?= h((string) $row['board_id']) ?></td>
            <td><?= h((string) $row['nick']) ?></td>
            <td class="num"><?= h(fmt_time($timeMs)) ?></td>
            <td class="num"><?= (int) $row['score'] ?></td>
            <td class="num"><?= h(fmt_time($wallGapMs)) ?></td>
            <td><?= h((string) $row['ip']) ?></td>
            <td title="<?= h((string) $row['client_id']) ?>"><?= h(substr((string) $row['client_id'], 0, 8)) ?>…</td>
            <td><?= h(date('Y-m-d H:i', (int) $row['submitted_at'])) ?></td>
            <td><?= (int) $row['flagged'] ?></td>
            <td><?= (int) $row['deleted'] ?></td>
            <td>
              <?php if ((int) $row['has_replay']): ?>
                <a href="action.php?download=<?= (int) $row['id'] ?>">dl</a>
              <?php endif; ?>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <p>
      <button name="action" value="flag" type="submit">Flag selected</button>
      <button name="action" value="unflag" type="submit">Unflag selected</button>
      <button name="action" value="soft_delete" type="submit">Soft-delete selected</button>
      <button name="action" value="restore" type="submit">Restore selected</button>
      <button name="action" value="hard_delete" type="submit" onclick="return confirm('Permanently delete?')">Hard-delete selected</button>
    </p>
    <p>
      <label>By IP <input name="bulk_ip" placeholder="x.x.x.x"/></label>
      <button name="action" value="flag_ip" type="submit">Flag all for IP</button>
      <button name="action" value="soft_delete_ip" type="submit">Soft-delete all for IP</button>
    </p>
    <p>
      <label>By client ID <input name="bulk_client_id" size="36"/></label>
      <button name="action" value="flag_client" type="submit">Flag all for client</button>
      <button name="action" value="soft_delete_client" type="submit">Soft-delete all for client</button>
    </p>
  </form>
</body>
</html>
