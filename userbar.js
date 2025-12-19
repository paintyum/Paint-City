import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const userLink = document.getElementById("userLink");

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
            ONLINE <img src="online.gif" alt="online" class="online-icon">
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
        // Clear lastActive before signing out
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
  } catch (err) {
    console.error("Failed to load user", err);
  }
});