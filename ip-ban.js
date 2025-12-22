// IP Ban System (Admin only)
// Note: Client-side IP detection is limited. This uses a workaround by storing a device fingerprint.
// For true IP bans, server-side implementation is recommended.

import { db, auth } from './firebase.js';
import { collection, doc, getDoc, setDoc, deleteDoc, getDocs, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Generate device fingerprint (simple version - combines user agent, screen resolution, timezone)
function generateDeviceFingerprint() {
  const components = [
    navigator.userAgent,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset().toString(),
    navigator.language
  ];
  return btoa(components.join('|')).substring(0, 32); // Base64 encode and truncate
}

// Check if current device is banned
export async function checkIfDeviceBanned() {
  try {
    const fingerprint = generateDeviceFingerprint();
    const bannedDeviceDoc = await getDoc(doc(db, 'bannedDevices', fingerprint));
    return bannedDeviceDoc.exists();
  } catch (err) {
    console.error('Error checking device ban:', err);
    return false;
  }
}

// Store device fingerprint for user (admin only, for tracking)
export async function storeDeviceFingerprint(userId) {
  if (!auth.currentUser) return;
  
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (!userDoc.exists() || !userDoc.data().isAdmin) {
      return; // Admin only
    }
    
    const fingerprint = generateDeviceFingerprint();
    const userDeviceRef = doc(db, 'users', userId);
    const userDocToUpdate = await getDoc(userDeviceRef);
    
    if (userDocToUpdate.exists()) {
      const userData = userDocToUpdate.data();
      const deviceFingerprints = userData.deviceFingerprints || [];
      if (!deviceFingerprints.includes(fingerprint)) {
        deviceFingerprints.push(fingerprint);
        await updateDoc(userDeviceRef, {
          deviceFingerprints: deviceFingerprints
        });
      }
    }
  } catch (err) {
    console.error('Error storing device fingerprint:', err);
  }
}

// Ban device by fingerprint (admin only)
export async function banDevice(fingerprint, username) {
  if (!auth.currentUser) {
    alert('Must be logged in');
    return false;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (!userDoc.exists() || !userDoc.data().isAdmin) {
      alert('Admin only');
      return false;
    }
    
    await setDoc(doc(db, 'bannedDevices', fingerprint), {
      fingerprint: fingerprint,
      bannedAt: Date.now(),
      bannedBy: auth.currentUser.uid,
      username: username || 'Unknown'
    });
    
    return true;
  } catch (err) {
    console.error('Error banning device:', err);
    alert('Error banning device: ' + err.message);
    return false;
  }
}

// Unban device by fingerprint (admin only)
export async function unbanDevice(fingerprint) {
  if (!auth.currentUser) {
    alert('Must be logged in');
    return false;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (!userDoc.exists() || !userDoc.data().isAdmin) {
      alert('Admin only');
      return false;
    }
    
    await deleteDoc(doc(db, 'bannedDevices', fingerprint));
    return true;
  } catch (err) {
    console.error('Error unbanning device:', err);
    alert('Error unbanning device: ' + err.message);
    return false;
  }
}

// Ban all devices for a user (admin only) - bans all stored fingerprints
export async function banUserDevices(userId, username) {
  if (!auth.currentUser) {
    alert('Must be logged in');
    return false;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (!userDoc.exists() || !userDoc.data().isAdmin) {
      alert('Admin only');
      return false;
    }
    
    const targetUserDoc = await getDoc(doc(db, 'users', userId));
    if (!targetUserDoc.exists()) {
      alert('User not found');
      return false;
    }
    
    const userData = targetUserDoc.data();
    const deviceFingerprints = userData.deviceFingerprints || [];
    
    let bannedCount = 0;
    for (const fingerprint of deviceFingerprints) {
      await banDevice(fingerprint, username);
      bannedCount++;
    }
    
    alert(`Banned ${bannedCount} device(s) for ${username}`);
    return true;
  } catch (err) {
    console.error('Error banning user devices:', err);
    alert('Error banning devices: ' + err.message);
    return false;
  }
}

// Check on page load if device is banned
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const isBanned = await checkIfDeviceBanned();
    if (isBanned) {
      alert('This device has been banned from accessing the site.');
      // Optionally sign out and redirect
      window.location.href = 'login.html';
    } else {
      // Store fingerprint for tracking (if admin)
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().isAdmin) {
        await storeDeviceFingerprint(user.uid);
      }
    }
  }
});
