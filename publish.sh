#!/bin/bash
# Builds the zip with release.sh, then creates a GitHub release for it and attaches the zip.
# Needs the GitHub CLI (gh), signed in: gh auth login
# Usage: ./publish.sh            (uses release-notes/v<version>.md if it exists, else generated notes)
#        ./publish.sh notes.md   (uses your own notes file)
set -e
cd "$(dirname "$0")"

command -v gh >/dev/null 2>&1 || { echo "Install the GitHub CLI (https://cli.github.com) and run: gh auth login"; exit 1; }

./release.sh

VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
TAG="v$VERSION"
ZIP="dist/quran-resume-$VERSION.zip"
NOTES="${1:-release-notes/$TAG.md}"

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG already exists. Bump \"version\" in manifest.json first (or delete the release)."
  exit 1
fi

if [ -f "$NOTES" ]; then
  gh release create "$TAG" "$ZIP" --title "Quran Resume $VERSION" --notes-file "$NOTES"
else
  gh release create "$TAG" "$ZIP" --title "Quran Resume $VERSION" --generate-notes
fi

echo "Published $TAG"
