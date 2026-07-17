/*
 * Administration Sprint 2b — per-request audit context for the user
 * management routes (app/api/admin/users/*).
 *
 * userService's five mutations now emit user-management events (see
 * userService.js); this helper builds, once per HTTP request, the two
 * pieces of request-scoped context those emissions need:
 *
 *   - `correlationId`: ONE id per request, passed to every userService
 *     call the request makes, so a multi-field PATCH (displayName + email
 *     = two mutations = two events) groups under a single id via
 *     eventRepository.listForCorrelationId(). eventService.emit() has
 *     always accepted the param (Section 13.6); this is just the first
 *     route layer to supply it.
 *
 *   - `requestMetadata`: technical/request context ONLY ({ ipAddress,
 *     userAgent }) — the exact passthrough Sprint 2a's auditLogListener
 *     projects into AuditLog's existing ipAddress/userAgent columns. IP
 *     extraction mirrors the login route's getClientIp (x-forwarded-for
 *     first hop, then x-real-ip). Deliberately never body fields,
 *     credentials, cookies, or any other header.
 */

/** Collision-resistant fallback matching eventService's own generator. */
function generateCorrelationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * @param {Request} request
 * @returns {{ correlationId: string, requestMetadata: { ipAddress: string, userAgent: string|null } }}
 */
export function buildRequestAuditContext(request) {
  const forwarded = request?.headers?.get?.('x-forwarded-for');
  const ipAddress = forwarded
    ? forwarded.split(',')[0].trim()
    : request?.headers?.get?.('x-real-ip') || 'unknown';

  return {
    correlationId: generateCorrelationId(),
    requestMetadata: {
      ipAddress,
      userAgent: request?.headers?.get?.('user-agent') || null,
    },
  };
}

export default buildRequestAuditContext;
