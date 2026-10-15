"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CatalogImage } from "@/lib/catalog/types";
import { isWide } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { CloseIcon } from "@/components/ui/icons";
import { ProductVideo } from "./product-video";

/**
 * Desktop: images stack and scroll beside a sticky info column, with a hover
 * loupe; click for fullscreen. Mobile: a native scroll-snap swipe gallery with slim progress dots;
 * tapping opens a fullscreen pinch-zoom viewer.
 */
export function ProductGallery({ images, video, name }: { images: CatalogImage[]; video: { src: string; poster: string } | null; name: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const count = images.length + (video ? 1 : 0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { root: el, threshold: 0.6 },
    );
    el.querySelectorAll("[data-index]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  const loupe = (e: ReactPointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--zx", `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty("--zy", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <div>
      <div
        ref={track}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:gap-4 lg:overflow-visible lg:px-0"
        aria-label={`${name} photos`}
      >
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            data-index={i}
            onPointerMove={loupe}
            onClick={() => setViewer(i)}
            className="loupe relative aspect-[4/5] w-[86vw] shrink-0 snap-center overflow-hidden rounded-[var(--radius-card)] bg-white sm:w-[70vw] lg:w-full"
            style={i === 0 ? { viewTransitionName: "product-hero" } : undefined}
            data-vt-hero={i === 0 ? "" : undefined}
            aria-label={`View photo ${i + 1} of ${images.length} larger`}
          >
            <Image
              src={img.src}
              alt={img.alt}
              width={img.width}
              height={img.height}
              priority={i === 0}
              sizes="(min-width: 1024px) 640px, 86vw"
              className={cn("size-full", isWide(img) ? "object-contain p-[6%]" : "object-cover")}
            />
          </button>
        ))}
        {video && (
          <div data-index={images.length} className="relative aspect-[4/5] w-[86vw] shrink-0 snap-center overflow-hidden rounded-[var(--radius-card)] bg-white sm:w-[70vw] lg:w-full">
            <ProductVideo src={video.src} poster={video.poster} label={`${name} detail video`} />
          </div>
        )}
      </div>
      {count > 1 && (
        <div className="mt-4 flex justify-center gap-1.5 lg:hidden" aria-hidden>
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className={cn("h-1 rounded-full transition-all duration-300", i === active ? "w-6 bg-ink" : "w-2 bg-line-strong")} />
          ))}
        </div>
      )}
      {viewer != null && <ZoomViewer image={images[viewer]} onClose={() => setViewer(null)} />}
    </div>
  );
}

/** Fullscreen viewer with two-finger pinch and one-finger pan (touch only). */
function ZoomViewer({ image, onClose }: { image: CatalogImage; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef({ dist: 0, scale: 1, x: 0, y: 0, px: 0, py: 0 });
  const [t, setT] = useState({ scale: 1, x: 0, y: 0 });

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const down = (e: ReactPointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    start.current = {
      dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
      scale: t.scale,
      x: t.x,
      y: t.y,
      px: e.clientX,
      py: e.clientY,
    };
  };
  const move = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && start.current.dist) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      setT((p) => ({ ...p, scale: Math.min(4, Math.max(1, (start.current.scale * d) / start.current.dist)) }));
    } else if (pts.length === 1 && t.scale > 1) {
      setT((p) => ({ ...p, x: start.current.x + e.clientX - start.current.px, y: start.current.y + e.clientY - start.current.py }));
    }
  };
  const up = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (t.scale <= 1.02) setT({ scale: 1, x: 0, y: 0 });
  };

  return (
    <dialog
      ref={dialog}
      className="viewer m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0"
      onClose={onClose}
      aria-label="Photo viewer"
    >
      <div
        className="flex size-full touch-none items-center justify-center overflow-hidden"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={() => setT((p) => (p.scale > 1 ? { scale: 1, x: 0, y: 0 } : { ...p, scale: 2.5 }))}
      >
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes="100vw"
          className="max-h-full w-full bg-white object-contain"
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})` }}
          draggable={false}
        />
      </div>
      <button
        type="button"
        onClick={() => dialog.current?.close()}
        className="fixed top-[max(1rem,env(safe-area-inset-top))] right-4 flex size-12 items-center justify-center rounded-full bg-white text-neutral-900 shadow-lg"
        aria-label="Close photo viewer"
      >
        <CloseIcon />
      </button>
      <p className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-step-n1 text-white/80">Pinch to zoom · double-tap to reset</p>
    </dialog>
  );
}
