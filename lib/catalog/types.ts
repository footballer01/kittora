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
  club: string | null;
  /** Shirt number; null until an admin fills it in. Never parsed from the name. */
  number: number | null;
  player: string | null;
  pricePaise: number;
  audience: Audience[];
  featured: boolean;
  featuredPosition: number | null;
  image: CatalogImage | null;
  variants: CatalogVariant[];
};
