# How to Test CORS Headers - Simple Steps

## Method 1: Use the Test Page (Easiest)

1. **Open the test file:**
   - Go to your project folder: `c:\Users\paint\Downloads\paintyum_site\`
   - Double-click `verify-icecast-cors.html`
   - OR right-click it → Open with → Chrome/Firefox/Edge

2. **Enter your ngrok URL:**
   - In the text box, type: `https://kam-budless-gael.ngrok-free.dev`
   - (Or whatever your current ngrok URL is)

3. **Click "Test CORS Headers" button**
   - It will tell you if CORS is working or not

---

## Method 2: Test Directly in Browser (Quick)

1. **Open your ngrok status page:**
   - Go to: `https://kam-budless-gael.ngrok-free.dev/status-json.xsl`
   - You should see JSON data

2. **Open Developer Tools:**
   - Press `F12`
   - Click the **Network** tab

3. **Check Response Headers:**
   - In the Network tab, click on `status-json.xsl`
   - Look at the **Response Headers** section
   - You should see:
     - `Access-Control-Allow-Origin: *` (or your domain)
     - `Access-Control-Allow-Methods: GET, POST, OPTIONS, HEAD`
     - `Access-Control-Allow-Headers: Content-Type, X-Requested-With`

**If you DON'T see these headers**, CORS is not configured correctly.

---

## Method 3: Test in Console (For Developers)

1. Open your website
2. Press `F12` → Console tab
3. Paste this code:

```javascript
fetch('https://kam-budless-gael.ngrok-free.dev/status-json.xsl')
  .then(r => {
    console.log('✅ Fetch succeeded!');
    console.log('CORS Origin header:', r.headers.get('Access-Control-Allow-Origin'));
    return r.json();
  })
  .then(data => console.log('✅ Data received:', data))
  .catch(e => console.error('❌ CORS Error:', e));
```

If it works, you'll see the data. If it fails, you'll see a CORS error.

