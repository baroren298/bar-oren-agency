/*
 * Prisma migration guard — decision logic (Sprint 6A: Migration Workflow
 * Guardrails). See MIGRATION_WORKFLOW.md.
 *
 * This module is deliberately pure and side-effect free so its decisions
 * can be unit-tested without spawning processes or touching a database:
 * the CLI entry point (scripts/prisma-guard.mjs) handles env loading and
 * process spawning; this file only answers "may this command run, and
 * with which Prisma argument arrays?".
 *
 * Safety rules encoded here (Sprint 6A product decisions):
 *   - Environment authorization comes ONLY from the explicit, non-secret
 *     DATABASE_ENV label — never inferred from a hostname or URL.
 *   - Every supported command requires DATABASE_ENV=development. There is
 *     no production mode; `migrate deploy` is intentionally not wrapped.
 *   - Error messages never echo user input or environment values, so no
 *     connection string can ever leak through a refusal message.
 */

/** Flags `dev` mode may forward to `prisma migrate dev`. Anything else is
 *  refused — in particular `--schema`, which could re-point the CLI. */
const DEV_ALLOWED_FLAGS = new Set([
  '--create-only',
  '--skip-generate',
  '--skip-seed',
]);

/** Supported guard commands → the Prisma CLI argument arrays they run,
 *  in order. `verify` is the repo's safe verification workflow: schema
 *  validation (no database) followed by read-only migration status. */
const COMMANDS = {
  status: { steps: [['migrate', 'status']], allowExtraArgs: false },
  dev: { steps: [['migrate', 'dev']], allowExtraArgs: true },
  verify: { steps: [['validate'], ['migrate', 'status']], allowExtraArgs: false },
};

export const SUPPORTED_COMMANDS = Object.keys(COMMANDS);

const USAGE =
  'Usage: node scripts/prisma-guard.mjs <status|dev|verify> [dev flags]\n' +
  '  status  prisma migrate status (read-only)\n' +
  '  dev     prisma migrate dev (allowed flags: --name <name>, ' +
  '--create-only, --skip-generate, --skip-seed)\n' +
  '  verify  prisma validate, then prisma migrate status (read-only)';

/**
 * Decide whether a guard invocation may run.
 *
 * @param {object} input
 * @param {string|undefined} input.command    first CLI argument
 * @param {string[]}         [input.extraArgs] remaining CLI arguments
 * @param {string|undefined} input.databaseEnv value of DATABASE_ENV
 * @returns {{ok: true, steps: string[][]} | {ok: false, error: string}}
 *   `steps` are argument arrays for the Prisma CLI (never a shell string).
 *   Errors are static text: they never include user input or env values.
 */
export function evaluateGuard({ command, extraArgs = [], databaseEnv }) {
  if (!command || !Object.prototype.hasOwnProperty.call(COMMANDS, command)) {
    // Deliberately does NOT echo the unrecognized argument.
    return {
      ok: false,
      error: `prisma-guard: unsupported or missing command.\n${USAGE}`,
    };
  }

  const label = typeof databaseEnv === 'string' ? databaseEnv.trim() : '';
  if (label === '') {
    return {
      ok: false,
      error:
        'prisma-guard: DATABASE_ENV is not set. Refusing to run.\n' +
        'Add DATABASE_ENV=development to the root .env file (next to ' +
        'DATABASE_URL / DIRECT_URL) once you have confirmed both URLs ' +
        'target the Development branch. See MIGRATION_WORKFLOW.md.',
    };
  }
  if (label !== 'development') {
    // Deliberately does NOT echo the actual value.
    return {
      ok: false,
      error:
        "prisma-guard: DATABASE_ENV is set but is not 'development'. " +
        'This guard only ever runs against the Development database; ' +
        'Production migration execution is a separate, manually approved ' +
        'procedure (MIGRATION_WORKFLOW.md, Production section). Refusing to run.',
    };
  }

  const spec = COMMANDS[command];
  if (!spec.allowExtraArgs) {
    if (extraArgs.length > 0) {
      return {
        ok: false,
        error: `prisma-guard: '${command}' does not accept extra arguments.`,
      };
    }
    return { ok: true, steps: spec.steps.map((s) => [...s]) };
  }

  const validated = validateDevArgs(extraArgs);
  if (validated.error) return { ok: false, error: validated.error };
  return {
    ok: true,
    steps: spec.steps.map((s) => [...s, ...validated.args]),
  };
}

/** Allow only a fixed safelist of `migrate dev` flags. Never echoes the
 *  offending argument (it could be anything, including a pasted URL). */
function validateDevArgs(args) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (DEV_ALLOWED_FLAGS.has(arg)) {
      out.push(arg);
      continue;
    }
    if (arg === '--name') {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) {
        return { error: 'prisma-guard: --name requires a value.' };
      }
      out.push(arg, value);
      i += 1;
      continue;
    }
    if (arg.startsWith('--name=') && arg.length > '--name='.length) {
      out.push(arg);
      continue;
    }
    return {
      ok: false,
      error:
        "prisma-guard: unsupported argument for 'dev'. Allowed: " +
        '--name <name>, --create-only, --skip-generate, --skip-seed.',
    };
  }
  return { args: out };
}

/**
 * Run the decided steps sequentially through an injectable executor,
 * stopping at (and returning) the first non-zero exit code — this is how
 * the child Prisma process's exit status is preserved. `execStep` receives
 * one argument array per step and must resolve to a numeric exit code.
 */
export async function runSteps(steps, execStep) {
  for (const args of steps) {
    // eslint-disable-next-line no-await-in-loop -- steps are ordered on purpose
    const code = await execStep(args);
    if (code !== 0) return code;
  }
  return 0;
}
