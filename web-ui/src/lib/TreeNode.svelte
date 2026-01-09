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

<div class="border-l border-gray-200 dark:border-gray-700 ml-4 pl-2">
  <Collapsible.Root bind:open={isOpen}>
    <Collapsible.Trigger class="w-full text-left">
      <div 
        class="flex items-center gap-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 cursor-pointer group {selectedId === span.id ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500/20' : ''}"
        on:click|stopPropagation={handleClick}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && handleClick()}
      >
        
        {#if hasChildren}
            <div 
                class="text-gray-400 group-hover:text-gray-600 transition-transform duration-200" 
                class:rotate-90={isOpen}
                on:click|stopPropagation={() => isOpen = !isOpen}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && (isOpen = !isOpen)}
            >
                <ChevronRight size={16} />
            </div>
        {:else}
            <div class="w-4"></div>
        {/if}

        <TypeIcon size={16} class="text-blue-500" />
        
        <span class="font-medium text-sm text-gray-900 dark:text-gray-100">{span.name}</span>
        
        <span class="text-xs text-gray-500 font-mono bg-gray-100 dark:bg-gray-900 px-1 rounded">{span.type}</span>

        <div class="flex-grow"></div>

        <div class="flex items-center gap-4 text-xs text-gray-500">
            {#if span.duration}
                <div class="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{formatDuration(span.duration)}</span>
                </div>
            {/if}
            <StatusIcon size={14} class={statusColor} />
        </div>
      </div>
    </Collapsible.Trigger>

    <Collapsible.Content>
      <div class="pl-8 pr-2 pb-2" transition:slide>
         
         <!-- Recursive Children -->
         {#if hasChildren}
            <div class="mt-2 text-sm">
                {#each span.children as child}
                    <svelte:self span={child} level={level + 1} on:select={handleChildSelect} {selectedId} />
                {/each}
            </div>
         {/if}
      </div>
    </Collapsible.Content>
  </Collapsible.Root>
</div>
