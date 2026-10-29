"""Send one action to browserd. Usage: ctl.py <base64-json>. Prints the JSON reply."""

import base64
import json
import sys
import urllib.request

body = base64.b64decode(sys.argv[1])
timeout = json.loads(body).get("timeout", 60) + 15
req = urllib.request.Request("http://127.0.0.1:7777/", data=body, headers={"Content-Type": "application/json"})
try:
    sys.stdout.write(urllib.request.urlopen(req, timeout=timeout).read().decode())
except Exception as e:  # noqa: BLE001
    sys.stdout.write(json.dumps({"ok": False, "error": f"browserd unreachable: {e}", "daemon_down": True}))
