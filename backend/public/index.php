<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/bootstrap.php';
require_once dirname(__DIR__) . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/Leaderboard.php';

$boardId = trim((string) ($_GET['boardId'] ?? ''));
$distinct = !isset($_GET['distinct']) || $_GET['distinct'] !== '0';
$limit = max(1, min(100, (int) ($_GET['limit'] ?? 25)));
$offset = max(0, (int) ($_GET['offset'] ?? 0));

$db = null;
$boards = [];
$entries = [];
$total = 0;
$error = null;

try {
    $db = aw_db();
    $boards = AwLeaderboard::boardIds($db);
    if ($boardId === '' && count($boards) > 0) {
        $boardId = $boards[0];
    }
    if ($boardId !== '') {
        $entries = AwLeaderboard::fetch($db, $boardId, $distinct, $limit, $offset);
        $total = AwLeaderboard::count($db, $boardId, $distinct);
    }
} catch (Throwable $e) {
    $error = $e->getMessage();
}

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

function board_href(string $boardId, bool $distinct, int $limit): string
{
    $params = ['boardId' => $boardId];
    if (!$distinct) {
        $params['distinct'] = '0';
    }
    if ($limit !== 25) {
        $params['limit'] = (string) $limit;
    }
    return '?' . http_build_query($params);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Antiwar 2 — Leaderboard</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; background: #111; color: #eee; }
    a { color: #8cf; }
    table { border-collapse: collapse; width: 100%; max-width: 960px; margin-top: 1rem; }
    th, td { border: 1px solid #444; padding: 0.45rem 0.6rem; text-align: left; }
    th { background: #222; }
  td.num, th.num { text-align: right; }
    tr.suspicious { background: #3a2222; }
    .error { color: #f88; }
    form { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; margin-bottom: 0.75rem; }
    .boards { margin: 0 0 1.25rem; max-width: 960px; }
    .boards h2 { font-size: 0.95rem; font-weight: 600; margin: 0 0 0.5rem; color: #bbb; }
    .board-list { display: flex; flex-wrap: wrap; gap: 0.35rem 0.5rem; list-style: none; padding: 0; margin: 0; }
    .board-list a {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border: 1px solid #444;
      border-radius: 4px;
      text-decoration: none;
      font-size: 13px;
      background: #1a1a1a;
    }
    .board-list a:hover { border-color: #8cf; background: #222; }
    .board-list a.current {
      border-color: #8cf;
      background: #243;
      color: #fff;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <h1>Leaderboard</h1>
  <?php if ($error): ?>
    <p class="error"><?= h($error) ?></p>
  <?php endif; ?>
  <form method="get">
    <label>Board
      <input name="boardId" list="boards" value="<?= h($boardId) ?>" size="20"/>
      <datalist id="boards">
        <?php foreach ($boards as $b): ?>
          <option value="<?= h($b) ?>"/>
        <?php endforeach; ?>
      </datalist>
    </label>
    <label><input type="checkbox" name="distinct" value="1" <?= $distinct ? 'checked' : '' ?>/> Best per nick</label>
    <button type="submit">Show</button>
  </form>
  <?php if (count($boards) > 0): ?>
    <nav class="boards" aria-label="Boards">
      <h2>Boards</h2>
      <ul class="board-list">
        <?php foreach ($boards as $b): ?>
          <li>
            <?php if ($b === $boardId): ?>
              <a class="current" href="<?= h(board_href($b, $distinct, $limit)) ?>" aria-current="page"><?= h($b) ?></a>
            <?php else: ?>
              <a href="<?= h(board_href($b, $distinct, $limit)) ?>"><?= h($b) ?></a>
            <?php endif; ?>
          </li>
        <?php endforeach; ?>
      </ul>
    </nav>
  <?php endif; ?>
  <?php if ($boardId !== ''): ?>
    <p><?= h($boardId) ?> — <?= (int) $total ?> entries<?= $distinct ? ' (distinct)' : '' ?></p>
    <table>
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Nick</th>
          <th class="num">Time</th>
          <th class="num">Score</th>
          <th class="num">Version</th>
          <th>Submitted</th>
          <th class="num">Wall gap</th>
          <th>Replay</th>
        </tr>
      </thead>
      <tbody>
        <?php if (count($entries) === 0): ?>
          <tr><td colspan="8">No entries.</td></tr>
        <?php else: ?>
          <?php foreach ($entries as $row): ?>
            <?php
              $timeMs = (int) $row['time_ms'];
              $submittedAt = (int) $row['submitted_at'];
              $runStartedAt = (int) $row['run_started_at'];
              $wallGapMs = ($submittedAt - $runStartedAt) * 1000;
              $suspicious = $timeMs > $wallGapMs + 5000;
            ?>
            <tr class="<?= $suspicious ? 'suspicious' : '' ?>">
              <td class="num"><?= (int) $row['rank'] ?></td>
              <td><?= h((string) $row['nick']) ?></td>
              <td class="num"><?= h(fmt_time($timeMs)) ?></td>
              <td class="num"><?= (int) $row['score'] ?></td>
              <td class="num"><?= (int) $row['version'] ?></td>
              <td><?= h(date('Y-m-d H:i:s', $submittedAt)) ?></td>
              <td class="num"><?= h(fmt_time($wallGapMs)) ?></td>
              <td>
                <?php if ((int) ($row['has_replay'] ?? 0)): ?>
                  <?php $watchUrl = aw_game_production_replay_url((int) $row['id']); ?>
                  <?php if ($watchUrl !== ''): ?>
                    <a href="<?= h($watchUrl) ?>" target="_blank" rel="noopener">Watch</a>
                  <?php endif; ?>
                <?php endif; ?>
              </td>
            </tr>
          <?php endforeach; ?>
        <?php endif; ?>
      </tbody>
    </table>
  <?php endif; ?>
</body>
</html>
