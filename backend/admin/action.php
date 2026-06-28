<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/bootstrap.php';
require_once dirname(__DIR__) . '/lib/db.php';

$db = aw_db();

if (isset($_GET['download'])) {
    $id = (int) $_GET['download'];
    $stmt = $db->prepare('SELECT id, board_id, nick, replay FROM scores WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row || $row['replay'] === null) {
        http_response_code(404);
        echo 'Not found';
        exit;
    }
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="replay-' . $id . '.bin"');
    echo $row['replay'];
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: scores.php');
    exit;
}

$action = (string) ($_POST['action'] ?? '');
$ids = array_map('intval', (array) ($_POST['ids'] ?? []));
$ids = array_values(array_filter($ids, static fn (int $id): bool => $id > 0));

$redirect = 'scores.php';

switch ($action) {
    case 'flag':
        if ($ids) {
            $in = implode(',', array_fill(0, count($ids), '?'));
            $db->prepare("UPDATE scores SET flagged = 1 WHERE id IN ($in)")->execute($ids);
        }
        break;
    case 'unflag':
        if ($ids) {
            $in = implode(',', array_fill(0, count($ids), '?'));
            $db->prepare("UPDATE scores SET flagged = 0 WHERE id IN ($in)")->execute($ids);
        }
        break;
    case 'soft_delete':
        if ($ids) {
            $in = implode(',', array_fill(0, count($ids), '?'));
            $db->prepare("UPDATE scores SET deleted = 1 WHERE id IN ($in)")->execute($ids);
        }
        break;
    case 'restore':
        if ($ids) {
            $in = implode(',', array_fill(0, count($ids), '?'));
            $db->prepare("UPDATE scores SET deleted = 0 WHERE id IN ($in)")->execute($ids);
        }
        break;
    case 'hard_delete':
        if ($ids) {
            $in = implode(',', array_fill(0, count($ids), '?'));
            $db->prepare("DELETE FROM scores WHERE id IN ($in)")->execute($ids);
        }
        break;
    case 'flag_ip':
        $ip = trim((string) ($_POST['bulk_ip'] ?? ''));
        if ($ip !== '') {
            $db->prepare('UPDATE scores SET flagged = 1 WHERE ip = ?')->execute([$ip]);
        }
        $redirect .= '?ip=' . urlencode($ip);
        break;
    case 'soft_delete_ip':
        $ip = trim((string) ($_POST['bulk_ip'] ?? ''));
        if ($ip !== '') {
            $db->prepare('UPDATE scores SET deleted = 1 WHERE ip = ?')->execute([$ip]);
        }
        $redirect .= '?ip=' . urlencode($ip);
        break;
    case 'flag_client':
        $clientId = trim((string) ($_POST['bulk_client_id'] ?? ''));
        if ($clientId !== '') {
            $db->prepare('UPDATE scores SET flagged = 1 WHERE client_id = ?')->execute([$clientId]);
        }
        $redirect .= '?clientId=' . urlencode($clientId);
        break;
    case 'soft_delete_client':
        $clientId = trim((string) ($_POST['bulk_client_id'] ?? ''));
        if ($clientId !== '') {
            $db->prepare('UPDATE scores SET deleted = 1 WHERE client_id = ?')->execute([$clientId]);
        }
        $redirect .= '?clientId=' . urlencode($clientId);
        break;
}

header('Location: ' . $redirect);
exit;
