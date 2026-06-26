/*
 * POST /api/admin/auth/login — Phase 2: Auth/Security.
 *
 * Explicit route handler (not a Server Action, per the approved Phase 2
 * plan). Runs in the Node.js runtime (the App Router default for route
 * handlers), which is required here since bcryptjs password comparison
 * happens in this file — middleware.js never does this, since it runs on
 * the Edge runtime and only verifies the already-issued session JWT.
 *
 * Always returns one of exactly three generic outcomes — success, 401, or
 * 429 — never anything that would let a caller distinguish "no such
 * email" from "wrong password" (Section 11 — no enumeration leaks).
 */

import { NextResponse } from "next/server";
import { userRepository } from "@/lib/admin/repository/userRepository";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/admin/auth/password";
import {
  signSession,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/admin/auth/session";
import {
  isRateLimited,
  recordFailedAttempt,
  clearAttempts,
} from "@/lib/admin/auth/rateLimit";

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

// [SPRINT 4.4 DIAGNOSTIC — TEMPORARY, remove once login investigation is
// closed] Same masking helper as scripts/create-owner.mjs's diagnostic
// addition — host/port/dbname only, never credentials.
function maskDbUrl(url) {
  if (!url) return "(unset)";
  try {
    const u = new URL(url);
    return `${u.protocol}//***:***@${u.host}${u.pathname}`;
  } catch {
    return "(unparseable)";
  }
}

// [SPRINT 4.4 DIAGNOSTIC — TEMPORARY] bcrypt hash *format* only — length and
// cost-factor prefix — never the hash value itself.
function hashFormat(hash) {
  if (!hash) return "(none)";
  return `length=${hash.length} prefix=${hash.slice(0, 7)}`;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const ip = getClientIp(request);

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  if (isRateLimited(ip, email)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 },
    );
  }

  const user = await userRepository.getByEmail(email);

  // Always run a bcrypt compare, even for a non-existent user, against a
  // fixed dummy hash — keeps response timing equivalent for "no such
  // user" and "wrong password" so timing can't be used to enumerate
  // valid admin emails.
  const passwordValid = await verifyPassword(
    password,
    user ? user.passwordHash : DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordValid) {
    recordFailedAttempt(ip, email);
    console.warn("[admin/auth/login] Failed login attempt", { email, ip });
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  clearAttempts(ip, email);

  const token = await signSession({ userId: user.id, role: user.role });
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());

  console.log("[admin/auth/login] Successful login", {
    userId: user.id,
    email: user.email,
    ip,
  });

  return response;
}
