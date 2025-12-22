import { db, auth, realtimeDb } from './firebase.js';
import { censorSlurs, containsSlur, containsLink } from './content-filter.js';
import { MESSAGES_PER_LEVEL, POINTS_PER_50_MESSAGES, getLevelFromMessages, getPointsFromMessages } from './leveling.js';
import { escapeHtml, escapeHtmlAttr, escapeJs } from './xss-utils.js';
import { collection, addDoc, onSnapshot, query, orderBy, limit, where, getDocs, deleteDoc, getDocs as firestoreGetDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDoc, doc, updateDoc, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, set, onDisconnect, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Function to save user progress (level, points, messageCount) to Firebase
async function saveUserProgress() {
  if (!auth.currentUser) return;
  
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const messageCount = userData.messageCount || 0;
      const level = getLevelFromMessages(messageCount);
      const points = getPointsFromMessages(messageCount);
      
      // Ensure level and points match messageCount (in case they got out of sync)
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
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

// Update XP bar with current progress
async function updateXPBar() {
  if (!auth.currentUser) {
    const xpBarContainer = document.getElementById('xpBarContainer');
    if (xpBarContainer) {
      xpBarContainer.style.display = 'none';
    }
    return;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (!userDoc.exists()) return;
    
    const userData = userDoc.data();
    const messageCount = userData.messageCount || 0;
    const currentLevel = getLevelFromMessages(messageCount);
    
    // Calculate progress within current level
    // Level 1: 0-99 messages, Level 2: 100-199, etc.
    const messagesInCurrentLevel = messageCount % MESSAGES_PER_LEVEL;
    const messagesNeededForNextLevel = MESSAGES_PER_LEVEL - messagesInCurrentLevel;
    const progressPercent = (messagesInCurrentLevel / MESSAGES_PER_LEVEL) * 100;
    
    // Update XP bar elements
    const xpBarContainer = document.getElementById('xpBarContainer');
    const xpLevelText = document.getElementById('xpLevelText');
    const xpProgressText = document.getElementById('xpProgressText');
    const xpBarFill = document.getElementById('xpBarFill');
    
    if (xpBarContainer && xpLevelText && xpProgressText && xpBarFill) {
      xpBarContainer.style.display = 'block';
      xpLevelText.textContent = `LV ${currentLevel}`;
      xpProgressText.textContent = `${messagesInCurrentLevel} / ${MESSAGES_PER_LEVEL} messages (${messagesNeededForNextLevel} to next level)`;
      xpBarFill.style.width = `${progressPercent}%`;
      
      console.log('XP Bar updated:', { currentLevel, messagesInCurrentLevel, progressPercent });
    }
  } catch (err) {
    console.error('Error updating XP bar:', err);
  }
}

let currentUsername = null;
let activeChatUsers = new Set();
let currentUserIsAdmin = false;
let currentUserIsMod = false; // New variable for mod status
let userRoleMap = new Map(); // Map userId to {isAdmin, isMod}
window.userRoleMap = userRoleMap; // Expose globally for inventory system
let userMap = new Map(); // Map username to userId

// Helper function to get user role data and stats
async function getUserRoleData(userId) {
  if (!userId) return { isAdmin: false, isMod: false, level: 1, points: 0, ownedItems: [] };
  
  // Check cache first
  if (userRoleMap.has(userId)) {
    return userRoleMap.get(userId);
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const messageCount = userData.messageCount || 0;
      
      // Use stored level if it exists and is valid, otherwise calculate from messageCount
      let level = userData.level;
      if (!level || level < 1) {
        level = getLevelFromMessages(messageCount);
      }
      
      // Recalculate points from messageCount to ensure consistency
      const points = getPointsFromMessages(messageCount);
      
      const roleData = {
        isAdmin: userData.isAdmin || false,
        isMod: userData.isMod || false,
        level: level,
        points: points,
        messageCount: messageCount,
        ownedItems: userData.ownedItems || []
      };
      userRoleMap.set(userId, roleData);
      return roleData;
    }
  } catch (err) {
    console.error('Error fetching user role:', err);
  }
  
  return { isAdmin: false, isMod: false, level: 1, points: 0, messageCount: 0, ownedItems: [] };
}

// Helper function to get user's shop items (colors, badges, gifs)
async function getUserShopItems(userId) {
  if (!userId) return { nameColor: null, glowColor: null, badge: null, chatGif: null };
  
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const equippedBadge = userData.equippedBadge || null;
      const equippedColor = userData.equippedColor || null;
      const equippedGif = userData.equippedGif || null;
      
      // Get shop items to see equipped items
      const shopRef = collection(db, 'shopItems');
      const shopSnapshot = await getDocs(shopRef);
      const items = { nameColor: null, glowColor: null, badge: null, chatGif: null };
      
      shopSnapshot.forEach((itemDoc) => {
        const item = itemDoc.data();
        // Check for equipped items
        if (itemDoc.id === equippedBadge && item.type === 'badge') {
          items.badge = item.value;
        } else if (itemDoc.id === equippedColor && item.type === 'color') {
          // Parse color value (could be old format string or new JSON format)
          try {
            const colorData = typeof item.value === 'string' && item.value.startsWith('{') 
              ? JSON.parse(item.value)
              : { nameColor: item.value };
            items.nameColor = colorData.nameColor || item.value || '#ffffff';
            items.glowColor = colorData.glowColor || null;
          } catch (e) {
            // Fallback to old format
            items.nameColor = item.value || '#ffffff';
            items.glowColor = null;
          }
        } else if (itemDoc.id === equippedGif && item.type === 'gif') {
          items.chatGif = item.value;
        }
      });
      
      return items;
    }
  } catch (err) {
    console.error('Error fetching shop items:', err);
  }
  
  return { nameColor: null, glowColor: null, badge: null, chatGif: null };
}

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
    const xpBarContainer = document.getElementById('xpBarContainer');
    if (xpBarContainer) xpBarContainer.style.display = 'none';
    currentUserIsAdmin = false;
    return;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      currentUsername = userData.username;
      currentUserIsAdmin = userData.isAdmin || false;
      currentUserIsMod = userData.isMod || false; // Set mod status
      userRoleMap.set(user.uid, { isAdmin: currentUserIsAdmin, isMod: currentUserIsMod }); // Cache current user's roles
      chatInputContainer.style.display = 'flex';
      loginMessage.style.display = 'none';
      if (chatUsersSidebar) chatUsersSidebar.style.display = 'flex';
      
      // Show untimeout and unban buttons for admins and mods
      if (untimeoutBtn) {
        untimeoutBtn.style.display = (currentUserIsAdmin || currentUserIsMod) ? 'block' : 'none';
      }
      if (unbanBtn) {
        unbanBtn.style.display = (currentUserIsAdmin || currentUserIsMod) ? 'block' : 'none';
      }
      
      // Update XP bar when user logs in
      updateXPBar();
      
      // Mark user as active in chat
      const chatPresenceRef = ref(realtimeDb, `chatPresence/${user.uid}`);
      const now = Date.now();
      set(chatPresenceRef, {
        username: currentUsername,
        lastActive: now
      });
      
      // Set up disconnect handler to remove presence when connection is lost
      onDisconnect(chatPresenceRef).remove().catch((err) => {
        console.error('Error setting up onDisconnect:', err);
      });
      
      // Also explicitly remove presence when page unloads (backup for onDisconnect)
      const removePresenceOnUnload = async () => {
        if (auth.currentUser && auth.currentUser.uid === user.uid) {
          try {
            const presenceRef = ref(realtimeDb, `chatPresence/${user.uid}`);
            await set(presenceRef, null);
            console.log('Removed chat presence on unload');
          } catch (err) {
            console.error('Error removing presence on unload:', err);
          }
        }
      };
      
      // Store cleanup function globally so it can be called
      window.removeChatPresence = removePresenceOnUnload;
      
      // Add event listeners for cleanup
      window.addEventListener('beforeunload', () => {
        // Use synchronous approach - onDisconnect should handle it, but this is backup
        removePresenceOnUnload();
      });
      
      // Also handle pagehide event (more reliable than beforeunload)
      window.addEventListener('pagehide', () => {
        removePresenceOnUnload();
      });
      
      // Save progress periodically while online (every 5 minutes) to ensure it's always saved
      const progressSaveInterval = setInterval(() => {
        if (auth.currentUser) {
          saveUserProgress();
        } else {
          clearInterval(progressSaveInterval);
        }
      }, 5 * 60 * 1000); // 5 minutes
      
      // Store interval ID so we can clear it later if needed
      if (window.progressSaveInterval) {
        clearInterval(window.progressSaveInterval);
      }
      window.progressSaveInterval = progressSaveInterval;
      
      // Immediately add current user to active users list
      activeChatUsers.add(currentUsername);
      userMap.set(currentUsername, user.uid);
      
      // Update user list after setting roles
      updateChatUsersList();
    }
  } catch (err) {
    console.error('Error getting username:', err);
  }
});

// Track active chat users with real-time updates
const chatPresenceRef = ref(realtimeDb, 'chatPresence');
onValue(chatPresenceRef, (snapshot) => {
  const users = snapshot.val();
  // Create fresh collections to avoid duplicates
  const newActiveUsers = new Set();
  const newUserMap = new Map();
  
  if (users) {
    const now = Date.now();
    const INACTIVE_THRESHOLD = 120000; // 2 minutes - reduced from 10 minutes to clean up faster
    
    // Map to track username -> {uid, lastActive} to handle duplicates
    const usernameToBestEntry = new Map();
    
    // Process all users, keeping the most recent entry for each username
    Object.keys(users).forEach(uid => {
      const userData = users[uid];
      if (userData && userData.username) {
        const username = userData.username.trim();
        if (username && now - userData.lastActive < INACTIVE_THRESHOLD) {
          const existing = usernameToBestEntry.get(username);
          // Keep the entry with the most recent lastActive timestamp
          if (!existing || userData.lastActive > existing.lastActive) {
            usernameToBestEntry.set(username, { uid, lastActive: userData.lastActive });
          }
        }
      }
    });
    
    // Build unique user list from the best entries
    usernameToBestEntry.forEach((data, username) => {
      newActiveUsers.add(username);
      newUserMap.set(username, data.uid);
    });
  }
  
  // CRITICAL: Always ensure current user is in the list if logged in
  // This must happen AFTER processing Firebase data to ensure current user is never removed
  if (auth.currentUser) {
    // Try to get username from currentUsername variable first
    let usernameToAdd = currentUsername;
    
    // If currentUsername isn't set yet, try to get it from Firebase
    if (!usernameToAdd) {
      // This is a fallback - ideally currentUsername should be set by onAuthStateChanged
      console.log('currentUsername not set, checking Firebase...');
    }
    
    if (usernameToAdd) {
      const trimmedUsername = usernameToAdd.trim();
      if (trimmedUsername) {
        // Force add current user - they should always be visible
        newActiveUsers.add(trimmedUsername);
        newUserMap.set(trimmedUsername, auth.currentUser.uid);
        console.log('Ensuring current user in list:', trimmedUsername, 'Total users:', newActiveUsers.size);
      }
    } else {
      console.warn('Cannot add current user to list: currentUsername is not set');
    }
  }
  
  // Update global variables atomically to prevent race conditions
  activeChatUsers = newActiveUsers;
  userMap = newUserMap;
  
  // Update the userlist immediately
  updateChatUsersList();
}, (error) => {
  console.error('Error listening to chat presence:', error);
});

// Update presence periodically while logged in
setInterval(() => {
  if (auth.currentUser && currentUsername) {
    const chatPresenceRef = ref(realtimeDb, `chatPresence/${auth.currentUser.uid}`);
    set(chatPresenceRef, {
      username: currentUsername,
      lastActive: Date.now()
    }).catch((err) => {
      console.error('Error updating presence:', err);
    });
  }
}, 30000); // Update every 30 seconds

// Debounce updateChatUsersList to prevent rapid successive calls
let updateUsersListTimeout = null;
let isUpdatingUsersList = false; // Prevent concurrent updates
async function updateChatUsersList() {
  // Clear any pending update
  if (updateUsersListTimeout) {
    clearTimeout(updateUsersListTimeout);
  }
  
  // Debounce the actual update to prevent rapid successive renders
  updateUsersListTimeout = setTimeout(async () => {
    // Prevent concurrent updates
    if (isUpdatingUsersList) {
      return;
    }
    isUpdatingUsersList = true;
    
    try {
      const chatUsersList = document.getElementById('chatUsersList');
      if (!chatUsersList) {
        isUpdatingUsersList = false;
        return;
      }
      
      // Clear the list completely before rebuilding
      chatUsersList.innerHTML = '';
      
      // Always ensure current user is in activeChatUsers if logged in (before checking size)
      if (auth.currentUser && currentUsername) {
        const trimmedUsername = currentUsername.trim();
        if (trimmedUsername) {
          activeChatUsers.add(trimmedUsername);
          if (!userMap.has(trimmedUsername)) {
            userMap.set(trimmedUsername, auth.currentUser.uid);
          }
        }
      }
      
      if (!activeChatUsers || activeChatUsers.size === 0) {
        chatUsersList.innerHTML = '<div class="chat-user-item" style="color: #666; font-style: italic;">No active users</div>';
        isUpdatingUsersList = false;
        return;
      }
      
      // Create array from Set and ensure uniqueness by username
      const usersArray = Array.from(activeChatUsers).filter(username => username && username.trim());
      
      // Always ensure current user is included (double-check)
      if (auth.currentUser && currentUsername) {
        const trimmedUsername = currentUsername.trim();
        if (trimmedUsername && !usersArray.includes(trimmedUsername)) {
          usersArray.push(trimmedUsername);
          console.log('Added current user to array:', trimmedUsername);
        }
      }
      
      // Use Map to track unique usernames (case-insensitive check)
      const uniqueUsers = new Map();
      usersArray.forEach(username => {
        const lowerUsername = username.toLowerCase();
        if (!uniqueUsers.has(lowerUsername)) {
          uniqueUsers.set(lowerUsername, username);
        }
      });
      
      // Final check: ensure current user is in the unique array
      if (auth.currentUser && currentUsername) {
        const trimmedUsername = currentUsername.trim();
        const lowerCurrent = trimmedUsername.toLowerCase();
        const hasCurrentUser = Array.from(uniqueUsers.keys()).some(lower => lower === lowerCurrent);
        if (!hasCurrentUser && trimmedUsername) {
          uniqueUsers.set(lowerCurrent, trimmedUsername);
          // Ensure userId mapping exists for current user
          if (!userMap.has(trimmedUsername)) {
            userMap.set(trimmedUsername, auth.currentUser.uid);
          }
          console.log('Force-added current user to unique list:', trimmedUsername);
        }
      }
      
      const uniqueUsersArray = Array.from(uniqueUsers.values());
      
      // Debug logging
      console.log('updateChatUsersList - currentUsername:', currentUsername);
      console.log('updateChatUsersList - uniqueUsersArray:', uniqueUsersArray);
      console.log('updateChatUsersList - activeChatUsers.size:', activeChatUsers.size);
      
      // Final safety check: if current user is not in array, add them
      if (auth.currentUser && currentUsername) {
        const trimmedCurrent = currentUsername.trim();
        const lowerCurrent = trimmedCurrent.toLowerCase();
        const isInArray = uniqueUsersArray.some(u => u.toLowerCase() === lowerCurrent);
        if (!isInArray) {
          console.warn('Current user NOT in uniqueUsersArray! Adding now:', trimmedCurrent);
          uniqueUsersArray.push(trimmedCurrent);
          if (!userMap.has(trimmedCurrent)) {
            userMap.set(trimmedCurrent, auth.currentUser.uid);
          }
        }
      }
      
      // Fetch role data for all users
      const rolePromises = uniqueUsersArray.map(async (username) => {
        let userId = userMap.get(username);
        // If no userId found and this is the current user, use auth.currentUser.uid
        if (!userId && auth.currentUser && currentUsername) {
          const trimmedCurrent = currentUsername.trim();
          if (username === trimmedCurrent || username.toLowerCase() === trimmedCurrent.toLowerCase()) {
            userId = auth.currentUser.uid;
            userMap.set(username, userId);
            console.log('Set userId for current user:', username, userId);
          }
        }
        if (!userId) {
          console.warn('No userId found for username:', username, 'currentUsername:', currentUsername);
          return null;
        }
        const roleData = await getUserRoleData(userId);
        return { username, userId, roleData };
      });
      
      const usersWithRoles = (await Promise.all(rolePromises)).filter(u => u !== null);
      
      console.log('usersWithRoles count:', usersWithRoles.length, 'usernames:', usersWithRoles.map(u => u.username));
      
      // Track rendered usernames to prevent duplicates (extra safety)
      const renderedUsernames = new Set();
      const renderedUserIds = new Set(); // Also track by userId for extra safety
      
      // Fetch shop items for all users
      const usersWithShopItems = await Promise.all(usersWithRoles.map(async ({ username, userId, roleData }) => {
        // Skip if already processed
        if (renderedUsernames.has(username) || renderedUserIds.has(userId)) {
          return null;
        }
        renderedUsernames.add(username);
        renderedUserIds.add(userId);
        
        const shopItems = await getUserShopItems(userId);
        return { username, userId, roleData, shopItems };
      }));
      
      // Filter out null entries and sort users by level (highest first), then by username alphabetically if same level
      const validUsers = usersWithShopItems.filter(u => u !== null);
      
      console.log('validUsers count:', validUsers.length, 'usernames:', validUsers.map(u => u.username));
      
      // Final check: if current user is not in validUsers, add them
      if (auth.currentUser && currentUsername) {
        const trimmedCurrent = currentUsername.trim();
        const lowerCurrent = trimmedCurrent.toLowerCase();
        const isInValidUsers = validUsers.some(u => u.username.toLowerCase() === lowerCurrent);
        if (!isInValidUsers) {
          console.error('CRITICAL: Current user not in validUsers! Adding manually:', trimmedCurrent);
          // Try to get role data for current user
          try {
            const roleData = await getUserRoleData(auth.currentUser.uid);
            const shopItems = await getUserShopItems(auth.currentUser.uid);
            validUsers.push({ username: trimmedCurrent, userId: auth.currentUser.uid, roleData, shopItems });
            console.log('Manually added current user to validUsers');
          } catch (err) {
            console.error('Error adding current user manually:', err);
          }
        }
      }
      
      validUsers.sort((a, b) => {
        const levelA = a.roleData?.level || 1;
        const levelB = b.roleData?.level || 1;
        
        // First sort by level (descending - highest first)
        if (levelB !== levelA) {
          return levelB - levelA;
        }
        
        // If same level, sort alphabetically by username
        return (a.username || '').localeCompare(b.username || '');
      });
      
      // Reset rendered sets for final rendering (they were used in shop items fetching)
      const finalRenderedUsernames = new Set();
      const finalRenderedUserIds = new Set();
      
      validUsers.forEach(({ username, userId, roleData, shopItems }) => {
        // Final duplicate check (shouldn't be needed but extra safety)
        if (finalRenderedUsernames.has(username) || finalRenderedUserIds.has(userId)) {
          console.log('Skipping duplicate in final rendering:', username);
          return;
        }
        finalRenderedUsernames.add(username);
        finalRenderedUserIds.add(userId);
        
        console.log('Rendering user:', username, 'userId:', userId);
    
        // Escape user input to prevent XSS
        const escapedUsername = escapeHtml(username || '');
        const escapedUserId = escapeJs(userId || '');
        const safeUsername = escapeJs(username || '');
        
        // Display level
        const level = roleData.level || 1;
        const levelDisplay = `<span style="color: #00ffff; font-weight: bold; margin-right: 5px;">LV ${level}</span>`;
        
        // Get name color and glow color from shop items - escape for safety
        const nameColor = shopItems.nameColor || '#ffffff';
        const glowColor = shopItems.glowColor || null;
        const escapedNameColor = escapeHtmlAttr(nameColor);
        const glowStyle = glowColor ? `text-shadow: 0 0 10px ${escapeHtmlAttr(glowColor)}, 0 0 20px ${escapeHtmlAttr(glowColor)}, 0 0 30px ${escapeHtmlAttr(glowColor)};` : '';
        
        // Get equipped badge
        const equippedBadgeUrl = shopItems.badge || null;
        
        // Add badges based on role and equipped items
        let badges = '';
        if (roleData.isAdmin || username.toLowerCase() === 'paint') {
          badges += `<img src="favicon.png" alt="Admin" class="admin-badge" style="width: 14px; height: 14px; vertical-align: middle; margin-left: 5px; display: inline-block;">`;
        }
        if (roleData.isMod) {
          badges += `<img src="mod-badge.png" alt="Mod" class="mod-badge" style="width: 14px; height: 14px; vertical-align: middle; margin-left: 5px; display: inline-block;">`;
        }
        if (equippedBadgeUrl) {
          const escapedBadgeUrl = escapeHtmlAttr(equippedBadgeUrl);
          badges += `<img src="${escapedBadgeUrl}" alt="Badge" style="width: 14px; height: 14px; vertical-align: middle; margin-left: 5px; display: inline-block;">`;
        }
        
        // Show admin menu if: user is admin or mod
        if ((currentUserIsAdmin || currentUserIsMod)) {
          const safeId = (username || '').replace(/[^a-zA-Z0-9]/g, '_');
          const escapedSafeId = escapeHtmlAttr(safeId);
          const isOwnName = username === currentUsername;
          
          // Create menu - different options for own name vs others
          let menuHtml = '';
          if (userId) {
            if (isOwnName && currentUserIsAdmin) {
              // Own name: Change Level and Give Points
              menuHtml = `
                <div class="chat-timeout-menu">
                  <button onclick="adminChangeLevel('${escapedUserId}', '${safeUsername}')" style="background: #0066cc; color: #ffff00;">Change Level (Admin)</button>
                  <button onclick="adminGivePoints('${escapedUserId}', '${safeUsername}')" style="background: #ffaa00; color: #000; margin-top: 5px;">Give Points (Admin)</button>
                </div>
              `;
            } else if (!isOwnName) {
              // Other users: all options
              menuHtml = `
                <div class="chat-timeout-menu">
                  <button onclick="timeoutUser('${escapedUserId}', '${safeUsername}', 5)">Timeout 5 min</button>
                  <button onclick="timeoutUser('${escapedUserId}', '${safeUsername}', 30)">Timeout 30 min</button>
                  <button onclick="timeoutUser('${escapedUserId}', '${safeUsername}', 60)">Timeout 1 hour</button>
                  <button onclick="timeoutUser('${escapedUserId}', '${safeUsername}', 1440)">Timeout 1 day</button>
                  <button onclick="banUser('${escapedUserId}', '${safeUsername}')" style="background: #cc0000; color: #fff; margin-top: 5px;">BAN USER</button>
                  ${currentUserIsAdmin ? `<button onclick="adminChangeLevel('${escapedUserId}', '${safeUsername}')" style="background: #0066cc; color: #ffff00; margin-top: 5px;">Change Level (Admin)</button>` : ''}
                  ${currentUserIsAdmin ? `<button onclick="adminGivePoints('${escapedUserId}', '${safeUsername}')" style="background: #ffaa00; color: #000; margin-top: 5px;">Give Points (Admin)</button>` : ''}
                </div>
              `;
            }
          }
          
          if (menuHtml) {
            const escapedSafeUsername = escapeHtmlAttr(safeUsername);
            const escapedUserIdAttr = escapeHtmlAttr(userId || '');
            chatUsersList.innerHTML += `
              <div class="chat-user-item chat-user-admin-clickable" data-username="${escapedSafeUsername}" data-userid="${escapedUserIdAttr}" onclick="showAdminMenuForUser('${safeUsername}', '${escapedUserId}', event)">
                ${levelDisplay}<span style="color: ${escapedNameColor}; ${glowStyle}">${escapedUsername}</span>${badges}
                <div class="chat-timeout-menu-clickable" id="adminMenu_${escapedSafeId}" style="display: none;">
                  ${menuHtml}
                </div>
              </div>
            `;
          } else {
            chatUsersList.innerHTML += `<div class="chat-user-item">${levelDisplay}<span style="color: ${escapedNameColor}; ${glowStyle}">${escapedUsername}</span>${badges}</div>`;
          }
        } else {
          chatUsersList.innerHTML += `<div class="chat-user-item">${levelDisplay}<span style="color: ${escapedNameColor}; ${glowStyle}">${escapedUsername}</span>${badges}</div>`;
        }
      });
    } catch (error) {
      console.error('Error updating chat users list:', error);
    } finally {
      isUpdatingUsersList = false;
    }
  }, 100); // 100ms debounce
}

// Show admin menu for a user (click handler)
window.showAdminMenuForUser = function(username, userId, event) {
  if (!currentUserIsAdmin && !currentUserIsMod) {
    return;
  }
  
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  
  const safeId = username.replace(/[^a-zA-Z0-9]/g, '_');
  const menu = document.getElementById(`adminMenu_${safeId}`);
  
  if (!menu) {
    console.error('Menu not found for:', safeId);
    return;
  }
  
  // Check if this menu is already visible
  const wasVisible = menu.style.display === 'block';
  
  // Hide all menus first
  document.querySelectorAll('.chat-timeout-menu-clickable').forEach(m => {
    m.style.display = 'none';
  });
  
  // Show this menu if it wasn't visible
  if (!wasVisible) {
    menu.style.display = 'block';
    
    // Dynamic positioning
    if (event) {
      const rect = event.target.getBoundingClientRect();
      const menuWidth = 180;
      const menuHeight = 200;
      let left = rect.right + 5;
      let top = rect.top;
      
      if (left + menuWidth > window.innerWidth) {
        left = rect.left - menuWidth - 5;
      }
      if (top + menuHeight > window.innerHeight) {
        top = window.innerHeight - menuHeight - 10;
      }
      if (left < 0) left = 10;
      if (top < 0) top = 10;
      
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
      menu.style.position = 'fixed';
    }
  }
};

// Load chat messages - show recent messages on load, then new ones
const messagesRef = collection(db, 'chatMessages');
let lastMessageTimestamp = Date.now(); // Track last message timestamp
let initialLoadComplete = false; // Track if initial load is done
let displayedMessageIds = new Set(); // Track which messages have been displayed to prevent duplicates

// Send system message to chat
async function sendSystemMessage(messageText) {
  try {
    const systemMessageData = {
      username: 'SYSTEM',
      userId: 'system',
      text: messageText,
      timestamp: Date.now(),
      isSystem: true
    };
    await addDoc(messagesRef, systemMessageData);
    console.log('System message sent:', messageText);
  } catch (err) {
    console.error('Error sending system message:', err);
  }
}

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
    
    // On initial load, show all recent messages (last 50)
    // After initial load, only show new messages
    if (!initialLoadComplete || msgData.timestamp > lastMessageTimestamp) {
      messages.push({ id: doc.id, ...msgData });
      if (msgData.gifId) {
        console.log('New message with GIF detected:', msgData.gifId, 'Message ID:', doc.id);
      }
    }
  });
  
  // Reverse to show oldest first
  messages.reverse();
  
  if (messages.length > 0) {
    console.log('Processing', messages.length, initialLoadComplete ? 'new' : 'initial', 'messages');
  }
  
  // Mark initial load as complete after first snapshot
  if (!initialLoadComplete) {
    initialLoadComplete = true;
    // Update lastMessageTimestamp to the most recent message from snapshot
    const allTimestamps = [];
    snapshot.forEach((doc) => {
      allTimestamps.push(doc.data().timestamp);
    });
    if (allTimestamps.length > 0) {
      lastMessageTimestamp = Math.max(...allTimestamps);
      console.log('Initial load complete. Last message timestamp:', lastMessageTimestamp);
    }
  }
  
  // Fetch role data for all message authors
  const messagePromises = messages.map(async (msg) => {
    let roleData = { isAdmin: false, isMod: false, level: 1, ownedItems: [] };
    if (msg.userId) {
      roleData = await getUserRoleData(msg.userId);
      // Store username to userId mapping
      if (msg.username) {
        userMap.set(msg.username, msg.userId);
      }
    }
    return { ...msg, roleData };
  });
  
  Promise.all(messagePromises).then(async (messagesWithRoles) => {
    const currentUserId = auth.currentUser ? auth.currentUser.uid : null;
    
    // Fetch shop items and GIF data for all messages
    const messagesWithShopItems = await Promise.all(messagesWithRoles.map(async (msg) => {
      const shopItems = await getUserShopItems(msg.userId);
      let gifData = null;
      if (msg.gifId) {
        try {
          const gifDoc = await getDoc(doc(db, 'shopItems', msg.gifId));
          if (gifDoc.exists()) {
            gifData = gifDoc.data();
            console.log('Loaded GIF data for message:', msg.gifId, gifData);
          } else {
            console.warn('GIF not found in shopItems:', msg.gifId);
          }
        } catch (err) {
          console.error('Error loading GIF:', err, 'gifId:', msg.gifId);
        }
      }
      return { ...msg, shopItems, gifData };
    }));
    
    messagesWithShopItems.forEach((msg) => {
      // Skip if message already displayed
      if (displayedMessageIds.has(msg.id)) {
        return;
      }
      displayedMessageIds.add(msg.id);
      
      const messageDate = new Date(msg.timestamp);
      const timeString = messageDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      
      // Handle system messages differently
      if (msg.isSystem) {
        const systemText = escapeHtml(msg.text || '');
        chatMessages.innerHTML += `
          <div class="chat-message system-message" data-msg-id="${escapeHtmlAttr(msg.id)}">
            <span>${systemText}</span>
            <span class="timestamp">${escapeHtml(timeString)}</span>
          </div>
        `;
        return; // Skip normal message rendering for system messages
      }
      
      // Escape user input to prevent XSS
      const escapedUsername = escapeHtml(msg.username || '');
      const escapedUserId = escapeJs(msg.userId || '');
      
      // Handle GIF messages
      let messageContentHtml = '';
      if (msg.gifId || msg.gifData) {
        // If we have gifData, use it
        if (msg.gifData && msg.gifData.value) {
          const gifAlt = escapeHtmlAttr(msg.gifData.name || 'GIF');
          const gifUrl = escapeHtmlAttr(msg.gifData.value);
          messageContentHtml = `<img src="${gifUrl}" alt="${gifAlt}" class="chat-gif">`;
          console.log('Displaying GIF:', gifUrl);
        } else if (msg.gifId) {
          // If gifData wasn't loaded, show placeholder and try to load it
          const escapedGifId = escapeHtmlAttr(msg.gifId);
          messageContentHtml = `<div class="chat-gif-loading" data-gif-id="${escapedGifId}" data-msg-id="${escapeHtmlAttr(msg.id || '')}">Loading GIF...</div>`;
          console.log('GIF data not loaded, attempting to load:', msg.gifId);
          // Try to load the GIF asynchronously
          (async () => {
            try {
              const gifDoc = await getDoc(doc(db, 'shopItems', msg.gifId));
              if (gifDoc.exists()) {
                const gifData = gifDoc.data();
                const gifAlt = escapeHtmlAttr(gifData.name || 'GIF');
                const gifUrl = escapeHtmlAttr(gifData.value);
                // Find the loading div by both gifId and msgId to be more specific
                const loadingDiv = document.querySelector(`.chat-gif-loading[data-gif-id="${msg.gifId}"][data-msg-id="${msg.id || ''}"]`);
                if (loadingDiv && loadingDiv.parentElement) {
                  loadingDiv.outerHTML = `<img src="${gifUrl}" alt="${gifAlt}" class="chat-gif">`;
                  console.log('GIF loaded and displayed:', gifUrl);
                }
              } else {
                console.warn('GIF document does not exist:', msg.gifId);
                const loadingDiv = document.querySelector(`.chat-gif-loading[data-gif-id="${msg.gifId}"][data-msg-id="${msg.id || ''}"]`);
                if (loadingDiv) {
                  loadingDiv.textContent = 'GIF not found';
                }
              }
            } catch (err) {
              console.error('Error loading GIF:', err, 'gifId:', msg.gifId);
              const loadingDiv = document.querySelector(`.chat-gif-loading[data-gif-id="${msg.gifId}"][data-msg-id="${msg.id || ''}"]`);
              if (loadingDiv) {
                loadingDiv.textContent = 'Error loading GIF';
              }
            }
          })();
        }
      }
      
      // Add text content if present - escape it for safety
      if (msg.text) {
        const censoredText = censorSlurs(msg.text);
        const escapedText = escapeHtml(censoredText);
        messageContentHtml += `<span class="message-text">${escapedText}</span>`;
      }
      
      // Get level and badges from role data
      const msgLevel = msg.roleData?.level || 1;
      const levelDisplay = `<span style="color: #00ffff; font-weight: bold; margin-right: 5px;">LV ${msgLevel}</span>`;
      
      // Get equipped badge
      const equippedBadgeUrl = msg.shopItems?.badge || null;
      const nameColor = msg.shopItems?.nameColor || '#ffffff';
      
      let badges = '';
      if (msg.roleData && (msg.roleData.isAdmin || msg.username.toLowerCase() === 'paint')) {
        badges += `<img src="favicon.png" alt="Admin" class="admin-badge" style="width: 16px; height: 16px; vertical-align: middle; margin-left: 5px; display: inline-block;">`;
      }
      if (msg.roleData && msg.roleData.isMod) {
        badges += `<img src="mod-badge.png" alt="Mod" class="mod-badge" style="width: 16px; height: 16px; vertical-align: middle; margin-left: 5px; display: inline-block;">`;
      }
      if (equippedBadgeUrl) {
        // Badge URLs are from database (admin-controlled), but escape to be safe
        const escapedBadgeUrl = escapeHtmlAttr(equippedBadgeUrl);
        badges += `<img src="${escapedBadgeUrl}" alt="Badge" style="width: 16px; height: 16px; vertical-align: middle; margin-left: 5px; display: inline-block;">`;
      }
      
      // Use name color and glow - escape color values
      const glowColor = msg.shopItems?.glowColor || null;
      const escapedNameColor = escapeHtmlAttr(nameColor);
      const glowStyle = glowColor ? `text-shadow: 0 0 10px ${escapeHtmlAttr(glowColor)}, 0 0 20px ${escapeHtmlAttr(glowColor)}, 0 0 30px ${escapeHtmlAttr(glowColor)};` : '';
      const usernameWithColor = `<span style="color: ${escapedNameColor}; ${glowStyle}">${escapedUsername}</span>`;
      
      // Make username clickable for admins/mods (only for other users, not self)
      const msgSafeUsername = escapeJs(msg.username || '');
      const msgSafeId = (msg.username || '').replace(/[^a-zA-Z0-9]/g, '_');
      let usernameHtml = `${levelDisplay}${usernameWithColor}${badges}`;
      let msgTimeoutBanButtons = '';
      
      // If admin/mod, make username clickable with menu
      if (currentUserIsAdmin || currentUserIsMod) {
        usernameHtml = `<span class="chat-message-username-clickable" onclick="showAdminMenuForUser('${msgSafeUsername}', '${escapedUserId}', event)" style="cursor: pointer;">${usernameHtml}</span>`;
        
        const isOwnName = currentUserId === msg.userId;
        let msgMenuHtml = '';
        
        if (msg.userId) {
          if (isOwnName && currentUserIsAdmin) {
            // Own name: Change Level and Give Points
            msgMenuHtml = `
              <div class="chat-timeout-menu">
                <button onclick="adminChangeLevel('${escapedUserId}', '${msgSafeUsername}')" style="background: #0066cc; color: #ffff00;">Change Level (Admin)</button>
                <button onclick="adminGivePoints('${escapedUserId}', '${msgSafeUsername}')" style="background: #ffaa00; color: #000; margin-top: 5px;">Give Points (Admin)</button>
              </div>
            `;
          } else if (!isOwnName) {
            // Other users: all options
            msgMenuHtml = `
              <div class="chat-timeout-menu">
                <button onclick="timeoutUser('${escapedUserId}', '${msgSafeUsername}', 5)">Timeout 5 min</button>
                <button onclick="timeoutUser('${escapedUserId}', '${msgSafeUsername}', 30)">Timeout 30 min</button>
                <button onclick="timeoutUser('${escapedUserId}', '${msgSafeUsername}', 60)">Timeout 1 hour</button>
                <button onclick="timeoutUser('${escapedUserId}', '${msgSafeUsername}', 1440)">Timeout 1 day</button>
                <button onclick="banUser('${escapedUserId}', '${msgSafeUsername}')" style="background: #cc0000; color: #fff; margin-top: 5px;">BAN USER</button>
                ${currentUserIsAdmin ? `<button onclick="adminChangeLevel('${escapedUserId}', '${msgSafeUsername}')" style="background: #0066cc; color: #ffff00; margin-top: 5px;">Change Level (Admin)</button>` : ''}
                ${currentUserIsAdmin ? `<button onclick="adminGivePoints('${escapedUserId}', '${msgSafeUsername}')" style="background: #ffaa00; color: #000; margin-top: 5px;">Give Points (Admin)</button>` : ''}
              </div>
            `;
          }
        }
        
        if (msgMenuHtml) {
          const escapedSafeId = escapeHtmlAttr(msgSafeId);
          msgTimeoutBanButtons = `
            <div class="chat-timeout-menu-clickable" id="adminMenu_${escapedSafeId}" style="display: none; position: absolute; background: rgba(0, 0, 0, 0.95); border: 2px solid #0066cc; padding: 5px; z-index: 10000; min-width: 150px;">
              ${msgMenuHtml}
            </div>
          `;
        }
      }
      
      const escapedUserIdAttr = escapeHtmlAttr(msg.userId || '');
      const escapedMsgId = escapeHtmlAttr(msg.id || '');
      chatMessages.innerHTML += `
        <div class="chat-message" data-userid="${escapedUserIdAttr}" data-msg-id="${escapedMsgId}" style="position: relative;">
          <span class="username">${usernameHtml}:</span>
          ${messageContentHtml}
          <span class="timestamp">${escapeHtml(timeString)}</span>
          ${msgTimeoutBanButtons}
        </div>
      `;
    });
    
    // Auto scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
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

// Spam protection variables
const SPAM_CHECK_WINDOW = 10000; // 10 seconds
const MAX_MESSAGES_PER_WINDOW = 5;
const MIN_TIME_BETWEEN_MESSAGES = 500; // 0.5 seconds
let userMessageHistory = new Map(); // userId -> [{timestamp, text}]

// Levenshtein distance for similar message detection
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }
  
  return matrix[len1][len2];
}

function calculateSimilarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
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
  
  // Check if username is banned
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const username = userData.username;
      if (username) {
        const bannedUsernameDoc = await getDoc(doc(db, 'bannedUsernames', username.toLowerCase()));
        if (bannedUsernameDoc.exists()) {
          alert('Your account has been banned.');
          return;
        }
      }
    }
  } catch (err) {
    console.error('Error checking ban status:', err);
  }
  
  const chatInput = document.getElementById('chatInput');
  const text = chatInput.value.trim();
  const gifId = window.pendingGifId || null; // Get pending GIF from useGifInChat
  
  if (!text && !gifId) return; // Allow GIF-only messages
  
  // Check for slurs before sending
  if (containsSlur(text)) {
    alert('Your message contains inappropriate language and cannot be sent.');
    chatInput.value = '';
    return;
  }
  
  // Check for links
  if (containsLink(text)) {
    alert('Links are not allowed in chat.');
    chatInput.value = '';
    return;
  }
  
  // SPAM PROTECTION LOGIC (skip for GIF-only messages)
  const userId = auth.currentUser.uid;
  const timestamp = Date.now();
  let userHistory = userMessageHistory.get(userId) || [];
  userHistory = userHistory.filter(msg => timestamp - msg.timestamp < SPAM_CHECK_WINDOW);
  
  // Only apply spam protection if there's text (not GIF-only)
  if (text) {
    // Check minimum time between messages
    if (userHistory.length > 0) {
      const lastMessage = userHistory[userHistory.length - 1];
      const timeSinceLastMessage = timestamp - lastMessage.timestamp;
      if (timeSinceLastMessage < MIN_TIME_BETWEEN_MESSAGES) {
        const remaining = Math.ceil((MIN_TIME_BETWEEN_MESSAGES - timeSinceLastMessage) / 1000);
        alert(`Please wait ${remaining} second${remaining !== 1 ? 's' : ''} before sending another message.`);
        return;
      }
    }
    
    // Check max messages per window
    if (userHistory.length >= MAX_MESSAGES_PER_WINDOW) {
      alert(`You are sending messages too quickly. Please wait ${Math.ceil(SPAM_CHECK_WINDOW / 1000)} seconds before sending more.`);
      return;
    }
    
    // Check for repeated messages
    const recentSameMessages = userHistory.filter(msg => msg.text && msg.text.toLowerCase() === text.toLowerCase());
    if (recentSameMessages.length >= 3) {
      alert('Please do not send the same message repeatedly.');
      return;
    }
    
    // Check for very similar messages (bot protection)
    if (userHistory.length >= 2 && text.length > 0) {
      const similarCount = userHistory.filter(msg => {
        if (!msg.text || msg.text.length === 0) return false;
        const similarity = calculateSimilarity(msg.text.toLowerCase(), text.toLowerCase());
        return similarity > 0.8; // 80% similar
      }).length;
      if (similarCount >= 3) {
        alert('Please do not spam similar messages.');
        return;
      }
    }
  } else if (gifId) {
    // For GIF-only messages, still check rate limiting
    if (userHistory.length > 0) {
      const lastMessage = userHistory[userHistory.length - 1];
      const timeSinceLastMessage = timestamp - lastMessage.timestamp;
      if (timeSinceLastMessage < MIN_TIME_BETWEEN_MESSAGES) {
        const remaining = Math.ceil((MIN_TIME_BETWEEN_MESSAGES - timeSinceLastMessage) / 1000);
        alert(`Please wait ${remaining} second${remaining !== 1 ? 's' : ''} before sending another message.`);
        return;
      }
    }
    
    if (userHistory.length >= MAX_MESSAGES_PER_WINDOW) {
      alert(`You are sending messages too quickly. Please wait ${Math.ceil(SPAM_CHECK_WINDOW / 1000)} seconds before sending more.`);
      return;
    }
  }
  
  // Add to history
  userHistory.push({ timestamp, text: text || '', gifId: gifId || null });
  userMessageHistory.set(userId, userHistory);
  
  const messageTimestamp = Date.now();
  const messageData = {
    username: currentUsername,
    userId: auth.currentUser.uid,
    text: text || '',
    timestamp: messageTimestamp
  };
  
  // Add GIF if present - validate it exists in shopItems first
  if (gifId) {
    // Security: Verify GIF exists in shopItems collection (admin-controlled)
    try {
      const gifDoc = await getDoc(doc(db, 'shopItems', gifId));
      if (!gifDoc.exists()) {
        console.error('Invalid GIF ID - not found in shopItems:', gifId);
        alert('Invalid GIF selected. Please try again.');
        window.pendingGifId = null;
        return;
      }
      const gifData = gifDoc.data();
      if (gifData.type !== 'gif') {
        console.error('Invalid GIF ID - not a GIF type:', gifId);
        alert('Invalid GIF selected. Please try again.');
        window.pendingGifId = null;
        return;
      }
      // Only allow GIFs from shopItems (admin-controlled)
      messageData.gifId = gifId;
      console.log('Adding GIF to message:', gifId);
    } catch (err) {
      console.error('Error validating GIF:', err);
      alert('Error validating GIF. Please try again.');
      window.pendingGifId = null;
      return;
    }
    window.pendingGifId = null; // Clear pending GIF
  }
  
  console.log('Sending message:', messageData);
  await addDoc(messagesRef, messageData);
  console.log('Message sent successfully');
  
  // Update message count, points, and level
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const oldMessageCount = userData.messageCount || 0;
      const currentMessageCount = oldMessageCount + 1;
      
      // Calculate new level from message count
      const newLevel = getLevelFromMessages(currentMessageCount);
      const oldLevel = getLevelFromMessages(oldMessageCount);
      
      // Calculate points: every 50 messages = 25 points
      const newPoints = getPointsFromMessages(currentMessageCount);
      
      console.log(`Updating user stats: Messages ${oldMessageCount} -> ${currentMessageCount}, Level ${oldLevel} -> ${newLevel}, Points -> ${newPoints}`);
      
      const updateData = {
        messageCount: currentMessageCount,
        points: newPoints,
        level: newLevel,
        lastActive: messageTimestamp
      };
      
      await updateDoc(doc(db, 'users', auth.currentUser.uid), updateData);
      
      // Clear cache to refresh user data
      userRoleMap.delete(auth.currentUser.uid);
      
      // Update XP bar immediately
      await updateXPBar();
      
      // If leveled up, show notification and send system message
      // Check if level actually increased (handles edge cases)
      if (newLevel > oldLevel && newLevel >= 1) {
        alert(`🎉 Level up! You are now level ${newLevel}!`);
        // Send system message to chat - announce every level up
        await sendSystemMessage(`🎉 ${currentUsername} leveled up to Level ${newLevel}! 🎉`);
        console.log(`Level up announced: ${currentUsername} reached level ${newLevel}`);
        // Refresh user list to show new level
        setTimeout(() => {
          updateChatUsersList();
        }, 100);
      } else {
        // Still refresh to show updated message count and points
        setTimeout(() => {
          updateChatUsersList();
        }, 100);
      }
    } else {
      console.error('User document does not exist');
    }
  } catch (err) {
    console.error('Error updating message count/points/level:', err);
    alert('Error updating stats: ' + err.message);
  }
  
  // Update chat presence
  if (auth.currentUser) {
    const chatPresenceRef = ref(realtimeDb, `chatPresence/${auth.currentUser.uid}`);
    set(chatPresenceRef, {
      username: currentUsername,
      lastActive: messageTimestamp
    });
  }
  
  chatInput.value = '';
};

// Timeout a user
window.timeoutUser = async function(userId, username, minutes) {
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
  if (!currentUserIsAdmin && !currentUserIsMod) {
    alert('Moderator only');
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
  if (!currentUserIsAdmin && !currentUserIsMod) {
    alert('Moderator only');
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
  if (!currentUserIsAdmin && !currentUserIsMod) {
    alert('Moderator only');
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
  if (!currentUserIsAdmin && !currentUserIsMod) {
    alert('Moderator only');
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

// Admin change level
window.adminChangeLevel = async function(userId, username) {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      alert('User not found');
      return;
    }
    
    const userData = userDoc.data();
    const currentMessageCount = userData.messageCount || 0;
    const currentLevel = userData.level || getLevelFromMessages(currentMessageCount);
    const currentPoints = userData.points || getPointsFromMessages(currentMessageCount);
    
    const newLevelStr = prompt(
      `Change level for ${username}:\n\n` +
      `Current level: ${currentLevel}\n` +
      `Current messages: ${currentMessageCount}\n` +
      `Current points: ${currentPoints}\n\n` +
      `Enter new level:`,
      currentLevel
    );
    
    if (newLevelStr === null) return; // User cancelled
    
    const newLevel = parseInt(newLevelStr);
    if (isNaN(newLevel) || newLevel < 1) {
      alert('Invalid level. Please enter a number greater than 0.');
      return;
    }
    
    // Calculate message count needed for this level (level 1 = 0-99 messages, level 2 = 100-199, etc.)
    const messageCountForLevel = (newLevel - 1) * MESSAGES_PER_LEVEL;
    const pointsForLevel = getPointsFromMessages(messageCountForLevel);
    
    console.log(`Changing level for ${username}: Level ${currentLevel} -> ${newLevel}, Messages ${currentMessageCount} -> ${messageCountForLevel}, Points ${currentPoints} -> ${pointsForLevel}`);
    
    await updateDoc(doc(db, 'users', userId), {
      level: newLevel,
      messageCount: messageCountForLevel,
      points: pointsForLevel
    });
    
    // Clear cache to refresh display
    userRoleMap.delete(userId);
    
    alert(
      `${username}'s level has been changed!\n\n` +
      `Level: ${currentLevel} → ${newLevel}\n` +
      `Messages: ${currentMessageCount} → ${messageCountForLevel}\n` +
      `Points: ${currentPoints} → ${pointsForLevel}`
    );
    
    // Send system message to chat
    await sendSystemMessage(`⚙️ ${currentUsername} changed ${username}'s level from ${currentLevel} to ${newLevel}`);
    
    // Refresh the user list to show updated level
    setTimeout(() => {
      updateChatUsersList();
    }, 100);
    
    // Update XP bar if admin changed their own level
    if (userId === auth.currentUser?.uid) {
      await updateXPBar();
    }
    
    // Also clear cache for any messages from this user to refresh their displayed level
    // The onSnapshot listener will automatically refresh when it detects changes
  } catch (err) {
    console.error('Error changing level:', err);
    alert('Error changing level: ' + err.message);
  }
};

// Admin give points
window.adminGivePoints = async function(userId, username) {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      alert('User not found');
      return;
    }
    
    const userData = userDoc.data();
    const currentPoints = userData.points || getPointsFromMessages(userData.messageCount || 0);
    
    const pointsStr = prompt(
      `Give points to ${username}:\n\n` +
      `Current points: ${currentPoints}\n\n` +
      `Enter points to add (can be negative to subtract):`,
      '0'
    );
    
    if (pointsStr === null) return; // User cancelled
    
    const pointsToAdd = parseInt(pointsStr);
    if (isNaN(pointsToAdd)) {
      alert('Invalid input. Please enter a number.');
      return;
    }
    
    const newPoints = Math.max(0, currentPoints + pointsToAdd);
    
    console.log(`Giving points to ${username}: ${currentPoints} + ${pointsToAdd} = ${newPoints}`);
    
    await updateDoc(doc(db, 'users', userId), {
      points: newPoints
    });
    
    // Clear cache to refresh display
    userRoleMap.delete(userId);
    
    if (pointsToAdd > 0) {
      alert(`${username} received ${pointsToAdd} points!\n\nNew total: ${newPoints} points`);
      await sendSystemMessage(`💰 ${currentUsername} gave ${pointsToAdd} points to ${username} (Total: ${newPoints})`);
    } else if (pointsToAdd < 0) {
      alert(`${Math.abs(pointsToAdd)} points were removed from ${username}.\n\nNew total: ${newPoints} points`);
      await sendSystemMessage(`💰 ${currentUsername} removed ${Math.abs(pointsToAdd)} points from ${username} (Total: ${newPoints})`);
    } else {
      alert('No points were changed.');
    }
    
    // Refresh the user list to show updated points
    setTimeout(() => {
      updateChatUsersList();
    }, 100);
    
    // Update XP bar if admin gave points to themselves
    if (userId === auth.currentUser?.uid) {
      await updateXPBar();
    }
  } catch (err) {
    console.error('Error giving points:', err);
    alert('Error giving points: ' + err.message);
  }
};

// Ban a user - deletes account and bans username
window.banUser = async function(userId, username) {
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

// Use GIF in chat (called from gif-picker.js)
window.useGifInChat = async function(gifId) {
  if (!auth.currentUser) {
    alert('You must be logged in to send GIFs');
    return;
  }
  
  if (!gifId) {
    console.error('No GIF ID provided');
    return;
  }
  
  // Store pending GIF ID
  window.pendingGifId = gifId;
  
  // Clear chat input and send message
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.value = ''; // Clear text input
  }
  
  // Send the message with GIF
  try {
    await window.sendMessage();
    console.log('GIF message sent with gifId:', gifId);
  } catch (err) {
    console.error('Error sending GIF message:', err);
    alert('Error sending GIF. Please try again.');
    window.pendingGifId = null; // Clear on error
  }
};

// Send on Enter key
document.addEventListener('DOMContentLoaded', () => {
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // Prevent newline
        sendMessage();
      }
    });
  }
  
  // Save user progress when page is about to unload (closing tab/window)
  window.addEventListener('beforeunload', () => {
    if (auth.currentUser) {
      // Use sendBeacon for reliable sending even if page is closing
      saveUserProgress();
    }
  });
  
  // Also save on visibility change (tab switching, minimizing)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && auth.currentUser) {
      saveUserProgress();
    }
  });
});

// Close admin menus when clicking outside
document.addEventListener('click', (e) => {
  // Check if click is outside any menu or clickable element
  const isClickInsideMenu = e.target.closest('.chat-timeout-menu-clickable');
  const isClickInsideClickable = e.target.closest('.chat-user-admin-clickable') || e.target.closest('.chat-message-username-clickable');
  
  // If clicked outside both menu and clickable elements, close all menus
  if (!isClickInsideMenu && !isClickInsideClickable) {
    document.querySelectorAll('.chat-timeout-menu-clickable').forEach(menu => {
      menu.style.display = 'none';
    });
  }
});