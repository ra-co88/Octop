"""Host absolute path helpers for workspace download / preview."""

from __future__ import annotations

from pathlib import Path

import pytest

from octop.infra.gateway.media.backend_files import (
    file_url_to_abs_path,
    is_allowed_host_download_abs_path,
    is_host_absolute_path,
)


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("/Users/me/Desktop/a.pptx", True),
        ("/outbound/a.pptx", True),
        ("outbound/a.pptx", False),
        ("file:///tmp/x", True),
        (r"C:\Users\me\a.pptx", True),
        ("", False),
    ],
)
def test_is_host_absolute_path(path: str, expected: bool) -> None:
    assert is_host_absolute_path(path) is expected


def test_allowed_host_download_under_workspace(tmp_path: Path) -> None:
    ws = tmp_path / "workspace"
    target = ws / "outbound" / "a.pptx"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"x")
    assert is_allowed_host_download_abs_path(str(target), workspace=ws) is True


def test_allowed_host_download_desktop_style(tmp_path: Path) -> None:
    desktop = tmp_path / "Desktop" / "deck.pptx"
    desktop.parent.mkdir(parents=True)
    desktop.write_bytes(b"PK")
    # Outside workspace but not a system root — tool send_file paths.
    assert is_allowed_host_download_abs_path(str(desktop), workspace=tmp_path / "ws") is True


def test_denied_host_download_etc(tmp_path: Path) -> None:
    assert is_allowed_host_download_abs_path("/etc/passwd", workspace=tmp_path) is False


def test_denied_harness_browser(tmp_path: Path) -> None:
    path = tmp_path / ".harness-browser" / "screenshots" / "x.png"
    path.parent.mkdir(parents=True)
    path.write_bytes(b"x")
    assert is_allowed_host_download_abs_path(str(path), workspace=tmp_path) is False


def test_denied_octop_browser(tmp_path: Path) -> None:
    path = tmp_path / ".octop-browser" / "screenshots" / "x.png"
    path.parent.mkdir(parents=True)
    path.write_bytes(b"x")
    assert is_allowed_host_download_abs_path(str(path), workspace=tmp_path) is False


def test_file_url_windows_drive_decodes_unicode() -> None:
    """file:///C:/… must unquote and match native Path form (Windows CI)."""
    url = "file:///C:/Users/me/out/%E4%BF%9D%E6%8A%A4.pptx"
    assert file_url_to_abs_path(url) == str(Path("C:/Users/me/out/保护.pptx"))


def test_file_url_windows_drive_in_netloc_keeps_drive() -> None:
    """``file://C:/…`` — two slashes, so the drive lands in netloc, not path.

    Windows CI builds these URLs from ``Path.as_posix()``, which yields
    ``file://C:/…``. ``urlparse`` puts ``C:`` in netloc, so reading ``path``
    alone loses the drive and returns ``/Users/…``. On a runner whose workdir
    is on D: that resolves drive-relative, which both escapes the containment
    check and writes somewhere the caller did not name — SEC-2's file://
    write test came back 200 instead of 403.
    """
    assert file_url_to_abs_path("file://C:/Users/me/out/a.pptx") == str(
        Path("C:/Users/me/out/a.pptx")
    )
    # Percent-decoding still applies on this branch.
    assert file_url_to_abs_path("file://C:/Users/me/out/%E4%BF%9D%E6%8A%A4.pptx") == str(
        Path("C:/Users/me/out/保护.pptx")
    )
    # The three-slash form is unchanged by the fix.
    assert file_url_to_abs_path("file:///C:/Users/me/out/a.pptx") == str(
        Path("C:/Users/me/out/a.pptx")
    )
    # A UNC host is still a host, not a drive letter.
    assert file_url_to_abs_path("file://server/share/a.pptx") != str(Path("C:/share/a.pptx"))
