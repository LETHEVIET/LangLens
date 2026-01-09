import json
from datetime import datetime
from uuid import UUID
from typing import Any, Dict, List
from langchain_core.callbacks import BaseCallbackHandler

class JsonLoggingCallbackHandler(BaseCallbackHandler):
    def __init__(self, filename: str = "workflow_log.json"):
        self.filename = filename
        self.logs: List[Dict[str, Any]] = []

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
            # We wrap the entire payload in our cleaner
            **self._ensure_serializable(payload)
        }
        self.logs.append(entry)
        self._save_to_file()

    def _save_to_file(self):
        with open(self.filename, "w", encoding="utf-8") as f:
            json.dump(self.logs, f, indent=2, ensure_ascii=False)

    # --- UPDATED CALLBACKS WITH SAFE ACCESS ---

    def on_chain_start(self, serialized: Dict[str, Any], inputs: Dict[str, Any], **kwargs: Any) -> None:
        # Use safe get to avoid 'NoneType' errors
        name = (serialized or {}).get("name") or "UnknownChain"
        self._log_event("chain_start", {"name": name, "inputs": inputs, **kwargs})

    def on_chain_end(self, outputs: Dict[str, Any], **kwargs: Any) -> None:
        self._log_event("chain_end", {"outputs": outputs, **kwargs})

    def on_chat_model_start(self, serialized: Dict[str, Any], messages: List[List[Any]], **kwargs: Any) -> None:
        name = (serialized or {}).get("name") or "UnknownModel"
        self._log_event("llm_start", {"model": name, "messages": messages, **kwargs})

    def on_llm_end(self, response: Any, **kwargs: Any) -> None:
        self._log_event("llm_end", {"response": response, **kwargs})

    def on_tool_start(self, serialized: Dict[str, Any], input_str: str, **kwargs: Any) -> None:
        name = (serialized or {}).get("name") or "UnknownTool"
        self._log_event("tool_start", {"tool": name, "input": input_str, **kwargs})

    def on_tool_end(self, output: Any, **kwargs: Any) -> None:
        self._log_event("tool_end", {"output": output, **kwargs})