'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// useMountedRef — track whether a component is still mounted
// ═══════════════════════════════════════════════════════════════════════════════
//
// Returns a ref whose `.current` is `true` while the component is mounted and
// `false` after unmount. Use inside async callbacks to skip state updates that
// would otherwise fire on a dead component.
//
// Usage:
//   const mountedRef = useMountedRef();
//   useEffect(() => {
//     (async () => {
//       const data = await fetchData();
//       if (!mountedRef.current) return; // unmounted while we were waiting
//       setData(data);
//     })();
//   }, []);
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';

export function useMountedRef() {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}
