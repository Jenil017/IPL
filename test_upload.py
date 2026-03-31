import urllib.request
import urllib.error
import urllib.parse
import json

data = urllib.parse.urlencode({'username': 'jainil', 'password': 'jainil'}).encode()
req = urllib.request.Request('http://127.0.0.1:8000/api/login', data=data)
res = urllib.request.urlopen(req)
token = json.loads(res.read())['access_token']

print("Token obtained")

import requests
with open(r'd:\IPL\_agent\sample_match_schema.json', 'rb') as f:
    files = {'file': ('sample_match_schema.json', f, 'application/json')}
    headers = {'Authorization': 'Bearer ' + token}
    r = requests.post('http://127.0.0.1:8000/api/upload', files=files, headers=headers)
    print(r.status_code)
    print(r.text)
