/**
 * Utility functions for client-side only operations
 * These help avoid SSR issues with browser APIs like localStorage
 */

/**
 * Check if code is running on the client (browser) vs server
 */
export function isClient(): boolean {
	return typeof window !== 'undefined';
}

/**
 * Safe localStorage getter - returns null if not on client
 */
export function safeLocalStorageGet(key: string): string | null {
	if (!isClient()) return null;
	return localStorage.getItem(key);
}

/**
 * Safe localStorage setter - no-op if not on client
 */
export function safeLocalStorageSet(key: string, value: string): void {
	if (!isClient()) return;
	localStorage.setItem(key, value);
}

/**
 * Safe localStorage remover - no-op if not on client
 */
export function safeLocalStorageRemove(key: string): void {
	if (!isClient()) return;
	localStorage.removeItem(key);
}

