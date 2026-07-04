/*
 * JsonLd — injects one or more JSON-LD <script> blocks for structured data.
 * Server component — no 'use client' needed.
 *
 * Usage:
 *   <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", ... }} />
 *   <JsonLd data={[schema1, schema2]} />  ← array of schemas
 *
 * Security (pre-merge hardening, audit finding S4): schema values can
 * include admin-authored DB content (published talent fields), and
 * JSON.stringify does not escape "<" — a value containing "</script>"
 * would terminate the script block and inject markup. Escaping every "<"
 * as the six-character JSON escape sequence backslash-u003c is the
 * standard fix: browsers
 * parse the JSON-LD to the identical value, but the raw HTML can never
 * contain a closing script tag.
 */
function serializeSchema(schema) {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}

export default function JsonLd({ data }) {
  const schemas = Array.isArray(data) ? data : [data];
  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeSchema(schema) }}
        />
      ))}
    </>
  );
}
