/*
 * Sprint 6A (Migration Workflow Guardrails) — unit tests for the migration
 * guard's decision logic (scripts/prisma-guard-core.mjs).
 *
 * Pure logic only: no database connection, no child process, no env-file
 * loading. The exec seam in runSteps is exercised with fakes, which is how
 * exit-code propagation is verified without ever spawning Prisma.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateGuard,
  runSteps,
  SUPPORTED_COMMANDS,
} from '../prisma-guard-core.mjs';

const SENSITIVE =
  'postgresql://real-user:real-secret@ep-real-branch-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';

describe('evaluateGuard — environment label authorization', () => {
  it('allows every supported command when DATABASE_ENV=development', () => {
    for (const command of SUPPORTED_COMMANDS) {
      const result = evaluateGuard({ command, databaseEnv: 'development' });
      expect(result.ok).toBe(true);
      expect(result.steps.length).toBeGreaterThan(0);
    }
  });

  it('maps commands to the expected Prisma argument arrays', () => {
    expect(
      evaluateGuard({ command: 'status', databaseEnv: 'development' }).steps
    ).toEqual([['migrate', 'status']]);
    expect(
      evaluateGuard({ command: 'dev', databaseEnv: 'development' }).steps
    ).toEqual([['migrate', 'dev']]);
    expect(
      evaluateGuard({ command: 'verify', databaseEnv: 'development' }).steps
    ).toEqual([['validate'], ['migrate', 'status']]);
  });

  it('refuses when DATABASE_ENV is missing, empty, or whitespace', () => {
    for (const databaseEnv of [undefined, '', '   ']) {
      const result = evaluateGuard({ command: 'status', databaseEnv });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('DATABASE_ENV is not set');
    }
  });

  it('refuses any label other than exactly "development"', () => {
    for (const databaseEnv of [
      'production',
      'staging',
      'Development', // case-sensitive on purpose
      'development ', // trimmed, still allowed — verify separately below
    ]) {
      if (databaseEnv.trim() === 'development') continue;
      const result = evaluateGuard({ command: 'dev', databaseEnv });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("not 'development'");
    }
  });

  it('accepts a label with surrounding whitespace after trimming', () => {
    const result = evaluateGuard({
      command: 'status',
      databaseEnv: ' development ',
    });
    expect(result.ok).toBe(true);
  });

  it('never echoes the label value in refusal messages', () => {
    const result = evaluateGuard({
      command: 'status',
      databaseEnv: SENSITIVE,
    });
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain(SENSITIVE);
    expect(result.error).not.toContain('neon.tech');
    expect(result.error).not.toContain('real-secret');
  });
});

describe('evaluateGuard — command surface', () => {
  it('rejects unsupported commands without echoing them', () => {
    for (const command of [
      undefined,
      '',
      'deploy',
      'reset',
      'push',
      'resolve',
      SENSITIVE,
    ]) {
      const result = evaluateGuard({ command, databaseEnv: 'development' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('unsupported or missing command');
      expect(result.error).not.toContain(SENSITIVE);
    }
  });

  it('exposes exactly the three supported commands', () => {
    expect([...SUPPORTED_COMMANDS].sort()).toEqual(['dev', 'status', 'verify']);
  });

  it('rejects extra arguments on status and verify', () => {
    for (const command of ['status', 'verify']) {
      const result = evaluateGuard({
        command,
        extraArgs: ['--schema', 'elsewhere.prisma'],
        databaseEnv: 'development',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('does not accept extra arguments');
    }
  });

  it('forwards only safelisted dev flags', () => {
    const ok = evaluateGuard({
      command: 'dev',
      extraArgs: ['--create-only', '--name', 'add_field', '--skip-generate'],
      databaseEnv: 'development',
    });
    expect(ok.ok).toBe(true);
    expect(ok.steps).toEqual([
      ['migrate', 'dev', '--create-only', '--name', 'add_field', '--skip-generate'],
    ]);

    const okEquals = evaluateGuard({
      command: 'dev',
      extraArgs: ['--name=add_field'],
      databaseEnv: 'development',
    });
    expect(okEquals.ok).toBe(true);
    expect(okEquals.steps).toEqual([['migrate', 'dev', '--name=add_field']]);
  });

  it('rejects non-safelisted dev flags (incl. --schema) without echoing them', () => {
    for (const extraArgs of [
      ['--schema', 'other.prisma'],
      ['--force'],
      [SENSITIVE],
      ['--name'], // missing value
    ]) {
      const result = evaluateGuard({
        command: 'dev',
        extraArgs,
        databaseEnv: 'development',
      });
      expect(result.ok).toBe(false);
      expect(result.error).not.toContain(SENSITIVE);
      expect(result.error).not.toContain('other.prisma');
    }
  });
});

describe('runSteps — exit-code propagation through the exec seam', () => {
  it('runs steps in order and returns 0 when all succeed', async () => {
    const seen = [];
    const code = await runSteps(
      [['validate'], ['migrate', 'status']],
      async (args) => {
        seen.push(args);
        return 0;
      }
    );
    expect(code).toBe(0);
    expect(seen).toEqual([['validate'], ['migrate', 'status']]);
  });

  it('stops at the first failure and propagates its exit code', async () => {
    const seen = [];
    const code = await runSteps(
      [['validate'], ['migrate', 'status']],
      async (args) => {
        seen.push(args);
        return args[0] === 'validate' ? 1 : 0;
      }
    );
    expect(code).toBe(1);
    expect(seen).toEqual([['validate']]); // second step never ran
  });

  it('propagates arbitrary non-zero child exit codes unchanged', async () => {
    const code = await runSteps([['migrate', 'status']], async () => 130);
    expect(code).toBe(130);
  });
});
