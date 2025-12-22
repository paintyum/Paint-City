# How to Enable CORS for Radio Status Endpoint

The radio player needs to fetch track info from the Icecast status endpoint (`/status-json.xsl`), but CORS (Cross-Origin Resource Sharing) is blocking these requests.

## Option 1: Configure Icecast (RECOMMENDED - Works with Free ngrok)

This is the best option because it works regardless of your ngrok plan.

### Step 1: Find Your Icecast Config File

The config file is usually named `icecast.xml` and located in:
- Windows: `C:\Program Files\Icecast\` or `C:\Program Files (x86)\Icecast\`
- Or wherever you installed Icecast

### Step 2: Edit icecast.xml

Open `icecast.xml` in a text editor (run as Administrator if needed).

Find the `<http-headers>` section, or add it if it doesn't exist. It should be inside the `<icecast>` root element.

**If `<http-headers>` doesn't exist**, add this after the `<paths>` section:

```xml
<http-headers>
    <header name="Access-Control-Allow-Origin" value="https://paintyum.com" />
    <header name="Access-Control-Allow-Methods" value="GET, POST, OPTIONS, HEAD" />
    <header name="Access-Control-Allow-Headers" value="Content-Type, X-Requested-With" />
    <header name="Access-Control-Max-Age" value="86400" />
</http-headers>
```

**If `<http-headers>` already exists**, add these header lines inside it:

```xml
<header name="Access-Control-Allow-Origin" value="https://paintyum.com" />
<header name="Access-Control-Allow-Methods" value="GET, POST, OPTIONS, HEAD" />
<header name="Access-Control-Allow-Headers" value="Content-Type, X-Requested-With" />
<header name="Access-Control-Max-Age" value="86400" />
```

**For local development**, you can use `*` to allow all origins:

```xml
<header name="Access-Control-Allow-Origin" value="*" />
```

**For production**, specify your exact domain(s):

```xml
<header name="Access-Control-Allow-Origin" value="https://paintyum.com" />
```

Or multiple domains:

```xml
<header name="Access-Control-Allow-Origin" value="https://paintyum.com, https://www.paintyum.com, http://127.0.0.1:5501" />
```

### Step 3: Restart Icecast

1. Stop Icecast (if running as a service, stop the service)
2. Start Icecast again
3. Make sure your stream is broadcasting

### Step 4: Test

1. Make sure ngrok is running
2. Make sure your radio software (Mixxx) is connected and broadcasting
3. Refresh your website
4. The track info should now load!

---

## Option 2: Configure ngrok Response Headers (Requires Paid Plan)

**Note:** This only works if you have ngrok Hobby plan ($8/month) or higher. Free ngrok doesn't support response headers.

### Step 1: Copy ngrok.yml to the Right Location

1. Copy `ngrok.yml` from this project folder
2. Paste it to: `%LOCALAPPDATA%\ngrok\ngrok.yml`
   - Press `Win+R`, type `%LOCALAPPDATA%\ngrok`, press Enter
   - Create the `ngrok` folder if it doesn't exist
   - Paste the `ngrok.yml` file there

### Step 2: Update ngrok.yml (if needed)

Open `%LOCALAPPDATA%\ngrok\ngrok.yml` and make sure it has:

```yaml
version: "2"
tunnels:
  web:
    proto: http
    addr: 8000
    inspect: false
    response_headers:
      Access-Control-Allow-Origin: "https://paintyum.com"
      Access-Control-Allow-Methods: "GET, POST, OPTIONS, HEAD"
      Access-Control-Allow-Headers: "Content-Type, X-Requested-With, ngrok-skip-browser-warning"
      Access-Control-Max-Age: "86400"
```

### Step 3: Restart ngrok with Config

Stop ngrok (Ctrl+C) and restart it using the config file:

```batch
ngrok.exe http 8000 --config %LOCALAPPDATA%\ngrok\ngrok.yml
```

Or update `start-ngrok.bat` to use the config file.

---

## Which Option Should I Use?

- **Use Option 1 (Icecast)** if you're on ngrok free plan or want the most reliable solution
- **Use Option 2 (ngrok)** if you already have a paid ngrok plan and prefer configuring it there

## Troubleshooting

### Still getting CORS errors?

1. **Clear your browser cache** - Old responses might be cached
2. **Check the browser console** - Look for the exact error message
3. **Verify the headers are set** - Use browser DevTools → Network tab → Check the Response Headers for `/status-json.xsl`
4. **Make sure you restarted Icecast/ngrok** after making changes

### Testing if CORS is working:

Open browser DevTools (F12) → Console, and run:

```javascript
fetch('YOUR_NGROK_URL/status-json.xsl')
  .then(r => r.json())
  .then(d => console.log('CORS works!', d))
  .catch(e => console.error('CORS failed:', e))
```

If it works, you'll see the JSON data. If it fails, you'll see a CORS error.

