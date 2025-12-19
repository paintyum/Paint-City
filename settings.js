import { auth, db } from "./firebase.js";
import { containsSlur } from "./content-filter.js";
import {
  onAuthStateChanged,
  updatePassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    document.getElementById("currentUsername").innerText = snap.data().username;
    
    // Show ngrok URL button for admins
    const ngrokUrlBtn = document.getElementById("ngrokUrlBtn");
    if (ngrokUrlBtn && snap.data().isAdmin) {
      ngrokUrlBtn.style.display = "block";
    }
  } catch (err) {
    console.error("Failed to load user", err);
  }
});

window.changeUsername = async function() {
  const newUsername = prompt("enter new username:");
  if (!newUsername) return;
  
  const username = newUsername.trim().toLowerCase();
  if (!username) {
    alert("username cannot be empty");
    return;
  }

  if (username.length > 15) {
    alert("Username must be 15 characters or less");
    return;
  }

  // Check for slurs in username
  if (containsSlur(username)) {
    alert("Username contains inappropriate language. Please choose a different username.");
    return;
  }

  const user = auth.currentUser;
  if (!user) return;

  // Check if username is banned
  try {
    const bannedUsernameDoc = await getDoc(doc(db, "bannedUsernames", username));
    if (bannedUsernameDoc.exists()) {
      alert("This username has been banned and cannot be used");
      return;
    }
  } catch (err) {
    console.error("Error checking banned username:", err);
  }

  const q = query(
    collection(db, "users"),
    where("username", "==", username)
  );
  
  try {
    const existing = await getDocs(q);
    if (!existing.empty) {
      alert("username already taken");
      return;
    }

    await updateDoc(doc(db, "users", user.uid), {
      username: username
    });

    alert("username updated!");
    window.location.reload();
  } catch (err) {
    alert("error updating username");
    console.error(err);
  }
};

window.changePassword = async function() {
  const newPassword = prompt("enter new password:");
  if (!newPassword) return;

  const confirmPassword = prompt("confirm new password:");
  if (newPassword !== confirmPassword) {
    alert("passwords do not match");
    return;
  }

  try {
    await updatePassword(auth.currentUser, newPassword);
    alert("password updated!");
  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      alert("please log out and log back in, then try again");
    } else {
      alert("error updating password");
    }
    console.error(err);
  }
};

// Update ngrok URL in Firebase (admin only)
window.updateNgrokUrl = async function() {
  const user = auth.currentUser;
  if (!user) {
    alert("Please log in first");
    return;
  }

  let userDoc;
  try {
    userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || !userDoc.data().isAdmin) {
      alert("Admin only");
      return;
    }
  } catch (err) {
    alert("Error checking admin status");
    return;
  }

  const newUrl = prompt("Enter new ngrok URL (e.g., https://abc123.ngrok-free.dev):");
  if (!newUrl) return;

  // Validate URL
  if (!newUrl.startsWith('https://') && !newUrl.startsWith('http://')) {
    alert("URL must start with https:// or http://");
    return;
  }

  try {
    await setDoc(doc(db, 'config', 'radio'), {
      ngrokUrl: newUrl,
      updatedAt: Date.now(),
      updatedBy: userDoc.data().username
    });
    alert("Ngrok URL updated! The stream will use the new URL on next page load.");
  } catch (err) {
    alert("Error updating ngrok URL: " + err.message);
    console.error(err);
  }
};

// Update ngrok URL in Firebase (admin only)
window.updateNgrokUrl = async function() {
  const user = auth.currentUser;
  if (!user) {
    alert("Please log in first");
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || !userDoc.data().isAdmin) {
      alert("Admin only");
      return;
    }
  } catch (err) {
    alert("Error checking admin status");
    return;
  }

  const newUrl = prompt("Enter new ngrok URL (e.g., https://abc123.ngrok-free.dev):");
  if (!newUrl) return;

  // Validate URL
  if (!newUrl.startsWith('https://') && !newUrl.startsWith('http://')) {
    alert("URL must start with https:// or http://");
    return;
  }

  try {
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    await setDoc(doc(db, 'config', 'radio'), {
      ngrokUrl: newUrl,
      updatedAt: Date.now(),
      updatedBy: userDoc.data().username
    });
    alert("Ngrok URL updated! The stream will use the new URL on next page load.");
  } catch (err) {
    alert("Error updating ngrok URL: " + err.message);
    console.error(err);
  }
};