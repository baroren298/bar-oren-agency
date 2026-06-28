#!/usr/bin/env node
/*
 * Migration Day importer — maps data/talent/index.js (+ data/collaborations.js)
 * into the normalized Section 3 model (Talent/TalentVersion/TalentSocial/
 * TalentGalleryImage/ImageAsset, plus Entity/EntityVersion for
 * collaborations). Design: MIGRATION_DAY_IMPORTER_DESIGN.md — read that
 * file first; this script implements it section-by-section and the
 * comments below point back at the relevant section numbers.
 *
 * THIS IS A REUSABLE TOOL, NOT A ONE-SHOT SCRIPT. Four modes, selected with
 * --mode (default "dry-run"):
 *
 *   dry-run   reads + validates + diffs against the database, writes nothing.
 *             Default. Running this file with NO arguments is always safe.
 *   create    inserts talents/images/socials/gallery rows that don't exist
 *             yet. Never modifies an existing Talent's published content.
 *   sync      makes the database match data/talent/index.js: creates new
 *             talents, supersedes changed TalentVersion/TalentSocial/
 *             TalentGalleryImage rows with a fresh PUBLISHED row (never
 *             mutates a published row in place), archives rows whose source
 *             entry was removed. Converges — running it twice with no
 *             source changes between runs writes nothing on the second run.
 *   reset     dev/staging only. Deletes everything this tool has ever
 *             created (tracked in scripts/.migration-day-import.manifest.json)
 *             and re-creates from a clean slate. Hard-blocked under
 *             NODE_ENV=production, no override.
 *
 * Writing to the database additionally requires --commit on top of --mode.
 * --mode=create|sync|reset WITHOUT --commit only computes and prints what
 * that mode would do. There is no single flag that writes data.
 *
 *   node scripts/migrate-day-import.mjs                       # dry-run, safe
 *   node scripts/migrate-day-import.mjs --mode=sync            # preview only
 *   node scripts/migrate-day-import.mjs --mode=create --commit # writes
 *   node scripts/migrate-day-import.mjs --mode=sync --commit
 *   node scripts/migrate-day-import.mjs --mode=reset --commit --confirm-reset
 *
 * OUT OF SCOPE FOR THIS SPRINT (per MIGRATION_DAY_IMPORTER_DESIGN.md Section
 * 2): SiteContent / Seo / LegalPage import from data/site.js. That file is
 * intentionally never read by this script. Importing it is a separate,
 * smaller script reusing this one's connection/report/mode pattern — not
 * bolted onto this one. Collaborations ARE handled (Section 8), since
 * data/collaborations.js is small and the "skip placeholders" rule is part
 * of this sprint's explicit requirements.
 *
 * Same reason as scripts/create-owner.mjs / scripts/seed-dev-talent.mjs for
 * being a plain .mjs file that doesn't import lib/admin/*: this project has
 * no "type": "module" in package.json, so lib/admin/*'s import/export
 * syntax can't be loaded by a bare Node script. Enum string values below are
 * duplicated from prisma/schema.prisma by hand — keep them in sync if the
 * schema's enums change.
 *
 * data/talent/index.js and data/collaborations.js have the same problem:
 * they're plain `.js` files that use `export const ...`, which Node's
 * default CommonJS interpretation of `.js` (no project-wide "type" field)
 * cannot parse. Rather than changing package.json's "type" field (rejected
 * for the same reason create-owner.mjs gives — that's a project-wide
 * change for the sake of one script) or adding a bundler dependency, this
 * script reads those two specific, trusted, first-party files as text,
 * strips the `export` keyword, and evaluates the result in an isolated
 * `vm` context with no `require`/`fs`/network access. This is a narrow,
 * one-purpose loader for these two known-shape files — not a general
 * transpiler, and never run against anything other than this repo's own
 * data/*.js files.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const MANIFEST_PATH = resolve(__dirname, '.migration-day-import.manifest.json');

// ── Enums — mirrors prisma/schema.prisma string-for-string (see file header). ──
const VERSION_STATUS = { PUBLISHED: 'PUBLISHED', SUPERSEDED: 'SUPERSEDED' };
const LIFECYCLE_STATUS = { ACTIVE: 'ACTIVE', ARCHIVED: 'ARCHIVED' };
const KNOWN_SOCIAL_LABELS = ['MAIN', 'SECONDARY', 'SPAM', 'BRAND', 'PERSONAL'];

// Section 8: data/collaborations.js's unfilled-in entries are this literal
// placeholder string. Anything else is treated as real data.
const PLACEHOLDER_COLLAB_PATTERN = /^brand name$/i;

// ─────────────────────────────────────────────────────────────────────────
// Env / CLI plumbing (same pattern as create-owner.mjs / seed-dev-talent.mjs)
// ─────────────────────────────────────────────────────────────────────────

function loadEnvFile(filename) {
  const path = resolve(projectRoot, filename);
  if (!existsSync(path)) return;
  const contents = readFileSync(path, 'utf8');
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
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

loadEnvFile('.env.local');
loadEnvFile('.env');

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

/**
 * Defense in depth: maskDbUrl() is the only place this script *intends* to
 * print connection info, but driver/engine errors (auth failures,
 * malformed-URL errors, etc.) can sometimes echo a raw connection string
 * back inside err.message. Every place an arbitrary error message reaches
 * the console or the JSON report is passed through this first, so there is
 * no code path — intentional or via a third-party error message — that can
 * print real DATABASE_URL credentials.
 */
function redactSecrets(text) {
  if (text == null) return text;
  return String(text).replace(/(postgres(?:ql)?:\/\/)([^@/\s]+)@/gi, '$1***:***@');
}

function maskDbUrl(url) {
  if (!url) return '(unset)';
  try {
    const u = new URL(url);
    return `${u.protocol}//***:***@${u.host}${u.pathname}`;
  } catch {
    return '(unparseable)';
  }
}

function printUsage() {
  console.log(`Usage: node scripts/migrate-day-import.mjs [options]

  --mode=dry-run|create|sync|reset   Default: dry-run (always safe, never writes)
  --commit                           Required, on top of --mode, to write anything
  --owner-email=<email>              Attribute created/approved rows to this Owner
  --report-path=<file>               Also write the end-of-run report as JSON
  --confirm-production               Required for create/sync --commit when NODE_ENV=production
  --confirm-reset                    Required for reset --commit (reset is also
                                      hard-blocked outright when NODE_ENV=production)
  --help                             Show this message

See MIGRATION_DAY_IMPORTER_DESIGN.md for the full design this implements.`);
}

// ─────────────────────────────────────────────────────────────────────────
// Narrow loader for data/talent/index.js and data/collaborations.js —
// see file header for why this exists instead of a normal import().
// ─────────────────────────────────────────────────────────────────────────

function loadPlainDataModule(absolutePath, exportNames) {
  const source = readFileSync(absolutePath, 'utf8');
  const transformed = source.replace(
    /^export\s+(const|function|async function|let|var)\s+/gm,
    '$1 ',
  );
  const wrapped = `${transformed}\n;({ ${exportNames.join(', ')} });`;
  const script = new vm.Script(wrapped, { filename: absolutePath });
  const sandbox = { console, Date, Math, JSON, RegExp, Array, Object, String, Number, Boolean };
  const context = vm.createContext(sandbox);
  return script.runInContext(context);
}

// ─────────────────────────────────────────────────────────────────────────
// Section 2 / 4: image path resolution
// ─────────────────────────────────────────────────────────────────────────

function publicImagePath(rootRelativePath) {
  return resolve(projectRoot, 'public', rootRelativePath.replace(/^\//, ''));
}

function imageExistsOnDisk(rootRelativePath) {
  return existsSync(publicImagePath(rootRelativePath));
}

/**
 * Resolves a source image path against the in-memory index of existing
 * ImageAsset rows (built once at start from the database, read-only).
 * Returns { mappedId, missing }:
 *   - mappedId === null, missing: true    -> file doesn't exist on disk
 *   - mappedId === null, missing: false   -> no image referenced (path was null)
 *   - mappedId === '__NEW__'              -> file exists, no ImageAsset yet
 *   - mappedId === '<cuid>'               -> file exists, already has an ImageAsset
 */
function resolveImageRef(path, assetIndex, missingList, slug, field) {
  if (!path) return { mappedId: null, missing: false };
  if (!imageExistsOnDisk(path)) {
    missingList.push({ slug, field, path });
    return { mappedId: null, missing: true };
  }
  const existingId = assetIndex.get(path);
  return { mappedId: existingId ?? '__NEW__', missing: false };
}

/** Only ever called from the write path (mode=create|sync, --commit). */
async function ensureImageAssetByPath(tx, path, ownerId, assetIndex, reverseAssetIndex, manifest) {
  if (!path || !imageExistsOnDisk(path)) return null;
  const existingId = assetIndex.get(path);
  if (existingId) return existingId;
  const created = await tx.asset.create({
    data: { blobUrl: path, uploadedById: ownerId, status: LIFECYCLE_STATUS.ACTIVE },
  });
  assetIndex.set(path, created.id);
  reverseAssetIndex.set(created.id, path);
  manifest.imageAssetIds.push(created.id);
  return created.id;
}

// ─────────────────────────────────────────────────────────────────────────
// Section 6 / 7: mapping data/talent/index.js -> TalentSocial / podcast / scalar fields
// ─────────────────────────────────────────────────────────────────────────

function normalizeText(value) {
  if (value == null) return null;
  return value.trim();
}

function parseHandleFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const segment = u.pathname.split('/').filter(Boolean)[0];
    return segment ? `@${segment}` : null;
  } catch {
    return null;
  }
}

function guessPlatformFromExtra(extra) {
  const text = `${extra.url || ''} ${extra.label || ''} ${extra.displayLabel || ''}`.toLowerCase();
  if (text.includes('instagram')) return 'INSTAGRAM';
  if (text.includes('tiktok')) return 'TIKTOK';
  if (text.includes('youtube')) return 'YOUTUBE';
  if (text.includes('facebook')) return 'FACEBOOK';
  if (text.includes('threads')) return 'THREADS';
  // Unknown platform link — WEBSITE is the controlled-enum escape hatch for
  // "some URL, not one of the named platforms" rather than guessing wrong.
  return 'WEBSITE';
}

/** Section 6: displayLabel -> SocialAccountLabel enum, OTHER as the escape hatch. */
function mapDisplayLabelToEnum(displayLabel) {
  if (!displayLabel) return { value: 'OTHER', custom: null };
  const norm = displayLabel.trim().toUpperCase();
  if (KNOWN_SOCIAL_LABELS.includes(norm)) return { value: norm, custom: null };
  return { value: 'OTHER', custom: displayLabel.trim() };
}

function socialKey(row) {
  return row.label === 'OTHER' ? `${row.platform}::OTHER::${row.customLabel}` : `${row.platform}::${row.label}`;
}

/** Section 6 — one row per main platform field + one per extraSocials entry. */
function buildSourceSocials(talent) {
  const rows = [];
  const followers = talent.followers || {};
  for (const platform of ['instagram', 'tiktok', 'youtube']) {
    const url = talent[platform];
    if (!url) continue;
    rows.push({
      platform: platform.toUpperCase(),
      label: 'MAIN',
      customLabel: null,
      url,
      handle: parseHandleFromUrl(url),
      followerCount: followers[platform] ?? null,
      sortOrder: null,
    });
  }
  for (const extra of talent.extraSocials || []) {
    const platform = guessPlatformFromExtra(extra);
    const label = mapDisplayLabelToEnum(extra.displayLabel || extra.label);
    rows.push({
      platform,
      label: label.value,
      customLabel: label.custom,
      url: extra.url,
      handle: parseHandleFromUrl(extra.url),
      // Section 6: source followers{} is keyed by platform, not by account —
      // a secondary account never gets a follower count from this importer.
      followerCount: null,
      sortOrder: null,
    });
  }
  return rows;
}

/** Section 4 — gallery[] entries (string or {src, position, scale}) + galleryMobileOrder[]. */
function buildSourceGallery(talent) {
  const gallery = talent.gallery || [];
  const mobileOrder = talent.galleryMobileOrder || [];
  return gallery.map((entry, index) => {
    const isObj = typeof entry === 'object' && entry !== null;
    const src = isObj ? entry.src : entry;
    return {
      src,
      order: index,
      position: isObj ? entry.position ?? null : null,
      scale: isObj ? entry.scale ?? null : null,
      mobileOrder: mobileOrder[index] ?? null,
      altHe: null,
      altEn: null,
    };
  });
}

/** Section 7 — podcast block; only michal-ben-david has one today. */
function buildSourcePodcast(talent) {
  if (!talent.podcast) {
    return { podcastTitle: null, podcastDescriptionHe: null, podcastDescriptionEn: null, podcastImagePath: null, podcastVideoEmbedUrl: null };
  }
  return {
    podcastTitle: talent.podcast.title ?? null,
    podcastDescriptionHe: normalizeText(talent.podcast.description),
    podcastDescriptionEn: normalizeText(talent.podcast.descriptionEn),
    podcastImagePath: talent.podcast.image ?? null,
    podcastVideoEmbedUrl: talent.podcast.videoEmbedUrl ?? null,
  };
}

/** Section 5 — scalar TalentVersion fields (image *paths*, not asset ids yet). */
function buildVersionScalarFields(talent) {
  const podcast = buildSourcePodcast(talent);
  return {
    name: talent.name,
    nameEn: talent.nameEn ?? null,
    category: talent.category ?? [],
    tags: talent.tags ?? [],
    featured: Boolean(talent.featured),
    featuredOrder: talent.featuredOrder ?? null,
    sortOrder: talent.sortOrder ?? null,
    location: talent.location ?? null,
    locationEn: talent.locationEn ?? null,
    birthDate: talent.birthDate ? new Date(talent.birthDate) : null,
    bioHe: normalizeText(talent.bioHe),
    bioEn: normalizeText(talent.bioEn),
    profileImagePath: talent.profileImage ?? null,
    profileImagePosition: talent.imagePosition ?? null,
    // No source field for this today (Section 5) — always null on import.
    profileImageScale: null,
    ...podcast,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Section 3.3 — diff engine shared by dry-run and sync
// ─────────────────────────────────────────────────────────────────────────

function diffVersionFields(existingVersion, mapped, profileRef, podcastRef) {
  if (!existingVersion) return { changed: true, diffs: [{ field: '(new talent)' }] };

  const diffs = [];
  const compare = (field, a, b) => {
    if (Array.isArray(a) || Array.isArray(b)) {
      if (JSON.stringify(a ?? []) !== JSON.stringify(b ?? [])) diffs.push({ field, from: a, to: b });
      return;
    }
    if (a instanceof Date || b instanceof Date) {
      const at = a ? new Date(a).getTime() : null;
      const bt = b ? new Date(b).getTime() : null;
      if (at !== bt) diffs.push({ field, from: a, to: b });
      return;
    }
    if ((a ?? null) !== (b ?? null)) diffs.push({ field, from: a ?? null, to: b ?? null });
  };

  compare('name', existingVersion.name, mapped.name);
  compare('nameEn', existingVersion.nameEn, mapped.nameEn);
  compare('category', existingVersion.category, mapped.category);
  compare('tags', existingVersion.tags, mapped.tags);
  compare('featured', existingVersion.featured, mapped.featured);
  compare('featuredOrder', existingVersion.featuredOrder, mapped.featuredOrder);
  compare('sortOrder', existingVersion.sortOrder, mapped.sortOrder);
  compare('location', existingVersion.location, mapped.location);
  compare('locationEn', existingVersion.locationEn, mapped.locationEn);
  compare('birthDate', existingVersion.birthDate, mapped.birthDate);
  compare('bioHe', existingVersion.bioHe, mapped.bioHe);
  compare('bioEn', existingVersion.bioEn, mapped.bioEn);
  compare('profileImagePosition', existingVersion.profileImagePosition, mapped.profileImagePosition);
  compare('profileImageScale', existingVersion.profileImageScale, mapped.profileImageScale);
  compare('podcastTitle', existingVersion.podcastTitle, mapped.podcastTitle);
  compare('podcastDescriptionHe', existingVersion.podcastDescriptionHe, mapped.podcastDescriptionHe);
  compare('podcastDescriptionEn', existingVersion.podcastDescriptionEn, mapped.podcastDescriptionEn);
  compare('podcastVideoEmbedUrl', existingVersion.podcastVideoEmbedUrl, mapped.podcastVideoEmbedUrl);

  // Section 4: a missing-on-disk image is reported separately and never
  // treated as "the importer wants to change this field" — there's nothing
  // it could resolve the field to.
  if (!profileRef.missing && existingVersion.profileImageAssetId !== profileRef.mappedId) {
    diffs.push({ field: 'profileImageAssetId', from: existingVersion.profileImageAssetId, to: profileRef.mappedId });
  }
  if (!podcastRef.missing && existingVersion.podcastImageAssetId !== podcastRef.mappedId) {
    diffs.push({ field: 'podcastImageAssetId', from: existingVersion.podcastImageAssetId, to: podcastRef.mappedId });
  }

  return { changed: diffs.length > 0, diffs };
}

function diffSocials(existingRows, sourceRows) {
  const existingByKey = new Map(existingRows.filter((r) => r.versionStatus === VERSION_STATUS.PUBLISHED).map((r) => [socialKey(r), r]));
  const sourceByKey = new Map(sourceRows.map((r) => [socialKey(r), r]));

  const toCreate = [];
  const toSupersede = [];
  const toArchive = [];
  const unchanged = [];

  for (const [key, src] of sourceByKey) {
    const existing = existingByKey.get(key);
    if (!existing || existing.lifecycleStatus === LIFECYCLE_STATUS.ARCHIVED) {
      toCreate.push(src);
      continue;
    }
    const changed =
      (existing.url ?? null) !== (src.url ?? null) ||
      (existing.handle ?? null) !== (src.handle ?? null) ||
      (existing.followerCount ?? null) !== (src.followerCount ?? null) ||
      (existing.customLabel ?? null) !== (src.customLabel ?? null);
    if (changed) toSupersede.push({ existing, next: src });
    else unchanged.push(src);
  }
  for (const [key, existing] of existingByKey) {
    if (!sourceByKey.has(key) && existing.lifecycleStatus === LIFECYCLE_STATUS.ACTIVE) toArchive.push(existing);
  }

  return { toCreate, toSupersede, toArchive, unchanged, hasChanges: toCreate.length + toSupersede.length + toArchive.length > 0 };
}

function diffGallery(existingRows, sourceRows, reverseAssetIndex) {
  const existingByKey = new Map(
    existingRows
      .filter((r) => r.versionStatus === VERSION_STATUS.PUBLISHED)
      .map((r) => [reverseAssetIndex.get(r.imageAssetId) ?? r.imageAssetId, r]),
  );
  const sourceByKey = new Map(sourceRows.map((r) => [r.src, r]));

  const toCreate = [];
  const toSupersede = [];
  const toArchive = [];
  const unchanged = [];

  for (const [key, src] of sourceByKey) {
    const existing = existingByKey.get(key);
    if (!existing || existing.lifecycleStatus === LIFECYCLE_STATUS.ARCHIVED) {
      toCreate.push(src);
      continue;
    }
    const changed =
      existing.order !== src.order ||
      (existing.position ?? null) !== (src.position ?? null) ||
      (existing.scale ?? null) !== (src.scale ?? null) ||
      (existing.mobileOrder ?? null) !== (src.mobileOrder ?? null);
    if (changed) toSupersede.push({ existing, next: src });
    else unchanged.push(src);
  }
  for (const [key, existing] of existingByKey) {
    if (!sourceByKey.has(key) && existing.lifecycleStatus === LIFECYCLE_STATUS.ACTIVE) toArchive.push(existing);
  }

  return { toCreate, toSupersede, toArchive, unchanged, hasChanges: toCreate.length + toSupersede.length + toArchive.length > 0 };
}

// ─────────────────────────────────────────────────────────────────────────
// Section 5/6: per-talent plan (read-only — no writes happen here)
// ─────────────────────────────────────────────────────────────────────────

function planTalent({ talent, mode, existingTalent, assetIndex, reverseAssetIndex, missingImages }) {
  const mappedScalar = buildVersionScalarFields(talent);
  const profileRef = resolveImageRef(mappedScalar.profileImagePath, assetIndex, missingImages, talent.slug, 'profileImage');
  const podcastRef = resolveImageRef(mappedScalar.podcastImagePath, assetIndex, missingImages, talent.slug, 'podcast.image');
  const sourceSocials = buildSourceSocials(talent);
  const sourceGallery = buildSourceGallery(talent);
  // Resolve gallery image refs too, purely so missing files are reported
  // even for talents that otherwise have no other change.
  for (const g of sourceGallery) {
    resolveImageRef(g.src, assetIndex, missingImages, talent.slug, `gallery[${g.order}]`);
  }

  const base = { slug: talent.slug, mappedScalar, profileRef, podcastRef, sourceSocials, sourceGallery };

  if (!existingTalent) {
    return { ...base, action: 'create' };
  }
  if (mode === 'create') {
    return { ...base, action: 'skip-existing' };
  }

  // sync or dry-run: compute the full diff.
  const versionDiff = diffVersionFields(existingTalent.currentPublishedVersion, mappedScalar, profileRef, podcastRef);
  const socialsDiff = diffSocials(existingTalent.socials, sourceSocials);
  const galleryDiff = diffGallery(existingTalent.galleryImages, sourceGallery, reverseAssetIndex);
  const changed = versionDiff.changed || socialsDiff.hasChanges || galleryDiff.hasChanges;

  return { ...base, action: changed ? 'update' : 'unchanged', versionDiff, socialsDiff, galleryDiff, existingTalent };
}

// ─────────────────────────────────────────────────────────────────────────
// Write path — only ever invoked when commitWrites === true
// ─────────────────────────────────────────────────────────────────────────

async function applySocialDiff(tx, talentId, diff, ownerId, manifest, now) {
  for (const social of diff.toCreate) {
    const row = await tx.talentSocial.create({
      data: {
        talentId, platform: social.platform, label: social.label, customLabel: social.customLabel,
        handle: social.handle, url: social.url, followerCount: social.followerCount, sortOrder: social.sortOrder,
        lifecycleStatus: LIFECYCLE_STATUS.ACTIVE, versionStatus: VERSION_STATUS.PUBLISHED,
        createdById: ownerId, approvedById: ownerId, approvedAt: now,
      },
    });
    manifest.talentSocialIds.push(row.id);
  }
  for (const { existing, next } of diff.toSupersede) {
    await tx.talentSocial.update({ where: { id: existing.id }, data: { versionStatus: VERSION_STATUS.SUPERSEDED } });
    const row = await tx.talentSocial.create({
      data: {
        talentId, platform: next.platform, label: next.label, customLabel: next.customLabel,
        handle: next.handle, url: next.url, followerCount: next.followerCount, sortOrder: next.sortOrder,
        lifecycleStatus: LIFECYCLE_STATUS.ACTIVE, versionStatus: VERSION_STATUS.PUBLISHED,
        basedOnVersionId: existing.id, createdById: ownerId, approvedById: ownerId, approvedAt: now,
      },
    });
    manifest.talentSocialIds.push(row.id);
  }
  for (const existing of diff.toArchive) {
    await tx.talentSocial.update({ where: { id: existing.id }, data: { lifecycleStatus: LIFECYCLE_STATUS.ARCHIVED } });
  }
}

async function applyGalleryDiff(tx, talentId, diff, ownerId, manifest, assetIndex, reverseAssetIndex) {
  for (const g of diff.toCreate) {
    const imageAssetId = await ensureImageAssetByPath(tx, g.src, ownerId, assetIndex, reverseAssetIndex, manifest);
    if (!imageAssetId) continue; // missing on disk — already reported
    const row = await tx.talentGalleryImage.create({
      data: {
        talentId, imageAssetId, order: g.order, altHe: g.altHe, altEn: g.altEn,
        position: g.position, scale: g.scale, mobileOrder: g.mobileOrder,
        lifecycleStatus: LIFECYCLE_STATUS.ACTIVE, versionStatus: VERSION_STATUS.PUBLISHED,
      },
    });
    manifest.talentGalleryImageIds.push(row.id);
  }
  for (const { existing, next } of diff.toSupersede) {
    await tx.talentGalleryImage.update({ where: { id: existing.id }, data: { versionStatus: VERSION_STATUS.SUPERSEDED } });
    const imageAssetId = await ensureImageAssetByPath(tx, next.src, ownerId, assetIndex, reverseAssetIndex, manifest);
    if (!imageAssetId) continue;
    const row = await tx.talentGalleryImage.create({
      data: {
        talentId, imageAssetId, order: next.order, altHe: next.altHe, altEn: next.altEn,
        position: next.position, scale: next.scale, mobileOrder: next.mobileOrder,
        lifecycleStatus: LIFECYCLE_STATUS.ACTIVE, versionStatus: VERSION_STATUS.PUBLISHED,
        basedOnVersionId: existing.id,
      },
    });
    manifest.talentGalleryImageIds.push(row.id);
  }
  for (const existing of diff.toArchive) {
    await tx.talentGalleryImage.update({ where: { id: existing.id }, data: { lifecycleStatus: LIFECYCLE_STATUS.ARCHIVED } });
  }
}

/** Section 5 — brand-new Talent + first Published TalentVersion. */
async function createTalent(tx, plan, ownerId, manifest, assetIndex, reverseAssetIndex) {
  const now = new Date();
  const talent = await tx.talent.create({ data: { slug: plan.slug, status: 'ACTIVE' } });
  manifest.talentIds.push(talent.id);

  const profileImageAssetId = await ensureImageAssetByPath(tx, plan.mappedScalar.profileImagePath, ownerId, assetIndex, reverseAssetIndex, manifest);
  const podcastImageAssetId = await ensureImageAssetByPath(tx, plan.mappedScalar.podcastImagePath, ownerId, assetIndex, reverseAssetIndex, manifest);

  const version = await tx.talentVersion.create({
    data: {
      talentId: talent.id, status: VERSION_STATUS.PUBLISHED,
      name: plan.mappedScalar.name, nameEn: plan.mappedScalar.nameEn,
      category: plan.mappedScalar.category, tags: plan.mappedScalar.tags,
      featured: plan.mappedScalar.featured, featuredOrder: plan.mappedScalar.featuredOrder,
      sortOrder: plan.mappedScalar.sortOrder, location: plan.mappedScalar.location,
      locationEn: plan.mappedScalar.locationEn, birthDate: plan.mappedScalar.birthDate,
      bioHe: plan.mappedScalar.bioHe, bioEn: plan.mappedScalar.bioEn,
      profileImageAssetId, profileImagePosition: plan.mappedScalar.profileImagePosition,
      profileImageScale: plan.mappedScalar.profileImageScale,
      podcastTitle: plan.mappedScalar.podcastTitle, podcastDescriptionHe: plan.mappedScalar.podcastDescriptionHe,
      podcastDescriptionEn: plan.mappedScalar.podcastDescriptionEn, podcastImageAssetId,
      podcastVideoEmbedUrl: plan.mappedScalar.podcastVideoEmbedUrl,
      createdById: ownerId, approvedById: ownerId, approvedAt: now,
    },
  });
  manifest.talentVersionIds.push(version.id);

  await applySocialDiff(tx, talent.id, { toCreate: plan.sourceSocials, toSupersede: [], toArchive: [] }, ownerId, manifest, now);
  await applyGalleryDiff(tx, talent.id, { toCreate: plan.sourceGallery, toSupersede: [], toArchive: [] }, ownerId, manifest, assetIndex, reverseAssetIndex);

  await tx.talent.update({ where: { id: talent.id }, data: { currentPublishedVersionId: version.id } });
  return { talent, version };
}

/** Section 3.3 — existing Talent whose mapped shape changed under `sync`. */
async function syncTalent(tx, plan, ownerId, manifest, assetIndex, reverseAssetIndex) {
  const now = new Date();
  const existingTalent = plan.existingTalent;
  const oldVersion = existingTalent.currentPublishedVersion;

  const profileImageAssetId = await ensureImageAssetByPath(tx, plan.mappedScalar.profileImagePath, ownerId, assetIndex, reverseAssetIndex, manifest);
  const podcastImageAssetId = await ensureImageAssetByPath(tx, plan.mappedScalar.podcastImagePath, ownerId, assetIndex, reverseAssetIndex, manifest);

  let newVersion = oldVersion;
  if (plan.versionDiff.changed) {
    await tx.talentVersion.update({ where: { id: oldVersion.id }, data: { status: VERSION_STATUS.SUPERSEDED } });
    newVersion = await tx.talentVersion.create({
      data: {
        talentId: existingTalent.id, status: VERSION_STATUS.PUBLISHED, basedOnVersionId: oldVersion.id,
        basedOnRevisionNumber: existingTalent.revisionNumber,
        name: plan.mappedScalar.name, nameEn: plan.mappedScalar.nameEn,
        category: plan.mappedScalar.category, tags: plan.mappedScalar.tags,
        featured: plan.mappedScalar.featured, featuredOrder: plan.mappedScalar.featuredOrder,
        sortOrder: plan.mappedScalar.sortOrder, location: plan.mappedScalar.location,
        locationEn: plan.mappedScalar.locationEn, birthDate: plan.mappedScalar.birthDate,
        bioHe: plan.mappedScalar.bioHe, bioEn: plan.mappedScalar.bioEn,
        profileImageAssetId, profileImagePosition: plan.mappedScalar.profileImagePosition,
        profileImageScale: plan.mappedScalar.profileImageScale,
        podcastTitle: plan.mappedScalar.podcastTitle, podcastDescriptionHe: plan.mappedScalar.podcastDescriptionHe,
        podcastDescriptionEn: plan.mappedScalar.podcastDescriptionEn, podcastImageAssetId,
        podcastVideoEmbedUrl: plan.mappedScalar.podcastVideoEmbedUrl,
        createdById: ownerId, approvedById: ownerId, approvedAt: now,
      },
    });
    manifest.talentVersionIds.push(newVersion.id);
    await tx.talent.update({
      where: { id: existingTalent.id },
      data: { currentPublishedVersionId: newVersion.id, revisionNumber: { increment: 1 } },
    });
  }

  await applySocialDiff(tx, existingTalent.id, plan.socialsDiff, ownerId, manifest, now);
  await applyGalleryDiff(tx, existingTalent.id, plan.galleryDiff, ownerId, manifest, assetIndex, reverseAssetIndex);

  return { talent: existingTalent, version: newVersion };
}

// ─────────────────────────────────────────────────────────────────────────
// Section 8 — collaborations (placeholder skip)
// ─────────────────────────────────────────────────────────────────────────

function planCollaborations(collaborations, existingEntity) {
  const real = collaborations.filter((c) => typeof c === 'string' && c.trim() && !PLACEHOLDER_COLLAB_PATTERN.test(c.trim()));
  const skipped = collaborations.length - real.length;

  if (real.length === 0) {
    return { action: 'skip-all', skipped, real: [] };
  }

  const existingContent = existingEntity?.currentPublishedVersion?.content ?? null;
  const changed = JSON.stringify(existingContent) !== JSON.stringify(real);

  if (!existingEntity) return { action: 'create', skipped, real };
  if (changed) return { action: 'update', skipped, real, existingEntity };
  return { action: 'unchanged', skipped, real };
}

async function createCollaborationsEntity(tx, plan, ownerId, manifest) {
  const now = new Date();
  const entity = await tx.entity.create({ data: { entityType: 'COLLABORATIONS', entityId: null, status: 'ACTIVE' } });
  const version = await tx.entityVersion.create({
    data: { entityId: entity.id, status: VERSION_STATUS.PUBLISHED, content: plan.real, createdById: ownerId, approvedById: ownerId, approvedAt: now },
  });
  await tx.entity.update({ where: { id: entity.id }, data: { currentPublishedVersionId: version.id } });
  manifest.collaborationsEntityId = entity.id;
  manifest.entityVersionIds = manifest.entityVersionIds || [];
  manifest.entityVersionIds.push(version.id);
}

async function syncCollaborationsEntity(tx, plan, ownerId, manifest) {
  const now = new Date();
  const entity = plan.existingEntity;
  const oldVersion = entity.currentPublishedVersion;
  if (oldVersion) await tx.entityVersion.update({ where: { id: oldVersion.id }, data: { status: VERSION_STATUS.SUPERSEDED } });
  const version = await tx.entityVersion.create({
    data: {
      entityId: entity.id, status: VERSION_STATUS.PUBLISHED, basedOnVersionId: oldVersion?.id ?? null,
      content: plan.real, createdById: ownerId, approvedById: ownerId, approvedAt: now,
    },
  });
  await tx.entity.update({ where: { id: entity.id }, data: { currentPublishedVersionId: version.id, revisionNumber: { increment: 1 } } });
  manifest.entityVersionIds = manifest.entityVersionIds || [];
  manifest.entityVersionIds.push(version.id);
}

// ─────────────────────────────────────────────────────────────────────────
// Manifest (Section 3.4) — bookkeeping for `reset`. Never read/written
// outside create|sync --commit and reset.
// ─────────────────────────────────────────────────────────────────────────

function emptyManifest() {
  return { talentIds: [], talentVersionIds: [], talentSocialIds: [], talentGalleryImageIds: [], imageAssetIds: [], entityVersionIds: [], collaborationsEntityId: null };
}

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return emptyManifest();
  try {
    return { ...emptyManifest(), ...JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) };
  } catch {
    console.warn('[migrate-day-import] Manifest file exists but could not be parsed — treating as empty.');
    return emptyManifest();
  }
}

function writeManifest(manifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function executeReset(prisma, manifest) {
  if (manifest.talentIds.length) {
    await prisma.talent.updateMany({ where: { id: { in: manifest.talentIds } }, data: { currentPublishedVersionId: null } });
  }
  if (manifest.talentGalleryImageIds.length) await prisma.talentGalleryImage.deleteMany({ where: { id: { in: manifest.talentGalleryImageIds } } });
  if (manifest.talentSocialIds.length) await prisma.talentSocial.deleteMany({ where: { id: { in: manifest.talentSocialIds } } });
  if (manifest.talentVersionIds.length) await prisma.talentVersion.deleteMany({ where: { id: { in: manifest.talentVersionIds } } });
  if (manifest.talentIds.length) await prisma.talent.deleteMany({ where: { id: { in: manifest.talentIds } } });
  for (const id of manifest.imageAssetIds || []) {
    try {
      await prisma.asset.delete({ where: { id } });
    } catch (err) {
      console.warn(`[migrate-day-import] reset: could not delete ImageAsset ${id} (${redactSecrets(err.message)}) — leaving it.`);
    }
  }
  if (manifest.collaborationsEntityId) {
    try {
      await prisma.entity.update({ where: { id: manifest.collaborationsEntityId }, data: { currentPublishedVersionId: null } });
      await prisma.entityVersion.deleteMany({ where: { entityId: manifest.collaborationsEntityId } });
      await prisma.entity.delete({ where: { id: manifest.collaborationsEntityId } });
    } catch (err) {
      console.warn(`[migrate-day-import] reset: could not delete Entity ${manifest.collaborationsEntityId} (${redactSecrets(err.message)}).`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Report (Section 9)
// ─────────────────────────────────────────────────────────────────────────

function newReport(mode, commitWrites) {
  return {
    mode,
    write: commitWrites ? 'committed' : 'preview',
    talents: { created: [], updated: [], unchanged: [], skippedExisting: [] },
    images: { linked: { profile: 0, gallery: 0, podcast: 0 }, deduped: 0, missing: [] },
    socials: { created: 0, updated: 0, archived: 0, labeled: [], followersPresent: 0, followersMissing: 0 },
    gallery: { created: 0, updated: 0, archived: 0 },
    podcast: { talents: [] },
    collaborations: { skippedPlaceholders: 0, real: [], action: 'skip-all' },
    bilingualParity: { missing: [] },
    reset: null,
    errors: [],
  };
}

function recordTalentPlanInReport(report, plan) {
  if (plan.action === 'create') report.talents.created.push(plan.slug);
  else if (plan.action === 'update') report.talents.updated.push(plan.slug);
  else if (plan.action === 'unchanged') report.talents.unchanged.push(plan.slug);
  else if (plan.action === 'skip-existing') report.talents.skippedExisting.push(plan.slug);

  if (plan.action === 'create' || plan.action === 'update') {
    if (plan.profileRef.mappedId === '__NEW__') report.images.linked.profile += 1;
    else if (plan.profileRef.mappedId) report.images.deduped += 1;
    if (plan.podcastRef.mappedId === '__NEW__') report.images.linked.podcast += 1;
    else if (plan.podcastRef.mappedId) report.images.deduped += 1;
    for (const g of plan.sourceGallery) {
      report.images.linked.gallery += 1;
    }
    for (const s of plan.sourceSocials) {
      report.socials.created += 1;
      if (s.label !== 'MAIN') report.socials.labeled.push(`${plan.slug}: ${s.platform.toLowerCase()} -> ${s.label}${s.customLabel ? ` (${s.customLabel})` : ''}`);
      if (s.followerCount != null) report.socials.followersPresent += 1;
      else report.socials.followersMissing += 1;
    }
    if (plan.mappedScalar.podcastTitle) report.podcast.talents.push(plan.slug);
  }

  if (plan.action === 'update' && plan.socialsDiff) {
    report.socials.updated += plan.socialsDiff.toSupersede.length;
    report.socials.archived += plan.socialsDiff.toArchive.length;
    for (const s of plan.socialsDiff.toCreate) {
      if (s.label !== 'MAIN') report.socials.labeled.push(`${plan.slug}: ${s.platform.toLowerCase()} -> ${s.label} (new)`);
    }
  }
  if (plan.action === 'update' && plan.galleryDiff) {
    report.gallery.created += plan.galleryDiff.toCreate.length;
    report.gallery.updated += plan.galleryDiff.toSupersede.length;
    report.gallery.archived += plan.galleryDiff.toArchive.length;
  }
  if (plan.action === 'create') {
    report.gallery.created += plan.sourceGallery.length;
  }

  for (const m of plan.missingImagesForTalent || []) report.images.missing.push(m);
}

function checkBilingualParity(talent) {
  const missingFields = [];
  if (talent.name && !talent.nameEn) missingFields.push('nameEn');
  if (talent.location && !talent.locationEn) missingFields.push('locationEn');
  if (talent.bioHe && !talent.bioEn) missingFields.push('bioEn');
  return missingFields;
}

function printReport(report, args) {
  const lines = [];
  lines.push('');
  lines.push(`Migration Day Import Report — ${new Date().toISOString()}, mode: ${report.mode}, write: ${report.write}`);
  lines.push('');
  lines.push('TALENTS');
  lines.push(`  created:             ${report.talents.created.length}   ${report.talents.created.join(', ')}`);
  lines.push(`  updated (synced):    ${report.talents.updated.length}   ${report.talents.updated.join(', ')}`);
  lines.push(`  unchanged:           ${report.talents.unchanged.length}`);
  lines.push(`  skipped (existing):  ${report.talents.skippedExisting.length}   ${report.talents.skippedExisting.join(', ')}`);
  lines.push('');
  lines.push('IMAGES');
  lines.push(`  linked:              profile ${report.images.linked.profile}, gallery ${report.images.linked.gallery}, podcast ${report.images.linked.podcast}`);
  lines.push(`  deduped (reused):    ${report.images.deduped}`);
  lines.push(`  missing on disk:     ${report.images.missing.length}`);
  for (const m of report.images.missing) lines.push(`    - ${m.slug} / ${m.field}: ${m.path}`);
  lines.push('');
  lines.push('SOCIALS');
  lines.push(`  created:             ${report.socials.created}`);
  lines.push(`  updated (superseded): ${report.socials.updated}`);
  lines.push(`  archived (removed):  ${report.socials.archived}`);
  lines.push(`  labeled non-MAIN:    ${report.socials.labeled.length}`);
  for (const l of report.socials.labeled) lines.push(`    - ${l}`);
  lines.push(`  follower counts:     present ${report.socials.followersPresent} / missing ${report.socials.followersMissing}`);
  lines.push('');
  lines.push('GALLERY IMAGES');
  lines.push(`  created: ${report.gallery.created}  updated: ${report.gallery.updated}  archived: ${report.gallery.archived}`);
  lines.push('');
  lines.push('PODCAST');
  lines.push(`  talents with podcast data: ${report.podcast.talents.length}   ${report.podcast.talents.join(', ')}`);
  lines.push('');
  lines.push('COLLABORATIONS');
  lines.push(`  skipped placeholders: ${report.collaborations.skippedPlaceholders}`);
  lines.push(`  real entries:        ${report.collaborations.real.length} (action: ${report.collaborations.action})`);
  lines.push('');
  lines.push('BILINGUAL PARITY');
  if (report.bilingualParity.missing.length === 0) {
    lines.push('  none');
  } else {
    for (const m of report.bilingualParity.missing) lines.push(`  - ${m.slug}: missing ${m.fields.join(', ')}`);
  }
  if (report.reset) {
    lines.push('');
    lines.push('RESET');
    lines.push(`  rows tracked in manifest: Talent ${report.reset.talentIds}, TalentVersion ${report.reset.talentVersionIds}, TalentSocial ${report.reset.talentSocialIds}, TalentGalleryImage ${report.reset.talentGalleryImageIds}, ImageAsset ${report.reset.imageAssetIds}`);
  }
  lines.push('');
  lines.push('ERRORS');
  lines.push(`  ${report.errors.length}`);
  for (const e of report.errors) lines.push(`    - ${e.slug ?? '(general)'}: ${e.message}`);
  lines.push('');

  const text = lines.join('\n');
  console.log(text);

  if (args['report-path']) {
    writeFileSync(resolve(projectRoot, args['report-path']), JSON.stringify(report, null, 2));
    console.log(`[migrate-day-import] Report also written to ${args['report-path']}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Owner resolution
// ─────────────────────────────────────────────────────────────────────────

async function resolveOwner(prisma, args) {
  if (args['owner-email']) {
    const user = await prisma.user.findUnique({ where: { email: String(args['owner-email']).toLowerCase() } });
    if (!user) throw new Error(`No user found with email "${args['owner-email']}".`);
    if (user.role !== 'OWNER') throw new Error(`User "${args['owner-email']}" is not an Owner (role: ${user.role}).`);
    return user;
  }
  const owners = await prisma.user.findMany({ where: { role: 'OWNER' } });
  if (owners.length === 0) throw new Error('No Owner user found. Run `npm run admin:create-owner` first.');
  if (owners.length > 1) throw new Error('Multiple Owner users found — pass --owner-email=<email> to pick one.');
  return owners[0];
}

// ─────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const mode = args.mode || 'dry-run';
  if (!['dry-run', 'create', 'sync', 'reset'].includes(mode)) {
    console.error(`[migrate-day-import] Unknown --mode="${mode}". Must be one of dry-run, create, sync, reset.`);
    process.exit(1);
  }

  // dry-run NEVER writes, no matter what else is passed — this is the one
  // hard invariant the design calls out explicitly (Section 3.1).
  const commitWrites = mode !== 'dry-run' && Boolean(args.commit);

  if (!process.env.DATABASE_URL) {
    console.error('[migrate-day-import] DATABASE_URL is not set. Set it in .env.local and re-run.');
    process.exit(1);
  }

  if (mode === 'reset') {
    if (process.env.NODE_ENV === 'production') {
      console.error('[migrate-day-import] --mode=reset is blocked outright when NODE_ENV=production. No flag overrides this.');
      process.exit(1);
    }
    if (commitWrites && !args['confirm-reset']) {
      console.error('[migrate-day-import] --mode=reset --commit requires --confirm-reset as well.');
      process.exit(1);
    }
  }

  if ((mode === 'create' || mode === 'sync') && commitWrites && process.env.NODE_ENV === 'production' && !args['confirm-production']) {
    console.error('[migrate-day-import] Refusing to write with NODE_ENV=production unless --confirm-production is also passed.');
    process.exit(1);
  }

  console.log(`[migrate-day-import] mode=${mode} commit=${commitWrites} DATABASE_URL=${maskDbUrl(process.env.DATABASE_URL)}`);

  const prisma = new PrismaClient();
  const report = newReport(mode, commitWrites);

  try {
    // ── Load source data (Section 2) ──
    const talentDataPath = resolve(projectRoot, 'data/talent/index.js');
    const collabDataPath = resolve(projectRoot, 'data/collaborations.js');
    const { talentList } = loadPlainDataModule(talentDataPath, ['talentList']);
    const { collaborations } = loadPlainDataModule(collabDataPath, ['collaborations']);

    // ── Resolve Owner (only hard-required if we're actually about to write) ──
    let owner = null;
    try {
      owner = await resolveOwner(prisma, args);
    } catch (err) {
      if (commitWrites) {
        console.error(`[migrate-day-import] ${redactSecrets(err.message)}`);
        process.exit(1);
      }
      report.errors.push({ message: `Owner resolution failed (only required for --commit): ${redactSecrets(err.message)}` });
    }

    // ── Build read-only indices (Section 3.3 / 4) ──
    const existingAssets = await prisma.asset.findMany({ select: { id: true, blobUrl: true } });
    const assetIndex = new Map(existingAssets.map((a) => [a.blobUrl, a.id]));
    const reverseAssetIndex = new Map(existingAssets.map((a) => [a.id, a.blobUrl]));

    const slugs = talentList.map((t) => t.slug);
    const existingTalents = await prisma.talent.findMany({
      where: { slug: { in: slugs } },
      include: { currentPublishedVersion: true, socials: true, galleryImages: true },
    });
    const existingTalentBySlug = new Map(existingTalents.map((t) => [t.slug, t]));

    if (mode === 'reset') {
      const manifest = readManifest();
      report.reset = {
        talentIds: manifest.talentIds.length,
        talentVersionIds: manifest.talentVersionIds.length,
        talentSocialIds: manifest.talentSocialIds.length,
        talentGalleryImageIds: manifest.talentGalleryImageIds.length,
        imageAssetIds: (manifest.imageAssetIds || []).length,
      };
      if (commitWrites) {
        await executeReset(prisma, manifest);
        console.log('[migrate-day-import] reset: deletion complete. Re-running create pass...');
        writeManifest(emptyManifest());
      } else {
        console.log('[migrate-day-import] reset preview only (pass --commit --confirm-reset to actually delete and re-create).');
        printReport(report, args);
        await prisma.$disconnect();
        process.exit(0);
      }
    }

    // For reset+commit, fall through into the normal create-mode loop against
    // a now-empty manifest/database, per the design ("reset re-creates from a
    // clean slate"). For all other modes this is the only pass.
    const effectiveModeForLoop = mode === 'reset' ? 'create' : mode;
    const manifest = mode === 'reset' ? emptyManifest() : readManifest();

    const missingImages = [];

    for (const talent of talentList) {
      try {
        const existingTalent = mode === 'reset' ? null : existingTalentBySlug.get(talent.slug);
        const plan = planTalent({
          talent, mode: effectiveModeForLoop, existingTalent, assetIndex, reverseAssetIndex, missingImages,
        });
        plan.missingImagesForTalent = missingImages.filter((m) => m.slug === talent.slug);

        if (commitWrites && (plan.action === 'create' || plan.action === 'update')) {
          await prisma.$transaction(async (tx) => {
            if (plan.action === 'create') {
              await createTalent(tx, plan, owner.id, manifest, assetIndex, reverseAssetIndex);
            } else {
              await syncTalent(tx, plan, owner.id, manifest, assetIndex, reverseAssetIndex);
            }
          });
        }

        recordTalentPlanInReport(report, plan);
      } catch (err) {
        report.errors.push({ slug: talent.slug, message: redactSecrets(err.message || String(err)) });
      }

      const missingFields = checkBilingualParity(talent);
      if (missingFields.length) report.bilingualParity.missing.push({ slug: talent.slug, fields: missingFields });
    }

    // ── Collaborations (Section 8) ──
    const existingCollabEntity = await prisma.entity.findFirst({
      where: { entityType: 'COLLABORATIONS' },
      include: { currentPublishedVersion: true },
    });
    const collabPlan = planCollaborations(collaborations, existingCollabEntity);
    report.collaborations = { skippedPlaceholders: collabPlan.skipped, real: collabPlan.real, action: collabPlan.action };

    if (commitWrites && (collabPlan.action === 'create' || collabPlan.action === 'update')) {
      await prisma.$transaction(async (tx) => {
        if (collabPlan.action === 'create') await createCollaborationsEntity(tx, collabPlan, owner.id, manifest);
        else await syncCollaborationsEntity(tx, collabPlan, owner.id, manifest);
      });
    }

    if (commitWrites) writeManifest(manifest);

    printReport(report, args);

    const exitCode = report.errors.length > 0 ? 1 : 0;
    await prisma.$disconnect();
    process.exit(exitCode);
  } catch (err) {
    console.error('[migrate-day-import] Fatal error:', redactSecrets(err.message || err));
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
