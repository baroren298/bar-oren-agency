/*
 * JsonLd — injects a JSON-LD <script> block for structured data.
 * Server component — no 'use client' needed.
 *
 * Usage:
 *   <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", ... }} />
 */
export default function JsonLd({ data }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
