#!/bin/bash
# Builds dist/quran-resume-<version>.zip: the one file you upload to the Chrome Web Store and
# attach to a GitHub Release. The version comes from manifest.json. The zip has manifest.json at its
# root, which is what the Web Store requires, and leaves out the README, store/ and tools/ folders.
set -e
cd "$(dirname "$0")"

VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")

# the store build must point at the hosted phone server, not this computer
if grep -q "localhost" config.js manifest.json; then
  echo "config.js / manifest.json still point the phone link at localhost. Host phone/ and put its address in both." >&2
  exit 1
fi

# catch a syntax slip before it ships
if command -v node >/dev/null 2>&1; then
  node --check background.js
  node --check config.js
  node --check content.js
  node --check options.js
  node --check popup.js
  node --check surahs.js
  node --check welcome.js
fi

mkdir -p dist
ZIP="dist/quran-resume-$VERSION.zip"
rm -f "$ZIP"
zip -r "$ZIP" manifest.json background.js content.js options.html options.js popup.html popup.css popup.js surahs.js config.js welcome.html welcome.css welcome.js icons vendor -x '*.DS_Store' >/dev/null

echo "Created $ZIP"
if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$ZIP"; else sha256sum "$ZIP"; fi
