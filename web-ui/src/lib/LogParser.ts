import type { LogEvent, Span, Message } from "./types";

export class LogParser {
  parseLogs(rawLogs: LogEvent[]): Span[] {
    const spanMap: Record<string, Span> = {};
    const roots: Span[] = [];

    // 1. First Pass: Create Spans and collect events
    for (const log of rawLogs) {
      const runId = log.run_id;
      if (!runId) continue;

      if (!spanMap[runId]) {
        spanMap[runId] = {
          id: runId,
          parentId: log.parent_run_id,
          name: "Unknown",
          type: "unknown",
          status: "running",
          timestamp: log.timestamp || 0,
          metadata: {},
          events: [],
          children: [],
        };
      }

      const span = spanMap[runId];
      span.events.push(log);

      // Update Metadata
      if (log.metadata) {
        Object.assign(span.metadata, log.metadata);
      }
      if (log.tags) {
        if (!span.tags) span.tags = [];
        // Merge tags uniquely
        for (const t of log.tags) {
          if (!span.tags.includes(t)) {
            span.tags.push(t);
          }
        }
      }

      const eventName = log.event || "";
      const data = log.data || {};

      // Determine Type & Name
      if (log.observation_type && log.observation_type !== "unknown") {
        span.type = log.observation_type;
      }
      if (log.name && log.name !== "Unknown") {
        span.name = log.name;
      }

      // Heuristics for unknown types
      if (span.type === "unknown") {
        if (eventName.includes("chat_model") || eventName.includes("llm")) {
          span.type = "generation";
        } else if (eventName.includes("tool")) {
          span.type = "tool";
        } else if (eventName.includes("chain")) {
          span.type = "chain";
        }
      }

      // Handle Start Event details
      if (eventName.endsWith("_start")) {
        span.timestamp = log.timestamp || span.timestamp;

        // Extract Inputs
        if (data.inputs) {
          span.inputs = data.inputs;
        } else if (data.messages) {
          span.inputs = { messages: data.messages };
        } else if (data.input) {
          span.inputs = { input: data.input };
        }

        // Name fallback
        if (span.name === "Unknown") {
          const serialized = data.serialized || {};
          if (serialized.name) {
            span.name = serialized.name;
          } else if (span.metadata?.langgraph_node) {
            span.name = span.metadata.langgraph_node;
          }
        }
      }
      // Handle End Event details
      else if (eventName.endsWith("_end")) {
        span.status = "success";
        span.endTime = log.timestamp;

        // Extract Outputs
        if (data.outputs) {
          span.outputs = data.outputs;
        } else if (data.generations) {
          span.outputs = { generations: data.generations };
        } else if (data.output) {
          span.outputs = { output: data.output };
        }
      }
      // Handle Error Event details
      else if (eventName.endsWith("_error")) {
        span.status = "error";
        span.endTime = log.timestamp;
        span.errorMessage = data.error;
        span.outputs = { error: data.error };
      }
    }

    // 2. Second Pass: Calculate Durations and Build Hierarchy
    for (const span of Object.values(spanMap)) {
      if (span.endTime && span.timestamp) {
        span.duration = span.endTime - span.timestamp;
      }

      // Link to parent
      if (span.parentId && spanMap[span.parentId]) {
        spanMap[span.parentId].children.push(span);
      } else {
        roots.push(span);
      }
    }

    // 3. Sort by timestamp recursively
    const sortRecursive = (spans: Span[]) => {
      spans.sort((a, b) => a.timestamp - b.timestamp);
      for (const s of spans) {
        sortRecursive(s.children);
      }
    };

    sortRecursive(roots);

    return roots;
  }

  extractMessages(data: any): Message[] {
    let messages: any[] = [];

    if (Array.isArray(data)) {
      messages = data;
    } else if (typeof data === "object" && data !== null) {
      if (data.messages) {
        const msgs = data.messages;
        if (Array.isArray(msgs)) {
          if (msgs.length > 0 && Array.isArray(msgs[0])) {
            messages = msgs[0];
          } else {
            messages = msgs;
          }
        }
      } else if (data.generations) {
        const gens = data.generations;
        if (Array.isArray(gens) && gens.length > 0) {
          if (Array.isArray(gens[0])) {
            for (const g of gens[0]) {
              if (typeof g === "object" && g !== null) {
                if (g.message) messages.push(g.message);
                else if (g.text)
                  messages.push({ role: "assistant", content: g.text });
              }
            }
          }
        }
      }
    }

    const normalized: Message[] = [];
    for (const msg of messages) {
      if (typeof msg !== "object" || msg === null) continue;

      const role = msg.type || msg.role || "unknown";
      const content = msg.content || msg.text || "";
      const toolCalls = msg.tool_calls || msg.additional_kwargs?.tool_calls;

      normalized.push({
        role,
        content,
        tool_calls: toolCalls,
        raw: msg,
      });
    }

    return normalized;
  }
}
