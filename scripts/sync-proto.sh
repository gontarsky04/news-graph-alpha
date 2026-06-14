#!/usr/bin/env bash
# Copy the canonical proto into each service's build context.
# Run this after editing proto/extractor.proto.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/proto/extractor.proto"

mkdir -p "$ROOT/backend/src/main/proto" "$ROOT/extractor/proto"
cp "$SRC" "$ROOT/backend/src/main/proto/extractor.proto"
cp "$SRC" "$ROOT/extractor/proto/extractor.proto"
echo "synced extractor.proto -> backend/src/main/proto, extractor/proto"
