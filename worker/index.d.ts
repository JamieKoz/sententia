export interface Env {
    OPENAI_API_KEY?: string;
    OPENAI_BASE_URL?: string;
    AI_MODELS?: string;
    TMDB_READ_ACCESS_TOKEN?: string;
    TURNSTILE_SECRET_KEY?: string;
    TURNSTILE_SITE_KEY?: string;
    AI_DAILY_LIMIT?: string;
    RATE_KV?: KVNamespace;
}
declare const _default: {
    fetch(request: Request<unknown, IncomingRequestCfProperties<unknown>>, env: Env): Promise<Response>;
};
export default _default;
