# Easiest Way to Get Song Names Working

## Just 3 Steps:

### Step 1: Find icecast.xml
- Usually at: `C:\Program Files\Icecast\icecast.xml`
- Or: `C:\Program Files (x86)\Icecast\icecast.xml`
- Open it in Notepad (Right-click → Run as Administrator if needed)

### Step 2: Add These Lines

Find the `<icecast>` tag at the top, then look for `</paths>` (closing paths tag).

Right after `</paths>`, add this:

```xml
<http-headers>
    <header name="Access-Control-Allow-Origin" value="*" />
    <header name="Access-Control-Allow-Methods" value="GET, POST, OPTIONS, HEAD" />
    <header name="Access-Control-Allow-Headers" value="Content-Type, X-Requested-With" />
</http-headers>
```

**So it looks like:**
```xml
    </paths>
    <http-headers>
        <header name="Access-Control-Allow-Origin" value="*" />
        <header name="Access-Control-Allow-Methods" value="GET, POST, OPTIONS, HEAD" />
        <header name="Access-Control-Allow-Headers" value="Content-Type, X-Requested-With" />
    </http-headers>
    <!-- rest of your config -->
```

**If `<http-headers>` already exists**, just add the header lines inside it.

### Step 3: Restart Icecast
- Stop Icecast (close it or stop the service)
- Start Icecast again
- Done! Song names should now work.

---

That's it! No ngrok config needed. This works with free or paid ngrok.

