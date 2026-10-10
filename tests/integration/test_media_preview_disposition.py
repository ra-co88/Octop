"""tests/integration/test_media_preview_disposition.py - SEC-11 preview headers.

The workspace preview endpoint serves user-controlled bytes (uploads, tool
output) straight from the app origin. Two guarantees are asserted here:

* SVG - and anything else the browser treats as scriptable - is forced to an
  attachment disposition so a navigated document cannot execute script on
  our origin.
* Every preview response carries X-Content-Type-Options: nosniff (blocks MIME
  confusion) and Content-Security-Policy: sandbox (keeps inline image/video
  previews working while disabling script in the document).

The preview headers were merged from two sources - the audit SEC-11 fix and
upstream's CSP sandbox - so the assertions pin both rather than trusting either.
"""

from __future__ import annotations

from typing import Any

import pytest

_SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000a49444154789c6360000002000100ffff030000060005"
    "57bfabd40000000049454e44ae426082"
)


@pytest.fixture
async def env(env_with_agent):
    yield env_with_agent


def _headers(response: Any) -> dict[str, str]:
    return {k.lower(): v for k, v in response.headers.items()}


async def test_svg_preview_is_forced_to_attachment(env: Any) -> None:
    """SEC-11: a navigated SVG must never render inline from the app origin."""
    c, srv, auth, aid = env
    agent = srv.app_runtime.agent_registry.get_agent(aid)
    await agent.workspace.aupload_bytes("probe.svg", _SVG)

    r = await c.get(
        f"/api/agents/{aid}/media/preview",
        params={"source": "probe.svg"},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    headers = _headers(r)
    assert headers["content-type"].startswith("image/svg+xml"), headers
    assert headers["content-disposition"].startswith("attachment"), headers


async def test_png_preview_stays_inline_but_sandboxed(env: Any) -> None:
    """A safe raster preview stays inline, yet is still nosniff + sandboxed."""
    c, srv, auth, aid = env
    agent = srv.app_runtime.agent_registry.get_agent(aid)
    await agent.workspace.aupload_bytes("probe.png", _PNG)

    r = await c.get(
        f"/api/agents/{aid}/media/preview",
        params={"source": "probe.png"},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    headers = _headers(r)
    assert headers["content-disposition"].startswith("inline"), headers
    assert headers["x-content-type-options"] == "nosniff", headers
    assert headers["content-security-policy"] == "sandbox", headers


async def test_every_preview_response_carries_nosniff_and_sandbox(env: Any) -> None:
    """The hardening headers are unconditional, not tied to the MIME type."""
    c, srv, auth, aid = env
    agent = srv.app_runtime.agent_registry.get_agent(aid)
    await agent.workspace.aupload_bytes("probe2.svg", _SVG)

    r = await c.get(
        f"/api/agents/{aid}/media/preview",
        params={"source": "probe2.svg"},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    headers = _headers(r)
    assert headers["x-content-type-options"] == "nosniff", headers
    assert headers["content-security-policy"] == "sandbox", headers
