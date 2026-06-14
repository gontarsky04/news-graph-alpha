#!/usr/bin/env bash
# Generate Python gRPC stubs from proto/extractor.proto into
# src/newsgraph/grpcgen/. Run after editing the proto (or rely on the
# Dockerfile, which runs this at build time).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/src/newsgraph/grpcgen"

mkdir -p "$OUT"
touch "$OUT/__init__.py"

python -m grpc_tools.protoc \
  -I "$ROOT/proto" \
  --python_out="$OUT" \
  --grpc_python_out="$OUT" \
  "$ROOT/proto/extractor.proto"

echo "generated stubs -> $OUT"
