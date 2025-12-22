# Fix Duplicate CORS Header Error

## The Problem

You're getting this error:
```
The 'Access-Control-Allow-Origin' header contains multiple values '*, *', but only one is allowed.
```

This means BOTH Icecast AND ngrok are sending CORS headers, creating duplicates.

## Solution: Remove CORS Headers from One of Them

You only need CORS headers from ONE source. Since Icecast is already configured and working, let's remove them from ngrok.

### Option 1: Remove from ngrok (Recommended since Icecast is already set up)

1. Open: `%LOCALAPPDATA%\ngrok\ngrok.yml`
2. Remove or comment out the `response_headers` section:

```yaml
version: "2"
tunnels:
  web:
    proto: http
    addr: 8000
    inspect: false
    # Removed response_headers - using Icecast CORS headers instead
    # response_headers:
    #   Access-Control-Allow-Origin: "*"
    #   Access-Control-Allow-Methods: "GET, POST, OPTIONS, HEAD"
    #   Access-Control-Allow-Headers: "Content-Type, X-Requested-With, ngrok-skip-browser-warning"
    #   Access-Control-Max-Age: "86400"
```

3. Restart ngrok

### Option 2: Remove from Icecast (Alternative)

If you prefer to use ngrok's headers instead:

1. Open `icecast.xml`
2. Remove or comment out the `<http-headers>` section
3. Restart Icecast
4. Make sure ngrok config has the headers

---

**I recommend Option 1** since Icecast is already configured and working. Just remove the duplicate from ngrok!

