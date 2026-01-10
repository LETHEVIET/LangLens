<p align="center">
  <img src="web-ui/static/logo.svg" alt="LangLens Logo" width="600">
</p>

# LangLens

**Node-Level Observability for LangChain and LangGraph.**

LangLens is a lightweight visual tracer and debugger designed specifically for LLM-powered applications. It captures detailed execution logs from your agents and chains, allowing you to inspect every LLM call, tool execution, and state transition with precision.

---

## ✨ Features

- 🔍 **Interactive Trace Viewer**: Explore complex workflows through a rich graphical interface.
- 🧩 **Node-Level Granularity**: Deep dive into individual chain runs, LLM inputs/outputs, and tool executions.
- 💻 **VS Code Extension**: Debug your traces directly inside VS Code with a custom editor experience.
- 🚀 **CLI Tool**: Quickly host a local viewer for any `.langlens` file.
- 🔌 **Seamless Integration**: Add observability to your existing projects with a single line of code.

## 📦 Installation

Since LangLens is currently in development and not yet published to PyPI or the VS Code Marketplace, you can install it from source.

### 1. Build the Web UI

The Python viewer and VS Code extension both require the bundled Web UI.

```bash
# Build the UI and copy assets to the Python/VS Code directories
./build_ui.sh
```

### 2. Python Package

Install the package in editable mode from the root directory:

```bash
pip install -e .
```

### 3. VS Code Extension

To use the extension locally:

1. Open the `/vscode-extension` folder in VS Code.
2. Run `pnpm install`.
3. Press `F5` to start a new Extension Development Host window with the extension loaded.
4. (Alternatively) Package it into a `.vsix` file:

   ```bash
   npx vsce package
   code --install-extension langlens-viewer-0.1.0.vsix
   ```

## 🚀 Quick Start

### 1. Integrate the Callback

Add the `LangLensCallbackHandler` to your LangChain or LangGraph execution config.

```python
from langlens import LangLensCallbackHandler
from langchain_openai import ChatOpenAI

# Initialize the handler (creates a logs.langlens file)
handler = LangLensCallbackHandler(filename="logs.langlens")

# Attach it to your run
llm = ChatOpenAI()
config = {"callbacks": [handler]}
response = llm.invoke("How does a sunrise look from Mars?", config=config)
```

### 2. Visualize the Trace

#### Option A: Using the CLI

Run the following command to start a local server and open the viewer in your browser:

```bash
langlens visualize logs.langlens
```

#### Option B: Using VS Code

Simply open any `.langlens` file. The **LangLens Viewer** will automatically render the interactive trace.

## 🛠️ Development

### Building the Web UI

The UI is built with Svelte and Tailwind CSS.

```bash
cd web-ui
pnpm install
pnpm build
```

### Building the VS Code Extension

```bash
cd vscode-extension
pnpm install
pnpm run package
```

---

## 📄 License

This project is licensed under the MIT License.
