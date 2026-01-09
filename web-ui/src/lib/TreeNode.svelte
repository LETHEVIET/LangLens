<script lang="ts">
  import { FileText, ChevronRight, ChevronDown, CheckCircle, XCircle, Clock, PlayCircle, Wrench, MessageSquare, Link } from 'lucide-svelte';
  import { slide } from 'svelte/transition';
  import type { Span } from '$lib/types';
  import { Collapsible } from 'bits-ui';
  import { createEventDispatcher } from 'svelte';

  export let span: Span;
  export let level = 0;
  export let selectedId: string | undefined = undefined;

  const dispatch = createEventDispatcher();

  let isOpen = false;
  // Auto-expand if child is selected or if it's the root
  $: if (selectedId && span.children.some(c => c.id === selectedId || findChild(c, selectedId))) {
      isOpen = true;
  }
  
  function findChild(s: Span, id: string): boolean {
      if (s.id === id) return true;
      return s.children.some(c => findChild(c, id));
  }
  
  function handleClick() {
      dispatch('select', span);
  }

  function handleChildSelect(event: CustomEvent<Span>) {
      dispatch('select', event.detail);
  }

  function formatDuration(ms: number | null | undefined) {
    if (ms === null || ms === undefined) return '';
    return `${(ms * 1000).toFixed(2)}ms`;
  }

  function getIcon(type: string) {
    switch (type) {
        case 'generation': return MessageSquare;
        case 'tool': return Wrench;
        case 'chain': return Link;
        case 'retriever': return FileText;
        default: return PlayCircle;
    }
  }

  $: hasChildren = span.children && span.children.length > 0;
  $: statusColor = span.status === 'error' ? 'text-red-500' : 'text-green-500';
  $: StatusIcon = span.status === 'error' ? XCircle : CheckCircle;
  $: TypeIcon = getIcon(span.type);

</script>

<div class="ml-2">
  <Collapsible.Root bind:open={isOpen}>
    <Collapsible.Trigger class="w-full text-left relative group/row">
      <!-- Hover Guide Line (optional) -->
      <div 
        class="flex items-center gap-1.5 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-sm px-2 cursor-pointer transition-colors {selectedId === span.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}"
        on:click|stopPropagation={handleClick}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && handleClick()}
      >
        
        {#if hasChildren}
            <div 
                class="text-gray-400 hover:text-gray-600 transition-transform duration-200" 
                class:rotate-90={isOpen}
                on:click|stopPropagation={() => isOpen = !isOpen}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && (isOpen = !isOpen)}
            >
                <ChevronRight size={14} />
            </div>
        {:else}
            <div class="w-[14px]"></div>
        {/if}

        <TypeIcon size={14} class="{selectedId === span.id ? 'text-blue-500' : 'text-gray-400 group-hover/row:text-gray-500'}" />
        
        <span class="font-medium text-xs truncate flex-1 block" title={span.name}>{span.name}</span>
        
        <!-- Badges -->
        <span class="text-[10px] font-mono px-1 rounded border border-gray-100 dark:border-gray-800 opacity-60">
            {span.type}
        </span>

        <div class="flex items-center gap-2 text-[10px] text-gray-400 ml-2">
            {#if span.duration}
                <span>{formatDuration(span.duration)}</span>
            {/if}
            <StatusIcon size={12} class={statusColor} />
        </div>
      </div>
    </Collapsible.Trigger>

    <Collapsible.Content>
      <!-- Children Container with Guide Line -->
      <div class="pl-2 ml-[11px] border-l border-gray-200 dark:border-gray-800" transition:slide|local>
         {#if hasChildren}
            <div class="pt-0.5">
                {#each span.children as child}
                    <svelte:self span={child} level={level + 1} on:select={handleChildSelect} {selectedId} />
                {/each}
            </div>
         {/if}
      </div>
    </Collapsible.Content>
  </Collapsible.Root>
</div>
