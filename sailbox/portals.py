"""Three deliberately old-fashioned vendor portals for demos and tests.

They run inside the Sailbox on 127.0.0.1:8080 so the agent can practise on
realistic legacy UIs (table layouts, framesets, WebForms-style postbacks,
interstitials, PDFs served as attachments) without touching a real vendor.
"""

import html
import secrets
import urllib.parse
from datetime import date, timedelta
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8080
SESSIONS = {}

# ---------------------------------------------------------------- data

NORTHWIND = [
    # number, date, po, amount, status, lines
    ("INV-10431", "2026-08-04", "PO-5470", 318.40, "Paid", [("Copy paper, 10 ream case", 4, 52.10), ("Toner HP 58A", 1, 109.99)]),
    ("INV-10438", "2026-08-12", "PO-5479", 1120.00, "Paid", [("Ergonomic chair, mesh", 4, 280.00)]),
    ("INV-10446", "2026-08-21", "PO-5486", 87.35, "Paid", [("Sticky notes, 24pk", 3, 18.45), ("Ballpoint pens, 60ct", 1, 32.00)]),
    ("INV-10452", "2026-08-29", "PO-5491", 455.90, "Paid", [("Label printer DYMO 450", 2, 179.95), ("Label rolls", 4, 24.00)]),
    ("INV-10459", "2026-09-05", "PO-5499", 236.15, "Paid", [("Copy paper, 10 ream case", 4, 52.10), ("Binder clips", 5, 5.55)]),
    ("INV-10463", "2026-09-11", "PO-5503", 1689.00, "Paid", [("Standing desk frame", 3, 563.00)]),
    ("INV-10466", "2026-09-18", "PO-5510", 129.80, "Paid", [("Whiteboard markers", 10, 12.98)]),
    ("INV-10469", "2026-09-26", "PO-5516", 774.25, "Paid", [("Monitor arm, dual", 5, 154.85)]),
    ("INV-10471", "2026-10-03", "PO-5521", 642.18, "Paid", [("Copy paper, 10 ream case", 6, 52.10), ("Toner HP 58A", 3, 109.99), ("Shipping", 1, 0.61)]),
    ("INV-10482", "2026-10-09", "PO-5534", 1248.50, "Paid", [("Office chair, task", 5, 229.70), ("Chair mats", 1, 100.00)]),
    ("INV-10490", "2026-10-17", "PO-5540", 389.00, "Paid", [("Shredder, cross-cut", 1, 389.00)]),
    ("INV-10493", "2026-10-20", "PO-5544", 512.60, "Open", [("Break room supplies", 1, 512.60)]),
    ("INV-10497", "2026-10-24", "PO-5549", 2115.75, "Open", [("Laptop docking station", 9, 235.08), ("Shipping", 1, 0.03)]),
]

CONTOSO_BILLS = [
    ("FB-77088", "2026-09-08", "PO-5497", 1420.00, "Chicago, IL -> Columbus, OH", "BOL 4418820"),
    ("FB-77102", "2026-09-22", "PO-5512", 610.75, "Chicago, IL -> Detroit, MI", "BOL 4418874"),
    ("FB-77120", "2026-10-06", "PO-5528", 1870.00, "Chicago, IL -> Atlanta, GA", "BOL 4419003"),
    ("FB-77141", "2026-10-14", "PO-5537", 945.30, "Chicago, IL -> St. Louis, MO", "BOL 4419051"),
]

CONTOSO_POS = [
    ("PO-5497", "2026-09-02", 1420.00, "LTL freight, 6 pallets"),
    ("PO-5512", "2026-09-16", 610.75, "LTL freight, 2 pallets"),
    ("PO-5528", "2026-10-01", 1870.00, "FTL freight, 1 trailer"),
    ("PO-5537", "2026-10-09", 945.30, "LTL freight, 3 pallets"),
    ("PO-5552", "2026-10-25", 1210.00, "LTL freight, 4 pallets"),
]

ACME_DOCS = {
    "Invoices": [
        ("AC-INV-2274", "2026-09-12", "PO-5505", 2210.00, "Paid"),
        ("AC-INV-2291", "2026-10-02", "PO-5519", 3480.00, "Paid"),
        ("AC-INV-2307", "2026-10-15", "PO-5538", 760.40, "Paid"),
        ("AC-INV-2315", "2026-10-21", "PO-5546", 1125.00, "Payment pending"),
    ],
    "Payment Receipts": [
        ("RC-8790", "2026-09-19", "AC-INV-2274", 2210.60, "Posted"),
        ("RC-8812", "2026-10-04", "AC-INV-2291", 3480.00, "Posted"),
        ("RC-8840", "2026-10-16", "AC-INV-2307", 760.40, "Posted"),
        ("RC-8841", "2026-10-16", "AC-INV-2307", 760.40, "Posted"),
    ],
    "Credit Memos": [
        ("CM-0119", "2026-09-30", "AC-INV-2274", -145.00, "Applied"),
    ],
}

ACME_LINES = {
    "AC-INV-2274": [("Hex bolts M10, box/100", 20, 38.50), ("Steel brackets, 90deg", 140, 10.29)],
    "AC-INV-2291": [("Hydraulic fitting kit", 12, 165.00), ("Hose assembly 3/8in", 30, 50.00)],
    "AC-INV-2307": [("Bearing 6204-2RS", 80, 6.38), ("Shaft collar 1in", 40, 6.25)],
    "AC-INV-2315": [("Pneumatic cylinder 2in bore", 5, 225.00)],
}

NORTHWIND = [(n, d, po, round(sum(q * u for _, q, u in lines), 2), st, lines) for n, d, po, _, st, lines in NORTHWIND]
ACME_DOCS["Invoices"] = [(n, d, po, round(sum(q * u for _, q, u in ACME_LINES[n]), 2), st) for n, d, po, _, st in ACME_DOCS["Invoices"]]

BILL_TO = ["Accounts Payable", "Brightline Building Supply Co.", "1200 W Lake St, Suite 400", "Chicago, IL 60607"]


def money(v):
    return f"${v:,.2f}" if v >= 0 else f"-${-v:,.2f}"


def us(d):
    y, m, dd = d.split("-")
    return f"{m}/{dd}/{y}"


# ---------------------------------------------------------------- pdf

def pdf_bytes(items):
    """items: list of (x, y, size, text, bold) in points on a Letter page."""
    def esc(t):
        return t.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    ops = []
    for x, y, size, text, bold in items:
        if text == "__LINE__":
            ops.append(f"0.75 w {x} {y} m {size} {y} l S")
            continue
        ops.append(f"BT /{'F2' if bold else 'F1'} {size} Tf {x} {y} Td ({esc(text)}) Tj ET")
    stream = "\n".join(ops).encode("latin-1", "replace")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def doc_pdf(vendor_lines, title, meta, lines, total, footer):
    it = []
    y = 740
    for i, t in enumerate(vendor_lines):
        it.append((50, y, 16 if i == 0 else 9, t, i == 0))
        y -= 20 if i == 0 else 12
    it.append((400, 740, 20, title, True))
    my = 712
    for k, v in meta:
        it.append((400, my, 9, k, True))
        it.append((480, my, 9, v, False))
        my -= 13
    y = min(y, my) - 20
    it.append((50, y, 9, "BILL TO", True))
    y -= 13
    for t in BILL_TO:
        it.append((50, y, 9, t, False))
        y -= 12
    y -= 18
    it.append((50, y, 9, "DESCRIPTION", True))
    it.append((330, y, 9, "QTY", True))
    it.append((390, y, 9, "UNIT PRICE", True))
    it.append((490, y, 9, "AMOUNT", True))
    y -= 6
    it.append((50, y, 562, "__LINE__", False))
    y -= 14
    for desc, qty, unit in lines:
        it.append((50, y, 9, desc, False))
        it.append((330, y, 9, str(qty), False))
        it.append((390, y, 9, money(unit), False))
        it.append((490, y, 9, money(qty * unit), False))
        y -= 14
    y -= 4
    it.append((330, y, 562, "__LINE__", False))
    y -= 16
    it.append((390, y, 10, "TOTAL DUE" if "INVOICE" in title or "BILL" in title else "TOTAL", True))
    it.append((490, y, 10, money(total), True))
    y -= 40
    for t in footer:
        it.append((50, y, 8, t, False))
        y -= 11
    return pdf_bytes(it)


# ---------------------------------------------------------------- pages

NW_STYLE = """<style>body{font-family:Verdana,Arial;font-size:11px;background:#e8e8e8;margin:0}
td{font-size:11px} .hdr{background:#003366;color:#fff} .nav a{color:#003366} th{background:#c0c0c0;text-align:left}
.grid td{border-bottom:1px solid #bbb;padding:3px} a{color:#0000cc}</style>"""


def nw_page(body, sess=True):
    nav = """<td width="160" valign="top" bgcolor="#d6dfe8" class="nav"><br>
<b>&nbsp;Account</b><br>&nbsp;&nbsp;<a href="/northwind/home.asp">Home</a><br>
&nbsp;&nbsp;<a href="/northwind/invoices.asp">Invoices</a><br>&nbsp;&nbsp;<a href="/northwind/orders.asp">Order History</a><br>
&nbsp;&nbsp;<a href="/northwind/statements.asp">Statements</a><br><br>&nbsp;&nbsp;<a href="/northwind/logout.asp">Log Off</a></td>""" if sess else ""
    return f"""<html><head><title>Northwind Office Supply - Customer Extranet</title>{NW_STYLE}</head><body>
<table width="100%" cellpadding="0" cellspacing="0"><tr class="hdr"><td height="48">&nbsp;<font size="4"><b>NORTHWIND OFFICE SUPPLY</b></font>
&nbsp;&nbsp;<i>Customer Extranet v2.3</i></td><td align="right"><font size="1">Best viewed in Internet Explorer 6.0 at 800x600&nbsp;</font></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0"><tr>{nav}<td valign="top" style="padding:12px" bgcolor="#ffffff">{body}</td></tr></table>
<center><font size="1" color="#666">&copy; 2004 Northwind Office Supply. All rights reserved.</font></center></body></html>"""


def contoso_frame(title, body):
    return f"""<html><head><title>{title}</title><style>body{{font-family:'Times New Roman';font-size:13px;background:#fffff0}}
table.r td,table.r th{{border:1px solid #999;padding:2px 6px}} th{{background:#ddd}}</style></head><body>{body}</body></html>"""


ACME_STYLE = """<style>body{font-family:Tahoma,Arial;font-size:12px;background:#f3f3f3;margin:0}
.bar{background:linear-gradient(#5a7fb5,#2d4f86);color:#fff;padding:8px 12px;font-size:16px}
.panel{background:#fff;border:1px solid #9aa;margin:12px;padding:10px} .grid th{background:#d4dceb;border:1px solid #9aa;padding:3px 8px}
.grid td{border:1px solid #ccd;padding:3px 8px} .pager a{margin:0 3px}</style>
<script>function __doPostBack(t,a){var f=document.forms['aspnetForm'];f.__EVENTTARGET.value=t;f.__EVENTARGUMENT.value=a;f.submit();}</script>"""


class H(BaseHTTPRequestHandler):
    server_version = "Microsoft-IIS/6.0"

    def log_message(self, *a):
        pass

    # ---- helpers
    def sess(self):
        c = SimpleCookie(self.headers.get("Cookie", ""))
        sid = c.get("LEGACYSESSID")
        return SESSIONS.get(sid.value) if sid else None

    def new_sess(self, data):
        sid = secrets.token_hex(12)
        SESSIONS[sid] = data
        return sid

    def send(self, body, ctype="text/html; charset=iso-8859-1", status=200, headers=None):
        b = body if isinstance(body, bytes) else body.encode("latin-1", "replace")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(b)

    def redirect(self, to, cookie=None):
        self.send_response(302)
        self.send_header("Location", to)
        if cookie:
            self.send_header("Set-Cookie", f"LEGACYSESSID={cookie}; Path=/")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def form(self):
        n = int(self.headers.get("Content-Length") or 0)
        return {k: v[0] for k, v in urllib.parse.parse_qs(self.rfile.read(n).decode()).items()}

    def do_GET(self):
        self.route("GET", {})

    def do_POST(self):
        self.route("POST", self.form())

    def route(self, method, form):
        u = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        p = u.path.rstrip("/") or "/"
        if p == "/":
            return self.send("<html><body><h3>Vendor sandbox</h3><a href='/northwind/'>Northwind</a> <a href='/contoso/'>Contoso</a> <a href='/acme/'>Acme</a></body></html>")
        if p.startswith("/northwind"):
            return self.northwind(method, p[len("/northwind"):] or "/", q, form)
        if p.startswith("/contoso"):
            return self.contoso(method, p[len("/contoso"):] or "/", q, form)
        if p.startswith("/acme"):
            return self.acme(method, p[len("/acme"):] or "/", q, form)
        self.send("<h1>404 Not Found</h1>", status=404)

    # ------------------------------------------------------------ northwind
    def northwind(self, method, p, q, form):
        s = self.sess()
        authed = s and s.get("nw")
        if p in ("/", "/default.asp", "/login.asp"):
            err = ""
            if method == "POST":
                if form.get("txtUser", "").strip().lower() == "apclerk" and form.get("txtPass") == "Northwind#2004":
                    sid = self.new_sess({"nw": True})
                    return self.redirect("/northwind/home.asp", sid)
                err = "<font color=red><b>Invalid User ID or Password. Please try again.</b></font><br><br>"
            return self.send(nw_page(f"""<br><table align="center" bgcolor="#d6dfe8" cellpadding="6" border="1" bordercolor="#003366"><tr><td>
<b>Customer Login</b><br><br>{err}<form method="post" action="/northwind/login.asp">
<table><tr><td>User ID:</td><td><input name="txtUser" size="20"></td></tr><tr><td>Password:</td><td><input type="password" name="txtPass" size="20"></td></tr>
<tr><td></td><td><input type="submit" value="Log In"></td></tr></table></form><font size="1">Forgot password? Call 1-800-555-0142 (M-F 8am-5pm CST)</font></td></tr></table>""", sess=False))
        if not authed:
            return self.redirect("/northwind/login.asp")
        if p == "/logout.asp":
            s["nw"] = False
            return self.redirect("/northwind/login.asp")
        if p == "/home.asp":
            open_amt = sum(r[3] for r in NORTHWIND if r[4] == "Open")
            return self.send(nw_page(f"""<b>Welcome, Brightline Building Supply Co.</b> (Acct #NW-30417)<br><br>
<table border="1" cellpadding="4" cellspacing="0"><tr><td>Open balance</td><td><b>{money(open_amt)}</b></td></tr><tr><td>Terms</td><td>Net 30</td></tr></table>
<br><marquee width="400"><font color="#990000">NEW! Order online and save 5% on toner through 11/30!</font></marquee>"""))
        if p == "/invoices.asp":
            year = q.get("yr", "2026")
            status = q.get("st", "All")
            rows = [r for r in NORTHWIND if r[1].startswith(year) and (status == "All" or r[4] == status)]
            rows = sorted(rows, key=lambda r: r[1], reverse=True)
            per = 5
            page = max(1, int(q.get("pg", "1") or 1))
            pages = max(1, (len(rows) + per - 1) // per)
            chunk = rows[(page - 1) * per: page * per]
            trs = "".join(
                f"<tr><td>{r[0]}</td><td>{us(r[1])}</td><td>{r[2]}</td><td align=right>{money(r[3])}</td><td>{r[4]}</td>"
                f"<td><a href='/northwind/invoice_view.asp?id={r[0]}'>View</a> | <a href='/northwind/getdoc.asp?type=inv&id={r[0]}'><img src='data:,' alt='PDF' width=1 height=1>PDF</a></td></tr>"
                for r in chunk) or "<tr><td colspan=6><i>No records found.</i></td></tr>"
            pager = " ".join(
                f"<b>[{i}]</b>" if i == page else f"<a href='/northwind/invoices.asp?yr={year}&st={status}&pg={i}'>[{i}]</a>"
                for i in range(1, pages + 1))
            yopts = "".join(f"<option{' selected' if y == year else ''}>{y}</option>" for y in ("2026", "2025", "2024"))
            sopts = "".join(f"<option{' selected' if v == status else ''}>{v}</option>" for v in ("All", "Open", "Paid"))
            return self.send(nw_page(f"""<b><font size="3">Invoice History</font></b><br><br>
<form method="get" action="/northwind/invoices.asp">Year: <select name="yr">{yopts}</select> &nbsp; Status: <select name="st">{sopts}</select> <input type="submit" value="Go"></form>
<table class="grid" width="100%" cellspacing="0"><tr><th>Invoice #</th><th>Date</th><th>Your PO</th><th>Amount</th><th>Status</th><th>&nbsp;</th></tr>{trs}</table>
<br>Page {page} of {pages}: {pager}"""))
        if p == "/invoice_view.asp":
            r = next((r for r in NORTHWIND if r[0] == q.get("id")), None)
            if not r:
                return self.send(nw_page("<font color=red>Error 0x80040E14: Record not found.</font>"))
            lines = "".join(f"<tr><td>{d}</td><td>{n}</td><td align=right>{money(u)}</td><td align=right>{money(n * u)}</td></tr>" for d, n, u in r[5])
            return self.send(nw_page(f"""<b>Invoice {r[0]}</b><br>Date: {us(r[1])} &nbsp; PO: {r[2]} &nbsp; Status: {r[4]}<br><br>
<table class="grid" cellspacing=0><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Ext.</th></tr>{lines}<tr><td colspan=3 align=right><b>Total</b></td><td align=right><b>{money(r[3])}</b></td></tr></table>
<br><a href="/northwind/getdoc.asp?type=inv&id={r[0]}">Download PDF copy</a> &nbsp; <a href="javascript:history.back()">Back</a>"""))
        if p == "/getdoc.asp":
            r = next((r for r in NORTHWIND if r[0] == q.get("id")), None)
            if not r:
                return self.send("not found", status=404)
            due = (date.fromisoformat(r[1]) + timedelta(days=30)).isoformat()
            pdf = doc_pdf(["Northwind Office Supply", "4100 Industrial Pkwy", "Elk Grove Village, IL 60007", "Remit to: PO Box 77310, Chicago, IL 60678"],
                          "INVOICE", [("Invoice #", r[0]), ("Date", us(r[1])), ("Customer PO", r[2]), ("Account", "NW-30417"), ("Terms", "Net 30"), ("Due", us(due))],
                          r[5], r[3], ["Thank you for your business. Past due balances subject to 1.5% monthly finance charge."])
            return self.send(pdf, "application/pdf", headers={"Content-Disposition": f'attachment; filename="{r[0]}.pdf"'})
        if p in ("/orders.asp", "/statements.asp"):
            return self.send(nw_page("<i>This module is temporarily unavailable. Please contact your account representative.</i>"))
        self.send(nw_page("<h3>HTTP 404 - File not found</h3>"), status=404)

    # ------------------------------------------------------------ contoso
    def contoso(self, method, p, q, form):
        s = self.sess()
        authed = s and s.get("cf")
        if p in ("/", "/index.html"):
            if not authed:
                return self.redirect("/contoso/signon.cgi")
            return self.send("""<html><head><title>Contoso Freight Lines - Shipper Services</title></head>
<frameset rows="70,*" border="1"><frame name="banner" src="/contoso/banner.html" scrolling="no">
<frameset cols="190,*"><frame name="menu" src="/contoso/menu.html"><frame name="main" src="/contoso/welcome.html"></frameset></frameset></html>""")
        if p == "/signon.cgi":
            err = ""
            if method == "POST":
                if form.get("acct", "").strip().upper() == "CF-88213" and form.get("pin") == "4417":
                    sid = self.new_sess({"cf": True})
                    return self.redirect("/contoso/", sid)
                err = "<p><font color=red>SIGNON FAILED - CHECK ACCOUNT NUMBER AND PIN</font></p>"
            return self.send(contoso_frame("Contoso Freight - Sign On", f"""<center><h2>CONTOSO FREIGHT LINES</h2><h4>Shipper Services Sign-On</h4>{err}
<form method="post" action="/contoso/signon.cgi"><pre>Account No: <input name="acct" size="12">
PIN       : <input type="password" name="pin" size="6" maxlength="4"></pre><input type="submit" value="SIGN ON"> <input type="reset" value="CLEAR"></form>
<p><small>Authorized users only. Activity is monitored.</small></p></center>"""))
        if not authed:
            return self.send(contoso_frame("Expired", "<p>SESSION EXPIRED. <a href='/contoso/signon.cgi' target='_top'>SIGN ON AGAIN</a></p>"))
        if p == "/banner.html":
            return self.send(contoso_frame("b", "<table width=100%><tr><td><font size=5 color=navy><b>CONTOSO FREIGHT LINES</b></font></td><td align=right>Account CF-88213 &nbsp; <a href='/contoso/signoff.cgi' target='_top'>Sign Off</a></td></tr></table>"))
        if p == "/signoff.cgi":
            s["cf"] = False
            return self.redirect("/contoso/signon.cgi")
        if p == "/menu.html":
            return self.send(contoso_frame("m", """<b>MAIN MENU</b><br><br>
<a href="/contoso/bills.cgi" target="main">Freight Bills</a><br><a href="/contoso/pos.cgi" target="main">Purchase Orders</a><br>
<a href="/contoso/pod.cgi" target="main">Proof of Delivery</a><br><a href="/contoso/rates.cgi" target="main">Rate Quote</a>"""))
        if p == "/welcome.html":
            return self.send(contoso_frame("w", "<h3>Welcome</h3><p>Select an option from the MAIN MENU at left.</p><p><b>NOTICE:</b> Freight bills older than 90 days are archived.</p>"))
        if p == "/bills.cgi":
            frm, to = q.get("from", ""), q.get("to", "")
            body = """<h3>FREIGHT BILL INQUIRY</h3><form method="get" action="/contoso/bills.cgi">
Ship date from (MM/DD/YYYY): <input name="from" size="10"> to: <input name="to" size="10"> <input type="submit" value="SEARCH"></form>"""
            if frm or to:
                try:
                    def parse(x, default):
                        if not x:
                            return default
                        m, d, y = x.strip().split("/")
                        return date(int(y), int(m), int(d)).isoformat()
                    a, b = parse(frm, "1900-01-01"), parse(to, "2999-12-31")
                except Exception:
                    return self.send(contoso_frame("e", body + "<p><font color=red>ERR 22: DATE FORMAT MUST BE MM/DD/YYYY</font></p>"))
                rows = [r for r in CONTOSO_BILLS if a <= r[1] <= b]
                trs = "".join(f"<tr><td><a href='/contoso/bill.cgi?pro={r[0]}'>{r[0]}</a></td><td>{us(r[1])}</td><td>{r[2]}</td><td>{r[4]}</td><td align=right>{money(r[3])}</td></tr>" for r in rows)
                body += f"<p>{len(rows)} RECORD(S) FOUND</p><table class='r' cellspacing=0><tr><th>PRO #</th><th>SHIP DATE</th><th>PO</th><th>LANE</th><th>CHARGES</th></tr>{trs}</table>"
            return self.send(contoso_frame("Freight Bills", body))
        if p == "/bill.cgi":
            r = next((r for r in CONTOSO_BILLS if r[0] == q.get("pro")), None)
            if not r:
                return self.send(contoso_frame("e", "NO SUCH PRO NUMBER"))
            return self.send(contoso_frame("Bill", f"""<h3>FREIGHT BILL {r[0]}</h3><pre>SHIP DATE : {us(r[1])}
PO NUMBER : {r[2]}
LANE      : {r[4]}
REFERENCE : {r[5]}
CHARGES   : {money(r[3])}</pre><form method="post" action="/contoso/print.cgi"><input type="hidden" name="pro" value="{r[0]}"><input type="submit" value="PRINT FREIGHT BILL (PDF)"></form>
<a href="javascript:history.back()">&lt;&lt; RETURN</a>"""))
        if p == "/print.cgi":
            r = next((r for r in CONTOSO_BILLS if r[0] == (form.get("pro") or q.get("pro"))), None)
            if not r:
                return self.send("not found", status=404)
            pdf = doc_pdf(["Contoso Freight Lines, Inc.", "88 Terminal Rd", "Joliet, IL 60436", "MC-448210  USDOT 1182733"], "FREIGHT BILL",
                          [("PRO #", r[0]), ("Ship date", us(r[1])), ("Shipper PO", r[2]), ("Reference", r[5]), ("Terms", "Net 15")],
                          [(f"Linehaul {r[4]}", 1, round(r[3] * 0.82, 2)), ("Fuel surcharge", 1, round(r[3] - round(r[3] * 0.82, 2), 2))], r[3],
                          ["Pay by ACH to account on file. Questions: billing@contoso-freight.example"])
            return self.send(pdf, "application/pdf", headers={"Content-Disposition": f'attachment; filename="FreightBill_{r[0]}.pdf"'})
        if p == "/pos.cgi":
            trs = "".join(f"<tr><td>{r[0]}</td><td>{us(r[1])}</td><td>{r[3]}</td><td align=right>{money(r[2])}</td><td><a href='/contoso/po.cgi?po={r[0]}'>DETAIL</a></td></tr>" for r in CONTOSO_POS)
            return self.send(contoso_frame("POs", f"<h3>PURCHASE ORDERS ON FILE</h3><table class='r' cellspacing=0><tr><th>PO #</th><th>DATE</th><th>DESCRIPTION</th><th>AUTHORIZED</th><th></th></tr>{trs}</table>"))
        if p == "/po.cgi":
            r = next((r for r in CONTOSO_POS if r[0] == q.get("po")), None)
            if not r:
                return self.send(contoso_frame("e", "NO SUCH PO"))
            return self.send(contoso_frame("PO", f"""<h3>PURCHASE ORDER {r[0]}</h3><pre>DATE        : {us(r[1])}
DESCRIPTION : {r[3]}
AUTHORIZED  : {money(r[2])}
BILLED      : {'YES - ' + next(b[0] for b in CONTOSO_BILLS if b[2] == r[0]) if any(b[2] == r[0] for b in CONTOSO_BILLS) else 'NOT YET BILLED'}</pre>
<a href="/contoso/podoc.cgi?po={r[0]}">DOWNLOAD PO COPY</a><br><a href="javascript:history.back()">&lt;&lt; RETURN</a>"""))
        if p == "/podoc.cgi":
            r = next((r for r in CONTOSO_POS if r[0] == q.get("po")), None)
            if not r:
                return self.send("not found", status=404)
            pdf = doc_pdf(["Brightline Building Supply Co.", "1200 W Lake St, Suite 400", "Chicago, IL 60607"], "PURCHASE ORDER",
                          [("PO #", r[0]), ("Date", us(r[1])), ("Vendor", "Contoso Freight Lines")], [(r[3], 1, r[2])], r[2], ["Authorized by: J. Patel, Operations"])
            return self.send(pdf, "application/pdf", headers={"Content-Disposition": f'attachment; filename="{r[0]}.pdf"'})
        if p in ("/pod.cgi", "/rates.cgi"):
            return self.send(contoso_frame("x", "<p>SYSTEM UNAVAILABLE 0200-0600 CT FOR MAINTENANCE. FUNCTION DISABLED.</p>"))
        self.send(contoso_frame("404", "PAGE NOT FOUND"), status=404)

    # ------------------------------------------------------------ acme
    def acme(self, method, p, q, form):
        s = self.sess()
        st = s.get("acme") if s else None
        if p in ("/", "/Login.aspx"):
            err = ""
            if method == "POST":
                if form.get("ctl00$Main$txtUserName", "").strip() == "bbs_ap" and form.get("ctl00$Main$txtPassword") == "acme-ap-77":
                    sid = self.new_sess({"acme": {"agreed": False}})
                    return self.redirect("/acme/Notice.aspx", sid)
                err = "<span style='color:red'>Login failed. Your account will be locked after 5 unsuccessful attempts.</span><br>"
            return self.send(f"""<html><head><title>Acme Industrial Parts :: Supplier &amp; Customer Self Service</title>{ACME_STYLE}</head><body>
<div class="bar">Acme Industrial Parts &nbsp;|&nbsp; Customer Self Service</div><div class="panel" style="width:340px">
<form name="aspnetForm" method="post" action="/acme/Login.aspx"><input type="hidden" name="__VIEWSTATE" value="/wEPDwUKMTY1NDU2MTA1MmRk">
<input type="hidden" name="__EVENTTARGET"><input type="hidden" name="__EVENTARGUMENT">{err}
<table><tr><td>User name</td><td><input name="ctl00$Main$txtUserName" id="ctl00_Main_txtUserName"></td></tr>
<tr><td>Password</td><td><input type="password" name="ctl00$Main$txtPassword"></td></tr></table>
<a href="javascript:__doPostBack('ctl00$Main$btnLogin','')" style="display:inline-block;background:#2d4f86;color:#fff;padding:4px 14px;text-decoration:none">Sign in</a>
</form></div></body></html>""")
        if not st:
            return self.redirect("/acme/Login.aspx")
        if p == "/Notice.aspx":
            if method == "POST" and form.get("__EVENTTARGET") == "ctl00$Main$btnAgree":
                st["agreed"] = True
                return self.redirect("/acme/Documents.aspx")
            return self.send(f"""<html><head><title>Acme :: Notice</title>{ACME_STYLE}</head><body><div class="bar">Acme Industrial Parts</div>
<div class="panel"><form name="aspnetForm" method="post" action="/acme/Notice.aspx"><input type="hidden" name="__EVENTTARGET"><input type="hidden" name="__EVENTARGUMENT">
<b>Important notice regarding remittance</b><p>Effective 09/01/2026 Acme Industrial Parts has changed its remittance bank. Please update your vendor master records.
You must acknowledge this notice to continue.</p><a href="javascript:__doPostBack('ctl00$Main$btnAgree','')">I Acknowledge</a></form></div></body></html>""")
        if not st.get("agreed"):
            return self.redirect("/acme/Notice.aspx")
        if p == "/Documents.aspx":
            doctype = form.get("ctl00$Main$ddlDocType", st.get("doctype", "Invoices"))
            rng = form.get("ctl00$Main$ddlRange", st.get("range", "Last 30 days"))
            page = st.get("page", 1)
            show = st.get("show", False)
            tgt = form.get("__EVENTTARGET", "")
            if method == "POST":
                if tgt == "ctl00$Main$btnRetrieve":
                    show, page = True, 1
                elif tgt == "ctl00$Main$gvDocs" and form.get("__EVENTARGUMENT", "").startswith("Page$"):
                    page = int(form["__EVENTARGUMENT"][5:])
                elif tgt == "ctl00$Main$gvDocs" and form.get("__EVENTARGUMENT", "").startswith("Open$"):
                    st.update(doctype=doctype, range=rng, page=page, show=show)
                    return self.redirect("/acme/Print.aspx?doc=" + urllib.parse.quote(form["__EVENTARGUMENT"][5:]))
            st.update(doctype=doctype, range=rng, page=page, show=show)
            days = {"Last 30 days": 30, "Last 60 days": 60, "Last 90 days": 90}.get(rng, 30)
            cutoff = (date(2026, 10, 29) - timedelta(days=days)).isoformat()
            grid = ""
            if show:
                rows = sorted([r for r in ACME_DOCS.get(doctype, []) if r[1] >= cutoff], key=lambda r: r[1], reverse=True)
                per = 3
                pages = max(1, (len(rows) + per - 1) // per)
                page = min(page, pages)
                chunk = rows[(page - 1) * per: page * per]
                ref_label = "PO Number" if doctype == "Invoices" else "Applied To"
                trs = "".join(f"<tr><td><a href=\"javascript:__doPostBack('ctl00$Main$gvDocs','Open${r[0]}')\">{r[0]}</a></td><td>{us(r[1])}</td><td>{r[2]}</td><td align=right>{money(r[3])}</td><td>{r[4]}</td></tr>" for r in chunk)
                if not chunk:
                    trs = "<tr><td colspan=5>There are no documents to display.</td></tr>"
                pager = "".join(f"<span>{i}</span>" if i == page else f"<a href=\"javascript:__doPostBack('ctl00$Main$gvDocs','Page${i}')\">{i}</a>" for i in range(1, pages + 1))
                grid = f"""<table class="grid" cellspacing=0><tr><th>Document</th><th>Date</th><th>{ref_label}</th><th>Amount</th><th>Status</th></tr>{trs}
<tr><td colspan=5 class="pager">{pager}</td></tr></table>"""
            dt_opts = "".join(f"<option{' selected' if d == doctype else ''}>{d}</option>" for d in ACME_DOCS)
            rg_opts = "".join(f"<option{' selected' if d == rng else ''}>{d}</option>" for d in ("Last 30 days", "Last 60 days", "Last 90 days"))
            return self.send(f"""<html><head><title>Acme :: Account Documents</title>{ACME_STYLE}</head><body>
<div class="bar">Acme Industrial Parts &nbsp;|&nbsp; Account Documents &nbsp; <small>Customer #C-00918 Brightline Building Supply</small></div>
<div class="panel"><form name="aspnetForm" method="post" action="/acme/Documents.aspx"><input type="hidden" name="__VIEWSTATE" value="/wEPDwULLTE2MTY2ODcyMjkPZBYCZg9kFgI">
<input type="hidden" name="__EVENTTARGET"><input type="hidden" name="__EVENTARGUMENT">
Document type: <select name="ctl00$Main$ddlDocType">{dt_opts}</select> &nbsp; Period: <select name="ctl00$Main$ddlRange">{rg_opts}</select>
<input type="button" value="Retrieve" onclick="__doPostBack('ctl00$Main$btnRetrieve','')"><br><br>{grid}</form></div></body></html>""")
        if p == "/Print.aspx":
            doc = q.get("doc", "")
            for kind, rows in ACME_DOCS.items():
                r = next((r for r in rows if r[0] == doc), None)
                if r:
                    break
            if not r:
                return self.send("<h2>Server Error in '/' Application.</h2><p>Object reference not set to an instance of an object.</p>", status=500)
            lines = ACME_LINES.get(r[0]) or [(("Payment received - applied to " if kind == "Payment Receipts" else "Credit - ") + r[2], 1, r[3])]
            trs = "".join(f"<tr><td>{d}</td><td>{n}</td><td align=right>{money(u)}</td><td align=right>{money(n * u)}</td></tr>" for d, n, u in lines)
            title = {"Invoices": "INVOICE", "Payment Receipts": "PAYMENT RECEIPT", "Credit Memos": "CREDIT MEMO"}[kind]
            ref = "Customer PO" if kind == "Invoices" else "Applied to"
            return self.send(f"""<html><head><title>{title} {r[0]}</title><style>body{{font-family:Arial;font-size:12px;margin:30px}} td,th{{padding:4px 10px}} th{{border-bottom:1px solid #000;text-align:left}}</style></head><body>
<table width="100%"><tr><td><b style="font-size:18px">Acme Industrial Parts</b><br>2250 Foundry Ave<br>Gary, IN 46402</td><td align=right><b style="font-size:20px">{title}</b><br>
No. {r[0]}<br>Date {us(r[1])}<br>{ref}: {r[2]}<br>Status: {r[4]}</td></tr></table><br>
<b>Customer:</b> Brightline Building Supply Co. (C-00918)<br><br><table width="100%" cellspacing=0><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Amount</th></tr>{trs}
<tr><td></td><td></td><td align=right><b>Total</b></td><td align=right><b>{money(r[3])}</b></td></tr></table>
<p style="margin-top:30px"><a href="javascript:window.print()">Print this page</a> &nbsp; <a href="/acme/Documents.aspx">Back to documents</a></p></body></html>""")
        self.send("<h2>Server Error in '/' Application.</h2><p>The resource cannot be found.</p>", status=404)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
