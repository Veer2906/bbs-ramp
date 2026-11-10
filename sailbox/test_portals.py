"""Exercise the actual HTTP portals and fixture evidence, without a model or live services."""
import http.cookiejar
import threading
import unittest
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer

import portals


class PortalTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), portals.H)
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(self, path, fields=None):
        data = urllib.parse.urlencode(fields).encode() if fields is not None else None
        with self.client.open(self.base + path, data=data, timeout=10) as r:
            return r.read()

    def login(self, vendor):
        fields = {
            "northwind": ("/northwind/login.asp", "txtUser", "txtPass"),
            "contoso": ("/contoso/signon.cgi", "acct", "pin"),
            "acme": ("/acme/Login.aspx", "ctl00$Main$txtUserName", "ctl00$Main$txtPassword"),
        }
        path, user, password = fields[vendor]
        login = portals.LOGINS[vendor]
        return self.request(path, {user: login["username"], password: login["password"]})

    def test_seeded_logins_and_isolated_sessions(self):
        self.assertIn(b"Welcome", self.login("northwind"))
        self.assertIn(b"frameset", self.login("contoso"))
        self.assertIn(b"I Acknowledge", self.login("acme"))
        self.assertIn(b"Invoice History", self.request("/northwind/invoices.asp"))
        self.assertIn(b"PURCHASE ORDERS", self.request("/contoso/pos.cgi"))
        self.assertIn(b"Account Documents", self.request("/acme/Notice.aspx", {"__EVENTTARGET": "ctl00$Main$btnAgree"}))

    def test_wrong_password_is_rejected(self):
        self.assertIn(b"Invalid User ID", self.request("/northwind/login.asp", {"txtUser": "apclerk", "txtPass": "wrong"}))
        self.assertIn(b"Customer Login", self.request("/northwind/invoices.asp"))
        self.assertIn(b"SIGNON FAILED", self.request("/contoso/signon.cgi", {"acct": "CF-88213", "pin": "wrong"}))
        self.assertIn(b"Login failed", self.request("/acme/Login.aspx", {"ctl00$Main$txtUserName": "bbs_ap", "ctl00$Main$txtPassword": "wrong"}))

    def test_northwind_pagination_pdfs_and_statement(self):
        self.login("northwind")
        first = self.request("/northwind/invoices.asp?yr=2026&pg=1")
        second = self.request("/northwind/invoices.asp?yr=2026&pg=2")
        self.assertNotIn(b"INV-10471", first)
        self.assertIn(b"INV-10471", second)
        for row in portals.NORTHWIND:
            pdf = self.request("/northwind/getdoc.asp?id=" + row[0])
            self.assertTrue(pdf.startswith(b"%PDF-1.4"))
            self.assertIn(row[0].encode(), pdf)
            self.assertIn(portals.money(row[3]).encode(), pdf)
        statement = self.request("/northwind/statement.asp?month=2026-10")
        self.assertIn(b"ST-NW-202610", statement)
        self.assertIn(b"$2,818.35", statement)

    def test_contoso_search_po_and_delivery_downloads(self):
        self.login("contoso")
        page = self.request("/contoso/bills.cgi?from=10%2F01%2F2026&to=10%2F31%2F2026")
        self.assertIn(b"2 RECORD(S)", page)
        self.assertNotIn(b"FB-77088", page)
        for row in portals.CONTOSO_BILLS:
            self.assertIn(row[0].encode(), self.request("/contoso/print.cgi", {"pro": row[0]}))
        for row in portals.CONTOSO_POS:
            self.assertTrue(self.request("/contoso/podoc.cgi?po=" + row[0]).startswith(b"%PDF"))
        self.assertIn(b"NOT YET BILLED", self.request("/contoso/po.cgi?po=PO-5552"))
        for row in portals.DELIVERIES:
            self.assertIn(row[0].encode(), self.request("/contoso/podprint.cgi?id=" + row[0]))

    def test_acme_notice_postbacks_pagination_and_print_documents(self):
        self.login("acme")
        self.assertIn(b"I Acknowledge", self.request("/acme/Documents.aspx"))
        self.request("/acme/Notice.aspx", {"__EVENTTARGET": "ctl00$Main$btnAgree"})
        for kind, rows in portals.ACME_DOCS.items():
            page = self.request("/acme/Documents.aspx", {
                "__EVENTTARGET": "ctl00$Main$btnRetrieve",
                "ctl00$Main$ddlDocType": kind, "ctl00$Main$ddlRange": "Last 90 days",
            })
            self.assertIn(rows[-1][0].encode(), page)
            for row in rows:
                page = self.request("/acme/Documents.aspx", {
                    "__EVENTTARGET": "ctl00$Main$gvDocs", "__EVENTARGUMENT": "Open$" + row[0],
                    "ctl00$Main$ddlDocType": kind,
                })
                self.assertIn(row[0].encode(), page)
                self.assertIn(portals.money(row[3]).encode(), page)
        page = self.request("/acme/Documents.aspx", {
            "__EVENTTARGET": "ctl00$Main$gvDocs", "__EVENTARGUMENT": "Page$2",
            "ctl00$Main$ddlDocType": "Invoices", "ctl00$Main$ddlRange": "Last 30 days",
        })
        self.assertIn(b"AC-INV-2291", page)

    def test_fixture_exceptions_are_intentional(self):
        ledger = {e["id"]: e for e in portals.DEMO["ledger"]}
        nw = {r[0]: r for r in portals.NORTHWIND}
        self.assertEqual(nw["INV-10471"][3], ledger["L-1001"]["amount"])
        self.assertEqual(ledger["L-1002"]["amount"] - nw["INV-10482"][3], 36)
        self.assertFalse(any(e.get("poNumber") == nw["INV-10493"][2] for e in ledger.values()))
        bad_totals = [r[0] for r in portals.NORTHWIND if abs(sum(q * u for _, q, u in r[5]) - r[3]) > .01]
        self.assertEqual(bad_totals, ["INV-10501"])
        self.assertFalse(any(b[2] == "PO-5552" for b in portals.CONTOSO_BILLS))
        invoices = {r[0]: r for r in portals.ACME_DOCS["Invoices"]}
        receipts = {r[0]: r for r in portals.ACME_DOCS["Payment Receipts"]}
        credits = {r[0]: r for r in portals.ACME_DOCS["Credit Memos"]}
        self.assertEqual(invoices["AC-INV-2315"][3] - receipts["RC-8850"][3] + credits["CM-0124"][3], 400)
        self.assertEqual(receipts["RC-8840"][2:4], receipts["RC-8841"][2:4])
        october = lambda rows: sum(r[1].startswith("2026-10") for r in rows)
        total = october(portals.NORTHWIND) + 1 + october(portals.CONTOSO_BILLS) + october(portals.CONTOSO_POS) + october(portals.DELIVERIES)
        total += sum(october(rows) for rows in portals.ACME_DOCS.values())
        self.assertEqual(total, 23)
        self.assertIn("ACH-761204", portals.ACME_NOTES["RC-8840"])
        self.assertIn("ACH-761204", portals.ACME_NOTES["RC-8841"])
        self.assertEqual(ledger["L-1012"]["amount"], ledger["L-1013"]["amount"])


if __name__ == "__main__":
    unittest.main()
