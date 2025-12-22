import { auth, db } from "./firebase.js";
import { containsSlur } from "./content-filter.js";
import { banUserDevices as banUserDevicesFunc, unbanDevice as unbanDeviceFunc } from './ip-ban.js';
import { validateNgrokUrl } from './image-security.js';
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
    window.location.href = "/login";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const usernameElement = document.getElementById("currentUsername");
    if (usernameElement) {
      usernameElement.innerText = snap.data().username;
    }
    
    // Show admin buttons for admins - use multiple methods to ensure they show
    const ngrokUrlBtn = document.getElementById("ngrokUrlBtn");
    const promoteModBtn = document.getElementById("promoteModBtn");
    
    if (snap.data().isAdmin) {
      console.log("User is admin - showing admin buttons");
      if (ngrokUrlBtn) {
        ngrokUrlBtn.style.display = "block";
        ngrokUrlBtn.style.setProperty("display", "block", "important");
        ngrokUrlBtn.style.visibility = "visible";
      }
      if (promoteModBtn) {
        promoteModBtn.style.display = "block";
        promoteModBtn.style.setProperty("display", "block", "important");
        promoteModBtn.style.visibility = "visible";
      }
      const banDevicesBtn = document.getElementById("banDevicesBtn");
      const unbanDeviceBtn = document.getElementById("unbanDeviceBtn");
      if (banDevicesBtn) {
        banDevicesBtn.style.display = "block";
        banDevicesBtn.style.setProperty("display", "block", "important");
      }
      if (unbanDeviceBtn) {
        unbanDeviceBtn.style.display = "block";
        unbanDeviceBtn.style.setProperty("display", "block", "important");
      }
    } else {
      console.log("User is not admin");
    }
  } catch (err) {
    console.error("Failed to load user", err);
  }
});

// Also check on DOMContentLoaded as a fallback
document.addEventListener("DOMContentLoaded", async () => {
  if (!auth.currentUser) return;
  
  try {
    const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (snap.exists() && snap.data().isAdmin) {
      const ngrokUrlBtn = document.getElementById("ngrokUrlBtn");
      const promoteModBtn = document.getElementById("promoteModBtn");
      if (ngrokUrlBtn) {
        ngrokUrlBtn.style.setProperty("display", "block", "important");
        ngrokUrlBtn.style.visibility = "visible";
      }
      if (promoteModBtn) {
        promoteModBtn.style.setProperty("display", "block", "important");
        promoteModBtn.style.visibility = "visible";
      }
      const banDevicesBtn = document.getElementById("banDevicesBtn");
      const unbanDeviceBtn = document.getElementById("unbanDeviceBtn");
      if (banDevicesBtn) {
        banDevicesBtn.style.setProperty("display", "block", "important");
      }
      if (unbanDeviceBtn) {
        unbanDeviceBtn.style.setProperty("display", "block", "important");
      }
    }
  } catch (err) {
    console.error("Failed to check admin status on DOMContentLoaded", err);
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
  if (!newUrl || !newUrl.trim()) return;

  const trimmedUrl = newUrl.trim();

  // Validate ngrok URL with comprehensive security checks
  const validation = validateNgrokUrl(trimmedUrl);
  if (!validation.valid) {
    alert("Invalid URL: " + validation.error + "\n\nPlease enter a valid ngrok URL (e.g., https://abc123.ngrok-free.dev)");
    return;
  }

  // Additional validation: ensure URL doesn't contain suspicious patterns
  if (trimmedUrl.includes('<script') || trimmedUrl.includes('javascript:') || 
      trimmedUrl.includes('onerror=') || trimmedUrl.includes('onload=')) {
    alert("Invalid URL format. Suspicious patterns detected.");
    return;
  }

  try {
    const userData = userDoc.data();
    const username = userData ? userData.username : 'admin';
    
    await setDoc(doc(db, 'config', 'radio'), {
      ngrokUrl: trimmedUrl,
      updatedAt: Date.now(),
      updatedBy: username
    });
    alert("Ngrok URL updated! The stream will use the new URL on next page load.");
  } catch (err) {
    alert("Error updating ngrok URL: " + err.message);
    console.error(err);
  }
};

// Promote user to mod (admin only)
window.promoteToMod = async function() {
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

  const usernameToPromote = prompt("Enter the username to promote to mod:");
  if (!usernameToPromote || !usernameToPromote.trim()) {
    return;
  }

  try {
    // Find user by username
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    let targetUserId = null;
    
    usersSnapshot.forEach((docSnap) => {
      if (docSnap.data().username && docSnap.data().username.toLowerCase() === usernameToPromote.trim().toLowerCase()) {
        targetUserId = docSnap.id;
      }
    });
    
    if (!targetUserId) {
      alert(`User "${usernameToPromote}" not found`);
      return;
    }
    
    // Promote to mod
    await updateDoc(doc(db, 'users', targetUserId), {
      isMod: true
    });
    
    alert(`${usernameToPromote} has been promoted to mod!`);
  } catch (err) {
    alert("Error promoting user: " + err.message);
    console.error(err);
  }
};

// Ban user devices (admin only)
window.banUserDevices = async function() {
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

  // Use a more reliable prompt method
  const usernameToBan = window.prompt("Enter the username whose devices/IPs to ban:");
  if (!usernameToBan || !usernameToBan.trim()) {
    return;
  }

  try {
    // Find user by username
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    let targetUserId = null;
    
    usersSnapshot.forEach((docSnap) => {
      if (docSnap.data().username && docSnap.data().username.toLowerCase() === usernameToBan.trim().toLowerCase()) {
        targetUserId = docSnap.id;
      }
    });
    
    if (!targetUserId) {
      alert(`User "${usernameToBan}" not found`);
      return;
    }
    
    await banUserDevicesFunc(targetUserId, usernameToBan);
  } catch (err) {
    alert("Error banning user devices: " + err.message);
    console.error(err);
  }
};

// Unban device (admin only) - shows a modal with list
window.unbanDevice = async function() {
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

  try {
    const bannedDevicesRef = collection(db, 'bannedDevices');
    const bannedDevices = await getDocs(bannedDevicesRef);
    
    if (bannedDevices.empty) {
      alert("No devices are currently banned.");
      return;
    }
    
    // Create a modal to show banned devices
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; justify-content: center; align-items: center;';
    modal.innerHTML = `
      <div style="background: #000; border: 2px solid #0066cc; padding: 20px; max-width: 600px; max-height: 80vh; overflow-y: auto; color: #fff;">
        <h2 style="color: #00ffff; margin-top: 0;">Banned Devices</h2>
        <div id="bannedDevicesList"></div>
        <button onclick="this.closest('div[style*=\\"position: fixed\\"]').remove()" style="background: #cc0000; color: #fff; padding: 10px 20px; border: none; cursor: pointer; margin-top: 20px;">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
    
    const listContainer = modal.querySelector('#bannedDevicesList');
    bannedDevices.forEach((docSnap) => {
      const data = docSnap.data();
      const deviceDiv = document.createElement('div');
      deviceDiv.style.cssText = 'border: 1px solid #0066cc; padding: 10px; margin: 10px 0;';
      deviceDiv.innerHTML = `
        <div><strong>Username:</strong> ${data.username || 'Unknown'}</div>
        <div><strong>Fingerprint:</strong> ${docSnap.id}</div>
        <div><strong>Banned:</strong> ${new Date(data.bannedAt).toLocaleString()}</div>
        <button onclick="unbanDeviceByFingerprint('${docSnap.id}'); this.closest('div[style*=\\"position: fixed\\"]').remove();" style="background: #00ff00; color: #000; padding: 5px 15px; border: none; cursor: pointer; margin-top: 5px;">Unban This Device</button>
      `;
      listContainer.appendChild(deviceDiv);
    });
  } catch (err) {
    alert("Error fetching banned devices: " + err.message);
    console.error(err);
  }
};

// Helper function to unban by fingerprint
window.unbanDeviceByFingerprint = async function(fingerprint) {
  try {
    await unbanDeviceFunc(fingerprint);
    alert("Device unbanned successfully!");
  } catch (err) {
    alert("Error unbanning device: " + err.message);
    console.error(err);
  }
};