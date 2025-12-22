# How to Start ngrok

## Quick Start

1. **Double-click `start-ngrok.bat`** in the project folder

That's it! The script will:
- Stop any existing ngrok processes
- Find ngrok.exe automatically
- Start ngrok on port 8000

## Manual Method

If the batch file doesn't work, you can start ngrok manually:

1. Open Command Prompt or PowerShell
2. Navigate to where ngrok.exe is located
3. Run: `ngrok.exe http 8000`

## Finding Your ngrok URL

After starting ngrok, you'll see a URL like:
```
Forwarding  https://abc123.ngrok-free.dev -> http://localhost:8000
```

Copy this URL and update it in Firebase:
1. Go to Settings page (must be logged in as admin)
2. Click "Update Radio Stream URL (Admin)"
3. Paste the ngrok URL (e.g., `https://abc123.ngrok-free.dev`)

## Important Notes

- **Keep ngrok running** while you want the radio stream to be accessible
- The ngrok URL changes every time you restart ngrok (unless you have a paid plan)
- Make sure Icecast is running on port 8000 before starting ngrok
- Make sure Mixxx is connected and broadcasting before testing the stream

## Troubleshooting

- If ngrok says "authentication failed", run `setup-ngrok-auth.bat` first
- If ngrok says "port already in use", make sure no other ngrok instances are running
- If the stream doesn't work, check that Icecast is running and Mixxx is connected

