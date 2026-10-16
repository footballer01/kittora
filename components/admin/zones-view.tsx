"use client";

import { useState } from "react";
import { deleteZone, importZones, listZones, saveZone, type Zone } from "@/lib/admin/api";
import { parseZonesCsv, zonesToCsv, type ZoneParse } from "@/lib/admin/zones-csv";
import { toast } from "@/lib/stores/toast";
import { Button } from "@/components/ui/button";
import { TextArea, TextField } from "@/components/ui/input";
import { Card, Chip, ErrorNote, Loading, PageHeader, Toggle, useLoad } from "./ui";

type Draft = { name: string; pincode_prefix: string; min_days: string; max_days: string; cod_available: boolean };
const blank: Draft = { name: "", pincode_prefix: "", min_days: "", max_days: "", cod_available: false };

function fromDraft(d: Draft): Omit<Zone, "id"> | string {
  const one = parseZonesCsv(`name,prefix\n"${d.name.replace(/"/g, '""')}",${d.pincode_prefix.trim()},${d.min_days.trim()},${d.max_days.trim()},${d.cod_available ? "yes" : "no"}`);
  return one.errors[0]?.replace(/^Line \d+: /, "") ?? one.rows[0];
}

export function ZonesView() {
  const zones = useLoad(listZones);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ZoneParse | null>(null);

  if (zones.error) return <ErrorNote message={zones.error} onRetry={zones.reload} />;
  if (!zones.data) return <Loading />;

  async function save(id: string | null, d: Draft) {
    const z = fromDraft(d);
    if (typeof z === "string") return toast(z, "warning");
    try {
      await saveZone(id, z);
      toast("Zone saved.", "success");
      setEditing(null);
      zones.reload();
    } catch (e) {
      toast((e as Error).message, "warning");
    }
  }

  return (
    <>
      <PageHeader
        title="Delivery zones"
        intro="Checkout shows “Delivery in X–Y days” for pincodes starting with a prefix. The longest matching prefix wins (411 beats 4). No match = no estimate."
        action={
          <Button size="lg" onClick={() => setEditing("new")}>
            Add zone
          </Button>
        }
      />
      {editing === "new" && <ZoneForm initial={blank} onSave={(d) => void save(null, d)} onCancel={() => setEditing(null)} />}
      {zones.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-muted">No zones yet, so checkout shows no delivery estimate.</p>
      ) : (
        <ul className="grid gap-3">
          {zones.data.map((z) =>
            editing === z.id ? (
              <li key={z.id}>
                <ZoneForm
                  initial={{ ...z, min_days: String(z.min_days), max_days: String(z.max_days) }}
                  onSave={(d) => void save(z.id, d)}
                  onCancel={() => setEditing(null)}
                  onDelete={async () => {
                    if (!window.confirm(`Delete ${z.name}?`)) return;
                    try {
                      await deleteZone(z.id);
                      setEditing(null);
                      zones.reload();
                    } catch (e) {
                      toast((e as Error).message, "warning");
                    }
                  }}
                />
              </li>
            ) : (
              <li key={z.id}>
                <button type="button" onClick={() => setEditing(z.id)} className="flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 text-left hover:border-ink-muted">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{z.name}</span>
                    <span className="text-step-n1 text-ink-muted">
                      Pincodes {z.pincode_prefix}… · {z.min_days}–{z.max_days} days
                    </span>
                  </span>
                  {z.cod_available && <Chip>COD</Chip>}
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      <Card title="Import from a spreadsheet (CSV)">
        <p className="text-step-n1 text-ink-muted">
          Columns: name, pincode prefix, min days, max days, COD (yes/no). Rows with an existing prefix are updated. COD is stored for later; checkout stays UPI-only.
        </p>
        <div className="mt-4 grid gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Choose a CSV file"
            className="text-step-n1 file:mr-3 file:h-11 file:rounded-full file:border file:border-line-strong file:bg-surface file:px-4 file:text-ink"
            onChange={async (e) => {
              const text = await e.target.files?.[0]?.text();
              if (text != null) {
                setCsv(text);
                setPreview(parseZonesCsv(text));
              }
            }}
          />
          <TextArea label="…or paste rows" rows={5} value={csv} placeholder={"Pune,411,1,2,no\nMaharashtra,4,2,4,no"} onChange={(e) => setCsv(e.target.value)} />
          <div className="grid gap-2 sm:flex">
            <Button variant="secondary" size="lg" onClick={() => setPreview(parseZonesCsv(csv))}>
              Check rows
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                const blob = new Blob([zonesToCsv(zones.data!)], { type: "text/csv" });
                const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "delivery-zones.csv" });
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              Download current zones
            </Button>
          </div>
          {preview && (
            <div role="status" className="grid gap-2 rounded-xl border border-line p-3 text-step-n1">
              <p>
                {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"} ready{preview.errors.length ? `, ${preview.errors.length} with problems:` : "."}
              </p>
              {preview.errors.length > 0 && (
                <ul className="list-disc pl-5 text-warning">
                  {preview.errors.slice(0, 10).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
              {preview.rows.length > 0 && (
                <Button
                  size="lg"
                  onClick={async () => {
                    try {
                      await importZones(preview.rows);
                      toast(`${preview.rows.length} zones imported.`, "success");
                      setPreview(null);
                      setCsv("");
                      zones.reload();
                    } catch (e) {
                      toast((e as Error).message, "warning");
                    }
                  }}
                >
                  Import {preview.rows.length} zone{preview.rows.length === 1 ? "" : "s"}
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

function ZoneForm({ initial, onSave, onCancel, onDelete }: { initial: Draft; onSave: (d: Draft) => void; onCancel: () => void; onDelete?: () => void }) {
  const [d, setD] = useState(initial);
  return (
    <Card>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(d);
        }}
      >
        <TextField label="Zone name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Pune" />
        <TextField label="Pincode prefix" inputMode="numeric" value={d.pincode_prefix} onChange={(e) => setD({ ...d, pincode_prefix: e.target.value })} placeholder="e.g. 411" hint="1–6 digits" />
        <TextField label="Fastest (days)" inputMode="numeric" value={d.min_days} onChange={(e) => setD({ ...d, min_days: e.target.value })} />
        <TextField label="Slowest (days)" inputMode="numeric" value={d.max_days} onChange={(e) => setD({ ...d, max_days: e.target.value })} />
        <div className="sm:col-span-2">
          <Toggle label="Cash on delivery available" hint="Saved for later. Checkout is UPI-only for now." checked={d.cod_available} onChange={(cod_available) => setD({ ...d, cod_available })} />
        </div>
        <div className="grid gap-2 sm:col-span-2 sm:flex">
          <Button type="submit" size="lg">
            Save zone
          </Button>
          <Button variant="ghost" size="lg" onClick={onCancel}>
            Cancel
          </Button>
          {onDelete && (
            <Button variant="ghost" size="lg" className="text-brand-text sm:ml-auto" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
