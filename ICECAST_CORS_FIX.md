# Fix CORS Errors for Radio Stream

## The Problem
Your website (paintyum.com) is trying to access the ngrok stream, but Icecast doesn't send CORS headers, so the browser blocks the requests.

## Solution: Configure Icecast to Send CORS Headers

You need to edit your Icecast configuration file to add CORS headers.

### Step 1: Find Your Icecast Config File

The config file is usually named `icecast.xml` and located in:
- Windows: Usually in `C:\Program Files\Icecast\` or `C:\Program Files (x86)\Icecast\`
- Or wherever you installed Icecast

### Step 2: Edit the Config File

Open `icecast.xml` in a text editor and find the `<http-headers>` section (or add it if it doesn't exist).

Add or modify it to include CORS headers:

```xml
<http-headers>
    <header name="Access-Control-Allow-Origin" value="*" />
    <header name="Access-Control-Allow-Methods" value="GET, POST, OPTIONS, HEAD" />
    <header name="Access-Control-Allow-Headers" value="Content-Type, X-Requested-With" />
    <header name="Access-Control-Max-Age" value="86400" />
</http-headers>
```

**Important:** Replace `*` with your actual domain for better security:
```xml
<header name="Access-Control-Allow-Origin" value="https://paintyum.com" />
```

Or allow multiple origins:
```xml
<header name="Access-Control-Allow-Origin" value="https://paintyum.com, https://www.paintyum.com" />
```

### Step 3: Restart Icecast

After saving the config file, restart Icecast for the changes to take effect.

### Step 4: Test

After restarting:
1. Make sure ngrok is running
2. Make sure Mixxx is connected and broadcasting
3. Refresh your website - the radio should work!

## Alternative: Using ngrok Response Headers (Hobby Plan)

If you have ngrok Hobby plan or higher, you can also add headers via ngrok's configuration:

1. Edit `%LOCALAPPDATA%\ngrok\ngrok.yml` (or create it if it doesn't exist)
2. Add response headers:

```yaml
version: "2"
tunnels:
  web:
    proto: http
    addr: 8000
    response_headers:
      Access-Control-Allow-Origin: "https://paintyum.com"
      Access-Control-Allow-Methods: "GET, POST, OPTIONS, HEAD"
      Access-Control-Allow-Headers: "Content-Type, X-Requested-With"
```

3. Restart ngrok

## Note About Security

Using `*` (asterisk) allows any website to access your stream. For production, specify your actual domain(s) for better security.

