/*
 * JsonLd — injects one or more JSON-LD <script> blocks for structured data.
 * Server component — no 'use client' needed.
 *
 * Usage:
 *   <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", ... }} />
 *   <JsonLd data={[schema1, schema2]} />  ← array of schemas
 */
export default function JsonLd({ data }) {
  const schemas = Array.isArray(data) ? data : [data];
  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
