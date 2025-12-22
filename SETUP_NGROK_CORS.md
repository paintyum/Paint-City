# Setup ngrok CORS Headers (Paid Plan)

## Step-by-Step Instructions

### Step 1: Copy ngrok.yml to the Correct Location

1. **Find the ngrok config folder:**
   - Press `Win + R`
   - Type: `%LOCALAPPDATA%\ngrok`
   - Press Enter
   - This opens: `C:\Users\YOUR_USERNAME\AppData\Local\ngrok\`

2. **Copy the config file:**
   - If the `ngrok` folder doesn't exist, create it
   - Copy `ngrok.yml` from this project folder
   - Paste it into: `%LOCALAPPDATA%\ngrok\ngrok.yml`

### Step 2: Edit the Config File (if needed)

Open `%LOCALAPPDATA%\ngrok\ngrok.yml` in a text editor and verify it looks like this:

```yaml
version: "2"
tunnels:
  web:
    proto: http
    addr: 8000
    inspect: false
    response_headers:
      Access-Control-Allow-Origin: "*"
      Access-Control-Allow-Methods: "GET, POST, OPTIONS, HEAD"
      Access-Control-Allow-Headers: "Content-Type, X-Requested-With, ngrok-skip-browser-warning"
      Access-Control-Max-Age: "86400"
```

**Important:** 
- Use `"*"` to allow all origins (good for testing)
- Or use `"https://paintyum.com"` for production (more secure)

### Step 3: Restart ngrok with the Config

**Option A: Use the updated start-ngrok.bat**
- Just run `start-ngrok.bat` - it will automatically use the config file if it exists

**Option B: Manual command**
- Stop ngrok if it's running (Ctrl+C)
- Run this command:
  ```
  ngrok.exe http 8000 --config %LOCALAPPDATA%\ngrok\ngrok.yml
  ```

### Step 4: Verify It's Working

1. Start ngrok with the config
2. Start your Icecast stream
3. Open your website
4. Check the browser console (F12) - you should NOT see CORS errors
5. The track info should load!

## Troubleshooting

### Config file not found?
- Make sure you copied it to: `%LOCALAPPDATA%\ngrok\ngrok.yml`
- Check the exact path by running: `echo %LOCALAPPDATA%\ngrok\ngrok.yml`

### Still getting CORS errors?
1. Make sure you restarted ngrok after copying the config
2. Check that ngrok is using the config: Look for "Using config file" in ngrok output
3. Clear browser cache
4. Try using `"*"` for Access-Control-Allow-Origin to test

### Want to allow multiple domains?

```yaml
response_headers:
  Access-Control-Allow-Origin: "https://paintyum.com, http://127.0.0.1:5501"
```

Note: You can only specify ONE origin per header. For multiple origins, you'd need to use `"*"` or configure it in Icecast instead.

