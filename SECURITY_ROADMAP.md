# Security Implementation Roadmap

**Role:** Security Architect — planning output only
**Basis:** Six completed targeted audits (application-wide, authentication, session revocation, rate limiting, default role privilege, credential policy). Findings assumed accurate; no re-review performed.
**Overall posture:** Conditionally production-ready. No critical design flaws — the remaining work is hardening, not redesign.

---

## Category 1 — Must complete before production launch

### 1.1 Brute-force limiter is bypassable via spoofed client identity, with no per-account cap
- **Why here:** Password guessing against the admin login is the single realistic external attack path, and the current throttle can be defeated trivially by rotating a client-controlled header. The protection exists but is illusory.
- **Business justification:** The admin panel controls all public content and user accounts. A guessed credential means full site takeover; brand damage and recovery downtime are the direct costs.
- **Security justification:** Restores the intended attempt budget by keying limits on the account itself and trusting only platform-provided client identity. Eliminates unlimited password spraying.
- **Complexity:** Small–Medium

### 1.2 Rate-limit state does not survive the serverless deployment model
- **Why here:** The intended production hosting runs many short-lived instances; per-instance counters multiply the effective attempt budget and reset on every deploy. Combined with 1.1, brute-force protection is effectively absent in production.
- **Business justification:** Prevents launching with a security control that passes testing but silently fails in production — the most dangerous kind of gap.
- **Security justification:** A shared external counter store makes limits deployment-durable. The integration seam already exists by design, keeping risk and effort low.
- **Complexity:** Small–Medium

### 1.3 Temporary passwords never expire or force rotation; password floor is low
- **Why here:** Owner-issued temporary passwords silently become permanent credentials, and the minimum length is below current guidance. This is the cheapest launch-blocking fix and directly guards the credential layer that items 1.1/1.2 protect.
- **Business justification:** Offboarding and credential hygiene become owner responsibilities with no system backstop; one leaked temp password equals persistent admin access.
- **Security justification:** Forced first-login rotation plus a higher length floor closes the weakest credential path at negligible cost.
- **Complexity:** Small

---

## Category 2 — First production hardening sprint

### 2.1 No session revocation after deactivation or password reset
- **Why here:** Deliberate v1 trade-off with an 8-hour exposure cap and a small trusted team. Acceptable at launch with one owner; becomes unacceptable the moment employee offboarding is a real scenario.
- **Business justification:** "Deactivate" in the UI must actually cut access — the most likely trigger (terminating an employee) is exactly when the gap matters.
- **Security justification:** Per-request status re-check or token versioning converts an 8-hour compromise window into an immediate cutoff.
- **Complexity:** Medium

### 2.2 MFA for the owner account
- **Why here:** The owner account is the single point of total control. Not a launch blocker given no public registration and hardened login (post Category 1), but the highest-value account deserves a second factor early.
- **Business justification:** Phishing or password reuse is the realistic compromise path that no rate limiter stops; MFA is the only control that survives it.
- **Security justification:** Removes single-factor total compromise of the highest-privilege identity.
- **Complexity:** Medium

### 2.3 Content-Security-Policy and HSTS
- **Why here:** Defense-in-depth, not a known exploit path. Report-only rollout needs observation time, which fits a sprint better than a launch gate.
- **Business justification:** Materially reduces the blast radius of any future script-injection bug, especially inside the admin panel.
- **Security justification:** CSP is the standard mitigation layer for XSS classes the codebase currently prevents only by discipline.
- **Complexity:** Medium

### 2.4 Highest-privilege role is the schema-level default
- **Why here:** Confirmed but latent — every current creation path sets the role explicitly. The risk is a future code path forgetting; fix it before that path is written.
- **Business justification:** Prevents a silent full-privilege account from a routine future feature (invites, imports, SSO).
- **Security justification:** Aligns the schema with least privilege so mistakes fail safe instead of failing open.
- **Complexity:** Small

### 2.5 Origin verification on state-changing admin endpoints
- **Why here:** Cookie policy already mitigates CSRF; this is a cheap secondary check.
- **Business justification:** Insurance against browser-behavior changes and edge cases at trivial cost.
- **Security justification:** Defense-in-depth for all mutating admin actions.
- **Complexity:** Small

### 2.6 Rate limiting on the public contact endpoint
- **Why here:** Abuse/cost issue, not data exposure. Cheapest once the shared limiter store (1.2) exists.
- **Business justification:** Prevents inbox flooding and email-provider quota burn.
- **Security justification:** Closes the only unauthenticated endpoint without abuse controls.
- **Complexity:** Small

### 2.7 Dependency vulnerability audit in CI
- **Why here:** Exposure is currently unknown; automated checking is a one-time setup with permanent payoff.
- **Business justification:** Converts an unknown risk into a monitored one; gates deploys on published vulnerabilities.
- **Security justification:** Standard supply-chain hygiene for a small, recent dependency surface.
- **Complexity:** Small

---

## Category 3 — Defer to a future version

### 3.1 Audit-trail coverage gaps (publishes, uploads, login events)
- **Why here:** Forensic completeness, not attack prevention. The approval lifecycle — the highest-stakes flow — is already covered.
- **Business justification:** Matters mainly for post-incident reconstruction; team size keeps incident ambiguity low today.
- **Security justification:** Improves detection and forensics; does not reduce attack surface.
- **Complexity:** Medium

### 3.2 Image re-encoding / EXIF stripping / malware scanning on uploads
- **Why here:** Uploads are admin-only, image-only, byte-signature-validated, and size-capped. Residual risk is minimal until upload sources widen.
- **Business justification:** No realistic v1 abuse path; cost outweighs benefit today.
- **Security justification:** Re-encoding is worthwhile sanitization once non-owner roles or new media types upload at volume.
- **Complexity:** Medium

### 3.3 Breached-password rejection and complexity rules beyond length
- **Why here:** Marginal on top of a raised length floor, forced rotation, and hardened rate limiting; the audits rated complexity rules the lowest-value credential item.
- **Business justification:** Small incremental gain for a tiny invite-only user set.
- **Security justification:** Useful when the account base grows or self-service reset arrives.
- **Complexity:** Small

---

## Category 4 — Best practice only

| Item | Rationale | Complexity |
|---|---|---|
| 4.1 Align dummy-hash cost with real hash cost | Restores full timing-equivalence against email enumeration; residual signal is statistical and already generic-error-masked | Small |
| 4.2 Guard the 72-byte password truncation limit | Latent surprise, not exploitable at current lengths | Small |
| 4.3 Sanitize client identity and emails in logs | Log-forging / PII hygiene; minor | Small |
| 4.4 Direct test coverage for session, gating, logout, and limiter internals | Verified today by audit, not by automation; regressions currently invisible | Medium |

Each is justified by engineering hygiene rather than a live risk; none changes the security posture at launch.

---

## Execution plan

### Recommended order

1. 1.1 Per-account limiter + trusted client identity
2. 1.2 Shared rate-limit store *(same workstream as 1.1)*
3. 1.3 Forced temp-password rotation + raised floor
4. 2.4 Flip schema default role *(smallest highest-leverage sprint item — do first in sprint)*
5. 2.1 Session revocation
6. 2.2 Owner MFA
7. 2.7 Dependency audit in CI
8. 2.5 Origin verification
9. 2.6 Contact-endpoint rate limiting
10. 2.3 CSP/HSTS (start report-only early; enforce at sprint end)
11. Category 4 items opportunistically alongside adjacent work
12. Category 3 items scheduled against v2 triggers (team growth, new upload sources, compliance needs)

### Group into a single security sprint

- **Launch bundle (one workstream):** 1.1 + 1.2 + 2.6 — all touch the same limiter seam; the shared store built for login serves the contact endpoint nearly for free. Fold in 1.3 as the same "credential gate" effort.
- **Hardening sprint bundle:** 2.1 + 2.2 (both rework the session/login lifecycle — one review, one test pass), plus 2.4, 2.5, 2.7 as small independent tickets in the same sprint. 4.1–4.3 ride along at near-zero marginal cost.

### Keep independent

- **2.3 CSP/HSTS** — needs a report-only observation window and can break legitimate pages; isolate from auth changes so regressions are attributable.
- **4.4 Test coverage** — best done *after* 2.1/2.2 land, so tests target the final session model rather than being rewritten mid-sprint.
- **Category 3 items** — each has an external trigger; don't bundle into hardening.

### Highest security improvement per engineering hour

1. **1.3 Forced temp-password rotation** — hours of work, closes a persistent-credential hole.
2. **1.2 Shared limiter store** — the seam exists; small effort makes the primary anti-brute-force control real in production.
3. **2.4 Schema default flip** — near-trivial change that permanently removes an entire future-mistake class.
4. **1.1 Per-account limiting** — modest effort, eliminates unlimited password spraying.
5. **2.7 CI dependency audit** — one-time setup, continuous return.

### Can any confirmed finding remain unfixed for v1?

Yes. **Session revocation (2.1)** may remain unfixed at launch *only under a single-owner operating model* — the 8-hour cap bounds exposure and there is no one to offboard. It becomes a blocker the day the first employee account is issued; if employees exist at launch, promote it to Category 1. **All Category 3 and 4 items** may also remain unfixed for v1 without materially changing the risk profile. **MFA (2.2)** is a defensible v1 omission given invite-only access and a hardened login path, but should not survive past the first hardening sprint. Nothing in Category 1 can reasonably ship unfixed: launching with a bypassable, non-durable login limiter means shipping the appearance of brute-force protection without the substance.
