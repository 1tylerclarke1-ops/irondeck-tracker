import { useEffect, useState } from "react";

const CORRODE_MS = 2000;
const SETTLE_MS = 600;
const GAP_MS = 1000;

// Drives the /overlay/deck?mode=outro decay replay. Returns the animation
// state: appliedCount = decays fully applied, activeIdx = decay corroding now,
// ticked = whether the active decay's copies tick / rusted slide / replacement
// drop have happened. decaysOldest must be oldest-first.
export default function useOutroAnimation(isOutro, decaysOldest) {
  const n = decaysOldest.length;
  const [appliedCount, setAppliedCount] = useState(0);
  const [activeIdx, setActiveIdx] = useState(null);
  const [ticked, setTicked] = useState(false);

  useEffect(() => {
    if (!isOutro || n === 0) return;
    setAppliedCount(0);
    setActiveIdx(null);
    setTicked(false);

    let cancelled = false;
    const timers = [];
    const runDecay = (idx) => {
      if (cancelled) return;
      setActiveIdx(idx);
      setTicked(false);
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setTicked(true);
          timers.push(
            setTimeout(() => {
              if (cancelled) return;
              setAppliedCount(idx + 1);
              setActiveIdx(null);
              setTicked(false);
              if (idx + 1 < n) {
                timers.push(setTimeout(() => runDecay(idx + 1), GAP_MS));
              }
            }, SETTLE_MS)
          );
        }, CORRODE_MS)
      );
    };
    timers.push(setTimeout(() => runDecay(0), GAP_MS));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [isOutro, n]);

  return { appliedCount, activeIdx, ticked };
}