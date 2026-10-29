"""Persistent browser daemon that runs inside the Sailbox.

One Chromium profile lives at /data/profile so portal logins and cookies
survive across runs. The Next.js server drives it through `ctl.py`, which
posts one JSON action to this process on 127.0.0.1:7777.
"""

import asyncio
import base64
import json
import mimetypes
import os
import re
import time
import traceback
from pathlib import Path

from playwright.async_api import async_playwright

PROFILE = "/data/profile"
FILES = Path("/data/files")
PORT = 7777
VIEWPORT = {"width": 1280, "height": 860}
MAX_OBS = 14000

SNAPSHOT_JS = r"""
(start) => {
  let n = start;
  const refs = [];
  document.querySelectorAll('[data-lref]').forEach(e => e.removeAttribute('data-lref'));
  const BLOCK = new Set(['ADDRESS','ARTICLE','ASIDE','BLOCKQUOTE','BR','CENTER','DD','DIV','DL','DT','FIELDSET',
    'FIGURE','FOOTER','FORM','H1','H2','H3','H4','H5','H6','HEADER','HR','LI','MAIN','NAV','OL','P','PRE',
    'SECTION','TABLE','TBODY','THEAD','TFOOT','TR','UL','CAPTION','LEGEND','DETAILS']);
  const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','SVG','HEAD','META','LINK','IFRAME','FRAME','FRAMESET','OBJECT']);
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const visible = el => {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') return false;
    if (el.tagName === 'INPUT' && el.type === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0 || el.tagName === 'OPTION';
  };
  const isInteractive = el => {
    const t = el.tagName;
    if (t === 'A' && (el.hasAttribute('href') || el.hasAttribute('onclick'))) return true;
    if (['BUTTON','SELECT','TEXTAREA','SUMMARY'].includes(t)) return true;
    if (t === 'INPUT') return el.type !== 'hidden';
    if (el.hasAttribute('onclick')) return true;
    const role = el.getAttribute('role');
    return ['button','link','tab','menuitem','checkbox','radio','option','switch'].includes(role);
  };
  const labelFor = el => {
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return clean(l.innerText); }
    const pl = el.closest('label'); if (pl) return clean(pl.innerText);
    return '';
  };
  const describe = el => {
    const t = el.tagName;
    const id = ++n; el.setAttribute('data-lref', String(id)); refs.push(id);
    if (t === 'A') {
      const href = el.getAttribute('href') || '';
      const txt = clean(el.innerText) || clean(el.getAttribute('title')) || clean(el.querySelector('img')?.alt) || href;
      const h = href && !href.startsWith('javascript') && !href.startsWith('#') ? ` -> ${href.slice(0, 90)}` : '';
      return `[${id} link "${txt.slice(0, 80)}"${h}]`;
    }
    if (t === 'SELECT') {
      const opts = [...el.options].map(o => clean(o.text)).slice(0, 25).join(' | ');
      const sel = el.selectedOptions[0] ? clean(el.selectedOptions[0].text) : '';
      return `[${id} select${el.name ? ' name=' + el.name : ''} "${labelFor(el)}" selected="${sel}" options: ${opts}]`;
    }
    if (t === 'INPUT' || t === 'TEXTAREA') {
      const type = t === 'TEXTAREA' ? 'textarea' : (el.type || 'text');
      if (['submit','button','reset','image'].includes(type)) return `[${id} button "${clean(el.value || el.alt || type)}"]`;
      const val = type === 'password' ? (el.value ? '••••' : '') : (el.value || '');
      const chk = ['checkbox','radio'].includes(type) ? (el.checked ? ' checked' : ' unchecked') : '';
      const extra = [el.name && 'name=' + el.name, el.placeholder && `placeholder="${el.placeholder}"`, labelFor(el) && `label="${labelFor(el)}"`].filter(Boolean).join(' ');
      return `[${id} input ${type}${chk} ${extra} value="${String(val).slice(0, 60)}"]`;
    }
    const txt = clean(el.innerText) || clean(el.value) || clean(el.getAttribute('aria-label')) || clean(el.getAttribute('title'));
    return `[${id} button "${txt.slice(0, 80)}"]`;
  };
  const walk = (node) => {
    if (node.nodeType === 3) return node.textContent.replace(/\s+/g, ' ');
    if (node.nodeType !== 1) return '';
    const el = node;
    if (SKIP.has(el.tagName)) return '';
    if (!visible(el)) return '';
    if (isInteractive(el)) {
      const d = describe(el);
      return BLOCK.has(el.tagName) ? `\n${d}\n` : ` ${d} `;
    }
    if (el.tagName === 'IMG') { const a = clean(el.alt); return a ? ` (img: ${a}) ` : ''; }
    let inner = '';
    for (const c of el.childNodes) inner += walk(c);
    const t = el.tagName;
    const nested = (t === 'TD' || t === 'TH' || t === 'TR') && el.querySelector('table');
    if (nested) return '\n' + inner + '\n';
    if (t === 'TD' || t === 'TH') return ' ' + clean(inner) + ' |';
    if (t === 'TR') return '\n|' + inner.replace(/\n+/g, ' ') + '\n';
    if (/^H[1-6]$/.test(t)) return `\n${'#'.repeat(+t[1])} ${clean(inner)}\n`;
    if (t === 'LI') return `\n- ${inner.trim()}\n`;
    if (t === 'B' || t === 'STRONG') return ` **${clean(inner)}** `;
    if (BLOCK.has(t)) return `\n${inner}\n`;
    return inner;
  };
  const body = document.body ? walk(document.body) : '';
  const text = body.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(l => l && l !== '|').join('\n');
  const sh = document.documentElement.scrollHeight, y = window.scrollY, vh = window.innerHeight;
  return { text, next: n, scroll: { y, vh, sh } };
}
"""


class Browser:
    def __init__(self):
        self.pw = None
        self.ctx = None
        self.page = None
        self.ref_frames = {}
        self.snap_url = None
        self.pending = 0
        self.downloads = []
        self.lock = asyncio.Lock()

    async def start(self):
        FILES.mkdir(parents=True, exist_ok=True)
        self.pw = await async_playwright().start()
        self.ctx = await self.pw.chromium.launch_persistent_context(
            PROFILE,
            headless=True,
            viewport=VIEWPORT,
            accept_downloads=True,
            downloads_path="/data/tmp-downloads",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        self.ctx.on("page", self._on_page)
        for p in self.ctx.pages:
            self._wire(p)
        self.page = self.ctx.pages[0] if self.ctx.pages else await self.ctx.new_page()

    def _wire(self, page):
        page.on("download", lambda d: asyncio.ensure_future(self._save_download(d)))
        page.on("dialog", lambda d: asyncio.ensure_future(d.accept()))

    def _on_page(self, page):
        self._wire(page)
        self.page = page

    async def _save_download(self, d):
        self.pending += 1
        name = safe_name(d.suggested_filename or "download")
        path = unique(FILES / name)
        try:
            await d.save_as(str(path))
            self.downloads.append({"name": path.name, "path": str(path), "size": path.stat().st_size, "url": d.url, "at": time.time()})
        except Exception as e:  # noqa: BLE001
            self.downloads.append({"name": name, "error": str(e), "url": d.url, "at": time.time()})
        finally:
            self.pending -= 1

    async def settle(self, timeout=6000):
        try:
            await self.page.wait_for_load_state("domcontentloaded", timeout=timeout)
        except Exception:
            pass
        try:
            await self.page.wait_for_load_state("networkidle", timeout=1500)
        except Exception:
            pass

    async def observe(self):
        page = self.page
        parts = []
        counter = 0
        self.ref_frames = {}
        for i, frame in enumerate(page.frames):
            try:
                res = await frame.evaluate(SNAPSHOT_JS, counter)
            except Exception:
                continue
            for r in range(counter + 1, res["next"] + 1):
                self.ref_frames[r] = frame
            counter = res["next"]
            if not res["text"].strip():
                continue
            if i == 0 and len(page.frames) == 1:
                parts.append(res["text"])
            else:
                label = frame.name or f"frame {i}"
                parts.append(f"=== frame: {label} ({frame.url}) ===\n{res['text']}")
            if i == 0:
                sc = res["scroll"]
                if sc["sh"] > sc["vh"] * 1.2:
                    pct = int(100 * min(1, (sc["y"] + sc["vh"]) / sc["sh"]))
                    parts.append(f"(viewport shows down to {pct}% of the page)")
        text = "\n".join(parts) if parts else "(page has no visible text)"
        if len(text) > MAX_OBS:
            text = text[:MAX_OBS] + f"\n... [truncated {len(text) - MAX_OBS} chars; scroll or use find_text]"
        self.snap_url = page.url
        tabs = [p.url for p in self.ctx.pages]
        title = ""
        try:
            title = await page.title()
        except Exception:
            pass
        return {"url": page.url, "title": title, "tabs": tabs, "text": text}

    async def shot(self, quality=55, full=False):
        try:
            b = await self.page.screenshot(type="jpeg", quality=quality, full_page=full, timeout=8000)
            return base64.b64encode(b).decode()
        except Exception:
            return None

    def locate(self, ref):
        ref = int(ref)
        if self.snap_url and self.page.url != self.snap_url:
            raise ValueError("the page changed since the last snapshot; use the refs from the new snapshot")
        frame = self.ref_frames.get(ref)
        if frame is None:
            raise ValueError(f"ref {ref} not on the current page; take a new snapshot")
        return frame.locator(f'[data-lref="{ref}"]').first

    async def run(self, a):
        kind = a.get("action")
        before = len(self.downloads)
        result = {}
        if kind == "goto":
            url = a["url"]
            if not re.match(r"^[a-z]+:", url):
                url = "https://" + url
            try:
                await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
            except Exception as e:  # PDFs and attachments surface as aborted navigations
                if "Download is starting" not in str(e) and "net::ERR_ABORTED" not in str(e):
                    raise
                await asyncio.sleep(1.0)
        elif kind == "click":
            loc = self.locate(a["ref"])
            await loc.scroll_into_view_if_needed(timeout=4000)
            await loc.click(timeout=8000)
        elif kind == "type":
            loc = self.locate(a["ref"])
            await loc.fill(str(a.get("text", "")), timeout=8000)
            if a.get("submit"):
                await loc.press("Enter")
        elif kind == "select":
            loc = self.locate(a["ref"])
            val = str(a["value"])
            try:
                await loc.select_option(label=val, timeout=4000)
            except Exception:
                await loc.select_option(value=val, timeout=4000)
        elif kind == "check":
            loc = self.locate(a["ref"])
            await loc.set_checked(bool(a.get("checked", True)), timeout=4000)
        elif kind == "press":
            await self.page.keyboard.press(a["key"])
        elif kind == "scroll":
            dy = VIEWPORT["height"] * 0.85 * (-1 if a.get("direction") == "up" else 1)
            await self.page.mouse.wheel(0, dy)
            await asyncio.sleep(0.3)
        elif kind == "back":
            await self.page.go_back(wait_until="domcontentloaded", timeout=15000)
        elif kind == "tab":
            idx = int(a["index"])
            self.page = self.ctx.pages[idx]
            await self.page.bring_to_front()
        elif kind == "close_tab":
            if len(self.ctx.pages) > 1:
                await self.page.close()
                self.page = self.ctx.pages[-1]
        elif kind == "wait":
            await asyncio.sleep(min(float(a.get("seconds", 1)), 10))
        elif kind == "fetch":
            url = a["url"]
            if not re.match(r"^[a-z]+:", url):
                url = await self.page.evaluate("u => new URL(u, location.href).href", url)
            r = await self.ctx.request.get(url, timeout=30000)
            body = await r.body()
            name = a.get("filename") or name_from(r.headers.get("content-disposition", ""), url, r.headers.get("content-type", ""))
            path = unique(FILES / safe_name(name))
            path.write_bytes(body)
            self.downloads.append({"name": path.name, "path": str(path), "size": len(body), "url": url, "at": time.time(), "status": r.status, "type": r.headers.get("content-type", "")})
        elif kind == "save_pdf":
            name = safe_name(a.get("filename") or "page.pdf")
            if not name.lower().endswith(".pdf"):
                name += ".pdf"
            path = unique(FILES / name)
            await self.page.emulate_media(media="print")
            await self.page.pdf(path=str(path), format="Letter", print_background=True)
            await self.page.emulate_media(media="screen")
            self.downloads.append({"name": path.name, "path": str(path), "size": path.stat().st_size, "url": self.page.url, "at": time.time()})
        elif kind == "find_text":
            q = a["query"].lower()
            obs = await self.observe()
            hits = [l for l in obs["text"].split("\n") if q in l.lower()]
            result["matches"] = hits[:40]
        elif kind == "read_file":
            result.update(read_file(a["path"], a.get("max_chars", 20000)))
            return result
        elif kind == "list_files":
            files = sorted(FILES.glob("*"), key=lambda p: p.stat().st_mtime)
            result["files"] = [{"name": p.name, "path": str(p), "size": p.stat().st_size} for p in files]
            return result
        elif kind == "screenshot":
            await self.settle(3000)
            result["image"] = await self.shot(quality=70, full=False)
            result.update(await self.observe())
            return result
        elif kind == "snapshot":
            pass
        elif kind == "reset":
            for p in self.ctx.pages[1:]:
                await p.close()
            self.page = self.ctx.pages[0]
            await self.page.goto("about:blank")
        elif kind == "clear_cookies":
            await self.ctx.clear_cookies()
        else:
            raise ValueError(f"unknown action {kind}")

        if kind in ("click", "type", "press", "select", "check", "goto", "back"):
            await asyncio.sleep(0.15)
            await self.settle()
            # a click-triggered download fires its event shortly after the click; wait only if one started
            if kind in ("click", "goto"):
                await asyncio.sleep(0.1)
                for _ in range(100):
                    if not self.pending:
                        break
                    await asyncio.sleep(0.1)
        result["downloads"] = self.downloads[before:]
        if not a.get("observe", True):
            result["url"] = self.page.url
            return result
        result.update(await self.observe())
        if a.get("shot", True):
            result["shot"] = await self.shot()
        return result


def safe_name(name):
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._") or "file"
    return name[:120]


def unique(path: Path):
    if not path.exists():
        return path
    stem, suf = path.stem, path.suffix
    i = 2
    while (path.parent / f"{stem}-{i}{suf}").exists():
        i += 1
    return path.parent / f"{stem}-{i}{suf}"


def name_from(cd, url, ctype):
    m = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?', cd or "")
    if m:
        return m.group(1)
    base = url.split("?")[0].rstrip("/").split("/")[-1] or "download"
    if "." not in base:
        ext = mimetypes.guess_extension((ctype or "").split(";")[0].strip()) or ".bin"
        base += ext
    return base


def read_file(path, max_chars):
    p = Path(path)
    if not p.is_absolute():
        p = FILES / path
    if not p.exists():
        return {"error": f"no such file {p}"}
    suf = p.suffix.lower()
    out = {"name": p.name, "path": str(p), "size": p.stat().st_size}
    if suf == ".pdf":
        from pypdf import PdfReader

        try:
            reader = PdfReader(str(p))
            pages = [pg.extract_text() or "" for pg in reader.pages]
            text = "\n\n".join(f"--- page {i + 1} ---\n{t}" for i, t in enumerate(pages))
            out["pages"] = len(pages)
            if len(text.strip()) < 40:
                out["note"] = "PDF has almost no text layer (likely scanned); rendered first page as an image"
                out["image"] = render_first_page(p)
        except Exception as e:  # noqa: BLE001
            text = ""
            out["error"] = f"could not parse PDF: {e}"
    elif suf in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
        out["image"] = base64.b64encode(p.read_bytes()).decode()
        out["media_type"] = mimetypes.guess_type(str(p))[0]
        text = ""
    else:
        raw = p.read_bytes().decode("utf-8", errors="replace")
        if suf in (".html", ".htm"):
            raw = re.sub(r"(?is)<(script|style).*?</\1>", "", raw)
            raw = re.sub(r"(?i)<br\s*/?>|</(p|div|tr|li|h\d)>", "\n", raw)
            raw = re.sub(r"(?i)</t[dh]>", " | ", raw)
            raw = re.sub(r"<[^>]+>", " ", raw)
            raw = re.sub(r"[ \t]+", " ", raw)
            raw = "\n".join(l.strip() for l in raw.splitlines() if l.strip())
        text = raw
    if len(text) > max_chars:
        text = text[:max_chars] + f"\n... [truncated, {len(text)} chars total]"
    out["text"] = text
    return out


def render_first_page(p):
    return None


BROWSER = Browser()


async def handle(reader, writer):
    try:
        head = await reader.readuntil(b"\r\n\r\n")
        lines = head.decode().split("\r\n")
        length = 0
        for l in lines[1:]:
            if l.lower().startswith("content-length:"):
                length = int(l.split(":", 1)[1])
        body = await reader.readexactly(length) if length else b"{}"
        action = json.loads(body or b"{}")
        if action.get("action") == "ping":
            res = {"ok": True, "pong": True, "url": BROWSER.page.url}
        else:
            async with BROWSER.lock:
                try:
                    res = await asyncio.wait_for(BROWSER.run(action), timeout=float(action.get("timeout", 60)))
                    res["ok"] = True
                except Exception as e:  # noqa: BLE001
                    res = {"ok": False, "error": f"{type(e).__name__}: {str(e).splitlines()[0][:400]}"}
                    traceback.print_exc()
                    try:
                        res.update(await BROWSER.observe())
                        res["shot"] = await BROWSER.shot()
                    except Exception:
                        pass
        data = json.dumps(res).encode()
        writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: " + str(len(data)).encode() + b"\r\nConnection: close\r\n\r\n" + data)
        await writer.drain()
    except Exception:
        traceback.print_exc()
    finally:
        writer.close()


async def main():
    await BROWSER.start()
    server = await asyncio.start_server(handle, "127.0.0.1", PORT)
    print(f"browserd listening on {PORT}", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    os.makedirs("/data/tmp-downloads", exist_ok=True)
    asyncio.run(main())
