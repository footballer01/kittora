"use client";

import { useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/cn";
import {
  deleteImage,
  publicUrl,
  removeProductVideo,
  reorderImages,
  setImageKind,
  uploadProductImage,
  uploadProductVideo,
  type AdminImage,
  type AdminProduct,
} from "@/lib/admin/api";
import { toast } from "@/lib/stores/toast";
import { Button } from "@/components/ui/button";

const KIND_LABEL: Record<AdminImage["kind"], string> = { front: "Front", back: "Back", detail: "Extra", other: "Extra" };

/** Front, back and extra photos: upload (compressed in the browser), type, order, delete. */
export function ImageManager({ product, onChanged, missing }: { product: AdminProduct; onChanged: () => void; missing: { front: boolean; back: boolean } }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [order, setOrder] = useState(product.product_images);
  const [dragging, setDragging] = useState<string | null>(null);
  // Follow the server after uploads/deletes; keep the local order while dragging.
  const [seen, setSeen] = useState(product.product_images);
  if (seen !== product.product_images) {
    setSeen(product.product_images);
    setOrder(product.product_images);
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const kinds = new Set(product.product_images.map((i) => i.kind));
    let current = product;
    try {
      for (const [i, f] of list.entries()) {
        setProgress(`Compressing and uploading ${i + 1} of ${list.length}…`);
        const kind: AdminImage["kind"] = !kinds.has("front") ? "front" : !kinds.has("back") ? "back" : "detail";
        kinds.add(kind);
        await uploadProductImage(current, f, kind);
        current = { ...current, product_images: [...current.product_images, { id: "", storage_path: "", kind, position: current.product_images.length, width: null, height: null, alt: "" }] };
      }
      toast(`${list.length} photo${list.length === 1 ? "" : "s"} added.`, "success");
    } catch (e) {
      toast((e as Error).message, "warning");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
      onChanged();
    }
  }

  async function saveOrder(next: AdminImage[]) {
    setOrder(next);
    try {
      await reorderImages(product.id, next.map((i) => i.id));
      onChanged();
    } catch (e) {
      toast((e as Error).message, "warning");
      setOrder(product.product_images);
    }
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    next.splice(to, 0, ...next.splice(from, 1));
    void saveOrder(next);
  };
  const onDrop = (e: DragEvent, target: number) => {
    e.preventDefault();
    const from = order.findIndex((i) => i.id === dragging);
    setDragging(null);
    if (from >= 0) move(from, target);
  };

  async function run(fn: () => Promise<void>, done: string) {
    try {
      await fn();
      toast(done, "success");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "warning");
    }
  }

  return (
    <div className="grid gap-4">
      {(missing.front || missing.back) && (
        <p className="text-step-n1 text-warning">Needs {[missing.front && "a front photo", missing.back && "a back photo"].filter(Boolean).join(" and ")}. The back photo shows when shoppers hover a card.</p>
      )}
      {order.length > 0 && (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {order.map((img, i) => (
            <li
              key={img.id}
              draggable
              onDragStart={() => setDragging(img.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, i)}
              onDragEnd={() => setDragging(null)}
              className={cn("grid min-w-0 gap-2 rounded-xl border border-line bg-bg p-2", dragging === img.id && "opacity-40")}
            >
              <div className="relative aspect-square cursor-grab overflow-hidden rounded-lg bg-surface-2 active:cursor-grabbing">
                {/* eslint-disable-next-line @next/next/no-img-element -- straight from Storage */}
                <img src={publicUrl("product-images", img.storage_path)} alt={`Photo ${i + 1}`} className="size-full object-cover" loading="lazy" draggable={false} />
                <span className="absolute top-1.5 left-1.5 rounded-full bg-bg/85 px-2 py-0.5 text-step-n2 font-semibold">{i + 1}</span>
              </div>
              <label className="sr-only" htmlFor={`kind-${img.id}`}>
                Photo {i + 1} type
              </label>
              <select
                id={`kind-${img.id}`}
                value={img.kind === "other" ? "detail" : img.kind}
                onChange={(e) => void run(() => setImageKind(img, e.target.value as AdminImage["kind"], order), "Photo type saved.")}
                className="h-11 w-full rounded-lg border border-line-strong bg-surface px-2 text-step-n1"
              >
                {(["front", "back", "detail"] as const).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-3 gap-1">
                <button type="button" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, i - 1)} className="h-10 rounded-lg border border-line-strong disabled:opacity-30">
                  ←
                </button>
                <button type="button" aria-label={`Move photo ${i + 1} later`} disabled={i === order.length - 1} onClick={() => move(i, i + 1)} className="h-10 rounded-lg border border-line-strong disabled:opacity-30">
                  →
                </button>
                <button
                  type="button"
                  aria-label={`Delete photo ${i + 1}`}
                  onClick={() => window.confirm("Delete this photo?") && void run(() => deleteImage(img), "Photo deleted.")}
                  className="h-10 rounded-lg border border-line-strong text-brand-text"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="text-step-n1 text-ink-muted">Drag photos (or use the arrows) to change the order. Photos are shrunk automatically before upload.</p>
      <input ref={input} type="file" accept="image/*" multiple className="sr-only" id="photo-upload" aria-label="Add photos" tabIndex={-1} onChange={(e) => void upload(e.target.files)} />
      <Button size="lg" variant="secondary" loading={!!progress} onClick={() => input.current?.click()} className="w-full sm:w-auto">
        {progress ?? "Add photos"}
      </Button>
    </div>
  );
}

/** Optional 5–8 second silent detail video, max 2 MB. */
export function VideoManager({ product, onChanged }: { product: AdminProduct; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await uploadProductVideo(product, file);
      toast("Video added.", "success");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "warning");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="grid gap-3">
      {product.video ? (
        <video
          src={publicUrl("product-media", product.video.path)}
          poster={publicUrl("product-media", product.video.poster)}
          muted
          playsInline
          loop
          controls
          className="aspect-video w-full max-w-md rounded-xl bg-surface-2 object-cover"
        />
      ) : (
        <p className="text-step-n1 text-ink-muted">A silent 5–8 second clip (MP4 or WebM), up to 2 MB. It plays on the product page.</p>
      )}
      <input ref={input} type="file" accept="video/mp4,video/webm" className="sr-only" aria-label="Add video" tabIndex={-1} onChange={(e) => void upload(e.target.files?.[0])} />
      <div className="grid gap-2 sm:flex">
        <Button size="lg" variant="secondary" loading={busy} onClick={() => input.current?.click()}>
          {product.video ? "Replace video" : "Add video"}
        </Button>
        {product.video && (
          <Button
            size="lg"
            variant="ghost"
            className="text-brand-text"
            onClick={() =>
              window.confirm("Remove the video?") &&
              void removeProductVideo(product).then(
                () => onChanged(),
                (e: Error) => toast(e.message, "warning"),
              )
            }
          >
            Remove video
          </Button>
        )}
      </div>
    </div>
  );
}
