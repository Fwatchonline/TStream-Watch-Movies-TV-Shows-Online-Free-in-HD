/**
 * Retryable Async Keyed-Fetch Coordinator
 *
 * Used by TV season/episode loading (`StreamingPlayer.tsx`) and streaming platform
 * catalog tabs (`PlatformSection.tsx`) to guarantee:
 * 1. Entries are marked loaded ONLY after a request completes cleanly.
 * 2. Transient HTTP/network failures clear the in-flight lock so subsequent retries work.
 * 3. Concurrent identical requests are deduplicated into one in-flight call.
 * 4. Rapid switching (season A -> season B or platform A -> platform B) discards stale callbacks.
 * 5. Component unmounts silence post-unmount callbacks safely with zero state leaks.
 */

export interface FetchLoadOutcome<T> {
  key: string;
  ok: boolean;
  data?: T;
  error?: string;
  stale: boolean;
  aborted: boolean;
}

export class KeyedFetchCoordinator<T> {
  private cache = new Map<string, T>();
  private inFlight = new Map<string, Promise<FetchLoadOutcome<T>>>();
  private errors = new Map<string, string>();
  private seqCounter = 0;
  private latestSeqByKey = new Map<string, number>();
  private activeKey: string | null = null;
  private destroyed = false;

  setActiveKey(key: string) {
    this.activeKey = key;
  }

  getActiveKey(): string | null {
    return this.activeKey;
  }

  hasLoaded(key: string): boolean {
    return this.cache.has(key);
  }

  getCached(key: string): T | undefined {
    return this.cache.get(key);
  }

  seed(key: string, data: T) {
    this.cache.set(key, data);
    this.errors.delete(key);
  }

  getError(key: string): string | undefined {
    return this.errors.get(key);
  }

  isLoading(key: string): boolean {
    return this.inFlight.has(key);
  }

  clearError(key: string) {
    this.errors.delete(key);
  }

  destroy() {
    this.destroyed = true;
    this.inFlight.clear();
  }

  reset() {
    this.destroyed = false;
    this.cache.clear();
    this.inFlight.clear();
    this.errors.clear();
    this.latestSeqByKey.clear();
    this.activeKey = null;
  }

  async load(
    key: string,
    fetcher: () => Promise<T>,
    options: { forceRetry?: boolean; makeActive?: boolean } = {}
  ): Promise<FetchLoadOutcome<T>> {
    if (this.destroyed) {
      return { key, ok: false, stale: true, aborted: true };
    }

    if (options.makeActive !== false) {
      this.activeKey = key;
    }

    if (!options.forceRetry && this.cache.has(key)) {
      return {
        key,
        ok: true,
        data: this.cache.get(key),
        stale: this.activeKey !== key,
        aborted: false
      };
    }

    const existingPromise = this.inFlight.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const seq = ++this.seqCounter;
    this.latestSeqByKey.set(key, seq);
    this.errors.delete(key);

    const pending = (async (): Promise<FetchLoadOutcome<T>> => {
      try {
        const result = await fetcher();
        if (this.destroyed) {
          return { key, ok: false, stale: true, aborted: true };
        }
        // Always retain valid fetched payload in cache keyed cleanly by `key`
        this.cache.set(key, result);
        this.errors.delete(key);
        const isStale = this.activeKey !== key || this.latestSeqByKey.get(key) !== seq;
        return {
          key,
          ok: true,
          data: result,
          stale: isStale,
          aborted: false
        };
      } catch (err: any) {
        if (this.destroyed) {
          return { key, ok: false, stale: true, aborted: true };
        }
        const message = err?.message ? String(err.message) : 'Request failed';
        // Never mark failed requests as loaded; store error and leave key retryable
        this.errors.set(key, message);
        const isStale = this.activeKey !== key || this.latestSeqByKey.get(key) !== seq;
        return {
          key,
          ok: false,
          error: message,
          stale: isStale,
          aborted: false
        };
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, pending);
    return pending;
  }

  retry(key: string, fetcher: () => Promise<T>): Promise<FetchLoadOutcome<T>> {
    this.errors.delete(key);
    return this.load(key, fetcher, { forceRetry: true, makeActive: true });
  }
}
