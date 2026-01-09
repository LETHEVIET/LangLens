#!/bin/bash
set -e

echo "Building Web UI..."
cd web-ui
pnpm install
pnpm build
cd ..

echo "Copying to VS Code Extension..."
rm -rf vscode-extension/media/*
cp -r web-ui/build/* vscode-extension/media/

echo "Copying to Python Viewer..."
rm -rf langlens/viewer/static/*
cp -r web-ui/build/* langlens/viewer/static/

echo "Done!"
