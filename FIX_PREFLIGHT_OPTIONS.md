# Fix Preflight OPTIONS Request Issue

## The Problem

The browser is sending a "preflight" OPTIONS request before the actual GET request. This OPTIONS request is failing, which blocks the entire fetch.

## Solution 1: Remove Custom Headers (Easiest - Already Done)

I've updated the code to remove the custom headers (`Cache-Control`, `Pragma`) from the fetch request. This makes it a "simple request" that doesn't trigger a preflight check.

**This should work now!** Try refreshing your website.

---

## Solution 2: Configure ngrok to Handle OPTIONS (If Solution 1 Doesn't Work)

Since you have a paid ngrok plan, you can configure ngrok to handle OPTIONS requests:

1. Make sure your `%LOCALAPPDATA%\ngrok\ngrok.yml` has the response headers (it should already)
2. Restart ngrok with the config file

---

## Solution 3: Configure Icecast to Handle OPTIONS Requests

If the above doesn't work, Icecast might need explicit OPTIONS handling. However, the headers should already work for OPTIONS if they're configured correctly.

---

## Test It Now

1. **Hard refresh your website** (Ctrl+F5)
2. **Press play on the radio**
3. **Check the console** - you should see `[Track Info] Response status: 200` instead of CORS errors

The fetch request is now a "simple request" that won't trigger a preflight check, so it should work!

