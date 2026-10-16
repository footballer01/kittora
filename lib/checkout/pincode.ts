// City and state for a pincode, from India Post's directory bundled as small
// static files (public/pincodes/<first two digits>.json, built by
// scripts/pincodes/build.ts). Unknown pincodes return null: the shopper types them.
export type PincodePlace = { city: string; state: string };

const cache = new Map<string, Promise<Record<string, [string, string]> | null>>();

export async function lookupPincode(pin: string): Promise<PincodePlace | null> {
  if (!/^[1-9]\d{5}$/.test(pin)) return null;
  const prefix = pin.slice(0, 2);
  if (!cache.has(prefix)) {
    cache.set(
      prefix,
      fetch(`/pincodes/${prefix}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
  }
  const hit = (await cache.get(prefix))?.[pin.slice(2)];
  return hit ? { city: hit[0], state: hit[1] } : null;
}
