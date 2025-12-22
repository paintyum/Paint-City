import { auth, db, realtimeDb } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const userLink = document.getElementById("userLink");

// Function to save user progress (level, points, messageCount) to Firebase
async function saveUserProgress() {
  if (!auth.currentUser) return;
  
  try {
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const messageCount = userData.messageCount || 0;
      
      // Calculate level and points from messageCount to ensure consistency
      // Level 1: 0-99 messages, Level 2: 100-199, etc.
      const level = Math.floor(messageCount / 100) + 1;
      // Points: 25 points every 50 messages
      const points = Math.floor(messageCount / 50) * 25;
      
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        level: level,
        points: points,
        messageCount: messageCount,
        lastActive: Date.now()
      });
      
      console.log('User progress saved:', { level, points, messageCount });
    }
  } catch (err) {
    console.error('Error saving user progress:', err);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    userLink.innerHTML = '<a href="login.html">login</a>';
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const username = snap.data().username;

    userLink.innerHTML = `
      <div class="user-menu">
        <div class="user-info">
          <div>User: ${username}</div>
          <div class="online-status">
            ONLINE <span class="online-dot"></span>
          </div>
        </div>
        <div class="dropdown">
          <a href="settings.html">settings</a>
          <a href="#" id="logoutLink">logout</a>
        </div>
      </div>
    `;

    // Add logout event listener after creating the element
    document.getElementById('logoutLink').addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        // Save user progress before logging out
        await saveUserProgress();
        
        // Remove chat presence before logging out
        if (window.removeChatPresence) {
          window.removeChatPresence();
        }
        
        // Also remove from Firebase Realtime Database directly
        try {
          const chatPresenceRef = ref(realtimeDb, `chatPresence/${auth.currentUser.uid}`);
          await set(chatPresenceRef, null);
        } catch (presenceErr) {
          console.error("Error removing chat presence:", presenceErr);
        }
        
        // Set lastActive to 0 to mark as offline
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          lastActive: 0
        });
        
        await signOut(auth);
        window.location.href = "index.html";
      } catch (err) {
        console.error("Logout error:", err);
        alert("Error logging out");
      }
    });
    
    // Save progress when page is about to unload (closing tab/window)
    window.addEventListener('beforeunload', () => {
      if (auth.currentUser) {
        // Use synchronous save for beforeunload
        saveUserProgress();
      }
    });
    
    // Also save on visibility change (tab switching, minimizing)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && auth.currentUser) {
        saveUserProgress();
      }
    });
  } catch (err) {
    console.error("Failed to load user", err);
  }
});