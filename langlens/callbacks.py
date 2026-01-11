import json
import os
from datetime import datetime
from uuid import UUID
from typing import Any, Dict, List, Optional
from langchain_core.callbacks import BaseCallbackHandler


class LangLensCallbackHandler(BaseCallbackHandler):
    """
    A LangChain callback handler that logs trace events to a .langlens file.
    Supports both standard JSON array and JSONL (JSON Lines) formats.
    """

    def __init__(self, filename: str = "trace.langlens", use_jsonl: bool = True):
        self.filename = filename
        self.use_jsonl = use_jsonl
        self.logs: List[Dict[str, Any]] = []

        # Clear or initialize file if not in JSONL mode
        if not self.use_jsonl:
            self._save_to_file()
        elif os.path.exists(self.filename):
            # Maybe optionally clear it? For now let's append.
            pass

    def _ensure_serializable(self, obj: Any) -> Any:
        """
        Recursively converts complex objects into JSON-serializable primitives.
        """
        if isinstance(obj, (str, int, float, bool, type(None))):
            return obj
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, (list, tuple, set)):
            return [self._ensure_serializable(item) for item in obj]
        if isinstance(obj, dict):
            return {str(k): self._ensure_serializable(v) for k, v in obj.items()}

        # Handle LangChain/Pydantic objects
        if hasattr(obj, "to_json"):
            try:
                return obj.to_json()
            except Exception:
                pass
        if hasattr(obj, "dict"):
            try:
                return self._ensure_serializable(obj.dict())
            except Exception:
                pass

        # Fallback: Convert to string to avoid crashing the logger
        return f"<{type(obj).__name__}: {str(obj)}>"

    def _log_event(self, event_name: str, payload: Dict[str, Any]):
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": event_name,
            **self._ensure_serializable(payload),
        }

        if self.use_jsonl:
            self._append_to_jsonl(entry)
        else:
            self.logs.append(entry)
            self._save_to_file()

    def _save_to_file(self):
        """Save the entire logs array to a JSON file."""
        with open(self.filename, "w", encoding="utf-8") as f:
            json.dump(self.logs, f, indent=2, ensure_ascii=False)

    def _append_to_jsonl(self, entry: Dict[str, Any]):
        """Append a single log entry to a JSONL file."""
        with open(self.filename, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    # --- LangChain Callbacks ---

    def on_chain_start(
        self, serialized: Dict[str, Any], inputs: Dict[str, Any], **kwargs: Any
    ) -> None:
        name = (serialized or {}).get("name") or "UnknownChain"
        self._log_event("chain_start", {"name": name, "inputs": inputs, **kwargs})

    def on_chain_end(self, outputs: Dict[str, Any], **kwargs: Any) -> None:
        self._log_event("chain_end", {"outputs": outputs, **kwargs})

    def on_chat_model_start(
        self, serialized: Dict[str, Any], messages: List[List[Any]], **kwargs: Any
    ) -> None:
        name = (serialized or {}).get("name") or "UnknownModel"
        self._log_event("llm_start", {"model": name, "messages": messages, **kwargs})

    def on_llm_end(self, response: Any, **kwargs: Any) -> None:
        self._log_event("llm_end", {"response": response, **kwargs})

    def on_tool_start(
        self, serialized: Dict[str, Any], input_str: str, **kwargs: Any
    ) -> None:
        name = (serialized or {}).get("name") or "UnknownTool"
        self._log_event("tool_start", {"tool": name, "input": input_str, **kwargs})

    def on_tool_end(self, output: Any, **kwargs: Any) -> None:
        self._log_event("tool_end", {"output": output, **kwargs})
