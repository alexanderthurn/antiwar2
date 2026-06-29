#!/usr/bin/env bash
# Convert PNGs to indexed PNG-8 with pngquant (in-place, skips if larger).
# Requires: pngquant (brew install pngquant)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/public/assets"
QUALITY="${QUALITY:-65-90}"
DRY_RUN="${DRY_RUN:-0}"

if ! command -v pngquant >/dev/null 2>&1; then
  echo "pngquant not found. Install with: brew install pngquant" >&2
  exit 1
fi

total_before=0
total_after=0
converted=0
skipped=0

while IFS= read -r -d '' file; do
  before=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")
  rel="${file#$ROOT/}"

  if [[ "$DRY_RUN" == "1" ]]; then
    tmp=$(mktemp)
    if pngquant --quality="$QUALITY" --speed 1 --force --output "$tmp" "$file" 2>/dev/null; then
      after=$(stat -f%z "$tmp" 2>/dev/null || stat -c%s "$tmp")
      if (( after < before )); then
        pct=$(( (before - after) * 100 / before ))
        printf '%3d%%  %s  %s -> %s\n' "$pct" "$rel" "$(numfmt --to=iec-i --suffix=B "$before" 2>/dev/null || echo "${before}B")" "$(numfmt --to=iec-i --suffix=B "$after" 2>/dev/null || echo "${after}B")"
        total_before=$((total_before + before))
        total_after=$((total_after + after))
        ((converted++)) || true
      else
        ((skipped++)) || true
      fi
    else
      ((skipped++)) || true
    fi
    rm -f "$tmp"
  else
    if pngquant --quality="$QUALITY" --speed 1 --skip-if-larger --ext .png --force "$file" 2>/dev/null; then
      after=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")
      if (( after < before )); then
        pct=$(( (before - after) * 100 / before ))
        printf '%3d%%  %s\n' "$pct" "$rel"
        total_before=$((total_before + before))
        total_after=$((total_after + after))
        ((converted++)) || true
      else
        ((skipped++)) || true
      fi
    else
      ((skipped++)) || true
    fi
  fi
done < <(find "$ASSETS" -name '*.png' -print0)

if (( converted > 0 )); then
  saved=$((total_before - total_after))
  pct=$(( saved * 100 / total_before ))
  echo ""
  echo "Converted $converted file(s), skipped $skipped. Saved ${pct}% ($(numfmt --to=iec-i --suffix=B "$saved" 2>/dev/null || echo "${saved}B"))."
else
  echo "No files converted ($skipped skipped)."
fi
