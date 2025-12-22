# Test if CORS Headers Are Working

## Quick Test

1. Make sure your ngrok is running and you have the URL (e.g., `https://kam-budless-gael.ngrok-free.dev`)
2. Open a new browser tab
3. Go to: `https://kam-budless-gael.ngrok-free.dev/status-json.xsl`
4. Open browser DevTools (F12) → Network tab
5. Refresh the page
6. Click on the `status-json.xsl` request
7. Look at "Response Headers" - you should see:
   - `Access-Control-Allow-Origin: *` (or your domain)
   - `Access-Control-Allow-Methods: GET, POST, OPTIONS, HEAD`
   - `Access-Control-Allow-Headers: Content-Type, X-Requested-With`

**If you DON'T see these headers**, the Icecast config isn't working.

## Common Issues:

1. **Icecast wasn't restarted** - You MUST restart Icecast after editing icecast.xml
2. **Headers in wrong place** - They must be inside `<icecast>` but after `</paths>`
3. **XML syntax error** - Check for typos, missing quotes, or unclosed tags
4. **Wrong file** - Make sure you edited the icecast.xml that's actually being used

## Verify Your icecast.xml:

The `<http-headers>` section should look EXACTLY like this (inside `<icecast>` tag):

```xml
<icecast>
    <!-- other config -->
    </paths>
    <http-headers>
        <header name="Access-Control-Allow-Origin" value="*" />
        <header name="Access-Control-Allow-Methods" value="GET, POST, OPTIONS, HEAD" />
        <header name="Access-Control-Allow-Headers" value="Content-Type, X-Requested-With" />
    </http-headers>
    <!-- rest of config -->
</icecast>
```

**Important:** Make sure there are NO typos, and the quotes are straight quotes (") not curly quotes (").

