export type Audience = "men" | "women" | "kids";

export type CatalogImage = { src: string; width: number; height: number; alt: string };

export type CatalogVariant = {
  size: string;
  /** null = not set by admins yet. */
  stock: number | null;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  sku: string | null;
  club: string | null;
  /** Shirt number; null until an admin fills it in. Never parsed from the name. */
  number: number | null;
  player: string | null;
  pricePaise: number;
  audience: Audience[];
  featured: boolean;
  featuredPosition: number | null;
  description: string | null;
  /** Primary (front) image. */
  image: CatalogImage | null;
  /** Back image for the card crossfade; null = no effect. */
  backImage: CatalogImage | null;
  /** Full gallery in order (includes image and backImage). */
  images: CatalogImage[];
  /** Optional kit story; hidden when null. */
  story: { title: string | null; body: string } | null;
  /** Optional silent detail video, served from the static site. */
  video: { src: string; poster: string } | null;
  variants: CatalogVariant[];
};

export type CatalogEdit = {
  slug: string;
  title: string;
  description: string | null;
  productIds: string[];
};

export type ProductHref = (p: Pick<CatalogProduct, "slug">) => string;
export const defaultHref: ProductHref = (p) => `/product/${p.slug}`;

/** Wide photos (v1's front-and-back shots) are contained, not cropped. */
export const isWide = (img: CatalogImage) => img.width > img.height * 1.1;
