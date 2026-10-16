// "Needs details": imported products keep v1's data as-is, so admins fill in
// the rest. Required fields count towards the filter; player and number are
// only highlighted (many shirts have neither).

export type DetailSource = {
  club: string | null;
  country: string | null;
  season: string | null;
  kit_type: string | null;
  fit: string | null;
  description: string | null;
  audience: string[];
  player: string | null;
  number: number | null;
  product_images: { kind: string }[];
};

export const DETAIL_LABELS = {
  club: "Club or country",
  season: "Season",
  kit_type: "Kit type",
  fit: "Fit",
  description: "Description",
  audience: "Men / Women / Kids",
  front_image: "Front photo",
  back_image: "Back photo",
  player: "Player",
  number: "Shirt number",
} as const;
export type DetailField = keyof typeof DETAIL_LABELS;

const empty = (s: string | null | undefined) => !s?.trim();

export function missingDetails(p: DetailSource): { required: DetailField[]; optional: DetailField[] } {
  const required: DetailField[] = [];
  if (empty(p.club) && empty(p.country)) required.push("club");
  if (empty(p.season)) required.push("season");
  if (!p.kit_type) required.push("kit_type");
  if (empty(p.fit)) required.push("fit");
  if (empty(p.description)) required.push("description");
  if (p.audience.length === 0) required.push("audience");
  if (p.product_images.length === 0) required.push("front_image");
  if (!p.product_images.some((i) => i.kind === "back")) required.push("back_image");
  const optional: DetailField[] = [];
  if (empty(p.player)) optional.push("player");
  if (p.number == null) optional.push("number");
  return { required, optional };
}

export const needsDetails = (p: DetailSource) => missingDetails(p).required.length > 0;
