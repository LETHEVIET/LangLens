#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Starting LangLens build process...${NC}"

# 1. Build Web UI
echo -e "${BLUE}1. Building Web UI...${NC}"
./build_ui.sh

# 2. Package Python
echo -e "${BLUE}2. Packaging Python...${NC}"
# Ensure the 'build' package is available
if ! python3 -m build --version &> /dev/null; then
    echo -e "${BLUE}Installing 'build' package...${NC}"
    python3 -m pip install --user --upgrade build --break-system-packages || python3 -m pip install --upgrade build
fi
python3 -m build
echo -e "${GREEN}Python package built in dist/${NC}"

# 3. Package VS Code Extension
echo -e "${BLUE}3. Packaging VS Code Extension...${NC}"
cd vscode-extension
pnpm install
# Note: Requires @vscode/vsce to be installed or run via npx
npx @vscode/vsce package -o ../dist/
echo -e "${GREEN}VS Code extension (.vsix) built in dist/${NC}"

echo -e "${GREEN}All packages built successfully! Check the 'dist/' directory.${NC}"
