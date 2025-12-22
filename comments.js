import { updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, auth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc as firestoreDoc, getDocs, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { containsSlur, censorSlurs, containsLink } from './content-filter.js';
import { escapeHtml, escapeHtmlAttr, escapeJs } from './xss-utils.js';

const ref = collection(db,'comments');
const q = query(ref, orderBy('timestamp', 'desc'));

let currentUserIsAdmin = false;
let currentUserIsMod = false;

// Check if current user is admin or mod
auth.onAuthStateChanged(async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      currentUserIsAdmin = userDoc.data().isAdmin || false;
      currentUserIsMod = userDoc.data().isMod || false;
    }
  } else {
    currentUserIsAdmin = false;
    currentUserIsMod = false;
  }
});

const comments = document.getElementById('comments');
if (!comments) {
  console.error('Comments element not found');
}

onSnapshot(q, async (snap) => {
  if (!comments) return;
  comments.innerHTML='';
  
  // Pre-fetch all user roles
  const userIds = new Set();
  snap.docs.forEach(d => {
    if (d.data().userId) {
      userIds.add(d.data().userId);
    }
  });
  
  const userRoleMap = new Map();
  await Promise.all(Array.from(userIds).map(async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        userRoleMap.set(uid, {
          username: userData.username,
          isAdmin: userData.isAdmin || false,
          isMod: userData.isMod || false
        });
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  }));
  
  const currentUserId = auth.currentUser ? auth.currentUser.uid : null;
  
  // Pre-fetch all GIF data
  const gifIds = new Set();
  snap.docs.forEach(d => {
    if (d.data().gifId) {
      gifIds.add(d.data().gifId);
    }
  });
  
  const gifDataMap = new Map();
  await Promise.all(Array.from(gifIds).map(async (gifId) => {
    try {
      const gifDoc = await getDoc(doc(db, 'shopItems', gifId));
      if (gifDoc.exists()) {
        gifDataMap.set(gifId, gifDoc.data());
      }
    } catch (err) {
      console.error('Error loading GIF:', err);
    }
  }));
  
  for (const d of snap.docs) {
    const commentData = d.data();
    const userId = commentData.userId;
    const commentId = d.id;
    
    // Get user info from pre-fetched map
    const userInfo = userRoleMap.get(userId);
    if (!userInfo) continue; // Skip if user doesn't exist
    
    const username = userInfo.username;
    const isAdmin = userInfo.isAdmin || username.toLowerCase() === 'paint';
    const isMod = userInfo.isMod;
    
    // Add badges
    let badges = '';
    if (isAdmin) {
      badges += `<img src="favicon.png" alt="Admin" class="admin-badge" style="width: 16px; height: 16px; vertical-align: middle; margin-left: 5px; display: inline-block;">`;
    }
    if (isMod) {
      badges += `<img src="mod-badge.png" alt="Mod" class="mod-badge" style="width: 16px; height: 16px; vertical-align: middle; margin-left: 5px; display: inline-block;">`;
    }
    
    // Escape user input to prevent XSS
    const escapedUsername = escapeHtml(username || '');
    const escapedUserId = escapeJs(userId || '');
    const safeUsername = escapeJs(username || '');
    const escapedCommentId = escapeJs(commentId || '');
    
    // Show admin controls for admins/mods, and only for other users
    const showControls = (currentUserIsAdmin || currentUserIsMod) && currentUserId !== userId;
    const deleteBtn = showControls ? `<button onclick="deleteComment('${escapedCommentId}')" class="delete-btn">Delete</button>` : '';
    
    // Make username clickable for timeout/ban menu if admin/mod
    const safeId = (username || '').replace(/[^a-zA-Z0-9]/g, '_');
    const escapedSafeId = escapeHtmlAttr(safeId);
    
    let usernameHtml = `<b>${escapedUsername}</b>${badges}`;
    let timeoutBanButtons = '';
    
    if (showControls) {
      usernameHtml = `<span class="comment-username-clickable" onclick="showCommentAdminMenu('${escapedSafeId}', '${escapedUserId}', '${safeUsername}', event)" style="cursor: pointer;">${usernameHtml}</span>`;
      timeoutBanButtons = `
        <div class="comment-admin-menu" id="commentMenu_${escapedSafeId}" style="display: none; position: absolute; background: rgba(0, 0, 0, 0.95); border: 2px solid #0066cc; padding: 5px; z-index: 10000; min-width: 150px;">
          <button onclick="timeoutCommentUser('${escapedUserId}', '${safeUsername}')">Timeout 5 min</button>
          <button onclick="timeoutCommentUser('${escapedUserId}', '${safeUsername}', 30)">Timeout 30 min</button>
          <button onclick="timeoutCommentUser('${escapedUserId}', '${safeUsername}', 60)">Timeout 1 hour</button>
          <button onclick="timeoutCommentUser('${escapedUserId}', '${safeUsername}', 1440)">Timeout 1 day</button>
          <button onclick="banCommentUser('${escapedUserId}', '${safeUsername}')" style="background: #cc0000; color: #fff; margin-top: 5px;">BAN USER</button>
        </div>
      `;
    }
    
    // Handle GIF in comment - SECURITY: Only allow GIFs from shopItems
    let commentContentHtml = '';
    if (commentData.gifId && gifDataMap.has(commentData.gifId)) {
      const gifData = gifDataMap.get(commentData.gifId);
      // Security: Verify it's actually a GIF type
      if (gifData.type !== 'gif') {
        console.warn('Invalid GIF type in comment:', commentData.gifId, gifData.type);
        // Don't display if it's not a GIF
      } else {
        const gifUrl = escapeHtmlAttr(gifData.value || '');
        const gifAlt = escapeHtmlAttr(gifData.name || 'GIF');
        // Security: Validate URL is safe (only allow data URLs or http/https)
        if (gifUrl.startsWith('data:') || gifUrl.startsWith('http://') || gifUrl.startsWith('https://')) {
          commentContentHtml = `<img src="${gifUrl}" alt="${gifAlt}" class="comment-gif">`;
        } else {
          console.warn('Invalid GIF URL format in comment:', gifUrl);
        }
      }
    }
    
    // Censor slurs in displayed comments and escape for safety
    if (commentData.text) {
      const censoredText = censorSlurs(commentData.text);
      const escapedCommentText = escapeHtml(censoredText);
      commentContentHtml += escapedCommentText;
    }
    
    comments.innerHTML += `
          <div class="comment-item" style="position: relative;">
            <span>${usernameHtml}: ${commentContentHtml}</span>
            <span class="admin-controls">${deleteBtn} ${timeoutBanButtons}</span>
          </div>`;
  }
});

window.postComment = async function(){
  if (!auth.currentUser) {
    alert('You must be logged in to comment');
    return;
  }
  
  const text = commentInput.value.trim();
  const gifId = window.pendingCommentGifId || null;
  
  if (!text && !gifId) {
    alert('Comment cannot be empty');
    return;
  }

  // Check for slurs before sending (only if there's text)
  if (text && containsSlur(text)) {
    alert('Your comment contains inappropriate language and cannot be posted.');
    commentInput.value = '';
    return;
  }
  
  // Check for links (only if there's text)
  if (text && containsLink(text)) {
    alert('Links are not allowed in comments.');
    commentInput.value = '';
    return;
  }

  // Check if user is timed out
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
      
      alert(`You are timed out from commenting. Time remaining: ${timeString}`);
      return;
    }
  }
  
  // Security: Validate GIF ID if present - must exist in shopItems (admin-controlled)
  if (gifId) {
    try {
      const gifDoc = await getDoc(doc(db, 'shopItems', gifId));
      if (!gifDoc.exists()) {
        console.error('Invalid GIF ID - not found in shopItems:', gifId);
        alert('Invalid GIF selected. Please try again.');
        window.pendingCommentGifId = null;
        return;
      }
      const gifData = gifDoc.data();
      if (gifData.type !== 'gif') {
        console.error('Invalid GIF ID - not a GIF type:', gifId);
        alert('Invalid GIF selected. Please try again.');
        window.pendingCommentGifId = null;
        return;
      }
    } catch (err) {
      console.error('Error validating GIF:', err);
      alert('Error validating GIF. Please try again.');
      window.pendingCommentGifId = null;
      return;
    }
  }
  
  const commentData = {
    userId: auth.currentUser.uid,
    text: text || '',
    timestamp: Date.now()
  };
  
  // Add GIF if present (already validated above)
  if (gifId) {
    commentData.gifId = gifId;
    window.pendingCommentGifId = null; // Clear pending GIF
  }
  
  await addDoc(ref, commentData);
  commentInput.value='';
}

// Use GIF in comment (called from gif-picker.js)
// reviewId is null for simple comments system, or a reviewId for review comments
window.useGifInComment = async function(gifId, reviewId) {
  if (!auth.currentUser) return;
  
  // If reviewId is provided, this is for review comments (handled by admin-review.js)
  if (reviewId) {
    // This will be handled by admin-review.js's useGifInComment function
    return;
  }
  
  // For simple comments system, reviewId is null
  window.pendingCommentGifId = gifId;
  
  // Clear comment input
  const commentInput = document.getElementById('commentInput');
  if (commentInput) {
    commentInput.value = '';
  }
  
  // Post the comment with GIF
  await window.postComment();
};

window.deleteComment = async function(commentId) {
  if (!currentUserIsAdmin && !currentUserIsMod) {
    alert('Moderator only');
    return;
  }
  
  if (confirm('Delete this comment?')) {
    try {
      await deleteDoc(firestoreDoc(db, 'comments', commentId));
    } catch (err) {
      alert('Error deleting comment');
      console.error(err);
    }
  }
}

// Show admin menu for comment user
window.showCommentAdminMenu = function(menuId, userId, username, event) {
  if (!currentUserIsAdmin && !currentUserIsMod) {
    return;
  }
  
  if (event) {
    event.stopPropagation();
  }
  
  // Hide all other menus
  document.querySelectorAll('.comment-admin-menu').forEach(menu => {
    if (menu.id !== `commentMenu_${menuId}`) {
      menu.style.display = 'none';
    }
  });
  
  const menu = document.getElementById(`commentMenu_${menuId}`);
  if (menu) {
    if (menu.style.display === 'block') {
      menu.style.display = 'none';
    } else {
      menu.style.display = 'block';
      // Position menu near click
      if (event) {
        const rect = event.target.getBoundingClientRect();
        menu.style.left = rect.right + 5 + 'px';
        menu.style.top = rect.top + 'px';
        menu.style.position = 'fixed';
      }
    }
  }
};

// Timeout user from comments
window.timeoutCommentUser = async function(userId, username, minutes = 5) {
  if (!currentUserIsAdmin && !currentUserIsMod) {
    alert('Moderator only');
    return;
  }
  
  // Check if target user is admin or mod (mods can't timeout admins or other mods)
  if (!currentUserIsAdmin) {
    try {
      const targetUserDoc = await getDoc(doc(db, 'users', userId));
      if (targetUserDoc.exists()) {
        const targetUserData = targetUserDoc.data();
        if (targetUserData.isAdmin || targetUserData.isMod) {
          alert('Mods cannot timeout admins or other mods.');
          return;
        }
      }
    } catch (err) {
      console.error('Error checking target user role:', err);
      alert('Error checking user permissions');
      return;
    }
  }
  
  try {
    const timeoutUntil = Date.now() + (minutes * 60 * 1000);
    await updateDoc(doc(db, 'users', userId), {
      chatTimeoutUntil: timeoutUntil
    });
    
    // Delete all comments from this user
    const commentsRef = collection(db, 'comments');
    const userCommentsQuery = query(commentsRef, where('userId', '==', userId));
    const userComments = await getDocs(userCommentsQuery);
    const deletePromises = [];
    userComments.forEach((cDoc) => {
      deletePromises.push(deleteDoc(firestoreDoc(db, 'comments', cDoc.id)));
    });
    await Promise.all(deletePromises);
    
    alert(`${username} has been timed out for ${minutes} minute${minutes !== 1 ? 's' : ''}. All their comments have been deleted.`);
    
    // Hide menu
    document.querySelectorAll('.comment-admin-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  } catch (err) {
    console.error('Error timing out user:', err);
    alert('Error timing out user: ' + err.message);
  }
};

// Ban user from comments
window.banCommentUser = async function(userId, username) {
  if (!currentUserIsAdmin && !currentUserIsMod) {
    alert('Moderator only');
    return;
  }
  
  // Check if target user is admin or mod (mods can't ban admins or other mods)
  if (!currentUserIsAdmin) {
    try {
      const targetUserDoc = await getDoc(doc(db, 'users', userId));
      if (targetUserDoc.exists()) {
        const targetUserData = targetUserDoc.data();
        if (targetUserData.isAdmin || targetUserData.isMod) {
          alert('Mods cannot ban admins or other mods.');
          return;
        }
      }
    } catch (err) {
      console.error('Error checking target user role:', err);
      alert('Error checking user permissions');
      return;
    }
  }
  
  if (!confirm(`Are you sure you want to BAN ${username}? This will permanently delete their account and prevent this username from being used again.`)) {
    return;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      alert('User not found');
      return;
    }
    
    const userData = userDoc.data();
    const bannedUsername = userData.username.toLowerCase();
    
    // Add to banned usernames
    await setDoc(doc(db, 'bannedUsernames', bannedUsername), {
      username: bannedUsername,
      bannedAt: Date.now(),
      bannedBy: auth.currentUser.uid
    });
    
    // Delete all comments from this user
    const commentsRef = collection(db, 'comments');
    const userCommentsQuery = query(commentsRef, where('userId', '==', userId));
    const userComments = await getDocs(userCommentsQuery);
    const deletePromises = [];
    userComments.forEach((cDoc) => {
      deletePromises.push(deleteDoc(firestoreDoc(db, 'comments', cDoc.id)));
    });
    await Promise.all(deletePromises);
    
    // Delete user account
    await deleteDoc(doc(db, 'users', userId));
    
    alert(`${username} has been banned. Their account and all comments have been deleted.`);
    
    // Hide menu
    document.querySelectorAll('.comment-admin-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  } catch (err) {
    console.error('Error banning user:', err);
    alert('Error banning user: ' + err.message);
  }
};

// Close admin menus when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.comment-username-clickable') && !e.target.closest('.comment-admin-menu')) {
    document.querySelectorAll('.comment-admin-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  }
});