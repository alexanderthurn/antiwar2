# Deploy workflow

Single workflow: **Build & Deploy (GitHub Pages + Feuerware)** (`deploy.yml`).

## Quick reference

| How | GitHub Pages | Feuerware folder |
|-----|--------------|------------------|
| Push to `main` | Yes | `/main/` |
| Push to any other branch | No | `/<branch>/` (e.g. `/dev/`) |
| Manual → **production** | Yes | `/production/` |
| Manual → **branch-preview** | No | `/<branch>/` (branch you run from) |
| Delete branch (not `main`) | — | Removes `/<branch>/` on FTP |

## Deploy to production (live)

1. Open **Actions** → **Build & Deploy (GitHub Pages + Feuerware)**
2. Click **Run workflow**
3. Choose branch (usually `main`)
4. Set **Target** to **production**
5. Click **Run workflow**

This publishes to GitHub Pages and uploads to Feuerware `/production/`.

## Branch previews on Feuerware

Push the branch — no manual step. The site is mirrored to `/<branch>/` on the FTP server.

Example: push `dev` → available under `/dev/` on Feuerware.

## GitHub Pages only from `main` (automatic)

Every push to `main` also updates GitHub Pages, in addition to the Feuerware `/main/` preview folder.

For the live Feuerware site, use the manual **production** target instead.

## Concurrency

Runs are grouped per branch (`deploy-<ref>`). A newer push on the same branch cancels an in-progress deploy on that branch. Different branches do not block each other.

## Required secrets

Configure under **Settings → Secrets and variables → Actions**:

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
