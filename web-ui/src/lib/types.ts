export interface LogEvent {
    timestamp: number;
    event: string;
    run_id: string;
    parent_run_id?: string | null;
    observation_type?: string;
    name?: string;
    data?: any;
    tags?: string[];
    metadata?: Record<string, any>;
}

export interface Span {
    id: string;
    parentId?: string | null;
    name: string;
    type: string;
    status: string;
    timestamp: number;
    endTime?: number | null;
    duration?: number | null;
    inputs?: any;
    outputs?: any;
    metadata: Record<string, any>;
    events: LogEvent[];
    children: Span[];
    errorMessage?: string;
}

export interface Message {
    role: string;
    content: string;
    tool_calls?: any[];
    raw?: any;
}
