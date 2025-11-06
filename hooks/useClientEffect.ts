/**
 * Custom hook that wraps useEffect to only run on the client (browser)
 * This prevents SSR issues when accessing browser APIs like localStorage
 */

import { useEffect, EffectCallback, DependencyList } from 'react';

/**
 * useEffect that only runs on the client side
 * @param effect - The effect callback to run
 * @param deps - Dependency array (same as useEffect)
 */
export function useClientEffect(
	effect: EffectCallback,
	deps?: DependencyList
): void {
	useEffect(() => {
		// Only run on client
		if (typeof window === 'undefined') return;
		return effect();
	}, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

