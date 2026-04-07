/**
 * Async Data Fetching Utilities
 * Helper functions for managing async operations and caching
 */

/**
 * Simple in-memory cache for API responses
 */
class ApiCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl = 5 * 60 * 1000; // 5 minutes default

  set(key: string, data: any, ttl = this.ttl): void {
    this.cache.set(key, { data, timestamp: Date.now() + ttl });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.timestamp) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clear(key: string): void {
    this.cache.delete(key);
  }

  clearAll(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    return !!this.get(key);
  }
}

export const apiCache = new ApiCache();

/**
 * Debounce function for search/filter operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for scroll/resize operations
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Retry logic for failed API calls
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        // Exponential backoff
        const delay = delayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Batch requests with rate limiting
 */
export class BatchProcessor<T extends (...args: any[]) => Promise<any>> {
  private queue: Array<{
    fn: T;
    args: any[];
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  private processing = false;
  private readonly concurrency: number;
  private readonly delayMs: number;

  constructor(concurrency = 5, delayMs = 0) {
    this.concurrency = concurrency;
    this.delayMs = delayMs;
  }

  async add<R>(fn: T, ...args: any[]): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, args, resolve, reject });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.concurrency);
        
        const promises = batch.map((item) =>
          (item.fn as any)(...item.args)
            .then((result: any) => {
              item.resolve(result);
              return result;
            })
            .catch((error: any) => {
              item.reject(error);
              throw error;
            })
        );

        // Run batch
        await Promise.allSettled(promises);

        // Delay between batches
        if (this.queue.length > 0 && this.delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.delayMs));
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

/**
 * AbortController wrapper for cancellable requests
 */
export class CancellableRequest {
  private controller: AbortController;

  constructor() {
    this.controller = new AbortController();
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  cancel(): void {
    this.controller.abort();
  }

  isAborted(): boolean {
    return this.controller.signal.aborted;
  }
}

/**
 * Timeout wrapper for promises
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Request timeout'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Dependency tracker for automatic cache invalidation
 */
export class DependencyTracker {
  private dependencies = new Map<string, Set<string>>();

  addDependency(key: string, dependsOn: string): void {
    if (!this.dependencies.has(key)) {
      this.dependencies.set(key, new Set());
    }
    this.dependencies.get(key)!.add(dependsOn);
  }

  getDependents(key: string): Set<string> {
    const dependents = new Set<string>();

    for (const [depKey, deps] of this.dependencies.entries()) {
      if (deps.has(key)) {
        dependents.add(depKey);
      }
    }

    return dependents;
  }

  invalidateWithDependents(key: string): string[] {
    const toInvalidate = [key];
    const queue = [key];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = this.getDependents(current);

      for (const dep of dependents) {
        if (!toInvalidate.includes(dep)) {
          toInvalidate.push(dep);
          queue.push(dep);
        }
      }
    }

    return toInvalidate;
  }
}

/**
 * Queue for handling pending operations (useful for offline support)
 */
export class OperationQueue {
  private queue: Array<{
    id: string;
    operation: () => Promise<any>;
    retry: number;
    maxRetries: number;
  }> = [];

  private processing = false;
  private onFailure?: (id: string, error: Error) => void;
  private onSuccess?: (id: string, result: any) => void;

  constructor(
    onSuccess?: (id: string, result: any) => void,
    onFailure?: (id: string, error: Error) => void
  ) {
    this.onSuccess = onSuccess;
    this.onFailure = onFailure;
  }

  enqueue(
    id: string,
    operation: () => Promise<any>,
    maxRetries = 3
  ): void {
    this.queue.push({ id, operation, retry: 0, maxRetries });
    this.process();
  }

  async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const item = this.queue[0];

        try {
          const result = await item.operation();
          this.queue.shift();
          this.onSuccess?.(item.id, result);
        } catch (error) {
          item.retry++;

          if (item.retry >= item.maxRetries) {
            this.queue.shift();
            this.onFailure?.(item.id, error instanceof Error ? error : new Error(String(error)));
          } else {
            // Exponential backoff
            const delay = 1000 * Math.pow(2, item.retry - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}

/**
 * Response deduplication to avoid duplicate concurrent requests
 */
export class RequestDeduplicator {
  private pendingRequests = new Map<
    string,
    Promise<any>
  >();

  async execute<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    // If a request for this key is already pending, return that promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Create new promise and store it
    const promise = fn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  clearPending(key: string): void {
    this.pendingRequests.delete(key);
  }

  clearAll(): void {
    this.pendingRequests.clear();
  }
}

export const requestDeduplicator = new RequestDeduplicator();
