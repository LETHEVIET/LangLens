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

    $: activeRoot = selectedSpan ? findRoot(selectedSpan.id) : null;

    function findRoot(id: string): Span | undefined {
        return spans.find(r => r.id === id || hasChild(r, id));
    }

    function hasChild(node: Span, id: string): boolean {
        if (node.id === id) return true;
        return node.children.some(c => hasChild(c, id));
    }

    function handleSelectSpan(event: CustomEvent<Span>) {
        selectedSpan = event.detail;
    }

    onMount(async () => {
        try {
            const response = await fetch("/workflow_log.json");
            if (!response.ok) throw new Error("Failed to load logs");

            const rawData = await response.json();
            
            // Handle both JSON array and JSONL (legacy)
            let rawLogs: LogEvent[];
            
            if (Array.isArray(rawData)) {
                // It's a JSON array (workflow_log.json style)
                rawLogs = rawData.map(ev => {
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
                        if (ev.event.includes("llm")) observation_type = "generation";
                        else if (ev.event.includes("tool")) observation_type = "tool";
                        else if (ev.event.includes("chain")) observation_type = "chain";
                    }

                    return {
                        ...ev,
                        timestamp: new Date(ev.timestamp).getTime(), // Convert ISO string to number
                        data: data,
                        observation_type: observation_type
                    } as LogEvent;
                });
            } else {
                 // Fallback or unexpected format
                 console.warn("Unexpected JSON format, expected array");
                 rawLogs = [];
            }

            const parser = new LogParser();
            spans = parser.parseLogs(rawLogs);
        } catch (e) {
            error = (e as Error).message;
        } finally {
            loading = false;
        }
    });
</script>

<div
    class="h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans flex flex-col"
>

    <div class="flex flex-1 overflow-hidden">
        <!-- Sidebar -->
        <aside class="w-1/3 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col overflow-hidden">
            <!-- Tree Container -->
            <div class="flex-1 overflow-y-auto p-4">
                {#if error}
                    <div class="p-4 bg-red-50 text-red-600 rounded border border-red-200">
                        {error}
                    </div>
                {:else if loading}
                    <div class="space-y-4 animate-pulse">
                        <div class="h-8 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
                        <div class="h-8 bg-gray-200 dark:bg-gray-800 rounded w-5/6"></div>
                        <div class="h-8 bg-gray-200 dark:bg-gray-800 rounded w-4/6"></div>
                    </div>
                {:else}
                    <div class="space-y-1">
                        {#each spans as span}
                            <TreeNode {span} on:select={handleSelectSpan} selectedId={selectedSpan?.id} />
                        {/each}
                    </div>

                    {#if spans.length === 0}
                        <div class="text-center py-20 text-gray-400">
                            No traces found in logs.
                        </div>
                    {/if}
                {/if}
            </div>

            <!-- Graph Stick at Bottom -->
            {#if activeRoot}
                <div class="h-1/2 border-t border-gray-200 dark:border-gray-800 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col">
                    <div class="flex justify-between items-center p-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
                        <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Trace Flow</h3>
                        <div class="flex bg-gray-100 dark:bg-gray-900 rounded p-0.5 scale-90">
                            <button 
                                class="px-2 py-0.5 rounded text-[10px] {graphMode === 'compact' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}"
                                on:click={() => graphMode = 'compact'}
                            >
                                Compact
                            </button>
                            <button 
                                class="px-2 py-0.5 rounded text-[10px] {graphMode === 'flow' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}"
                                on:click={() => graphMode = 'flow'}
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
        <main class="flex-1 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            {#if selectedSpan}
                <div class="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-full flex flex-col">
                    <!-- Content -->
                    <div class="flex-1 overflow-y-auto p-4">
                        {#if viewMode === 'pretty'}
                            <div class="space-y-6">
                                <div>
                                    <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Metadata</h3>
                                    <div class="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-100 dark:border-gray-700">
                                        <div>
                                            <span class="text-gray-500">Type:</span>
                                            <span class="font-mono ml-2">{selectedSpan.type}</span>
                                        </div>
                                        <div>
                                            <span class="text-gray-500">Status:</span>
                                            <span class="font-mono ml-2 {selectedSpan.status === 'error' ? 'text-red-600' : 'text-green-600'}">{selectedSpan.status}</span>
                                        </div>
                                        <div>
                                            <span class="text-gray-500">Duration:</span>
                                            <span class="font-mono ml-2">{selectedSpan.duration ? (selectedSpan.duration * 1000).toFixed(2) + 'ms' : '-'}</span>
                                        </div>
                                        {#if selectedSpan.errorMessage}
                                            <div class="col-span-2 text-red-600">
                                                <span class="font-bold">Error:</span> {selectedSpan.errorMessage}
                                            </div>
                                        {/if}
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                                    <div class="flex flex-col h-full">
                                        <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 sticky top-0 bg-white dark:bg-gray-800 py-1">Inputs</h3>
                                        <div class="bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-100 dark:border-gray-700 font-mono text-xs overflow-auto flex-1 max-h-[500px]">
                                            {#if selectedSpan.inputs}
                                                <DataViewer value={selectedSpan.inputs} expand={true} />
                                            {:else}
                                                <span class="text-gray-400 italic">No inputs recorded</span>
                                            {/if}
                                        </div>
                                    </div>

                                    <div class="flex flex-col h-full">
                                        <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 sticky top-0 bg-white dark:bg-gray-800 py-1">Outputs</h3>
                                        <div class="bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-100 dark:border-gray-700 font-mono text-xs overflow-auto flex-1 max-h-[500px]">
                                            {#if selectedSpan.outputs}
                                                <DataViewer value={selectedSpan.outputs} expand={true} />
                                            {:else}
                                                <span class="text-gray-400 italic">No outputs recorded</span>
                                            {/if}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div class="p-4 rounded font-mono text-xs overflow-auto h-full border border-gray-800">
                                <JSONTree value={selectedSpan} defaultExpandedLevel={1} />
                            </div>
                        {/if}
                    </div>

                    <!-- Footer -->
                    <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 rounded-t-lg sticky top-0 z-10">
                        <div>
                            <h2 class="text-lg font-semibold">{selectedSpan.name}</h2>
                            <div class="text-xs text-gray-500 font-mono mt-1">{selectedSpan.id}</div>
                        </div>
                        <div class="flex bg-gray-100 dark:bg-gray-900 rounded p-1">
                            <button 
                                class="px-3 py-1 rounded text-sm transition-colors {viewMode === 'pretty' ? 'bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}"
                                on:click={() => viewMode = 'pretty'}
                            >
                                Pretty
                            </button>
                            <button 
                                class="px-3 py-1 rounded text-sm transition-colors {viewMode === 'raw' ? 'bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}"
                                on:click={() => viewMode = 'raw'}
                            >
                                Raw
                            </button>
                        </div>
                    </div>
                </div>
            {:else}
                <div class="h-full flex items-center justify-center text-gray-400">
                    <div class="text-center">
                        <p class="text-lg font-medium">No Span Selected</p>
                        <p class="text-sm">Select a node from the tree to view details</p>
                    </div>
                </div>
            {/if}
        </main>
    </div>
</div>

<style>
    :global(body) {
        background-color: #f9fafb; /* Light mode bg */
        overflow: hidden; /* Prevent body scroll */
    }
    @media (prefers-color-scheme: dark) {
        :global(body) {
            background-color: #030712; /* Dark mode bg */
        }
    }
</style>
