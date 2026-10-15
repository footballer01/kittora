-- product-media holds detail videos and posters, which are shown publicly on
-- product pages anyway. The build copies them into the static site with the
-- anon key, so the bucket must be publicly readable. Writes stay admin-only
-- ("product-media: admin all"), and shoppers still download from Cloudflare.
UPDATE storage.buckets SET public = true WHERE id = 'product-media';
