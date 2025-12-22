# Check Your Icecast Config for Duplicate Headers

Since your ngrok.yml doesn't have response_headers, the duplicate is coming from Icecast.

## How to Fix:

1. **Open your icecast.xml file:**
   - Usually at: `C:\Program Files\Icecast\icecast.xml`
   - Or: `C:\Program Files (x86)\Icecast\icecast.xml`
   - Right-click → Open with → Notepad (Run as Administrator if needed)

2. **Find the `<http-headers>` section:**
   - Press Ctrl+F
   - Search for: `http-headers`

3. **Check if `Access-Control-Allow-Origin` appears TWICE:**
   - You should only have ONE `<header name="Access-Control-Allow-Origin"` line
   - If you see it twice, delete one of them

4. **It should look like this (ONLY ONE of each header):**
```xml
<http-headers>
    <header name="Access-Control-Allow-Origin" value="*" />
    <header name="Access-Control-Allow-Methods" value="GET, POST, OPTIONS, HEAD" />
    <header name="Access-Control-Allow-Headers" value="Content-Type, X-Requested-With" />
</http-headers>
```

5. **If you see duplicate headers like this (WRONG):**
```xml
<http-headers>
    <header name="Access-Control-Allow-Origin" value="*" />
    <header name="Access-Control-Allow-Origin" value="*" />  <!-- DELETE THIS DUPLICATE -->
    <header name="Access-Control-Allow-Methods" value="GET, POST, OPTIONS, HEAD" />
    ...
</http-headers>
```

6. **Remove the duplicate line(s)**

7. **Save the file**

8. **Restart Icecast** (important!)

9. **Test again**

---

## Quick Check:

In your icecast.xml, search for "Access-Control-Allow-Origin" - you should only find it ONCE in the entire file.

