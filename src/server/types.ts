export interface Subtitle {
    label: string;
    file: string;
    type: "vtt" | "srt";
    language?: string;
}

export interface StreamRequest {
    mediaType: "movie" | "tv" | "anime";
    tmdbId?: string;
    anilistId?: number;
    malId?: number;
    title?: string;
    season?: number;
    episode?: number;
    audioType?: "sub" | "dub";
}

export interface StreamResult {
    success: boolean;
    type?: "hls" | "mp4" | "dash";
    url?: string;
    sources?: Array<{
        name?: string;
        url: string;
        quality?: string;
        type?: string;
    }>;
    headers?: Record<string, string>;
    subtitles?: Subtitle[];
    source: string;
    expiresAt?: number;
    error?: string;
    backdrop?: string;
}

export interface VideoProvider {
    key: string;
    label: string;
    priority: number;
    enabled: boolean;
    supportedTypes?: Array<"movie" | "tv" | "anime">;

    getStream(
        id: string,
        type: "movie" | "tv",
        season?: number,
        episode?: number
    ): Promise<StreamResult>;

    resolveStream?(request: StreamRequest): Promise<StreamResult>;
}

export interface ProviderConfig {
    key?: string;
    label?: string;
    timeout?: number;
    retries?: number;
    priority?: number;
    enabled?: boolean;
}

export interface ProviderHealthRecord {
    key: string;
    label: string;
    priority: number;
    enabled: boolean;
    averageResponseMs: number | null;
    successRate: number;
    totalRequests: number;
    successfulStarts: number;
    timeoutCount: number;
    playbackFailures: number;
    lastSuccessfulCheck: string | null;
    lastError: string | null;
    healthScore: number;
}
