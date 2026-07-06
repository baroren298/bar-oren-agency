/*
 * POST /api/admin/auth/login — Phase 2: Auth/Security, extended by the
 * User Model Completion sprint (Sprint 2).
 *
 * Explicit route handler (not a Server Action, per the approved Phase 2
 * plan). Runs in the Node.js runtime (the App Router default for route
 * handlers), which is required here since bcryptjs password comparison
 * happens in this file — middleware.js never does this, since it runs on
 * the Edge runtime and only verifies the already-issued session JWT.
 *
 * Outcomes: success, 401 (bad credentials — email/password), 429 (rate
 * limited), or 403 (Sprint 2 addition: correct credentials but the account
 * is deactivated). The 401/429/success split never lets a caller
 * distinguish "no such email" from "wrong password" (Section 11 — no
 * enumeration leaks); the 403 only fires after a password has already
 * verified correctly, so it reveals nothing an attacker didn't already
 * prove they knew.
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

  // Sprint 2 (User Model Completion): an otherwise-valid login is refused
  // if the account has been deactivated. Checked only after the password
  // has verified correctly (and rate-limit attempts already cleared), so
  // this never adds a new way to distinguish "wrong password" from "no
  // such user" — it only ever fires once the caller has already proven
  // they know the correct password for a real account.
  if (user.isActive === false) {
    console.warn("[admin/auth/login] Login attempt for deactivated account", {
      userId: user.id,
      email: user.email,
      ip,
    });
    return NextResponse.json(
      { error: "This account has been deactivated." },
      { status: 403 },
    );
  }

  const token = await signSession({ userId: user.id, role: user.role });
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());

  // Sprint 2: record the successful login. Awaited so a failure here is
  // visible (surfaces as a 500) rather than silently ignored, but it runs
  // after the session cookie is already prepared — a lastLoginAt write
  // failure is a data-quality problem, not a reason to fail the login.
  await userRepository.updateLastLoginAt(user.id);

  console.log("[admin/auth/login] Successful login", {
    userId: user.id,
    email: user.email,
    ip,
  });

  return response;
}
