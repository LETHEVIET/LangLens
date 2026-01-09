<script lang="ts">
    import { onMount } from "svelte";
    import { LogParser } from "$lib/LogParser";
    import type { Span, LogEvent } from "$lib/types";
    import TreeNode from "$lib/TreeNode.svelte";
    import DataViewer from "$lib/DataViewer.svelte";
    import TraceGraph from "$lib/TraceGraph.svelte";
    import JSONTree from "@sveltejs/svelte-json-tree";

    let spans: Span[] = [];
    let loading = true;
    let error: string | null = null;
    let selectedSpan: Span | null = null;
    let viewMode: "pretty" | "raw" = "pretty";
    let graphMode: "compact" | "flow" = "compact";

    const vscode =
        typeof window !== "undefined" &&
        typeof (window as any).acquireVsCodeApi === "function"
            ? (window as any).acquireVsCodeApi()
            : null;

    $: activeRoot = selectedSpan ? findRoot(selectedSpan.id) : null;

    function findRoot(id: string): Span | undefined {
        return spans.find((r) => r.id === id || hasChild(r, id));
    }

    function hasChild(node: Span, id: string): boolean {
        if (node.id === id) return true;
        return node.children.some((c) => hasChild(c, id));
    }

    function handleSelectSpan(event: CustomEvent<Span>) {
        selectedSpan = event.detail;
    }

    function parseData(rawData: any) {
        // Handle both JSON array and JSONL (legacy)
        let rawLogs: LogEvent[];

        console.log(
            "Parsing data, type:",
            typeof rawData,
            "isArray:",
            Array.isArray(rawData),
        );

        if (Array.isArray(rawData)) {
            // It's a JSON array (workflow_log.json style)
            rawLogs = rawData.map((ev) => {
                const data: any = {};
                if (ev.inputs) data.inputs = ev.inputs;
                if (ev.input) data.input = ev.input;
                if (ev.messages) data.messages = ev.messages; // usually for llm inputs

                if (ev.outputs) data.outputs = ev.outputs;
                if (ev.output) data.output = ev.output;
                if (ev.response) {
                    data.response = ev.response;
                    // LogParser expects generations at top level of data for llm
                    if (ev.response.generations) {
                        data.generations = ev.response.generations;
                    }
                }

                if (ev.error) data.error = ev.error;

                // Try to guess observation type if missing
                let observation_type = ev.observation_type || "unknown";
                if (ev.event) {
                    if (ev.event.includes("llm"))
                        observation_type = "generation";
                    else if (ev.event.includes("tool"))
                        observation_type = "tool";
                    else if (ev.event.includes("chain"))
                        observation_type = "chain";
                }

                return {
                    ...ev,
                    timestamp:
                        typeof ev.timestamp === "string"
                            ? new Date(ev.timestamp).getTime()
                            : ev.timestamp,
                    data: data,
                    observation_type: observation_type,
                } as LogEvent;
            });
        } else if (rawData && typeof rawData === "object") {
            // Check if it's an object with a 'logs' property
            if (rawData.logs && Array.isArray(rawData.logs)) {
                console.log("Object with logs array detected, extracting logs");
                rawLogs = rawData.logs;
            } else {
                // It's a single object - wrap it in an array
                console.log("Single object detected, wrapping in array");
                rawLogs = [rawData];
            }
        } else {
            // Fallback or unexpected format
            console.warn("Unexpected JSON format:", rawData);
            error = "Invalid file format. Expected JSON array or object.";
            loading = false;
            return;
        }

        console.log("Parsed", rawLogs.length, "log events");
        const parser = new LogParser();
        spans = parser.parseLogs(rawLogs);
        console.log("Generated", spans.length, "spans");
    }

    onMount(async () => {
        console.log("Component mounted, vscode API available:", !!vscode);

        if (vscode) {
            console.log("Using VS Code webview mode");
            window.addEventListener("message", (event) => {
                console.log("Received message:", event.data.type);
                const message = event.data;
                switch (message.type) {
                    case "update":
                        const text = message.text;
                        console.log(
                            "Received file content, length:",
                            text.length,
                        );
                        try {
                            // Try parsing as JSON first
                            const data = JSON.parse(text);
                            parseData(data);
                        } catch (e) {
                            // If JSON parse fails, try JSONL (newline-delimited JSON)
                            console.log(
                                "JSON parse failed, trying JSONL format",
                            );
                            try {
                                const lines = text
                                    .trim()
                                    .split("\n")
                                    .filter((line: string) => line.trim());
                                console.log(
                                    "Found",
                                    lines.length,
                                    "lines in JSONL",
                                );
                                const data = lines.map((l: string) =>
                                    JSON.parse(l),
                                );
                                parseData(data);
                            } catch (e2) {
                                console.error("Parse error:", e2);
                                error =
                                    "Failed to parse .langlens file. Ensure it is valid JSON or JSONL.";
                                loading = false;
                            }
                        }
                        loading = false;
                        break;
                }
            });
            console.log("Sending ready message to extension");
            vscode.postMessage({ type: "ready" });
        } else {
            console.log("Using standalone mode, fetching from server");
            try {
                const response = await fetch("/data");
                if (!response.ok) throw new Error("Failed to load data");

                const text = await response.text();
                try {
                    // Try parsing as JSON first
                    const data = JSON.parse(text);
                    parseData(data);
                } catch (e) {
                    // If JSON parse fails, try JSONL
                    try {
                        const lines = text
                            .trim()
                            .split("\n")
                            .filter((line: string) => line.trim());
                        const data = lines.map((l: string) => JSON.parse(l));
                        parseData(data);
                    } catch (e2) {
                        console.error("Parse error:", e2);
                        error =
                            "Failed to parse data. Ensure it is valid JSON or JSONL.";
                    }
                }
            } catch (e) {
                error = (e as Error).message;
            } finally {
                loading = false;
            }
        }
    });
</script>

<div
    class="h-screen text-gray-900 dark:text-gray-100 font-sans flex flex-col"
    style="background-color: var(--vscode-bg); color: var(--vscode-fg);"
>
    <div class="flex flex-1 overflow-hidden">
        <!-- Sidebar -->
        <aside
            class="w-1/3 flex flex-col overflow-hidden"
            style="border-right: 1px solid var(--vscode-border); background-color: var(--vscode-bg);"
        >
            <!-- Tree Container -->
            <div class="flex-1 overflow-y-auto p-4">
                {#if error}
                    <div
                        class="p-4 rounded border"
                        style="background-color: rgba(244, 135, 113, 0.1); color: var(--vscode-error); border-color: var(--vscode-error);"
                    >
                        {error}
                    </div>
                {:else if loading}
                    <div class="space-y-4 animate-pulse">
                        <div
                            class="h-8 rounded w-full"
                            style="background-color: var(--vscode-input-bg);"
                        ></div>
                        <div
                            class="h-8 rounded w-5/6"
                            style="background-color: var(--vscode-input-bg);"
                        ></div>
                        <div
                            class="h-8 rounded w-4/6"
                            style="background-color: var(--vscode-input-bg);"
                        ></div>
                    </div>
                {:else}
                    <div class="space-y-1">
                        {#each spans as span}
                            <TreeNode
                                {span}
                                on:select={handleSelectSpan}
                                selectedId={selectedSpan?.id}
                            />
                        {/each}
                    </div>

                    {#if spans.length === 0}
                        <div
                            class="text-center py-20"
                            style="color: var(--vscode-secondary-fg);"
                        >
                            No traces found in logs.
                        </div>
                    {/if}
                {/if}
            </div>

            <!-- Graph Stick at Bottom -->
            {#if activeRoot}
                <div
                    class="h-1/2 flex flex-col"
                    style="border-top: 1px solid var(--vscode-border); background-color: var(--vscode-panel-bg);"
                >
                    <div
                        class="flex justify-between items-center p-3"
                        style="border-bottom: 1px solid var(--vscode-border); background-color: var(--vscode-bg);"
                    >
                        <h3
                            class="text-[10px] font-bold uppercase tracking-widest"
                            style="color: var(--vscode-secondary-fg);"
                        >
                            Trace Flow
                        </h3>
                        <div
                            class="flex rounded p-0.5 scale-90"
                            style="background-color: var(--vscode-input-bg);"
                        >
                            <button
                                class="px-2 py-0.5 rounded text-[10px]"
                                style={graphMode === "compact"
                                    ? "background-color: var(--vscode-selection-bg); color: var(--vscode-link); font-weight: bold;"
                                    : "color: var(--vscode-secondary-fg);"}
                                on:click={() => (graphMode = "compact")}
                            >
                                Compact
                            </button>
                            <button
                                class="px-2 py-0.5 rounded text-[10px]"
                                style={graphMode === "flow"
                                    ? "background-color: var(--vscode-selection-bg); color: var(--vscode-link); font-weight: bold;"
                                    : "color: var(--vscode-secondary-fg);"}
                                on:click={() => (graphMode = "flow")}
                            >
                                Flow
                            </button>
                        </div>
                    </div>
                    <div class="flex-1 min-h-0 relative">
                        <TraceGraph
                            rootSpan={activeRoot}
                            selectedId={selectedSpan?.id}
                            viewMode={graphMode}
                            on:select={handleSelectSpan}
                        />
                    </div>
                </div>
            {/if}
        </aside>

        <!-- Main Details Area -->
        <main
            class="flex-1 overflow-y-auto"
            style="background-color: var(--vscode-panel-bg);"
        >
            {#if selectedSpan}
                <div
                    class="h-full flex flex-col"
                    style="background-color: var(--vscode-bg); border-color: var(--vscode-border);"
                >
                    <!-- Content -->
                    <div class="flex-1 overflow-y-auto p-4">
                        {#if viewMode === "pretty"}
                            <div class="space-y-6">
                                <div>
                                    <h3
                                        class="text-sm font-bold uppercase tracking-wider mb-2"
                                        style="color: var(--vscode-secondary-fg);"
                                    >
                                        Metadata
                                    </h3>
                                    <div
                                        class="grid grid-cols-2 gap-4 text-sm p-3 rounded border"
                                        style="background-color: var(--vscode-input-bg); border-color: var(--vscode-border);"
                                    >
                                        <div>
                                            <span
                                                style="color: var(--vscode-secondary-fg);"
                                                >Type:</span
                                            >
                                            <span class="font-mono ml-2"
                                                >{selectedSpan.type}</span
                                            >
                                        </div>
                                        <div>
                                            <span
                                                style="color: var(--vscode-secondary-fg);"
                                                >Status:</span
                                            >
                                            <span
                                                class="font-mono ml-2"
                                                style="color: {selectedSpan.status ===
                                                'error'
                                                    ? 'var(--vscode-error)'
                                                    : 'var(--vscode-success)'};"
                                                >{selectedSpan.status}</span
                                            >
                                        </div>
                                        <div>
                                            <span
                                                style="color: var(--vscode-secondary-fg);"
                                                >Duration:</span
                                            >
                                            <span class="font-mono ml-2"
                                                >{selectedSpan.duration
                                                    ? (
                                                          selectedSpan.duration *
                                                          1000
                                                      ).toFixed(2) + "ms"
                                                    : "-"}</span
                                            >
                                        </div>
                                        {#if selectedSpan.errorMessage}
                                            <div
                                                class="col-span-2"
                                                style="color: var(--vscode-error);"
                                            >
                                                <span class="font-bold"
                                                    >Error:</span
                                                >
                                                {selectedSpan.errorMessage}
                                            </div>
                                        {/if}
                                    </div>
                                </div>

                                <div
                                    class="grid grid-cols-1 md:grid-cols-2 gap-4 h-full"
                                >
                                    <div class="flex flex-col h-full">
                                        <h3
                                            class="text-sm font-bold uppercase tracking-wider mb-2 sticky top-0 py-1"
                                            style="background-color: var(--vscode-bg); color: var(--vscode-secondary-fg);"
                                        >
                                            Inputs
                                        </h3>
                                        <div
                                            class="p-3 rounded border font-mono text-xs overflow-auto flex-1 max-h-[500px]"
                                            style="background-color: var(--vscode-input-bg); border-color: var(--vscode-border);"
                                        >
                                            {#if selectedSpan.inputs}
                                                <DataViewer
                                                    value={selectedSpan.inputs}
                                                    expand={true}
                                                />
                                            {:else}
                                                <span
                                                    class="italic"
                                                    style="color: var(--vscode-secondary-fg);"
                                                    >No inputs recorded</span
                                                >
                                            {/if}
                                        </div>
                                    </div>

                                    <div class="flex flex-col h-full">
                                        <h3
                                            class="text-sm font-bold uppercase tracking-wider mb-2 sticky top-0 py-1"
                                            style="background-color: var(--vscode-bg); color: var(--vscode-secondary-fg);"
                                        >
                                            Outputs
                                        </h3>
                                        <div
                                            class="p-3 rounded border font-mono text-xs overflow-auto flex-1 max-h-[500px]"
                                            style="background-color: var(--vscode-input-bg); border-color: var(--vscode-border);"
                                        >
                                            {#if selectedSpan.outputs}
                                                <DataViewer
                                                    value={selectedSpan.outputs}
                                                    expand={true}
                                                />
                                            {:else}
                                                <span
                                                    class="italic"
                                                    style="color: var(--vscode-secondary-fg);"
                                                    >No outputs recorded</span
                                                >
                                            {/if}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div
                                class="p-4 rounded font-mono text-xs overflow-auto h-full border json-tree-container"
                                style="border-color: var(--vscode-border);
                                       background-color: var(--vscode-input-bg);
                                       color: var(--vscode-fg);
                                       --json-tree-label-color: #9cdcfe;
                                       --json-tree-colon-color: var(--vscode-secondary-fg);
                                       --json-tree-string-color: #ce9178;
                                       --json-tree-number-color: #b5cea8;
                                       --json-tree-boolean-color: #569cd6;
                                       --json-tree-null-color: #569cd6;
                                       --json-tree-arrow-color: var(--vscode-secondary-fg);
                                       --json-tree-value-color: var(--vscode-fg);
                                       --json-tree-font-family: 'JetBrains Mono', monospace;"
                            >
                                <JSONTree
                                    value={selectedSpan}
                                    defaultExpandedLevel={1}
                                />
                            </div>
                        {/if}
                    </div>

                    <!-- Footer -->
                    <div
                        class="p-4 flex justify-between items-center sticky top-0 z-10"
                        style="border-top: 1px solid var(--vscode-border); background-color: var(--vscode-bg);"
                    >
                        <div>
                            <h2 class="text-lg font-semibold">
                                {selectedSpan.name}
                            </h2>
                            <div
                                class="text-xs font-mono mt-1"
                                style="color: var(--vscode-secondary-fg);"
                            >
                                {selectedSpan.id}
                            </div>
                        </div>
                        <div
                            class="flex rounded p-1"
                            style="background-color: var(--vscode-input-bg);"
                        >
                            <button
                                class="px-3 py-1 rounded text-sm transition-colors"
                                style={viewMode === "pretty"
                                    ? "background-color: var(--vscode-selection-bg); color: var(--vscode-link); font-weight: 500;"
                                    : "color: var(--vscode-secondary-fg);"}
                                on:click={() => (viewMode = "pretty")}
                            >
                                Pretty
                            </button>
                            <button
                                class="px-3 py-1 rounded text-sm transition-colors"
                                style={viewMode === "raw"
                                    ? "background-color: var(--vscode-selection-bg); color: var(--vscode-link); font-weight: 500;"
                                    : "color: var(--vscode-secondary-fg);"}
                                on:click={() => (viewMode = "raw")}
                            >
                                Raw
                            </button>
                        </div>
                    </div>
                </div>
            {:else}
                <div
                    class="h-full flex items-center justify-center"
                    style="color: var(--vscode-secondary-fg);"
                >
                    <div class="text-center">
                        <p class="text-lg font-medium">No Span Selected</p>
                        <p class="text-sm">
                            Select a node from the tree to view details
                        </p>
                    </div>
                </div>
            {/if}
        </main>
    </div>
</div>

<style>
    :global(body) {
        overflow: hidden; /* Prevent body scroll */
    }

    /* Force JSON Tree colors */
    :global(.json-tree-container ul.json-tree li span.key),
    :global(.json-tree-container ul.json-tree li span.label) {
        color: #9cdcfe !important;
    }
    :global(.json-tree-container ul.json-tree li span.colon) {
        color: var(--vscode-secondary-fg) !important;
    }
</style>
