#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
BASE="$ROOT/docs/design/v0.3-stitch"
OUT="${1:-/tmp/nutrisnap-stitch-v0.3}"
mkdir -p "$OUT"
ARCHIVE="$OUT/stitch-v0.3-optimized.zip"
cat "$BASE"/archive/stitch-v0.3-optimized.zip.part0{0,1,2,3,4} > "$ARCHIVE"
printf '%s  %s\n' 'b4615a2d3819654791a730fd5a9452f6549e8a357218b917eee72de668d1c204' "$ARCHIVE" | sha256sum --check --status
unzip -qo "$ARCHIVE" -d "$OUT"
echo "Verified and extracted NutriSnap V0.3 Stitch designs to $OUT"
echo "Open: $OUT/index.html"