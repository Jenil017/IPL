import urllib.request
import urllib.parse
import json
import requests

try:
    data = urllib.parse.urlencode({'username': 'jainil', 'password': 'jainil'}).encode()
    req = urllib.request.Request('https://cric-predic.onrender.com/api/login', data=data)
    res = urllib.request.urlopen(req)
    token = json.loads(res.read())['access_token']
    print("Logged into production server successfully.")

    with open(r'd:\IPL\_agent\match_5_lsg_vs_dc.json', 'rb') as f:
        files = {'file': ('match_5_lsg_vs_dc.json', f, 'application/json')}
        headers = {'Authorization': 'Bearer ' + token}
        r = requests.post('https://cric-predic.onrender.com/api/upload', files=files, headers=headers)
        print("Upload Response:", r.status_code)
        print(r.text)
except Exception as e:
    print("Error uploading to prod:", e)
