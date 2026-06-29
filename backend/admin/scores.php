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

function fmt_bytes(?int $bytes): string
{
    if ($bytes === null || $bytes < 0) {
        return '';
    }
    if ($bytes < 1024) {
        return $bytes . ' B';
    }
    if ($bytes < 1024 * 1024) {
        return round($bytes / 1024, 1) . ' KB';
    }
    return round($bytes / (1024 * 1024), 2) . ' MB';
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
$hasFilters = $boardId !== ''
    || $nick !== ''
    || $ip !== ''
    || $clientId !== ''
    || $flagged !== null
    || $deleted !== null
    || $suspiciousOnly
    || $limit !== 50
    || $offset !== 0;

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
    $where[] = 'client_id LIKE ?';
    $params[] = '%' . $clientId . '%';
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
               (replay IS NOT NULL) AS has_replay,
               IF(replay IS NOT NULL, LENGTH(replay), NULL) AS replay_bytes
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
    tr.suspicious { background: #ffe8e8; cursor: help; }
    form.filters { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; margin-bottom: 1rem; }
    .num { text-align: right; }
    .client-id {
      font-family: ui-monospace, monospace;
      max-width: 9em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: copy;
    }
    .client-id:hover { background: #f8f8ff; }
    .replay-size { color: #555; white-space: nowrap; }
  </style>
  <script>
    function copyClientId(el) {
      const id = el.dataset.clientId;
      if (!id) return;
      navigator.clipboard.writeText(id).then(() => {
        const prev = el.title;
        el.title = 'Copied!';
        setTimeout(() => { el.title = prev; }, 1500);
      });
    }
  </script>
</head>
<body>
  <p><a href="index.php">&larr; Admin</a></p>
  <h1>Scores</h1>
  <form class="filters" method="get">
    <label title="Exact board ID">Board <input name="boardId" value="<?= h($boardId) ?>"/></label>
    <label title="Partial match">Nick <input name="nick" value="<?= h($nick) ?>"/></label>
    <label title="Exact IP address">IP <input name="ip" value="<?= h($ip) ?>"/></label>
    <label title="Partial match on client fingerprint">Client ID <input name="clientId" value="<?= h($clientId) ?>" size="24" placeholder="partial match"/></label>
    <label title="Moderator flag (hidden from public if flagged)">Flagged
      <select name="flagged">
        <option value="">any</option>
        <option value="1" <?= $flagged === 1 ? 'selected' : '' ?>>yes</option>
        <option value="0" <?= $flagged === 0 ? 'selected' : '' ?>>no</option>
      </select>
    </label>
    <label title="Soft-deleted rows are hidden from the public leaderboard">Deleted
      <select name="deleted">
        <option value="">any</option>
        <option value="1" <?= $deleted === 1 ? 'selected' : '' ?>>yes</option>
        <option value="0" <?= $deleted === 0 ? 'selected' : '' ?>>no</option>
      </select>
    </label>
    <label title="Claimed run time is more than 5s longer than wall-clock gap"><input type="checkbox" name="suspicious" <?= $suspiciousOnly ? 'checked' : '' ?>/> Suspicious timing only</label>
    <button type="submit" title="Apply filters">Filter</button>
    <?php if ($hasFilters): ?>
      <a href="scores.php" title="Remove all filters">Clear filters</a>
    <?php endif; ?>
  </form>

  <form method="post" action="action.php">
    <p><?= (int) $total ?> matching rows</p>
    <table>
      <thead>
        <tr>
          <th title="Select all rows"><input type="checkbox" onclick="document.querySelectorAll('.row-check').forEach(c=>c.checked=this.checked)"/></th>
          <th title="Score row ID">ID</th>
          <th title="Campaign / board identifier">Board</th>
          <th title="Player nickname">Nick</th>
          <th class="num" title="Claimed run time (reported by client)">Time</th>
          <th class="num" title="In-game score">Score</th>
          <th class="num" title="Wall-clock time from run start to submit">Wall gap</th>
          <th title="Submitter IP address">IP</th>
          <th title="Client fingerprint — click cell to copy full ID">Client</th>
          <th title="When the score was submitted">Submitted</th>
          <th title="Flagged — moderator mark (1 = yes)">F</th>
          <th title="Soft-deleted — hidden from public leaderboard (1 = yes)">D</th>
          <th title="Replay blob size; WL = watch localhost, WP = watch production, DL = download">Replay</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($rows as $row): ?>
          <?php
            $timeMs = (int) $row['time_ms'];
            $wallGapMs = ((int) $row['submitted_at'] - (int) $row['run_started_at']) * 1000;
            $suspicious = $timeMs > $wallGapMs + 5000;
          ?>
          <tr class="<?= $suspicious ? 'suspicious' : '' ?>"
              <?= $suspicious ? 'title="Suspicious: claimed time exceeds wall gap by more than 5 seconds"' : '' ?>>
            <td><input class="row-check" type="checkbox" name="ids[]" value="<?= (int) $row['id'] ?>"/></td>
            <td><?= (int) $row['id'] ?></td>
            <td><?= h((string) $row['board_id']) ?></td>
            <td><?= h((string) $row['nick']) ?></td>
            <td class="num"><?= h(fmt_time($timeMs)) ?></td>
            <td class="num"><?= (int) $row['score'] ?></td>
            <td class="num"><?= h(fmt_time($wallGapMs)) ?></td>
            <td><?= h((string) $row['ip']) ?></td>
            <td class="client-id"
                data-client-id="<?= h((string) $row['client_id']) ?>"
                title="<?= h((string) $row['client_id']) ?> — click to copy"
                onclick="copyClientId(this)"><?= h((string) $row['client_id']) ?></td>
            <td><?= h(date('Y-m-d H:i', (int) $row['submitted_at'])) ?></td>
            <td title="<?= (int) $row['flagged'] ? 'Flagged' : 'Not flagged' ?>"><?= (int) $row['flagged'] ?></td>
            <td title="<?= (int) $row['deleted'] ? 'Soft-deleted' : 'Active' ?>"><?= (int) $row['deleted'] ?></td>
            <td>
              <?php if ((int) $row['has_replay']): ?>
                <span class="replay-size" title="Replay size"><?= h(fmt_bytes($row['replay_bytes'] !== null ? (int) $row['replay_bytes'] : null)) ?></span>
                <?php foreach (aw_game_replay_watch_links((int) $row['id']) as $watch): ?>
                  · <a href="<?= h($watch['url']) ?>" target="_blank" rel="noopener" title="<?= h($watch['title']) ?>"><?= h($watch['short']) ?></a>
                <?php endforeach; ?>
                · <a href="action.php?download=<?= (int) $row['id'] ?>" title="Download replay">DL</a>
              <?php endif; ?>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <p>
      <button name="action" value="flag" type="submit" title="Mark selected rows as flagged">Flag selected</button>
      <button name="action" value="unflag" type="submit" title="Remove flag from selected rows">Unflag selected</button>
      <button name="action" value="soft_delete" type="submit" title="Hide selected rows from public leaderboard">Soft-delete selected</button>
      <button name="action" value="restore" type="submit" title="Restore soft-deleted selected rows">Restore selected</button>
      <button name="action" value="hard_delete" type="submit" onclick="return confirm('Permanently delete?')" title="Permanently remove selected rows from database">Hard-delete selected</button>
    </p>
    <p>
      <label title="Exact IP — affects all scores from this address">By IP <input name="bulk_ip" placeholder="x.x.x.x"/></label>
      <button name="action" value="flag_ip" type="submit" title="Flag every score with this IP">Flag all for IP</button>
      <button name="action" value="soft_delete_ip" type="submit" title="Soft-delete every score with this IP">Soft-delete all for IP</button>
    </p>
    <p>
      <label title="Exact client ID — affects all scores from this client">By client ID <input name="bulk_client_id" size="36"/></label>
      <button name="action" value="flag_client" type="submit" title="Flag every score with this client ID">Flag all for client</button>
      <button name="action" value="soft_delete_client" type="submit" title="Soft-delete every score with this client ID">Soft-delete all for client</button>
    </p>
  </form>
</body>
</html>
