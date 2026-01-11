# LangLens Viewer

LangLens Viewer is an interactive trace viewer for LangChain and LangGraph. It allows you to visualize and debug the execution of your agents and chains directly within VS Code.

![LangLens Viewer Screenshot](assests/screenshoot.png)

## Features

- **Visual Trace Graph**: Inspect the flow of your LangChain applications.
- **Node Details**: Deep dive into individual chain runs, LLM prompts/responses, and tool execution data.
- **Custom Editor**: Automatically opens `.langlens` files in a rich interactive interface.

## Usage

Simply open any file with the `.langlens` extension to launch the viewer.

You can generate these files using the `LangLensCallbackHandler` in your Python code:

```python
from langlens import LangLensCallbackHandler
handler = LangLensCallbackHandler(filename="trace.langlens")
# Use handler in your LangChain run...
```

## Requirements

No external dependencies are required to view traces.

## Release Notes

### 0.1.0

Initial release of LangLens Viewer for VS Code.
