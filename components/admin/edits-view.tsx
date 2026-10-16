"use client";

import { useState } from "react";
import { deleteEdit, listEdits, listProducts, saveEdit, setEditPositions, setEditProducts, type AdminProduct, type Edit } from "@/lib/admin/api";
import { slugify } from "@/lib/admin/product-form";
import { toast } from "@/lib/stores/toast";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/input";
import { Card, Chip, ErrorNote, Loading, PageHeader, Toggle, useLoad } from "./ui";

// Curated edits: named, ordered groups of products shown as rails on the home
// page and as "From the same edit" on product pages.

async function attempt(fn: () => Promise<unknown>, done: string) {
  try {
    await fn();
    toast(done, "success");
    return true;
  } catch (e) {
    toast((e as Error).message, "warning");
    return false;
  }
}

export function EditsView() {
  const edits = useLoad(listEdits);
  const products = useLoad(listProducts);
  const [title, setTitle] = useState("");

  if (edits.error) return <ErrorNote message={edits.error} onRetry={edits.reload} />;
  if (!edits.data || !products.data) return <Loading />;
  const list = edits.data;

  const move = (i: number, d: -1 | 1) => {
    const next = [...list];
    next.splice(i + d, 0, ...next.splice(i, 1));
    edits.set(next);
    void attempt(() => setEditPositions(next.map((e) => e.id)), "Order saved.");
  };

  return (
    <>
      <PageHeader title="Edits" intro="Curated groups of shirts, shown in this order on the home page. Changes show after you publish." />
      <Card title="New edit">
        <form
          className="flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (title.trim().length < 2) return toast("Give the edit a title.", "warning");
            const ok = await attempt(() => saveEdit(null, { title: title.trim(), slug: slugify(title), description: null, published: false, position: list.length }), "Edit created (hidden until you switch it on).");
            if (ok) {
              setTitle("");
              edits.reload();
            }
          }}
        >
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Number 10s" className="min-w-0 flex-1" />
          <Button type="submit" size="lg">
            Create
          </Button>
        </form>
      </Card>
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-muted">No edits yet.</p>
      ) : (
        <ol className="grid gap-4">
          {list.map((e, i) => (
            <li key={e.id}>
              <EditCard edit={e} products={products.data!} onChanged={edits.reload} onMove={(d) => move(i, d)} first={i === 0} last={i === list.length - 1} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function EditCard({ edit, products, onChanged, onMove, first, last }: { edit: Edit; products: AdminProduct[]; onChanged: () => void; onMove: (d: -1 | 1) => void; first: boolean; last: boolean }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: edit.title, slug: edit.slug, description: edit.description ?? "", published: edit.published });
  const [items, setItems] = useState(edit.edit_items.map((x) => x.product_id));
  const [adding, setAdding] = useState("");
  const byId = new Map(products.map((p) => [p.id, p]));

  const saveItems = (next: string[]) => {
    setItems(next);
    void attempt(() => setEditProducts(edit.id, next), "Products saved.");
  };
  const moveItem = (i: number, d: -1 | 1) => {
    const next = [...items];
    next.splice(i + d, 0, ...next.splice(i, 1));
    saveItems(next);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-step-1 font-semibold">{edit.title}</h2>
          <p className="mt-1 flex flex-wrap gap-1.5">
            {edit.published ? <Chip tone="success">Shown</Chip> : <Chip>Hidden</Chip>}
            <Chip>
              {items.length} product{items.length === 1 ? "" : "s"}
            </Chip>
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" aria-label={`Move ${edit.title} up`} disabled={first} onClick={() => onMove(-1)}>
            ↑
          </Button>
          <Button variant="ghost" aria-label={`Move ${edit.title} down`} disabled={last} onClick={() => onMove(1)}>
            ↓
          </Button>
          <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Close" : "Edit"}
          </Button>
        </div>
      </div>
      {open && (
        <div className="mt-4 grid gap-4 border-t border-line pt-4">
          <TextField label="Title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          <TextField label="Web address" value={v.slug} onChange={(e) => setV({ ...v, slug: slugify(e.target.value) })} />
          <TextArea label="Description (optional)" rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          <Toggle label="Show on the site" checked={v.published} onChange={(published) => setV({ ...v, published })} />
          <div className="grid gap-2 sm:flex">
            <Button
              size="lg"
              onClick={async () => {
                if (await attempt(() => saveEdit(edit.id, { ...v, title: v.title.trim(), description: v.description.trim() || null }), "Edit saved.")) onChanged();
              }}
            >
              Save edit
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="text-brand-text"
              onClick={async () => {
                if (window.confirm(`Delete the edit “${edit.title}”? The products stay.`) && (await attempt(() => deleteEdit(edit.id), "Edit deleted."))) onChanged();
              }}
            >
              Delete edit
            </Button>
          </div>

          <h3 className="mt-2 font-semibold">Products, in order</h3>
          {items.length === 0 && <p className="text-step-n1 text-ink-muted">No products yet.</p>}
          <ol className="grid gap-2">
            {items.map((id, i) => (
              <li key={id} className="flex items-center gap-2 rounded-xl border border-line p-2">
                <span className="w-6 shrink-0 text-center text-step-n1 text-ink-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-step-n1">{byId.get(id)?.name ?? "Deleted product"}</span>
                <Button size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => moveItem(i, -1)}>
                  ↑
                </Button>
                <Button size="sm" variant="ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => moveItem(i, 1)}>
                  ↓
                </Button>
                <Button size="sm" variant="ghost" className="text-brand-text" aria-label={`Remove ${byId.get(id)?.name ?? "product"}`} onClick={() => saveItems(items.filter((x) => x !== id))}>
                  ✕
                </Button>
              </li>
            ))}
          </ol>
          <div className="flex items-end gap-2">
            <SelectField label="Add a product" value={adding} onChange={(e) => setAdding(e.target.value)} className="min-w-0 flex-1">
              <option value="">Choose…</option>
              {products
                .filter((p) => !items.includes(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </SelectField>
            <Button
              size="lg"
              variant="secondary"
              disabled={!adding}
              onClick={() => {
                saveItems([...items, adding]);
                setAdding("");
              }}
            >
              Add
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
