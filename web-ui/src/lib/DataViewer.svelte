<script lang="ts">
  import { ChevronRight, ChevronDown, Info, Brain, Wrench } from 'lucide-svelte';
  import { slide } from 'svelte/transition';

  export let keyName: string | undefined = undefined;
  export let value: any;
  export let level = 0;
  export let expand = false;

  let isOpen = expand;
  let isReasoningOpen = true;

  function toggle() {
    isOpen = !isOpen;
  }

  function toggleReasoning() {
    isReasoningOpen = !isReasoningOpen;
  }

  // --- Type Checkers ---

  function isPrimitive(v: any) {
    return (
      v === null ||
      v === undefined ||
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    );
  }

  function formatPrimitive(v: any) {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "string") return `"${v}"`;
    return String(v);
  }

  // --- Message Detection Logic ---

  function getMessageDetails(v: any): { role: string; content: string; reasoning?: string; tool_calls?: any[]; metadata?: any } | null {
    if (!v || typeof v !== 'object') return null;

    // 1. LangChain Constructor format
    // {"lc": 1, "type": "constructor", "id": ["langchain", "...", "HumanMessage"], "kwargs": {"content": "..."}}
    if (v.lc === 1 && v.type === 'constructor' && Array.isArray(v.id) && v.kwargs) {
        const typeStr = v.id[v.id.length - 1]; // e.g., "HumanMessage"
        let role = typeStr.replace('Message', '');
        if (role === 'Human') role = 'User';
        if (role === 'AI') role = 'Assistant';
        
        const content = v.kwargs.content || "";
        const { content: _c, type: _t, ...rest } = v.kwargs;
        
        // Extract reasoning
        let reasoning = undefined;
        if (rest.additional_kwargs?.reasoning_content) {
            reasoning = rest.additional_kwargs.reasoning_content;
        }

        // Extract tool_calls
        let tool_calls = undefined;
        if (rest.additional_kwargs?.tool_calls) {
            tool_calls = rest.additional_kwargs.tool_calls;
        } else if (rest.tool_calls) {
            tool_calls = rest.tool_calls;
        }

        return { role, content, reasoning, tool_calls, metadata: rest };
    }

    // 2. Standard OpenAI/LangChain Dict format
    // {"role": "user", "content": "..."} or {"type": "human", "content": "..."}
    if (typeof v.content === 'string') {
        let role = v.role || v.type || "unknown";
        if (role === 'human') role = 'User';
        if (role === 'ai') role = 'Assistant';
        if (role === 'tool') role = 'Tool';
        
        const { content: _c, role: _r, type: _t, ...rest } = v;

        // Extract reasoning (often in additional_kwargs for LangChain objects converted to dicts)
        let reasoning = undefined;
        if (v.additional_kwargs?.reasoning_content) {
            reasoning = v.additional_kwargs.reasoning_content;
        }

        // Extract tool_calls
        let tool_calls = undefined;
        if (v.additional_kwargs?.tool_calls) {
            tool_calls = v.additional_kwargs.tool_calls;
        } else if (v.tool_calls) {
            tool_calls = v.tool_calls;
        }
        
        return { role, content: v.content, reasoning, tool_calls, metadata: rest };
    }
    
    // 3. Tool Node variants (LangGraph Spans)
    if (v.type === 'tool' && v.name && v.inputs) {
        let content = '';
        if (typeof v.inputs === 'string') {
            content = v.inputs;
        } else {
            content = JSON.stringify(v.inputs, null, 2);
        }
        
        return { 
            role: 'Tool', 
            content: content, 
            metadata: { name: v.name, ...v } 
        };
    }
    
    return null;
  }

  $: messageData = getMessageDetails(value);
  $: isMessage = !!messageData;
  $: isArray = Array.isArray(value);
  $: isObject = value && typeof value === 'object' && !isArray && !isMessage;
  
  // Heuristic: If it's an array, check if it's a list of messages
  $: isMessageList = isArray && value.length > 0 && value.every((item: any) => !!getMessageDetails(item));

</script>

<div class="font-mono text-xs leading-relaxed">
    
    <!-- Case 1: Primitive Value -->
    {#if isPrimitive(value)}
        <div class="flex items-start">
            {#if keyName}
                <span class="text-gray-500 mr-2 opacity-75">{keyName}:</span>
            {/if}
            <span class:text-green-600={typeof value === 'string'} 
                  class:text-blue-600={typeof value === 'number'} 
                  class:text-purple-600={typeof value === 'boolean'}
                  class:text-gray-400={value === null || value === undefined}>
                {formatPrimitive(value)}
            </span>
        </div>

    <!-- Case 2: Message Object (Special Render) -->
    {:else if isMessage && messageData} 
       <!-- Render as a collapsible Message card -->
       <div class="border border-gray-200 dark:border-gray-700 rounded my-1 bg-white dark:bg-gray-800">
            <div 
                class="flex items-center gap-2 px-3 py-2 cursor-pointer bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-t border-b border-gray-100 dark:border-gray-800"
                on:click={toggle}
                on:keydown={(e) => e.key === 'Enter' && toggle()}
                role="button"
                tabindex="0"
            >
                <div class:rotate-90={isOpen} class="transition-transform text-gray-400">
                    <ChevronRight size={12} />
                </div>
                
                <span class="font-bold text-xs uppercase tracking-wider px-1.5 py-0.5 rounded
                    {messageData.role === 'User' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : ''}
                    {messageData.role === 'Assistant' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : ''}
                    {messageData.role === 'System' ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' : ''}
                    {messageData.role === 'Tool' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : ''}
                    {['User', 'Assistant', 'System', 'Tool'].includes(messageData.role) ? '' : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'}
                ">
                    {messageData.role}
                </span>

                {#if messageData.role === 'Tool' && messageData.metadata?.name}
                    <span class="text-purple-600 dark:text-purple-400 text-[10px] font-mono border border-purple-200 dark:border-purple-800 px-1 rounded bg-purple-50 dark:bg-purple-900/20">
                        {messageData.metadata.name}
                    </span>
                {/if}

                {#if keyName}
                    <span class="text-gray-400 text-[10px] ml-auto">({keyName})</span>
                {/if}
            </div>
            
            <!-- Preview Content (Truncated) if closed -->
            {#if !isOpen}
                <div class="px-3 py-2 text-gray-600 dark:text-gray-400 cursor-pointer" on:click={toggle} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && toggle()}>
                    <div class="flex flex-wrap gap-2 mb-1">
                        {#if messageData.reasoning}
                            <div class="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-500 font-mono bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded w-fit border border-amber-100 dark:border-amber-800/50">
                                <span>Reasoning</span>
                            </div>
                        {/if}
                        {#if messageData.tool_calls && messageData.tool_calls.length > 0}
                            <div class="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 font-mono bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded w-fit border border-purple-100 dark:border-purple-800/50">
                                <Wrench size={10} />
                                <span>{messageData.tool_calls.length} Tool Call{messageData.tool_calls.length > 1 ? 's' : ''}</span>
                            </div>
                        {/if}
                    </div>

                    {#if messageData.content}
                        <div class="truncate">
                            {messageData.content.substring(0, 100)}{messageData.content.length > 100 ? '...' : ''}
                        </div>
                    {:else if !messageData.reasoning && (!messageData.tool_calls || messageData.tool_calls.length === 0)}
                         <div class="italic text-gray-400">Empty message</div>
                    {/if}
                </div>
            {/if}

            {#if isOpen}
                <div class="p-3 border-t border-gray-100 dark:border-gray-800" transition:slide|local>
                    {#if messageData.reasoning}
                         <div class="mb-3 bg-amber-50 dark:bg-amber-900/10 rounded-md border border-amber-100 dark:border-amber-800/30 overflow-hidden">
                              <div 
                                class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors select-none"
                                on:click={toggleReasoning}
                                on:keydown={(e) => e.key === 'Enter' && toggleReasoning()}
                                role="button"
                                tabindex="0"
                              >
                                  <div class:rotate-90={isReasoningOpen} class="transition-transform text-amber-500">
                                      <ChevronRight size={12} />
                                  </div>
                                  <div class="text-[10px] uppercase text-amber-600 dark:text-amber-500 font-bold flex items-center gap-1">
                                      <Brain size={10} /> Reasoning
                                  </div>
                              </div>
                              
                              {#if isReasoningOpen}
                                  <div class="px-3 pb-3" transition:slide|local>
                                      <div class="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono text-[11px] leading-relaxed border-l-2 border-amber-200 dark:border-amber-800 pl-2 ml-1">
                                          {messageData.reasoning}
                                      </div>
                                  </div>
                              {/if}
                         </div>
                    {/if}

                    {#if messageData.tool_calls && messageData.tool_calls.length > 0}
                         <div class="mb-3">
                            <div class="text-[10px] uppercase text-purple-600 dark:text-purple-400 mb-1 font-bold flex items-center gap-1">
                                <Wrench size={10} /> Tool Calls
                            </div>
                            <div class="space-y-2">
                                {#each messageData.tool_calls as call}
                                    <div class="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 rounded p-2 text-xs font-mono">
                                        {#if call.function}
                                            <div class="font-bold text-purple-700 dark:text-purple-300 mb-1 flex items-center gap-2">
                                                <span>{call.function.name}</span>
                                            </div>
                                            <div class="text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-all">
                                                {typeof call.function.arguments === 'string' ? call.function.arguments : JSON.stringify(call.function.arguments)}
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                         </div>
                    {/if}

                    {#if messageData.content}
                        <div class="whitespace-pre-wrap text-gray-800 dark:text-gray-200 mb-2 font-sans">{messageData.content}</div>
                    {/if}
                    
                    {#if messageData.metadata && Object.keys(messageData.metadata).length > 0}
                        <div class="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 border-dashed">
                             <div class="text-[10px] uppercase text-gray-400 mb-1 font-bold flex items-center gap-1">
                                <Info size={10} /> Metadata
                             </div>
                             <svelte:self value={messageData.metadata} level={level + 1} />
                        </div>
                    {/if}
                </div>
            {/if}
       </div>

    <!-- Case 3: Lists (Message Lists treated specially) -->
    {:else if isArray}
        <div>
            <div 
                class="flex items-center gap-1 cursor-pointer hover:text-blue-500 w-fit"
                on:click={toggle}
                on:keydown={(e) => e.key === 'Enter' && toggle()}
                role="button"
                tabindex="0"
            >
                <div class:rotate-90={isOpen} class="transition-transform text-gray-400">
                    <ChevronRight size={12} />
                </div>
                {#if keyName}
                    <span class="text-gray-600 dark:text-gray-400 font-medium">{keyName}:</span>
                {/if}
                <span class="text-gray-400">Array({value.length})</span>
                {#if isMessageList}
                    <span class="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-1.5 rounded text-[10px] ml-2">Messages</span>
                {/if}
            </div>

            {#if isOpen}
                <div class="pl-4 border-l border-gray-200 dark:border-gray-800 ml-1 mt-1 space-y-1" transition:slide|local>
                    {#each value as item, i}
                        <svelte:self value={item} keyName={isMessageList ? undefined : `${i}`} level={level + 1} />
                    {/each}
                </div>
            {/if}
        </div>

    <!-- Case 4: Generic Object -->
    {:else if isObject}
        <div>
             <div 
                class="flex items-center gap-1 cursor-pointer hover:text-blue-500 w-fit"
                on:click={toggle}
                on:keydown={(e) => e.key === 'Enter' && toggle()}
                role="button"
                tabindex="0"
            >
                <div class:rotate-90={isOpen} class="transition-transform text-gray-400">
                    <ChevronRight size={12} />
                </div>
                {#if keyName}
                    <span class="text-gray-600 dark:text-gray-400 font-medium">{keyName}</span>
                {/if}
                <span class="text-gray-400">{`{}`}</span>
            </div>

            {#if isOpen}
                <div class="pl-4 border-l border-gray-200 dark:border-gray-800 ml-1 mt-1 space-y-1" transition:slide|local>
                    {#if Object.keys(value).length === 0}
                        <div class="text-gray-400 italic">Empty</div>
                    {/if}
                    {#each Object.entries(value) as [k, v]}
                        <svelte:self keyName={k} value={v} level={level + 1} />
                    {/each}
                </div>
            {/if}
        </div>

    <!-- Fallback -->
    {:else}
         <div>{String(value)}</div>
    {/if}
</div>
