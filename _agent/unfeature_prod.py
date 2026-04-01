"""Clear all featured predictions on production so the dashboard shows the latest upload."""
import json
import os
import urllib.parse
import urllib.request

import requests

BASE_URL = os.getenv("CRICPREDICT_BASE_URL", "https://cric-predic.onrender.com").rstrip("/")
ADMIN_USER = os.getenv("CRICPREDICT_ADMIN_USER", "jainil")
ADMIN_PASSWORD = os.getenv("CRICPREDICT_ADMIN_PASSWORD", "jainil")

try:
    data = urllib.parse.urlencode({"username": ADMIN_USER, "password": ADMIN_PASSWORD}).encode()
    req = urllib.request.Request(f"{BASE_URL}/api/login", data=data)
    res = urllib.request.urlopen(req)
    token = json.loads(res.read())["access_token"]
    print("Logged into production server successfully.")

    headers = {"Authorization": "Bearer " + token}

    r = requests.get(f"{BASE_URL}/api/admin/predictions", headers=headers)
    preds = r.json()

    unset_count = 0
    for p in preds:
        if p.get("is_featured"):
            print(f"Found featured match: {p['match_id']} (ID: {p['id']})")
            del_r = requests.delete(
                f"{BASE_URL}/api/admin/predictions/{p['id']}/feature",
                headers=headers,
            )
            print("Unfeature Response:", del_r.status_code)
            unset_count += 1

    print(
        f"Unfeatured {unset_count} match(es). With none featured, dashboard uses the latest upload."
    )
except Exception as e:
    print("Error:", e)
