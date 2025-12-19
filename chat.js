import { db, auth, realtimeDb } from './firebase.js';
import { censorSlurs } from './content-filter.js';
import { collection, addDoc, onSnapshot, query, orderBy, limit, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDoc, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, set, onDisconnect, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

let currentUsername = null;
let activeChatUsers = new Set();
let currentUserIsAdmin = false;
let userMap = new Map(); // Map username to userId

// Check if user is logged in
auth.onAuthStateChanged(async (user) => {
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const loginMessage = document.getElementById('loginMessage');
  const chatInputContainer = document.getElementById('chatInputContainer');
  const chatUsersSidebar = document.getElementById('chatUsersSidebar');
  const untimeoutBtn = document.getElementById('untimeoutBtn');
  const unbanBtn = document.getElementById('unbanBtn');
  
  if (!user) {
    chatInputContainer.style.display = 'none';
    loginMessage.style.display = 'block';
    if (chatUsersSidebar) chatUsersSidebar.style.display = 'none';
    if (untimeoutBtn) untimeoutBtn.style.display = 'none';
    if (unbanBtn) unbanBtn.style.display = 'none';
    currentUserIsAdmin = false;
    return;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      currentUsername = userDoc.data().username;
      currentUserIsAdmin = userDoc.data().isAdmin || false;
      chatInputContainer.style.display = 'flex';
      loginMessage.style.display = 'none';
      if (chatUsersSidebar) chatUsersSidebar.style.display = 'flex';
      
      // Show untimeout and unban buttons for admins
      if (untimeoutBtn) {
        untimeoutBtn.style.display = currentUserIsAdmin ? 'block' : 'none';
      }
      if (unbanBtn) {
        unbanBtn.style.display = currentUserIsAdmin ? 'block' : 'none';
      }
      
      // Mark user as active in chat
      const chatPresenceRef = ref(realtimeDb, `chatPresence/${user.uid}`);
      const now = Date.now();
      set(chatPresenceRef, {
        username: currentUsername,
        lastActive: now
      });
      onDisconnect(chatPresenceRef).remove();
      
      // Immediately update the user list to include current user
      activeChatUsers.add(currentUsername);
      updateChatUsersList();
    }
  } catch (err) {
    console.error('Error getting username:', err);
  }
});

// Track active chat users
const chatPresenceRef = ref(realtimeDb, 'chatPresence');
onValue(chatPresenceRef, (snapshot) => {
  const users = snapshot.val();
  activeChatUsers.clear();
  
  // Always include current user if logged in
  if (currentUsername) {
    activeChatUsers.add(currentUsername);
  }
  
  if (users) {
    const now = Date.now();
    // Only show users active in last 5 minutes
    Object.keys(users).forEach(uid => {
      const userData = users[uid];
      if (userData && userData.username && now - userData.lastActive < 300000) { // 5 minutes
        activeChatUsers.add(userData.username);
      }
    });
  }
  
  updateChatUsersList();
});

// Update presence periodically while logged in
setInterval(() => {
  if (auth.currentUser && currentUsername) {
    const chatPresenceRef = ref(realtimeDb, `chatPresence/${auth.currentUser.uid}`);
    set(chatPresenceRef, {
      username: currentUsername,
      lastActive: Date.now()
    });
  }
}, 30000); // Update every 30 seconds

function updateChatUsersList() {
  const chatUsersList = document.getElementById('chatUsersList');
  if (!chatUsersList) return;
  
  chatUsersList.innerHTML = '';
  
  if (activeChatUsers.size === 0) {
    chatUsersList.innerHTML = '<div class="chat-user-item" style="color: #666; font-style: italic;">No active users</div>';
    return;
  }
  
  const sortedUsers = Array.from(activeChatUsers).sort();
  sortedUsers.forEach(username => {
    const userId = userMap.get(username);
    
    // Add admin badge for "paint" username
    const adminBadge = username.toLowerCase() === 'paint' ? 
      `<img src="favicon.png" alt="Admin" class="admin-badge" style="width: 14px; height: 14px; vertical-align: middle; margin-left: 5px; display: inline-block;">` : '';
    
    if (currentUserIsAdmin && userId && username !== currentUsername) {
      // Admin hover menu for timeout options
      chatUsersList.innerHTML += `
        <div class="chat-user-item chat-user-admin" data-username="${username}" data-userid="${userId}">
          ${username}${adminBadge}
          <div class="chat-timeout-menu">
            <button onclick="timeoutUser('${userId}', '${username}', 5)">Timeout 5 min</button>
            <button onclick="timeoutUser('${userId}', '${username}', 30)">Timeout 30 min</button>
            <button onclick="timeoutUser('${userId}', '${username}', 60)">Timeout 1 hour</button>
            <button onclick="timeoutUser('${userId}', '${username}', 1440)">Timeout 1 day</button>
            <button onclick="banUser('${userId}', '${username}')" style="background: #cc0000; color: #fff; margin-top: 5px;">BAN USER</button>
          </div>
        </div>
      `;
    } else {
      chatUsersList.innerHTML += `<div class="chat-user-item">${username}${adminBadge}</div>`;
    }
  });
}

// Load chat messages - only show new messages, not old ones
const messagesRef = collection(db, 'chatMessages');
let lastMessageTimestamp = Date.now(); // Only show messages after page load

// Clear chat on page load
const chatMessages = document.getElementById('chatMessages');
if (chatMessages) {
  chatMessages.innerHTML = '';
}

const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));

onSnapshot(q, (snapshot) => {
  if (!chatMessages) return;
  
  const messages = [];
  snapshot.forEach((doc) => {
    const msgData = doc.data();
    // Only show messages that came in after page load
    if (msgData.timestamp > lastMessageTimestamp) {
      messages.push({ id: doc.id, ...msgData });
    }
  });
  
  // Reverse to show oldest first
  messages.reverse();
  
  messages.forEach((msg) => {
    const messageDate = new Date(msg.timestamp);
    const timeString = messageDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    // Store username to userId mapping
    if (msg.userId && msg.username) {
      userMap.set(msg.username, msg.userId);
    }
    
    // Censor slurs in chat messages
    const censoredText = censorSlurs(msg.text);
    
    // Add admin badge for "paint" username
    const adminBadge = msg.username.toLowerCase() === 'paint' ? 
      `<img src="favicon.png" alt="Admin" class="admin-badge" style="width: 16px; height: 16px; vertical-align: middle; margin-left: 5px; display: inline-block;">` : '';
    
    chatMessages.innerHTML += `
      <div class="chat-message">
        <span class="username">${msg.username}${adminBadge}:</span>
        <span class="message-text">${censoredText}</span>
        <span class="timestamp">${timeString}</span>
      </div>
    `;
  });
  
  // Auto scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Update last message timestamp
  if (messages.length > 0) {
    lastMessageTimestamp = Math.max(...messages.map(m => m.timestamp));
  }
});

// Check if user is timed out
async function checkTimeout() {
  if (!auth.currentUser) return false;
  
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.chatTimeoutUntil && userData.chatTimeoutUntil > Date.now()) {
        const timeLeft = userData.chatTimeoutUntil - Date.now();
        const minutes = Math.ceil(timeLeft / 60000);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        let timeString = '';
        if (hours > 0) {
          timeString = `${hours} hour${hours > 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
        } else {
          timeString = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }
        
        alert(`You are timed out from the chatroom. Time remaining: ${timeString}`);
        return true;
      }
    }
  } catch (err) {
    console.error('Error checking timeout:', err);
  }
  return false;
}

// Send message
window.sendMessage = async function() {
  if (!auth.currentUser || !currentUsername) {
    alert('You must be logged in to chat');
    return;
  }
  
  // Check if user is timed out
  const isTimedOut = await checkTimeout();
  if (isTimedOut) {
    return;
  }
  
  const chatInput = document.getElementById('chatInput');
  const text = chatInput.value.trim();
  
  if (!text) return;
  
  const timestamp = Date.now();
  await addDoc(messagesRef, {
    username: currentUsername,
    userId: auth.currentUser.uid,
    text: text,
    timestamp: timestamp
  });
  
  // Update chat presence
  if (auth.currentUser) {
    const chatPresenceRef = ref(realtimeDb, `chatPresence/${auth.currentUser.uid}`);
    set(chatPresenceRef, {
      username: currentUsername,
      lastActive: timestamp
    });
  }
  
  chatInput.value = '';
};

// Timeout a user
window.timeoutUser = async function(userId, username, minutes) {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  try {
    const timeoutUntil = Date.now() + (minutes * 60 * 1000);
    await updateDoc(doc(db, 'users', userId), {
      chatTimeoutUntil: timeoutUntil
    });
    
    // Delete all messages from this user
    const userMessagesQuery = query(messagesRef, where('userId', '==', userId));
    const userMessages = await getDocs(userMessagesQuery);
    
    const deletePromises = [];
    userMessages.forEach((msgDoc) => {
      deletePromises.push(deleteDoc(doc(db, 'chatMessages', msgDoc.id)));
    });
    
    await Promise.all(deletePromises);
    
    alert(`${username} has been timed out for ${minutes} minute${minutes !== 1 ? 's' : ''}. All their messages have been deleted.`);
  } catch (err) {
    console.error('Error timing out user:', err);
    alert('Error timing out user');
  }
};

// Show untimeout modal
window.showUntimeoutModal = async function() {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  try {
    // Get all timed out users
    const usersRef = collection(db, 'users');
    const allUsers = await getDocs(usersRef);
    const timedOutUsers = [];
    
    allUsers.forEach((userDoc) => {
      const userData = userDoc.data();
      if (userData.chatTimeoutUntil && userData.chatTimeoutUntil > Date.now()) {
        const timeLeft = userData.chatTimeoutUntil - Date.now();
        const minutes = Math.ceil(timeLeft / 60000);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        let timeString = '';
        if (hours > 0) {
          timeString = `${hours}h ${remainingMinutes}m`;
        } else {
          timeString = `${minutes}m`;
        }
        
        timedOutUsers.push({
          userId: userDoc.id,
          username: userData.username || 'Unknown',
          timeLeft: timeString
        });
      }
    });
    
    if (timedOutUsers.length === 0) {
      alert('No users are currently timed out');
      return;
    }
    
    // Show modal with list
    const modal = document.getElementById('untimeoutModal');
    const modalContent = document.getElementById('untimeoutModalContent');
    
    let content = '<h3>Timed Out Users</h3><ul style="list-style: none; padding: 0;">';
    timedOutUsers.forEach(user => {
      content += `
        <li style="padding: 10px; border-bottom: 1px solid #0066cc; display: flex; justify-content: space-between; align-items: center;">
          <span>${user.username} (${user.timeLeft} remaining)</span>
          <button onclick="untimeoutUser('${user.userId}', '${user.username}')" style="background: #00ff00; color: #000; padding: 5px 10px; border: none; cursor: pointer;">Untimeout</button>
        </li>
      `;
    });
    content += '</ul>';
    
    modalContent.innerHTML = content;
    modal.style.display = 'flex';
  } catch (err) {
    console.error('Error loading timed out users:', err);
    alert('Error loading timed out users');
  }
};

// Untimeout a user
window.untimeoutUser = async function(userId, username) {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  try {
    await updateDoc(doc(db, 'users', userId), {
      chatTimeoutUntil: null
    });
    
    alert(`${username} has been untimed out`);
    
    // Refresh the modal
    showUntimeoutModal();
  } catch (err) {
    console.error('Error untiming out user:', err);
    alert('Error untiming out user');
  }
};

// Close untimeout modal
window.closeUntimeoutModal = function() {
  const modal = document.getElementById('untimeoutModal');
  modal.style.display = 'none';
};

// Show unban modal
window.showUnbanModal = async function() {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  try {
    const modal = document.getElementById('unbanModal');
    const modalContent = document.getElementById('unbanModalContent');
    
    // Fetch all banned usernames
    const bannedUsernamesRef = collection(db, 'bannedUsernames');
    const bannedSnapshot = await getDocs(bannedUsernamesRef);
    
    if (bannedSnapshot.empty) {
      modalContent.innerHTML = '<p style="color: #00ffff; padding: 20px;">No banned usernames found.</p>';
      modal.style.display = 'block';
      return;
    }
    
    let html = '<div style="max-height: 400px; overflow-y: auto;">';
    bannedSnapshot.forEach((docSnap) => {
      const bannedData = docSnap.data();
      const username = bannedData.username;
      const bannedAt = new Date(bannedData.bannedAt).toLocaleString();
      const bannedBy = bannedData.bannedBy || 'Unknown';
      
      html += `
        <div style="padding: 10px; border-bottom: 1px solid #0066cc; margin-bottom: 5px;">
          <div style="color: #00ffff; font-weight: bold; margin-bottom: 5px;">${username}</div>
          <div style="color: #999; font-size: 11px; margin-bottom: 5px;">
            Banned by: ${bannedBy}<br>
            Banned at: ${bannedAt}
          </div>
          <button onclick="unbanUser('${username}')" style="background: #00ff00; color: #000; padding: 5px 10px; border: none; cursor: pointer;">Unban</button>
        </div>
      `;
    });
    html += '</div>';
    
    modalContent.innerHTML = html;
    modal.style.display = 'block';
  } catch (err) {
    console.error('Error loading banned usernames:', err);
    alert('Error loading banned usernames');
  }
};

// Unban a username
window.unbanUser = async function(username) {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  if (!confirm(`Are you sure you want to unban "${username}"? This will allow this username to be used again.`)) {
    return;
  }
  
  try {
    const usernameLower = username.toLowerCase();
    await deleteDoc(doc(db, 'bannedUsernames', usernameLower));
    alert(`${username} has been unbanned and can now be used again.`);
    
    // Refresh the modal
    showUnbanModal();
  } catch (err) {
    console.error('Error unbanning username:', err);
    alert('Error unbanning username: ' + err.message);
  }
};

// Close unban modal
window.closeUnbanModal = function() {
  const modal = document.getElementById('unbanModal');
  modal.style.display = 'none';
};

// Ban a user - deletes account and bans username
window.banUser = async function(userId, username) {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  if (!confirm(`Are you sure you want to BAN ${username}? This will permanently delete their account and prevent this username from being used again.`)) {
    return;
  }
  
  try {
    // Get user data before deletion
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      alert('User not found');
      return;
    }
    
    const userData = userDoc.data();
    const bannedUsername = userData.username.toLowerCase();
    
    // Add username to banned list
    await setDoc(doc(db, 'bannedUsernames', bannedUsername), {
      username: bannedUsername,
      bannedAt: Date.now(),
      bannedBy: currentUsername
    });
    
    // Delete all chat messages from this user
    const userMessagesQuery = query(messagesRef, where('userId', '==', userId));
    const userMessages = await getDocs(userMessagesQuery);
    const messageDeletePromises = [];
    userMessages.forEach((msgDoc) => {
      messageDeletePromises.push(deleteDoc(doc(db, 'chatMessages', msgDoc.id)));
    });
    await Promise.all(messageDeletePromises);
    
    // Delete all comments from this user across all reviews
    const reviewsRef = collection(db, 'reviews');
    const allReviews = await getDocs(reviewsRef);
    const commentDeletePromises = [];
    
    for (const reviewDoc of allReviews.docs) {
      const reviewId = reviewDoc.id;
      const commentsRef = collection(db, 'reviews', reviewId, 'comments');
      const userCommentsQuery = query(commentsRef, where('userId', '==', userId));
      const userComments = await getDocs(userCommentsQuery);
      
      userComments.forEach((commentDoc) => {
        commentDeletePromises.push(deleteDoc(doc(db, 'reviews', reviewId, 'comments', commentDoc.id)));
      });
    }
    await Promise.all(commentDeletePromises);
    
    // Delete user document from Firestore
    await deleteDoc(doc(db, 'users', userId));
    
    // Delete user from Firebase Auth (requires admin SDK or user to be signed in as themselves)
    // Note: This requires Firebase Admin SDK on the server side for security
    // For client-side, we'll just delete from Firestore and mark as banned
    // The user won't be able to log in if their user doc is deleted
    
    // Remove from chat presence
    const chatPresenceRef = ref(realtimeDb, `chatPresence/${userId}`);
    await set(chatPresenceRef, null);
    
    alert(`${username} has been banned. Their account has been deleted and the username is now permanently banned.`);
    
    // Refresh the user list
    updateChatUsersList();
  } catch (err) {
    console.error('Error banning user:', err);
    alert('Error banning user: ' + err.message);
  }
};

// Send on Enter key
document.addEventListener('DOMContentLoaded', () => {
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }
});