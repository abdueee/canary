// Shown while a page's data loads. Also the Suspense boundary that
// cacheComponents requires around pages that read the database.
export default function Loading() {
  return <p>Loading…</p>;
}
