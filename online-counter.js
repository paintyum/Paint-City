import { realtimeDb } from "./firebase.js";
import { ref, onValue, onDisconnect, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Generate a device fingerprint based on browser characteristics
// This will be the same for all tabs on the same device
function getDeviceId() {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    // Create a device ID based on screen resolution, timezone, and language
    const fingerprint = `${screen.width}x${screen.height}_${navigator.language}_${new Date().getTimezoneOffset()}_${navigator.userAgent.substring(0, 50)}`;
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    deviceId = `device_${Math.abs(hash)}`;
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

const deviceId = getDeviceId();
const deviceRef = ref(realtimeDb, `presence/${deviceId}`);
const connectionsRef = ref(realtimeDb, 'presence');

// Set device as active
set(deviceRef, {
  online: true,
  lastActive: serverTimestamp(),
  userAgent: navigator.userAgent.substring(0, 50)
});

// Remove device when user disconnects
onDisconnect(deviceRef).remove();

// Update presence every 30 seconds to show we're still here
setInterval(() => {
  set(deviceRef, {
    online: true,
    lastActive: serverTimestamp(),
    userAgent: navigator.userAgent.substring(0, 50)
  });
}, 30000);

// Listen for all active devices
onValue(connectionsRef, (snapshot) => {
  const devices = snapshot.val();
  const count = devices ? Object.keys(devices).length : 0;
  
  const onlineCountElement = document.getElementById('onlineCount');
  if (onlineCountElement) {
    onlineCountElement.textContent = count;
  }
});

// Clean up on page unload (but keep device presence for a bit)
window.addEventListener('beforeunload', () => {
  // The onDisconnect will handle cleanup
});