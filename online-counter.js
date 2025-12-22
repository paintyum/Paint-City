import { realtimeDb } from "./firebase.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Listen for all logged-in users from chatPresence
// This counts actual logged-in users, not devices
const chatPresenceRef = ref(realtimeDb, 'chatPresence');

// Function to update online counter
function updateOnlineCounter(snapshot) {
  try {
    const users = snapshot.val();
    const now = Date.now();
    const INACTIVE_THRESHOLD = 120000; // 2 minutes - reduced from 10 minutes to match chat.js
    const uniqueUsernames = new Set(); // Track unique usernames to avoid counting duplicates
    
    if (users) {
      // Count unique usernames who were active in the last 10 minutes
      Object.keys(users).forEach(uid => {
        const userData = users[uid];
        if (userData && userData.username && userData.lastActive) {
          const timeSinceActive = now - userData.lastActive;
          // Consider user online if active within last 10 minutes
          if (timeSinceActive < INACTIVE_THRESHOLD) {
            const username = userData.username.trim();
            if (username) {
              uniqueUsernames.add(username.toLowerCase()); // Use lowercase for case-insensitive uniqueness
            }
          }
        }
      });
    }
    
    const count = uniqueUsernames.size;
    const onlineCountElement = document.getElementById('onlineCount');
    if (onlineCountElement) {
      onlineCountElement.textContent = count;
    }
  } catch (err) {
    console.error('Error updating online counter:', err);
    // On error, still try to show 0 or keep current value
    const onlineCountElement = document.getElementById('onlineCount');
    if (onlineCountElement && !onlineCountElement.textContent) {
      onlineCountElement.textContent = '0';
    }
  }
}

// Update counter when chatPresence changes
// Note: If this doesn't work for logged-out users, you need to update Firebase Realtime Database rules
// to allow unauthenticated reads: { "rules": { "chatPresence": { ".read": true, ".write": "auth != null" } } }
onValue(chatPresenceRef, updateOnlineCounter, (error) => {
  // This callback is called if the listener is cancelled (not for errors)
  console.log('Online counter listener cancelled:', error);
});

// Expose update function for other scripts
window.updateOnlineCounter = function() {
  // Counter updates automatically via onValue listener
  // This function is kept for compatibility
};