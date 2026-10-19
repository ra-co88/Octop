# Fork notes

This is a **personal-use fork** of [TencentCloud/Octop](https://github.com/TencentCloud/Octop),
maintained by [@ra-co88](https://github.com/ra-co88). It tracks upstream closely and
adds security fixes, accessibility work, and local preferences.

If you are looking at this to understand *why* it differs from upstream, read
[Strategy](#strategy) first — it explains the bias behind every difference below.

## Strategy

**Upstream is the trunk.** This fork tracks it deliberately, and **staying mergeable
with upstream is a first-class goal**. Where a local change is correct but would cost
merge interest at every future sync, it may be discarded — with the reasoning
recorded rather than the change quietly reverted.

The practical rule that follows: **prefer a new file plus a one-line import over an
edit inside upstream's high-churn files.** New files merge cleanly forever; in-place
edits to files upstream rewrites constantly are a recurring tax.

### Upstream pushes are disabled by design

The `upstream` remote exists **for fetching only**; its push URL is deliberately
disabled. This is intentional and should not be "helpfully" re-enabled:

- This fork carries **local opinions** (a colour palette, a stripped purchase path)
  that do not belong in upstream.
- Some fixes here were written against code upstream has since **replaced or
  deleted**. Pushing them back would be wrong.
- Several changes were **never merged upstream** after long silence on 13+ open pull
  requests. That is upstream's prerogative; it is not a reason to keep asking.

If you find yourself wanting to push, that is a signal the change belongs in your
own fork — or should be offered as a **new, minimal PR**, not as a branch push.

### Security findings are escalated, not filed

A security finding with a **real-world victim is reported by direct email**, never as
a public pull request or issue. Findings without a victim are fixed here and
documented in the changelog.

## What differs from upstream

| Area | Difference |
|---|---|
| **Security** | Path-boundary, ACL, SSRF and disclosure fixes. Mostly additive; see notes below. |
| **Accessibility** | Keyboard navigation, ARIA corrections, focus handling, contrast. |
| **Colour** | A rose accent palette replacing upstream's default. |
| **Packaging** | The Tencent Cloud purchase links are removed from the README. Upstream's Cloud deployment documentation is kept. |
| **Versioning** | Published as `<upstream>+ra.N` (PEP 440 local version). |

## Divergences to re-check each sync

Some lines here exist only because upstream has not fixed something yet. Each is a
**candidate for retirement**: if upstream ever fixes it their own way, our line should
be **dropped**, not carried forever. Keeping this list is what makes that a decision
instead of an archaeology project.

The rule from [Strategy](#strategy) applies — retiring a fork-only fix to protect
mergeability is a legitimate, successful outcome, recorded as *superseded* so it does
not later read as a regression.

| Divergence | Where | Retire when | Guard |
|---|---|---|---|
| Log retention: `backupCount=0` | `src/octop/infra/server.py`, `_build_log_handler` | Upstream stops letting `getFilesToDelete()` delete the plain file `delaycompress` preserves | `tests/unit/test_fork_divergences.py` |
| `wizard_password_path` omitted | `src/octop/api/routers/setup.py`, `/setup/status` | Upstream stops returning an absolute filesystem path from that unauthenticated endpoint | none — re-read on sync |

**Already retired (do not resurrect):**

| Item | Why it was dropped |
|---|---|
| **SEC-1** — auth hardening on `POST /setup/resume-wizard` | Upstream `cc687bdd` (#2074) **deleted the endpoint**, because an anonymous POST could mint a bearer that replaced the active model on a single-user install. Deletion is strictly stronger than adding authorization to it, so our fix became unreachable code. |
| `setup_completed_at` flag | Upstream's `count() > 1` check replaced it and **fails closed**; our flag **failed open** when `/setup/finish` never ran. Ours was the weaker of the two. |

### How to use the guard

`tests/unit/test_fork_divergences.py` fails when upstream edits code we diverged
from. **A failure is a prompt to look, not automatically a bug.** Read upstream's
version first:

- **Upstream fixed it properly** → drop our line, move the row above to the retired
  table with the commit that superseded it.
- **Upstream changed the surrounding code** → re-apply our line and re-run the guard.
- **Our line was lost in a conflict resolution** → restore it. This is the silent
  failure the guard exists to catch.

## Versioning

Versions carry a **local version segment** — `1.0.2+ra.3` means *upstream 1.0.2 plus
this fork's third revision*. It sorts *before* upstream's next release, so package
managers prefer upstream once it moves ahead. See `CHANGELOG.md` for what each
`ra.N` contains; PEP 440 local segments carry no notes of their own, which is why
they are written down there.

## Keeping in sync

```bash
git fetch upstream
git checkout -b sync/upstream-<version> develop
git merge upstream/develop        # merge commit, NEVER squash or rebase
```

**Always a merge commit.** Squashing or rebasing the upstream history would make
every future sync a fresh conflict across the whole tree, because the merge-base
would be lost.

Resolve conflicts by hand, then:

```bash
make all                   # format + lint + typecheck + pytest
cd dashboard && npx vitest run
```

**Then re-check the divergence guards** — these are the point of the sync, not an
afterthought, because they are what turns "the merge went clean" into "the merge
went clean *and* we still know which lines are ours and why":

```bash
uv run pytest tests/unit/test_fork_divergences.py -q
```

Walk every row of [Divergences to re-check each sync](#divergences-to-re-check-each-sync).
A clean merge is exactly when a lost divergence is hardest to notice.

### Watch for silent losses

A file can merge **cleanly** while upstream has rewritten it underneath. A visual
diff will not prompt anyone to look, so re-verify anything you have customised in a
file upstream actively changes. This has already bitten the accessibility work on
`ChatInput.tsx` once.
