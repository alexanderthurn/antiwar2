# Antiwar 2 — Online highscores (PHP + MySQL)

Plain PHP backend for leaderboard prepare/submit, public viewer, and admin tools.

## Setup

1. Create MySQL database and user.
2. Run schema:

   ```bash
   mysql -u USER -p DATABASE < schema/001_init.sql
   ```

3. Copy config and set secrets on the server (not in git):

   ```bash
   cp config.example.php config.php
   # edit config.php — DB credentials + hmac_secret
   ```

4. Ensure `cache/` is writable (rate-limit files):

   ```bash
   mkdir -p cache && chmod 755 cache
   ```

5. Point your webserver:
   - `backend/api/` → API endpoints
   - `backend/public/` → public leaderboard page (replay **Watch** links use `game_url_production`)
   - `backend/admin/` → password-protected admin (see below)

## Admin auth

```bash
cd admin
cp .htaccess.example .htaccess
# edit AuthUserFile path in .htaccess
htpasswd -c .htpasswd admin
```

`.htpasswd` and `.htaccess` with real paths should not be committed.

Optional in `config.php`: set `game_url_localhost` and `game_url_production` (no trailing slash) so admin scores show **Watch (Localhost)** and **Watch (Production)** replay links. Legacy `game_url` is used as production if `game_url_production` is unset.

## API

### `GET api/prepare.php?boardId=aw_h_5&clientId=...`

Returns `{ boardId, checksum, expiresIn }`. Checksum is required for submit and is single-use.

### `POST api/submit.php`

Form fields:

- `payload` — hex-encoded XOR blob (includes checksum, board_id, time_ms, nick, score, date, version)
- `clientId` — stable browser id
- `replay` — optional file upload

### `GET api/replay.php?id=123`

Returns raw replay blob (`application/octet-stream`) for a score row that has a replay attached.

### `GET api/score.php?id=123`

Returns score metadata JSON (`id`, `boardId`, `nick`, `time`, `score`, `hasReplay`).

### `GET api/leaderboard.php?boardId=aw_h_5&distinct=1&limit=25`

JSON leaderboard. `distinct=0` shows every attempt.

## Game client

Set in `.env` or build environment:

```
VITE_HIGHSCORE_URL=https://your-host/backend/api
```

If unset, only local highscores are used.

## Security notes

- `hmac_secret` lives only in `config.php` on the server.
- XOR + checksum required for submits; checksum is unique per row.
- Suspicious rows (claimed time ≫ wall gap) are highlighted in admin/public UI but still accepted.
