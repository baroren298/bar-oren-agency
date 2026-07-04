#!/usr/bin/env node
/*
 * One-off Owner account creation — Phase 2: Auth/Security.
 *
 * Run manually, locally or on the production host, whenever the single
 * Owner account needs to be created or recreated:
 *
 *   npm run admin:create-owner
 *
 * Deliberately NOT an HTTP route — there is no public signup flow
 * (ADMIN_PANEL_PLAN.md Section 11). This script is the only way an Owner
 * account is ever created.
 *
 * The email/password are read interactively (or via --email/--password
 * flags for scripting/CI use) rather than from environment variables, so
 * a real password never has to be written into any .env file, committed
 * or not.
 *
 * --reset-password (Sprint 4.4 dev-tooling addition): by default this
 * script refuses if the email already exists, to avoid silently
 * overwriting an Owner's credentials. Pass --reset-password when you
 * specifically intend to update an existing Owner's password (e.g. a
 * mistyped local dev password) instead of creating a new account. It
 * only ever updates `passwordHash` on a user that already has
 * `role: 'OWNER'` — it refuses for any other role, and never changes
 * email, role, or any other field. This is a script-level convenience
 * only; it does not touch lib/admin/auth/*, lib/admin/repository/*, or
 * any route — it just runs one more `prisma.user.update()` call inline,
 * same as this script's existing `prisma.user.create()` call.
 *
 * NOTE: input is not masked while typing (no extra terminal-control
 * dependency is added for this one script) — run it somewhere your
 * terminal session itself is private, or pass --password as an argument
 * if your shell history is acceptably private for that.
 *
 * WHY THIS FILE DOESN'T IMPORT lib/admin/auth/password.js OR
 * lib/admin/repository/userRepository.js: this script intentionally runs
 * as a plain Node ESM file (.mjs) without the project setting
 * `"type": "module"` in package.json (that flag would change how every
 * .js file in the project is parsed, project-wide, for the sake of one
 * script — rejected). Node decides how to parse a plain `.js` file from
 * the nearest package.json's `"type"` field, which is `"commonjs"` here,
 * but those two lib files use `import`/`export` syntax — Node would throw
 * a SyntaxError trying to load them as CommonJS. Bundled npm packages
 * like `@prisma/client` and `bcryptjs` don't have this problem (they ship
 * their own module resolution via their own package.json), so this script
 * imports those directly and duplicates the small amount of hashing/query
 * logic it needs instead. If that duplication ever drifts from
 * lib/admin/auth/password.js's SALT_ROUNDS or userRepository.js's
 * createOwner shape, fix both.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const SALT_ROUNDS = 12; // keep in sync with lib/admin/auth/password.js

/*
 * Plain Node (unlike `next dev`) doesn't auto-load .env.local, but
 * DATABASE_URL typically lives there. Minimal inline loader — no dotenv
 * dependency needed for one script.
 */
function loadEnvFile(filename) {
  const path = resolve(projectRoot, filename);
  if (!existsSync(path)) return;
  const contents = readFileSync(path, "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const withValue = /^--([^=]+)=(.*)$/.exec(arg);
    if (withValue) {
      args[withValue[1]] = withValue[2];
      continue;
    }
    const bareFlag = /^--([^=]+)$/.exec(arg);
    if (bareFlag) args[bareFlag[1]] = true;
  }
  return args;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function prompt(rl, question) {
  const answer = await rl.question(question);
  return answer.trim();
}

// [SPRINT 4.4 DIAGNOSTIC — TEMPORARY, remove once login investigation is closed]
// Masks credentials out of a Postgres connection string, leaving only
// host/port/dbname, so DB target can be compared across processes without
// ever printing a secret.
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
// cost-factor prefix (e.g. "$2a$12$") — never the hash value itself.
function hashFormat(hash) {
  if (!hash) return "(none)";
  return `length=${hash.length} prefix=${hash.slice(0, 7)}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rl = createInterface({ input: stdin, output: stdout });
  const prisma = new PrismaClient();

  try {
    let email = args.email;
    while (!email || !EMAIL_REGEX.test(email)) {
      email = await prompt(rl, "Owner email: ");
      if (email && !EMAIL_REGEX.test(email)) {
        console.error("That does not look like a valid email address.");
      }
    }

    let password = args.password;
    while (!password || password.length < 12) {
      password = await prompt(rl, "Owner password (min 12 characters): ");
      if (password && password.length < 12) {
        console.error("Password must be at least 12 characters.");
      }
    }

    rl.close();

    const normalizedEmail = email.trim().toLowerCase();
    const resetPassword = Boolean(args["reset-password"]);

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing && !resetPassword) {
      console.error(
        `A user with email "${normalizedEmail}" already exists (role: ${existing.role}).`,
      );
      console.error(
        "This script only creates new Owner accounts. Pass --reset-password to update the password of an existing Owner instead. Aborting.",
      );
      process.exit(1);
    }

    if (resetPassword) {
      if (!existing) {
        console.error(
          `--reset-password was passed but no user with email "${normalizedEmail}" exists. Aborting.`,
        );
        process.exit(1);
      }
      if (existing.role !== "OWNER") {
        console.error(
          `User "${normalizedEmail}" has role "${existing.role}", not OWNER. This script will not modify non-Owner accounts. Aborting.`,
        );
        process.exit(1);
      }

      const oldHash = existing.passwordHash;
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });

      console.log(
        `Owner password reset: ${user.email} (id: ${user.id}, role: ${user.role})`,
      );
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash, role: "OWNER" },
    });

    console.log(
      `Owner account created: ${user.email} (id: ${user.id}, role: ${user.role})`,
    );
    process.exit(0);
  } catch (err) {
    rl.close();
    console.error("[create-owner] Failed:", err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
