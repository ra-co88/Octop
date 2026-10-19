"""Guards for divergences this fork carries on purpose.

Each entry is a line upstream has not (yet) fixed. The guard's job is an early
warning at **sync time**: if upstream changes the code we diverged from, one of
these fails and tells us to re-evaluate the divergence instead of silently
resolving a conflict and moving on.

A failing guard here is not automatically a bug. It means: *look at upstream's
version and decide* - either upstream fixed it (drop our line, record it as
superseded) or upstream changed the surrounding code (re-apply our line).

See FORK.md, "Divergences to re-check each sync", for the decision procedure.
"""

from __future__ import annotations

import ast
import inspect

from octop.infra import server


def _keyword_value(func: object, keyword: str) -> str:
    """Return the source of `keyword=...` in the handler-construction call.

    Parsed with `ast` rather than matched as text on purpose. A substring check on
    the source is satisfied by a *comment* that merely mentions the value, so it
    would pass while the real assignment was reverted - a false pass in the one
    place this guard is supposed to be trustworthy.
    """
    tree = ast.parse(inspect.getsource(func))
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            for kw in node.keywords:
                if kw.arg == keyword:
                    return ast.unparse(kw.value)
    raise AssertionError(f"{keyword}= not found in the handler construction")


def test_log_retention_divergence_is_still_justified() -> None:
    """We pin `backupCount=0`; upstream pins `backupCount=retention_days`.

    Upstream's value lets TimedRotatingFileHandler.getFilesToDelete() delete the
    plain file delaycompress just preserved, because intra-day size rolls share one
    date and the count inflates - so trimming fires and sorts by name, not age.
    Upstream also has _purge_stale_logs, which is the correct mtime-based
    mechanism; the two together are what conflict.

    If this test fails after a sync, upstream has edited _build_log_handler.
    Read their version before re-applying ours - they may have fixed it properly,
    in which case our line should be DROPPED and FORK.md updated.
    """
    value = _keyword_value(server._build_log_handler, "backupCount")
    assert value == "0", (
        f"Backup count is {value}, but this fork pins it to 0.\n"
        "Either upstream fixed the backupCount/delaycompress conflict properly "
        "(then drop this guard and move the entry to FORK.md's retired list), or a "
        "conflict resolution lost our line. Check upstream's version, then decide."
    )
    # The reason we diverge: the purge must still exist to own retention. If
    # upstream removed _purge_stale_logs, backupCount=0 would mean NO retention
    # at all - an unbounded log directory - so this assert is not decoration.
    assert hasattr(server, "_purge_stale_logs"), (
        "_purge_stale_logs is gone, so backupCount=0 now means no retention at all "
        "and logs grow without bound. Restore a retention mechanism before syncing."
    )
