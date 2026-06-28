<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';

final class AwLeaderboard
{
    public static function rankFor(PDO $db, string $boardId, int $timeMs, int $score): int
    {
        $stmt = $db->prepare(
            'SELECT COUNT(*) + 1 AS rank FROM scores
             WHERE board_id = ? AND deleted = 0 AND flagged = 0
               AND (time_ms < ? OR (time_ms = ? AND score > ?))',
        );
        $stmt->execute([$boardId, $timeMs, $timeMs, $score]);
        return (int) $stmt->fetchColumn();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function fetch(
        PDO $db,
        string $boardId,
        bool $distinct,
        int $limit,
        int $offset,
    ): array {
        if ($distinct) {
            $sql = 'SELECT s.id, s.nick, s.time_ms, s.score, s.version, s.submitted_at, s.run_started_at,
                           (s.replay IS NOT NULL) AS has_replay
                FROM scores s
                WHERE s.board_id = ? AND s.deleted = 0 AND s.flagged = 0
                  AND NOT EXISTS (
                    SELECT 1 FROM scores s2
                    WHERE s2.board_id = s.board_id AND s2.nick = s.nick
                      AND s2.deleted = 0 AND s2.flagged = 0
                      AND (s2.time_ms < s.time_ms OR (s2.time_ms = s.time_ms AND s2.score > s.score))
                  )
                ORDER BY s.time_ms ASC, s.score DESC
                LIMIT ? OFFSET ?';
        } else {
            $sql = 'SELECT id, nick, time_ms, score, version, submitted_at, run_started_at,
                           (replay IS NOT NULL) AS has_replay
                FROM scores
                WHERE board_id = ? AND deleted = 0 AND flagged = 0
                ORDER BY time_ms ASC, score DESC
                LIMIT ? OFFSET ?';
        }
        $stmt = $db->prepare($sql);
        $stmt->bindValue(1, $boardId);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->bindValue(3, $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();
        $rank = $offset + 1;
        $out = [];
        foreach ($rows as $row) {
            $row['rank'] = $rank++;
            $out[] = $row;
        }
        return $out;
    }

    /**
     * @return list<string>
     */
    public static function boardIds(PDO $db): array
    {
        $stmt = $db->query(
            'SELECT DISTINCT board_id FROM scores WHERE deleted = 0 ORDER BY board_id ASC',
        );
        return array_column($stmt->fetchAll(), 'board_id');
    }

    public static function count(PDO $db, string $boardId, bool $distinct): int
    {
        if ($distinct) {
            $sql = 'SELECT COUNT(*) FROM (
                SELECT s.nick FROM scores s
                WHERE s.board_id = ? AND s.deleted = 0 AND s.flagged = 0
                  AND NOT EXISTS (
                    SELECT 1 FROM scores s2
                    WHERE s2.board_id = s.board_id AND s2.nick = s.nick
                      AND s2.deleted = 0 AND s2.flagged = 0
                      AND (s2.time_ms < s.time_ms OR (s2.time_ms = s.time_ms AND s2.score > s.score))
                  )
                GROUP BY s.nick
            ) t';
        } else {
            $sql = 'SELECT COUNT(*) FROM scores WHERE board_id = ? AND deleted = 0 AND flagged = 0';
        }
        $stmt = $db->prepare($sql);
        $stmt->execute([$boardId]);
        return (int) $stmt->fetchColumn();
    }

    /**
     * Best non-deleted score per board for a player nick.
     *
     * @return list<array<string, mixed>>
     */
    public static function fetchByNick(PDO $db, string $nick): array
    {
        $stmt = $db->prepare(
            'SELECT id, board_id, nick, time_ms, score, version, submitted_at, run_started_at,
                    (replay IS NOT NULL) AS has_replay
             FROM scores
             WHERE nick = ? AND deleted = 0 AND flagged = 0
             ORDER BY board_id ASC, time_ms ASC, score DESC',
        );
        $stmt->execute([$nick]);
        $rows = $stmt->fetchAll();

        $bestByBoard = [];
        foreach ($rows as $row) {
            $boardId = (string) $row['board_id'];
            if (!isset($bestByBoard[$boardId])) {
                $bestByBoard[$boardId] = $row;
            }
        }

        $out = [];
        foreach ($bestByBoard as $row) {
            $boardId = (string) $row['board_id'];
            $timeMs = (int) $row['time_ms'];
            $score = (int) $row['score'];
            $row['rank'] = self::rankFor($db, $boardId, $timeMs, $score);
            $out[] = $row;
        }

        usort($out, static fn (array $a, array $b): int => strcmp((string) $a['board_id'], (string) $b['board_id']));
        return $out;
    }
}
