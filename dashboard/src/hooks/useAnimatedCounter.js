import { useState, useEffect, useRef } from 'react';

/**
 * Hook that animates a number counting up from 0 to the target value.
 * @param {number} target - The final number to count up to
 * @param {number} duration - Animation duration in ms (default: 1000)
 * @param {number} decimals - Decimal places to show (default: 0)
 * @returns {string} The current animated value as a formatted string
 */
export function useAnimatedCounter(target, duration = 1000, decimals = 0) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === null || target === undefined) return;

    const start = prevTarget.current;
    const diff = target - start;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;

      setValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevTarget.current = target;
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
