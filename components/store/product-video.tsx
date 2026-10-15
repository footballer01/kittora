"use client";

import { useEffect, useRef } from "react";

/**
 * Silent detail video: muted, looping, inline. The file loads only when the
 * poster scrolls into view, and never autoplays under prefers-reduced-motion.
 */
export function ProductVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!v.src) v.src = src;
          if (!reduce) void v.play().catch(() => {});
        } else v.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [src]);
  return <video ref={ref} poster={poster} muted loop playsInline preload="none" aria-label={label} className="size-full object-cover" />;
}
