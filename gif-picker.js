// GIF Picker System - allows users to select and use owned GIFs
import { db, auth } from './firebase.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let selectedGifId = null; // Track selected GIF for current input

// Create GIF picker modal
function createGifPickerModal() {
  if (document.getElementById('gifPickerModal')) return; // Already exists
  
  const modal = document.createElement('div');
  modal.id = 'gifPickerModal';
  modal.className = 'chat-modal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="chat-modal-content" style="max-width: 600px; max-height: 80vh;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; color: #00ffff;">Select GIF</h3>
        <button onclick="closeGifPicker()" style="background: #cc0000; color: #fff; border: none; padding: 5px 10px; cursor: pointer;">Close</button>
      </div>
      <div id="gifPickerContent" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; max-height: 60vh; overflow-y: auto;">
        <p style="color: #ffff00; text-align: center; grid-column: 1 / -1;">Loading GIFs...</p>
      </div>
      <div style="margin-top: 15px; text-align: center;">
        <button onclick="confirmGifSelection()" id="confirmGifBtn" style="background: #00ff00; color: #000; padding: 10px 20px; border: none; cursor: pointer; font-weight: bold; display: none;">Use GIF</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Open GIF picker
window.openGifPicker = async function(context = 'chat') {
  if (!auth.currentUser) {
    alert('Please log in to use GIFs');
    return;
  }
  
  createGifPickerModal();
  const modal = document.getElementById('gifPickerModal');
  const content = document.getElementById('gifPickerContent');
  const confirmBtn = document.getElementById('confirmGifBtn');
  
  if (!modal || !content) return;
  
  // Store context (chat or comment)
  modal.dataset.context = context;
  if (context.includes('comment-')) {
    modal.dataset.reviewId = context.replace('comment-', '');
  }
  
  modal.style.display = 'flex';
  content.innerHTML = '<p style="color: #ffff00; text-align: center; grid-column: 1 / -1;">Loading GIFs...</p>';
  selectedGifId = null;
  if (confirmBtn) confirmBtn.style.display = 'none';
  
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (!userDoc.exists()) {
      content.innerHTML = '<p style="color: #ffff00; text-align: center; grid-column: 1 / -1;">User not found</p>';
      return;
    }
    
    const userData = userDoc.data();
    const ownedItems = userData.ownedItems || [];
    
    // Get shop items to see what GIFs user owns
    const shopRef = collection(db, 'shopItems');
    const shopSnapshot = await getDocs(shopRef);
    const ownedGifs = [];
    
    shopSnapshot.forEach((itemDoc) => {
      if (ownedItems.includes(itemDoc.id)) {
        const item = itemDoc.data();
        if (item.type === 'gif') {
          ownedGifs.push({ id: itemDoc.id, ...item });
        }
      }
    });
    
    if (ownedGifs.length === 0) {
      content.innerHTML = '<p style="color: #ffff00; text-align: center; grid-column: 1 / -1;">You don\'t own any GIFs yet. Visit the shop to purchase GIFs!</p>';
      return;
    }
    
    let html = '';
    ownedGifs.forEach(gif => {
      html += `
        <div onclick="selectGif('${gif.id}')" id="gif-${gif.id}" style="cursor: pointer; border: 2px solid #0066cc; padding: 5px; background: rgba(0, 0, 0, 0.5); text-align: center;">
          <img src="${gif.value}" alt="${gif.name}" style="max-width: 100%; max-height: 80px; display: block; margin: 0 auto;">
          <div style="color: #ffff00; font-size: 10px; margin-top: 5px;">${gif.name}</div>
        </div>
      `;
    });
    
    content.innerHTML = html;
  } catch (err) {
    console.error('Error loading GIFs:', err);
    content.innerHTML = '<p style="color: #ff0000; text-align: center; grid-column: 1 / -1;">Error loading GIFs</p>';
  }
};

// Select a GIF
window.selectGif = function(gifId) {
  selectedGifId = gifId;
  const confirmBtn = document.getElementById('confirmGifBtn');
  
  // Highlight selected GIF
  document.querySelectorAll('[id^="gif-"]').forEach(el => {
    el.style.border = '2px solid #0066cc';
    el.style.background = 'rgba(0, 0, 0, 0.5)';
  });
  
  const selectedEl = document.getElementById(`gif-${gifId}`);
  if (selectedEl) {
    selectedEl.style.border = '3px solid #00ff00';
    selectedEl.style.background = 'rgba(0, 255, 0, 0.2)';
  }
  
  if (confirmBtn) confirmBtn.style.display = 'block';
};

// Confirm GIF selection and use it
window.confirmGifSelection = function() {
  if (!selectedGifId) {
    console.error('No GIF selected');
    return;
  }
  
  // Save the selected GIF ID before closing the picker (which clears it)
  const gifIdToUse = selectedGifId;
  const modal = document.getElementById('gifPickerModal');
  const context = modal ? modal.dataset.context : 'chat';
  const reviewId = modal ? modal.dataset.reviewId : null;
  
  // Close the picker (this will clear selectedGifId)
  closeGifPicker();
  
  console.log('Using GIF:', gifIdToUse, 'Context:', context);
  
  // Use the saved GIF ID
  if (context === 'chat') {
    // Use in chat
    if (window.useGifInChat) {
      window.useGifInChat(gifIdToUse);
    } else {
      console.error('useGifInChat function not found');
    }
  } else if (context === 'comment') {
    // Use in simple comments system (no reviewId)
    if (window.useGifInComment) {
      window.useGifInComment(gifIdToUse, null);
    } else {
      console.error('useGifInComment function not found');
    }
  } else if (context.startsWith('comment-')) {
    // Use in review comment (has reviewId)
    if (window.useGifInComment) {
      window.useGifInComment(gifIdToUse, reviewId);
    } else {
      console.error('useGifInComment function not found');
    }
  }
};

// Close GIF picker
window.closeGifPicker = function() {
  const modal = document.getElementById('gifPickerModal');
  if (modal) modal.style.display = 'none';
  selectedGifId = null;
  const confirmBtn = document.getElementById('confirmGifBtn');
  if (confirmBtn) confirmBtn.style.display = 'none';
};

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    createGifPickerModal();
  });
} else {
  createGifPickerModal();
}

