#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
cat .mt5_bundle/part_*.b64 | base64 -d > mt5_payload.zip
unzip -o mt5_payload.zip -d .
rm -f mt5_payload.zip
echo 'MT5 integration installed into this Deltalytix checkout.'
echo 'Next: open MT5_DEPLOY.md and configure services/mt5-bridge/.env on the Windows MT5 host.'
