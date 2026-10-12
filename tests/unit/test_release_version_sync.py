"""All version locations must agree with pyproject.toml.

pyproject.toml is the single source of truth for the wheel/PyPI version. The
rest are hand-maintained copies that drift silently: nothing imports them, so
pytest-testmon never selects their tests, and no CI job compares them. That
gap shipped 1.0.2b7 with five stale copies and a red Release workflow.

This file is force-selected on every hook run (see the Makefile
`--testmon-force-select` flag) precisely because testmon will not pick it up
on its own.
"""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def _pyproject_version() -> str:
    """The one authoritative version."""
    data = tomllib.loads((REPO / "pyproject.toml").read_text(encoding="utf-8"))
    return str(data["project"]["version"])


def _manifest_version(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("version="):
            return line.split("=", 1)[1].strip().strip(chr(34))
    raise AssertionError(f"no version= line in {path}")


def test_pyproject_is_parseable() -> None:
    """If this fails, the other assertions here are meaningless."""
    assert re.fullmatch(r"\d+\.\d+\.\d+[a-z0-9]*(\+[a-z0-9.]+)?", _pyproject_version())


def test_lockfile_matches_pyproject() -> None:
    lock = (REPO / "uv.lock").read_text(encoding="utf-8")
    match = re.search(r'name = "octop"\nversion = "([^"]+)"', lock)
    assert match, "octop package not found in uv.lock"
    assert match.group(1) == _pyproject_version()


def test_init_dunder_version_matches_pyproject() -> None:
    text = (REPO / "src/octop/__init__.py").read_text(encoding="utf-8")
    match = re.search(r'__version__ = "([^"]+)"', text)
    assert match, "no __version__ in src/octop/__init__.py"
    assert match.group(1) == _pyproject_version()


def test_fnos_manifests_match_pyproject() -> None:
    for rel in ("fnos/docker/manifest", "fnos/native/manifest"):
        assert _manifest_version(REPO / rel) == _pyproject_version(), rel


def test_fnos_compose_image_tag_matches_pyproject() -> None:
    text = (REPO / "fnos/docker/app/docker/docker-compose.yaml").read_text(encoding="utf-8")
    tags = re.findall(r"ghcr\.io/[^/]+/octop:([^\s\"]+)", text)
    assert tags, "no octop image tag in docker-compose.yaml"
    cleaned = [t.strip(chr(34)).strip(chr(39)) for t in tags]
    assert _pyproject_version() in cleaned, cleaned


def test_readme_badges_match_pyproject() -> None:
    version = _pyproject_version()
    for rel in ("README.md", "README_CN.md"):
        text = (REPO / rel).read_text(encoding="utf-8")
        badge = re.search(r"shields\.io/badge/version-([^/]+?)-", text)
        if badge is None:
            continue
        assert badge.group(1) == version, (rel, badge.group(1))
