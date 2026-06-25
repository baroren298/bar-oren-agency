/*
 * User repository — skeleton only (Phase 1: Foundations).
 * Auth itself (sessions, login route, password hashing) is explicitly out
 * of scope for Phase 1 (ADMIN_PANEL_PLAN.md Section 9, Phase 2). This
 * stub exists only so the data-access shape for `role`-based checks
 * (Section 11 — Owner-only at launch, Editor-ready schema) is established
 * now, alongside the rest of the repository layer.
 */

import { notImplemented } from './_notImplemented';

export const userRepository = {
  /** Look up a user by email (used by the future login flow). (Phase 2) */
  async getByEmail(/* email */) {
    return notImplemented('userRepository.getByEmail');
  },

  /** Look up a user by id (used by session resolution). (Phase 2) */
  async getById(/* userId */) {
    return notImplemented('userRepository.getById');
  },

  /**
   * Create the single Owner user at setup time. No public signup flow is
   * planned (Section 11) — this is an operational/CLI action, not an
   * admin UI feature.
   */
  async createOwner(/* { email, passwordHash } */) {
    return notImplemented('userRepository.createOwner');
  },
};

export default userRepository;
