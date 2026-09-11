#!/bin/bash
# Run this on a Mac to produce dist/SiteScan Extractor.app
# Requirements: Python 3.11+, pip

set -e

echo "→ Installing dependencies…"
pip install -r requirements.txt
# playwright install is NOT needed — we use system Chrome (channel="chrome")

echo "→ Building .app with PyInstaller…"
pyinstaller \
  --windowed \
  --name "SiteScan Extractor" \
  --hidden-import customtkinter \
  --collect-all customtkinter \
  --onedir \
  main.py

echo ""
echo "✓ Done.  App is at:  dist/SiteScan Extractor.app"
echo "  Drag it to /Applications to install."
