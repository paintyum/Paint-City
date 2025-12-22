# Setup ngrok URL in Firebase (For GitHub Pages)

Since your site on GitHub Pages is HTTPS, it needs to get the ngrok URL from Firebase.

## Quick Setup:

1. **Go to your website** (the live version that works)
2. **Go to Settings page** (if you have one) OR
3. **Use Firebase Console directly:**
   - Go to: https://console.firebase.google.com/
   - Select your project
   - Go to Firestore Database
   - Create a collection called `config` (if it doesn't exist)
   - Create a document with ID `radio` in the `config` collection
   - Add a field:
     - Field name: `ngrokUrl`
     - Field type: `string`
     - Value: `https://kam-budless-gael.ngrok-free.dev` (or your current ngrok URL)

## Or use Settings page:

If your website has a settings page with "Update ngrok URL" button:
1. Log in as admin
2. Go to Settings
3. Paste your ngrok URL (e.g., `https://kam-budless-gael.ngrok-free.dev`)
4. Click Update

## Verify it's set:

After setting it, refresh your GitHub Pages site. The radio should work!

The code looks for: `config/radio` document with `ngrokUrl` field.

