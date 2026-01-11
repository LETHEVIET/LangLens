# Troubleshooting

## Issue: Webview Shows 404 Errors or Blank Screen

### Problem Description

When opening a `.langlens` file in VS Code, the extension loaded but displayed a blank screen or 404 errors in the Developer Tools console. Network requests showed failed attempts to load resources like `/_app/immutable/...`.

### Root Cause

SvelteKit's default routing and build configuration doesn't work well in VS Code webviews:

1. **Base Path Issues**: SvelteKit calculates base paths from the URL, but webviews use the `vscode-webview://` protocol which doesn't match typical HTTP paths
2. **Static Asset Paths**: The built app references assets with absolute paths like `/_app/...` instead of relative paths like `./_app/...`
3. **Routing Mode**: Default SvelteKit routing tries to use pathname-based navigation, which doesn't work in webview context

### Solution

Configured SvelteKit to use hash-based routing with relative paths:

**1. Modified [svelte.config.js](../web-ui/svelte.config.js) to use hash router:**

```javascript
export default {
  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "200.html",
      precompress: false,
      strict: true,
    }),
    paths: {
      relative: true,
    },
    router: {
      type: "hash", // Use hash-based routing for webview compatibility
    },
  },
};
```

**2. Modified [extension.ts](src/extension.ts) to:**

- Convert absolute paths `/_app/` to relative paths `./_app/`
- Inject proper Content Security Policy
- Override SvelteKit's base path to empty string

```typescript
// In getHtmlForWebview()
html = html.replace(/\/_app\//g, "./_app/");
html = html.replace(/<base href="[^"]*">/g, '<base href="">');
```

### Why Hash Router Works

Hash routing (`#/path`) works better in webviews because:

- The hash fragment is client-side only and doesn't affect resource loading
- SvelteKit doesn't try to calculate relative paths based on the current route
- All navigation happens via JavaScript without triggering page reloads
- Asset paths remain consistent regardless of navigation state

### Debugging Tips

To debug webview issues:

- Open Command Palette (Cmd/Ctrl + Shift + P) → "Developer: Toggle Developer Tools"
- Check Console for JavaScript errors or failed network requests
- Check Network tab to see which resources failed to load
- Look for `404` errors or `net::ERR_FILE_NOT_FOUND`
- Verify asset paths are relative (start with `./_app/`) not absolute (`/_app/`)

---

## Issue: File Loads But Shows "Generated 0 spans"

### Symptoms

When opening a `.langlens` file in VS Code, the extension loaded successfully and received the file content, but the viewer displayed "Generated 0 spans" even though the file contained log events.

### Cause

The `.langlens` file had a JSON structure with a top-level `logs` array:

```json
{
  "logs": [
    { "event": "chain_start", ... },
    { "event": "llm_end", ... }
  ]
}
```

The parser expected either:

1. A direct array of log events: `[{...}, {...}]`
2. Individual log events as objects

When the code detected the top-level object (not an array), it wrapped the entire object in an array: `[{ logs: [...] }]`. This resulted in passing a single object to the parser instead of the array of log events, causing 0 spans to be generated.

### Fix Applied

Modified [+page.svelte](../web-ui/src/routes/+page.svelte) to check if the parsed object has a `logs` property and extract that array before processing:

```typescript
} else if (rawData && typeof rawData === 'object') {
    // Check if it's an object with a 'logs' property
    if (rawData.logs && Array.isArray(rawData.logs)) {
        console.log('Object with logs array detected, extracting logs');
        rawLogs = rawData.logs;
    } else {
        // It's a single object - wrap it in an array
        console.log('Single object detected, wrapping in array');
        rawLogs = [rawData];
    }
}
```

### Supported File Formats

The extension now correctly handles:

1. **JSON array**: `[{...}, {...}]`
2. **JSON object with logs array**: `{ "logs": [{...}, {...}] }`
3. **JSONL** (newline-delimited JSON): One JSON object per line
4. **Single JSON object**: `{...}` (wrapped in array automatically)

### Debugging Data Parsing

Console logs can be viewed in VS Code's Developer Tools:

- Open Command Palette (Cmd/Ctrl + Shift + P)
- Run "Developer: Toggle Developer Tools"
- Check Console tab for parsing messages:
  - "Object with logs array detected" = Correct detection of `{ logs: [...] }` format
  - "Parsed X log events" = Number of events extracted
  - "Generated X spans" = Number of trace spans created
