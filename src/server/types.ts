export interface Subtitle {
    label: string;
    file: string;
    type: "vtt" | "srt";
    language?: string;
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
}

export interface ProviderConfig {
    key?: string;
    label?: string;
    timeout?: number;
    retries?: number;
    priority?: number;
    enabled?: boolean;
}
