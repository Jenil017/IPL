"""Upload a sample match JSON to the deployed CricPredict API. Prefer env vars for secrets."""
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

import requests

BASE_URL = os.getenv("CRICPREDICT_BASE_URL", "https://cric-predic.onrender.com").rstrip("/")
ADMIN_USER = os.getenv("CRICPREDICT_ADMIN_USER", "jainil")
ADMIN_PASSWORD = os.getenv("CRICPREDICT_ADMIN_PASSWORD", "jainil")
_JSON_FILE = Path(__file__).resolve().parent / "match_5_lsg_vs_dc.json"

try:
    data = urllib.parse.urlencode({"username": ADMIN_USER, "password": ADMIN_PASSWORD}).encode()
    req = urllib.request.Request(f"{BASE_URL}/api/login", data=data)
    res = urllib.request.urlopen(req)
    token = json.loads(res.read())["access_token"]
    print("Logged into production server successfully.")

    with open(_JSON_FILE, "rb") as f:
        files = {"file": (_JSON_FILE.name, f, "application/json")}
        headers = {"Authorization": "Bearer " + token}
        r = requests.post(f"{BASE_URL}/api/upload", files=files, headers=headers)
        print("Upload Response:", r.status_code)
        print(r.text)
except Exception as e:
    print("Error uploading to prod:", e)
