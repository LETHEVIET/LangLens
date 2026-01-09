<script lang="ts">
    import type { Span } from "$lib/types";
    import { createEventDispatcher } from "svelte";
    import {
        PlayCircle,
        Wrench,
        MessageSquare,
        Link,
        CheckCircle,
        ZoomIn,
        ZoomOut,
        Maximize,
        RefreshCw,
    } from "lucide-svelte";
    import dagre from "dagre";

    export let rootSpan: Span;
    export let selectedId: string | null = null;
    export let viewMode: "compact" | "flow" = "compact";

    const dispatch = createEventDispatcher();

    let containerWidth = 0;
    let containerHeight = 0;
    let graphWidth = 0;
    let graphHeight = 0;

    interface LayoutNode {
        span: Span;
        allSpans?: Span[]; // For compact mode cycling
        x: number;
        y: number;
        width: number;
    }

    let nodes: LayoutNode[] = [];
    let links: {
        source: LayoutNode;
        target: LayoutNode;
        type: "vertical" | "horizontal";
    }[] = [];

    function measureWidth(text: string): number {
        return Math.max(120, text.length * 8 + 50);
    }

    const NODE_HEIGHT = 50;
    const GAP_X = 20;
    const GAP_Y = 40;

    // Dragging state
    let draggedNode: LayoutNode | null = null;
    let initialMouseX = 0;
    let initialMouseY = 0;
    let initialNodeX = 0;
    let initialNodeY = 0;
    let isDragging = false;
    let hasMoved = false;
    let lastRootId: string | null = null;
    let lastViewMode: string | null = null;

    let isBackgroundPanning = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    $: if (rootSpan) {
        if (rootSpan.id !== lastRootId || viewMode !== lastViewMode) {
            lastRootId = rootSpan.id;
            lastViewMode = viewMode;
            applyAutoLayout();
        }
    }

    const PADDING = 60;
    $: displayWidth = graphWidth + PADDING * 2;
    $: displayHeight = graphHeight + PADDING * 2;

    // Zoom/Pan state
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isPanning = false;
    let isManualZoom = false;

    $: if (
        graphWidth &&
        graphHeight &&
        containerWidth &&
        containerHeight &&
        !isManualZoom
    ) {
        fitToScreen();
    }

    function fitToScreen() {
        const scaleX = (containerWidth - 40) / displayWidth;
        const scaleY = (containerHeight - 40) / displayHeight;
        scale = Math.min(1, scaleX, scaleY);
        translateX = (containerWidth - displayWidth * scale) / 2;
        translateY = (containerHeight - displayHeight * scale) / 2;
        isManualZoom = false;
    }

    function handleZoom(delta: number) {
        isManualZoom = true;
        const oldScale = scale;
        scale = Math.min(5, Math.max(0.1, scale + delta));

        // Zoom towards center
        const centerX = containerWidth / 2;
        const centerY = containerHeight / 2;
        translateX = centerX - (centerX - translateX) * (scale / oldScale);
        translateY = centerY - (centerY - translateY) * (scale / oldScale);
    }

    function handleReset() {
        fitToScreen();
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        handleZoom(e.deltaY > 0 ? -0.1 : 0.1);
    }

    function getAllSpans(span: Span, list: Span[] = []): Span[] {
        list.push(span);
        if (span.children) {
            span.children.forEach((c) => getAllSpans(c, list));
        }
        return list;
    }

    function applyAutoLayout() {
        const chains = getAllSpans(rootSpan).filter((s) => s.type === "chain");
        if (chains.length === 0) return;

        const g = new dagre.graphlib.Graph();
        g.setGraph({
            rankdir: viewMode === "flow" ? "TB" : "TB",
            nodesep: 50,
            ranksep: 70,
            marginx: 20,
            marginy: 20,
        });
        g.setDefaultEdgeLabel(() => ({}));

        const logicalNodes = new Map<
            string,
            { id: string; name: string; spans: Span[] }
        >();

        if (viewMode === "compact") {
            // Group by langgraph_node
            logicalNodes.set("Input", {
                id: "logical-Input",
                name: "Input",
                spans: [rootSpan],
            });
            chains.forEach((s) => {
                if (s.id === rootSpan.id) return;
                const name = s.metadata?.langgraph_node || s.name;
                if (!logicalNodes.has(name)) {
                    logicalNodes.set(name, {
                        id: `logical-${name}`,
                        name,
                        spans: [],
                    });
                }
                logicalNodes.get(name)!.spans.push(s);
            });
            logicalNodes.set("Output", {
                id: "logical-Output",
                name: "Output",
                spans: [rootSpan],
            });

            logicalNodes.forEach((ln) => {
                const w = measureWidth(ln.name);
                g.setNode(ln.id, {
                    width: w,
                    height: NODE_HEIGHT,
                    label: ln.name,
                });
            });

            // Transitions
            const actualChildren = chains
                .filter(
                    (s) =>
                        s.id !== rootSpan.id &&
                        s.metadata?.langgraph_step !== undefined,
                )
                .sort(
                    (a, b) =>
                        a.metadata.langgraph_step - b.metadata.langgraph_step,
                );

            if (actualChildren.length > 0) {
                const first =
                    actualChildren[0].metadata.langgraph_node ||
                    actualChildren[0].name;
                g.setEdge("logical-Input", `logical-${first}`);
                for (let i = 0; i < actualChildren.length - 1; i++) {
                    const from =
                        actualChildren[i].metadata.langgraph_node ||
                        actualChildren[i].name;
                    const to =
                        actualChildren[i + 1].metadata.langgraph_node ||
                        actualChildren[i + 1].name;
                    if (from !== to)
                        g.setEdge(`logical-${from}`, `logical-${to}`);
                }
                const last =
                    actualChildren[actualChildren.length - 1].metadata
                        .langgraph_node ||
                    actualChildren[actualChildren.length - 1].name;
                g.setEdge(`logical-${last}`, "logical-Output");
            } else {
                g.setEdge("logical-Input", "logical-Output");
            }
        } else {
            // Flow Mode: Every chain is a node
            g.setNode("marker-input", {
                width: measureWidth("Input"),
                height: NODE_HEIGHT,
                label: "Input",
            });

            const sorted = chains
                .filter((s) => s.id !== rootSpan.id)
                .sort(
                    (a, b) => (getStepIndex(a) || 0) - (getStepIndex(b) || 0),
                );

            sorted.forEach((s) => {
                g.setNode(s.id, {
                    width: measureWidth(s.name),
                    height: NODE_HEIGHT,
                    label: s.name,
                });
            });

            g.setNode("marker-output", {
                width: measureWidth("Output"),
                height: NODE_HEIGHT,
                label: "Output",
            });

            if (sorted.length > 0) {
                g.setEdge("marker-input", sorted[0].id);
                for (let i = 0; i < sorted.length - 1; i++) {
                    g.setEdge(sorted[i].id, sorted[i + 1].id);
                }
                g.setEdge(sorted[sorted.length - 1].id, "marker-output");
            } else {
                g.setEdge("marker-input", "marker-output");
            }
        }

        dagre.layout(g);

        const calculatedNodes: any[] = [];
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        g.nodes().forEach((v) => {
            const layoutData = g.node(v);
            let span: Span;
            let allSpans: Span[] | undefined;

            if (viewMode === "compact") {
                const ln = logicalNodes.get(v.replace("logical-", ""))!;
                const isMarker = ln.name === "Input" || ln.name === "Output";
                const representative =
                    ln.spans.find((s) => s.status === "error") ||
                    ln.spans[ln.spans.length - 1];
                allSpans = ln.spans;
                span = {
                    ...representative,
                    name: ln.name,
                    id: ln.id,
                    type: isMarker ? "marker" : representative.type,
                    metadata: {
                        ...representative.metadata,
                        compact_count:
                            ln.spans.length > 1 ? ln.spans.length : undefined,
                    },
                };
            } else {
                if (v === "marker-input") {
                    span = {
                        ...rootSpan,
                        name: "Input",
                        type: "marker",
                        id: "marker-input",
                    };
                } else if (v === "marker-output") {
                    span = {
                        ...rootSpan,
                        name: "Output",
                        type: "marker",
                        id: "marker-output",
                    };
                } else {
                    span = chains.find((s) => s.id === v)!;
                }
            }

            const x = layoutData.x - layoutData.width / 2;
            const y = layoutData.y - layoutData.height / 2;

            calculatedNodes.push({
                span,
                allSpans,
                x,
                y,
                width: layoutData.width,
            });

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + layoutData.width);
            maxY = Math.max(maxY, y + layoutData.height);
        });

        graphWidth = maxX - minX;
        graphHeight = maxY - minY;

        // Map to nodes normalized to 0,0
        nodes = calculatedNodes.map((n) => ({
            ...n,
            x: n.x - minX,
            y: n.y - minY,
        }));

        const newLinks: {
            source: LayoutNode;
            target: LayoutNode;
            type: "vertical" | "horizontal";
        }[] = [];
        g.edges().forEach((e) => {
            const srcNode = nodes.find((n) => n.span.id === e.v);
            const dstNode = nodes.find((n) => n.span.id === e.w);
            if (srcNode && dstNode) {
                newLinks.push({
                    source: srcNode,
                    target: dstNode,
                    type: viewMode === "flow" ? "horizontal" : "vertical",
                });
            }
        });

        links = newLinks;
        isManualZoom = false; // Trigger re-fit
    }

    function handleMouseDown(e: MouseEvent, node: LayoutNode | null = null) {
        e.stopPropagation();
        if (node) {
            draggedNode = node;
            initialMouseX = e.clientX;
            initialMouseY = e.clientY;
            initialNodeX = node.x;
            initialNodeY = node.y;
            isDragging = true;
            hasMoved = false;
        } else {
            isBackgroundPanning = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            isManualZoom = true;
        }
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    }

    function handleMouseMove(e: MouseEvent) {
        if (isDragging && draggedNode) {
            const dx = e.clientX - initialMouseX;
            const dy = e.clientY - initialMouseY;

            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                hasMoved = true;
            }

            draggedNode.x = initialNodeX + dx;
            draggedNode.y = initialNodeY + dy;
            nodes = nodes;
            links = links;
        } else if (isBackgroundPanning) {
            translateX += e.clientX - lastMouseX;
            translateY += e.clientY - lastMouseY;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    }

    function handleMouseUp() {
        isDragging = false;
        isBackgroundPanning = false;
        draggedNode = null;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
    }

    function handleNodeClick(e: MouseEvent, node: LayoutNode) {
        e.stopPropagation();
        if (hasMoved) return;

        if (
            viewMode === "compact" &&
            node.allSpans &&
            node.allSpans.length > 0
        ) {
            // Cycle through spans
            const currentIndex = node.allSpans.findIndex(
                (s) => s.id === selectedId,
            );
            const nextIndex = (currentIndex + 1) % node.allSpans.length;
            dispatch("select", node.allSpans[nextIndex]);
        } else {
            dispatch("select", node.span);
        }
    }

    function getStepIndex(span: Span): number {
        // Priority 1: metadata.langgraph_step
        if (span.metadata && typeof span.metadata.langgraph_step === "number") {
            return span.metadata.langgraph_step;
        }

        if (!span.tags) return Infinity;
        for (const tag of span.tags) {
            // tag example: graph:step:1
            if (tag.startsWith("graph:step:")) {
                const parts = tag.split(":");
                if (parts.length === 3) {
                    const val = parseInt(parts[2], 10);
                    if (!isNaN(val)) return val;
                }
            }
        }
        // Fallback for seq:step
        for (const tag of span.tags) {
            if (tag.startsWith("seq:step:")) {
                const parts = tag.split(":");
                if (parts.length === 3) {
                    const val = parseInt(parts[2], 10);
                    if (!isNaN(val)) return val;
                }
            }
        }
        return Infinity;
    }

    function getIcon(type: string, name: string = "") {
        const t = type.toLowerCase();
        if (name === "Input") return PlayCircle;
        if (name === "Output") return CheckCircle;
        if (t.includes("tool")) return Wrench;
        if (t.includes("llm") || t.includes("generation")) return MessageSquare;
        if (t.includes("chain")) return Link;
        return PlayCircle;
    }

    function handleKeydown(e: KeyboardEvent, node: LayoutNode) {
        if (e.key === "Enter" || e.key === " ") {
            handleNodeClick(e as any, node);
        }
    }

    function isNodeSelected(node: LayoutNode, selId: string | null): boolean {
        if (!selId) return false;
        if (node.span.id === selId) return true;
        if (node.allSpans) {
            return node.allSpans.some((s) => s.id === selId);
        }
        return false;
    }

    function getLinkPath(link: {
        source: LayoutNode;
        target: LayoutNode;
        type: "vertical" | "horizontal";
    }) {
        const { source, target } = link;

        const c1x = source.x + source.width / 2;
        const c1y = source.y + NODE_HEIGHT / 2;
        const c2x = target.x + target.width / 2;
        const c2y = target.y + NODE_HEIGHT / 2;

        if (source === target) {
            const x1 = source.x + source.width;
            const y1 = source.y + NODE_HEIGHT / 4;
            const x2 = source.x + source.width;
            const y2 = source.y + (3 * NODE_HEIGHT) / 4;
            return `M ${x1} ${y1} C ${x1 + 40} ${y1 - 20}, ${x2 + 40} ${y2 + 20}, ${x2} ${y2}`;
        }

        const dx = c2x - c1x;
        const dy = c2y - c1y;

        const PIVOT_SPACING = 15;

        const getAnchor = (node: LayoutNode, isSource: boolean) => {
            const nx = node.x;
            const ny = node.y;
            const nw = node.width;
            const vX = isSource ? dx : -dx;
            const vY = isSource ? dy : -dy;

            let side: "top" | "bottom" | "left" | "right";
            if (Math.abs(vX) / nw > Math.abs(vY) / NODE_HEIGHT) {
                side = vX > 0 ? "right" : "left";
            } else {
                side = vY > 0 ? "bottom" : "top";
            }

            // Find all links on this specific side, regardless of in/out
            const sideLinks = links.filter((l) => {
                const s1x = l.source.x + l.source.width / 2;
                const s1y = l.source.y + NODE_HEIGHT / 2;
                const s2x = l.target.x + l.target.width / 2;
                const s2y = l.target.y + NODE_HEIGHT / 2;
                const ldx = s2x - s1x;
                const ldy = s2y - s1y;

                if (l.source.span.id === node.span.id) {
                    const lside =
                        Math.abs(ldx) / node.width > Math.abs(ldy) / NODE_HEIGHT
                            ? ldx > 0
                                ? "right"
                                : "left"
                            : ldy > 0
                              ? "bottom"
                              : "top";
                    return lside === side;
                } else if (l.target.span.id === node.span.id) {
                    const lside =
                        Math.abs(-ldx) / node.width >
                        Math.abs(-ldy) / NODE_HEIGHT
                            ? -ldx > 0
                                ? "right"
                                : "left"
                            : -ldy > 0
                              ? "bottom"
                              : "top";
                    return lside === side;
                }
                return false;
            });

            // Sort everything by the "other" node's coordinate to prevent overlaps
            sideLinks.sort((a, b) => {
                const aOther =
                    a.source.span.id === node.span.id ? a.target : a.source;
                const bOther =
                    b.source.span.id === node.span.id ? b.target : b.source;
                return side === "top" || side === "bottom"
                    ? aOther.x - bOther.x
                    : aOther.y - bOther.y;
            });

            const index = sideLinks.indexOf(link);
            const total = sideLinks.length;
            const offset = (index - (total - 1) / 2) * PIVOT_SPACING;

            return {
                x:
                    side === "right"
                        ? nx + nw
                        : side === "left"
                          ? nx
                          : nx + nw / 2 + offset,
                y:
                    side === "bottom"
                        ? ny + NODE_HEIGHT
                        : side === "top"
                          ? ny
                          : ny + NODE_HEIGHT / 2 + offset,
                side,
                index,
            };
        };

        const start = getAnchor(source, true);
        const end = getAnchor(target, false);

        const dist = Math.sqrt(
            Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2),
        );
        const arrowOffset = 2;
        const ex = end.x - ((end.x - start.x) / (dist || 1)) * arrowOffset;
        const ey = end.y - ((end.y - start.y) / (dist || 1)) * arrowOffset;

        const radius = 12;
        const horizontalRouting =
            start.side === "left" || start.side === "right";

        // LANE ROUTING: Offset the mid-segments to prevent overlapping lines
        const LANE_WIDTH = 8;
        const laneOffset =
            ((start.index || 0) + (end.index || 0)) * (LANE_WIDTH / 2);

        if (horizontalRouting) {
            const midX = (start.x + ex) / 2 + laneOffset;
            const dirX = ex > start.x ? 1 : -1;
            const dirY = ey > start.y ? 1 : -1;

            if (Math.abs(ey - start.y) < radius * 2)
                return `M ${start.x} ${start.y} L ${ex} ${ey}`;

            return `M ${start.x} ${start.y} L ${midX - radius * dirX} ${start.y} Q ${midX} ${start.y} ${midX} ${start.y + radius * dirY} L ${midX} ${ey - radius * dirY} Q ${midX} ${ey} ${midX + radius * dirX} ${ey} L ${ex} ${ey}`;
        } else {
            const midY = (start.y + ey) / 2 + laneOffset / 2;
            const dirX = ex > start.x ? 1 : -1;
            const dirY = ey > start.y ? 1 : -1;

            if (Math.abs(ex - start.x) < radius * 2)
                return `M ${start.x} ${start.y} L ${ex} ${ey}`;

            return `M ${start.x} ${start.y} L ${start.x} ${midY - radius * dirY} Q ${start.x} ${midY} ${start.x + radius * dirX} ${midY} L ${ex - radius * dirX} ${midY} Q ${ex} ${midY} ${ex} ${midY + radius * dirY} L ${ex} ${ey}`;
        }
    }
</script>

<div
    bind:clientWidth={containerWidth}
    bind:clientHeight={containerHeight}
    class="absolute inset-0 overflow-hidden"
    style="background-color: var(--vscode-panel-bg);"
    on:wheel|preventDefault={handleWheel}
    on:mousedown={(e) => handleMouseDown(e)}
    role="presentation"
>
    <!-- Toolbar -->
    <div
        class="absolute bottom-4 left-4 z-10 flex items-center space-x-1 p-1 backdrop-blur border rounded-lg shadow-sm"
        style="background-color: var(--vscode-input-bg); border-color: var(--vscode-border);"
    >
        <button
            class="p-1.5 rounded transition-colors"
            style="color: var(--vscode-fg);"
            title="Zoom In"
            on:click={() => handleZoom(0.1)}
        >
            <ZoomIn size={18} />
        </button>
        <button
            class="p-1.5 rounded transition-colors"
            style="color: var(--vscode-fg);"
            title="Zoom Out"
            on:click={() => handleZoom(-0.1)}
        >
            <ZoomOut size={18} />
        </button>
        <div
            class="w-px h-4 mx-1"
            style="background-color: var(--vscode-border);"
        ></div>
        <button
            class="p-1.5 rounded transition-colors"
            style="color: var(--vscode-fg);"
            title="Reset Zoom"
            on:click={handleReset}
        >
            <Maximize size={18} />
        </button>
        <button
            class="p-1.5 rounded transition-colors"
            style="color: var(--vscode-fg);"
            title="Auto Layout"
            on:click={applyAutoLayout}
        >
            <RefreshCw size={18} />
        </button>
    </div>

    {#if graphWidth > 0}
        <svg
            width={containerWidth}
            height={containerHeight}
            class="block touch-none"
            role="presentation"
        >
            <defs>
                <pattern
                    id="dot-grid"
                    x={translateX}
                    y={translateY}
                    width={20 * scale}
                    height={20 * scale}
                    patternUnits="userSpaceOnUse"
                >
                    <circle
                        cx={1 * scale}
                        cy={1 * scale}
                        r={1 * scale}
                        fill="var(--vscode-border)"
                    />
                </pattern>
                <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="10"
                    refY="3.5"
                    orient="auto"
                >
                    <polygon
                        points="0 0, 10 3.5, 0 7"
                        style="fill: var(--vscode-link);"
                    />
                </marker>
            </defs>

            <rect width="100%" height="100%" fill="url(#dot-grid)" />

            <g transform="translate({translateX}, {translateY}) scale({scale})">
                <g transform="translate({PADDING}, {PADDING})">
                    <!-- Links -->
                    {#each links as link}
                        <path
                            d={getLinkPath(link)}
                            fill="none"
                            style="stroke: var(--vscode-link);"
                            stroke-width="1.5"
                            marker-end="url(#arrowhead)"
                        />
                    {/each}

                    <!-- Nodes -->
                    {#each nodes as node}
                        <g
                            role="button"
                            tabindex="0"
                            transform="translate({node.x}, {node.y})"
                            class="cursor-pointer transition-opacity hover:opacity-90 outline-none {isDragging &&
                            draggedNode === node
                                ? 'cursor-grabbing'
                                : 'cursor-grab'}"
                            on:mousedown={(e) => handleMouseDown(e, node)}
                            on:click={(e) => handleNodeClick(e, node)}
                            on:keydown={(e) => handleKeydown(e, node)}
                        >
                            <rect
                                width={node.width}
                                height={NODE_HEIGHT}
                                rx="6"
                                style="fill: var(--vscode-bg); stroke: {isNodeSelected(
                                    node,
                                    selectedId,
                                )
                                    ? 'var(--vscode-selection-bg)'
                                    : 'var(--vscode-border)'}; stroke-width: {isNodeSelected(
                                    node,
                                    selectedId,
                                )
                                    ? '2'
                                    : '1'};"
                            />

                            <foreignObject
                                width={node.width}
                                height={NODE_HEIGHT}
                            >
                                <div
                                    class="w-full h-full flex items-center px-3 space-x-2 overflow-hidden noselect"
                                >
                                    <div
                                        style="color: {node.span.status ===
                                        'error'
                                            ? 'var(--vscode-error)'
                                            : 'var(--vscode-link)'};"
                                    >
                                        <svelte:component
                                            this={getIcon(
                                                node.span.type,
                                                node.span.name,
                                            )}
                                            size={16}
                                        />
                                    </div>
                                    <div
                                        class="flex-1 min-w-0 flex flex-col justify-center"
                                    >
                                        <div class="flex items-center gap-1.5">
                                            <div
                                                class="text-xs font-medium truncate"
                                                style="color: var(--vscode-fg);"
                                            >
                                                {node.span.name}
                                            </div>
                                            {#if node.span.metadata?.compact_count}
                                                <span
                                                    class="px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none border"
                                                    style="background-color: var(--vscode-input-bg); color: var(--vscode-secondary-fg); border-color: var(--vscode-border);"
                                                >
                                                    {node.span.metadata
                                                        .compact_count}
                                                </span>
                                            {/if}
                                        </div>
                                        <div
                                            class="text-[10px] truncate flex justify-between gap-1 text-right"
                                            style="color: var(--vscode-secondary-fg);"
                                        >
                                            <span class="truncate opacity-75"
                                                >{node.span.type}</span
                                            >
                                            <span class="font-mono tabular-nums"
                                                >{node.span.duration
                                                    ? (
                                                          node.span.duration *
                                                          1000
                                                      ).toFixed(0) + "ms"
                                                    : ""}</span
                                            >
                                        </div>
                                    </div>
                                </div>
                            </foreignObject>
                        </g>
                    {/each}
                </g>
            </g>
        </svg>
    {/if}
</div>

<style>
    .noselect {
        user-select: none;
    }
</style>
