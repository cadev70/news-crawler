/**
 * HTTP Utility
 * Native fetch wrapper with retry and timeout support
 */

export interface FetchOptions extends RequestInit {
    /** Number of retry attempts (default: 3) */
    retries?: number;
    /** Base delay between retries in ms (default: 1000) */
    retryDelay?: number;
    /** Request timeout in ms (default: 30000) */
    timeout?: number;
}

export interface FetchResult<T> {
    data: T;
    status: number;
    headers: Headers;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Default headers for requests
 * Using a realistic browser User-Agent to avoid blocking
 */
const DEFAULT_HEADERS: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
};

/**
 * Fetch with retry and timeout support
 */
export async function fetchWithRetry(
    url: string,
    options: FetchOptions = {}
): Promise<Response> {
    const {
        retries = 3,
        retryDelay = 1000,
        timeout = 30000,
        headers: customHeaders,
        ...fetchOptions
    } = options;

    // Merge headers
    const headers = {
        ...DEFAULT_HEADERS,
        ...(customHeaders as Record<string, string>)
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                ...fetchOptions,
                headers,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Retry on server errors if we have attempts left
            if (!response.ok && response.status >= 500 && attempt < retries) {
                const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                await sleep(delay);
                continue;
            }

            // Retry on rate limit (429) with longer delay
            if (response.status === 429 && attempt < retries) {
                const retryAfter = response.headers.get('Retry-After');
                const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : retryDelay * Math.pow(2, attempt);
                await sleep(delay);
                continue;
            }

            return response;
        } catch (error) {
            // Handle abort (timeout)
            if (error instanceof Error && error.name === 'AbortError') {
                if (attempt === retries) {
                    throw new Error(`Request timeout after ${timeout}ms: ${url}`);
                }
                await sleep(retryDelay * Math.pow(2, attempt - 1));
                continue;
            }

            // Handle network errors
            if (attempt === retries) {
                throw error;
            }

            await sleep(retryDelay * Math.pow(2, attempt - 1));
        }
    }

    throw new Error(`Failed after ${retries} retries: ${url}`);
}

/**
 * Fetch JSON data
 */
export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<FetchResult<T>> {
    const response = await fetchWithRetry(url, {
        ...options,
        headers: {
            'Accept': 'application/json',
            ...(options.headers as Record<string, string>)
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as T;
    return {
        data,
        status: response.status,
        headers: response.headers
    };
}

/**
 * Fetch HTML content
 */
export async function fetchHtml(url: string, options: FetchOptions = {}): Promise<string> {
    const response = await fetchWithRetry(url, options);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
}

/**
 * Check if URL is accessible
 */
export async function isUrlAccessible(url: string, timeout: number = 10000): Promise<boolean> {
    try {
        const response = await fetchWithRetry(url, {
            method: 'HEAD',
            timeout,
            retries: 1
        });
        return response.ok;
    } catch {
        return false;
    }
}
