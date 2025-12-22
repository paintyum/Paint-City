// Shop Modal System - allows admins/mods to add items, users to purchase
import { db, auth } from './firebase.js';
import { escapeHtml, escapeHtmlAttr, escapeJs } from './xss-utils.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, getDoc, updateDoc, deleteDoc, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { validateImageFile, validateUrl, sanitizeImageDataUrl } from './image-security.js';

let currentUserIsAdmin = false;
let currentUserIsMod = false;
let currentUserPoints = 0;
let currentUserId = null;

// Check if current user is admin/mod
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserId = user.uid;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        currentUserIsAdmin = userData.isAdmin || false;
        currentUserIsMod = userData.isMod || false;
        currentUserPoints = userData.points || 0;
        updateShopUI();
      }
    } catch (err) {
      console.error('Error checking user status:', err);
    }
  } else {
    currentUserIsAdmin = false;
    currentUserIsMod = false;
    currentUserPoints = 0;
    currentUserId = null;
  }
});

// Create shop modal HTML
function createShopModal() {
  if (document.getElementById('shopModal')) return; // Already exists
  
  const modal = document.createElement('div');
  modal.id = 'shopModal';
  modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000; overflow-y: auto;';
  modal.innerHTML = `
    <div style="position: relative; max-width: 900px; margin: 50px auto; background: #000; border: 3px solid #0066cc; padding: 20px; color: #fff;">
      <button onclick="closeShopModal()" style="position: absolute; top: 10px; right: 10px; background: #cc0000; color: #fff; border: none; padding: 5px 15px; cursor: pointer; font-size: 20px; font-weight: bold;">×</button>
      
      <h1 style="color: #00ffff; text-align: center; margin: 20px 0;">SHOP</h1>
      
      <div id="userPoints" style="color: #ffff00; text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0;">
        Your Points: 0
      </div>
      
      <div style="background: rgba(0, 102, 204, 0.3); border: 2px solid #0066cc; padding: 15px; margin: 20px 0; text-align: center; color: #ffff00;">
        <div style="font-weight: bold; margin-bottom: 5px;">How to Earn Points & Levels:</div>
        <div>Every 50 messages you get 25 points</div>
        <div>Every 100 messages you level up</div>
      </div>
      
      <div style="text-align: center; margin: 20px 0;">
        <button onclick="openInventoryModal()" style="background: #0066cc; color: #ffff00; padding: 10px 20px; border: 2px solid #00ffff; cursor: pointer; font-weight: bold;">INVENTORY</button>
      </div>
      
      <!-- Admin/Mod Controls -->
      <div id="adminShopControls" style="display: none; margin: 20px 0; padding: 15px; border: 2px solid #0066cc; background: rgba(0, 0, 0, 0.5);">
        <h3 style="color: #00ffff; margin-top: 0;">Admin/Mod Controls</h3>
        <button onclick="addShopItem('badge')" style="background: #0066cc; color: #ffff00; padding: 10px 20px; border: 2px solid #00ffff; cursor: pointer; margin-right: 10px; font-weight: bold;">Add Badge</button>
        <button onclick="addShopItem('color')" style="background: #0066cc; color: #ffff00; padding: 10px 20px; border: 2px solid #00ffff; cursor: pointer; margin-right: 10px; font-weight: bold;">Add Colored Name</button>
        <button onclick="addShopItem('gif')" style="background: #0066cc; color: #ffff00; padding: 10px 20px; border: 2px solid #00ffff; cursor: pointer; margin-right: 10px; font-weight: bold;">Add GIF</button>
        <button onclick="giveShopItemFree()" id="giveItemFreeBtn" style="display: none; background: #00ff00; color: #000; padding: 10px 20px; border: 2px solid #00ffff; cursor: pointer; font-weight: bold;">Give Item for Free (Admin Only)</button>
      </div>
      
      <!-- Category Tabs -->
      <div style="display: flex; gap: 10px; margin: 20px 0; border-bottom: 2px solid #0066cc;">
        <button onclick="showShopCategory('badge')" id="tabBadge" style="background: #0066cc; color: #ffff00; padding: 10px 20px; border: 2px solid #00ffff; cursor: pointer; font-weight: bold; border-bottom: none;">BADGES</button>
        <button onclick="showShopCategory('color')" id="tabColor" style="background: #333; color: #fff; padding: 10px 20px; border: 2px solid #666; cursor: pointer; font-weight: bold; border-bottom: none;">COLORED NAMES</button>
        <button onclick="showShopCategory('gif')" id="tabGif" style="background: #333; color: #fff; padding: 10px 20px; border: 2px solid #666; cursor: pointer; font-weight: bold; border-bottom: none;">GIFS</button>
      </div>
      
      <!-- Shop Items Container by Category -->
      <div id="shopItemsBadge" class="shop-category" style="display: block;">
        <h2 style="color: #00ffff;">Badges</h2>
        <div id="shopItemsBadgeList" style="margin: 20px 0;"></div>
      </div>
      <div id="shopItemsColor" class="shop-category" style="display: none;">
        <h2 style="color: #00ffff;">Colored Names</h2>
        <div id="shopItemsColorList" style="margin: 20px 0;"></div>
      </div>
      <div id="shopItemsGif" class="shop-category" style="display: none;">
        <h2 style="color: #00ffff;">GIFs</h2>
        <div id="shopItemsGifList" style="margin: 20px 0;"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Create add item modal separately (outside shop modal)
  createAddItemModal();
}

// Create add item modal
function createAddItemModal() {
  if (document.getElementById('addItemModal')) return; // Already exists
  
  const addModal = document.createElement('div');
  addModal.id = 'addItemModal';
  addModal.className = 'chat-modal';
  addModal.style.display = 'none';
  addModal.innerHTML = `
    <div class="chat-modal-content" style="max-width: 500px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; color: #00ffff;">Add Item to Shop</h3>
        <button onclick="closeAddItemModal()" style="background: #cc0000; color: #fff; border: none; padding: 5px 10px; cursor: pointer;">Close</button>
      </div>
      <form id="addItemForm" onsubmit="return false;">
        <input type="hidden" id="addItemType" value="">
        
        <label style="display: block; color: #ffff00; margin: 10px 0 5px 0; font-weight: bold;">Item Name:</label>
        <input type="text" id="addItemName" required style="width: 100%; padding: 8px; background: #000; color: #fff; border: 2px solid #0066cc; margin-bottom: 10px; box-sizing: border-box;">
        
        <label style="display: block; color: #ffff00; margin: 10px 0 5px 0; font-weight: bold;">Price (points):</label>
        <input type="number" id="addItemPrice" required min="0" style="width: 100%; padding: 8px; background: #000; color: #fff; border: 2px solid #0066cc; margin-bottom: 10px; box-sizing: border-box;">
        
        <div id="addItemImageSection" style="display: none;">
          <label style="display: block; color: #ffff00; margin: 10px 0 5px 0; font-weight: bold;" id="addItemImageLabel">Image:</label>
          <input type="file" id="addItemImageFile" accept="image/*" onchange="previewAddItemImage(event)" style="margin-bottom: 10px; width: 100%; box-sizing: border-box;">
          <div id="addItemImagePreview" style="margin: 10px 0; text-align: center;"></div>
          <div style="color: #00ffff; font-size: 12px; margin-bottom: 10px; text-align: center;" id="addItemImageOr" style="display: none;">OR</div>
          <label style="display: block; color: #ffff00; margin: 10px 0 5px 0; font-weight: bold;" id="addItemImageUrlLabel" style="display: none;">Image URL:</label>
          <input type="text" id="addItemImageUrl" placeholder="Enter image URL" style="display: none; width: 100%; padding: 8px; background: #000; color: #fff; border: 2px solid #0066cc; margin-bottom: 10px; box-sizing: border-box;">
        </div>
        
        <div id="addItemColorSection" style="display: none;">
          <label style="display: block; color: #ffff00; margin: 10px 0 5px 0; font-weight: bold;">Name Color (hex code like #ff0000):</label>
          <input type="color" id="addItemColorPicker" style="width: 100%; height: 50px; margin-bottom: 10px; cursor: pointer;">
          <input type="text" id="addItemColorValue" placeholder="#ff0000" required style="width: 100%; padding: 8px; background: #000; color: #fff; border: 2px solid #0066cc; margin-bottom: 10px; box-sizing: border-box;">
          <label style="display: block; color: #ffff00; margin: 10px 0 5px 0; font-weight: bold;">
            <input type="checkbox" id="addItemGlowEnabled" style="margin-right: 5px;">
            Enable Glow Effect
          </label>
          <div id="addItemGlowColorSection" style="display: none; margin-top: 10px;">
            <label style="display: block; color: #ffff00; margin: 10px 0 5px 0; font-weight: bold;">Glow Color (hex code like #ff0000):</label>
            <input type="color" id="addItemGlowColorPicker" style="width: 100%; height: 50px; margin-bottom: 10px; cursor: pointer;">
            <input type="text" id="addItemGlowColorValue" placeholder="#ff0000" style="width: 100%; padding: 8px; background: #000; color: #fff; border: 2px solid #0066cc; margin-bottom: 10px; box-sizing: border-box;">
          </div>
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button type="button" onclick="submitAddItem()" style="background: #00ff00; color: #000; padding: 10px 20px; border: none; cursor: pointer; font-weight: bold; flex: 1;">Add to Shop</button>
          <button type="button" onclick="closeAddItemModal()" style="background: #666; color: #fff; padding: 10px 20px; border: none; cursor: pointer; flex: 1;">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(addModal);
  
  // Set up color picker to update text input
  setTimeout(() => {
    const colorPicker = document.getElementById('addItemColorPicker');
    const colorValue = document.getElementById('addItemColorValue');
    if (colorPicker && colorValue) {
      colorPicker.addEventListener('input', (e) => {
        colorValue.value = e.target.value;
      });
      colorValue.addEventListener('input', (e) => {
        if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
          colorPicker.value = e.target.value;
        }
      });
    }
  }, 100);
}

// Show shop category
window.showShopCategory = function(category) {
  // Hide all categories
  document.getElementById('shopItemsBadge').style.display = 'none';
  document.getElementById('shopItemsColor').style.display = 'none';
  document.getElementById('shopItemsGif').style.display = 'none';
  
  // Reset all tabs
  document.getElementById('tabBadge').style.background = '#333';
  document.getElementById('tabBadge').style.color = '#fff';
  document.getElementById('tabBadge').style.border = '2px solid #666';
  document.getElementById('tabColor').style.background = '#333';
  document.getElementById('tabColor').style.color = '#fff';
  document.getElementById('tabColor').style.border = '2px solid #666';
  document.getElementById('tabGif').style.background = '#333';
  document.getElementById('tabGif').style.color = '#fff';
  document.getElementById('tabGif').style.border = '2px solid #666';
  
  // Show selected category
  if (category === 'badge') {
    document.getElementById('shopItemsBadge').style.display = 'block';
    document.getElementById('tabBadge').style.background = '#0066cc';
    document.getElementById('tabBadge').style.color = '#ffff00';
    document.getElementById('tabBadge').style.border = '2px solid #00ffff';
  } else if (category === 'color') {
    document.getElementById('shopItemsColor').style.display = 'block';
    document.getElementById('tabColor').style.background = '#0066cc';
    document.getElementById('tabColor').style.color = '#ffff00';
    document.getElementById('tabColor').style.border = '2px solid #00ffff';
  } else if (category === 'gif') {
    document.getElementById('shopItemsGif').style.display = 'block';
    document.getElementById('tabGif').style.background = '#0066cc';
    document.getElementById('tabGif').style.color = '#ffff00';
    document.getElementById('tabGif').style.border = '2px solid #00ffff';
  }
};

// Open shop modal
window.openShopModal = function() {
  if (!auth.currentUser) {
    alert('Please log in to access the shop');
    return;
  }
  
  createShopModal();
  const modal = document.getElementById('shopModal');
  if (modal) {
    modal.style.display = 'block';
    loadShopItems();
    updateShopUI();
  }
};

// Close shop modal
window.closeShopModal = function() {
  const modal = document.getElementById('shopModal');
  if (modal) {
    modal.style.display = 'none';
  }
};

// Load and display shop items by category
function loadShopItems() {
  const shopRef = collection(db, 'shopItems');
  const q = query(shopRef, orderBy('addedAt', 'desc'));

  onSnapshot(q, async (snapshot) => {
    const badgeList = document.getElementById('shopItemsBadgeList');
    const colorList = document.getElementById('shopItemsColorList');
    const gifList = document.getElementById('shopItemsGifList');
    
    if (!badgeList || !colorList || !gifList) return;
    
    badgeList.innerHTML = '';
    colorList.innerHTML = '';
    gifList.innerHTML = '';

    if (snapshot.empty) {
      badgeList.innerHTML = '<div style="color: #666; padding: 20px; text-align: center;">No badges in shop yet.</div>';
      colorList.innerHTML = '<div style="color: #666; padding: 20px; text-align: center;">No colored names in shop yet.</div>';
      gifList.innerHTML = '<div style="color: #666; padding: 20px; text-align: center;">No GIFs in shop yet.</div>';
      return;
    }

    const itemsByCategory = { badge: [], color: [], gif: [] };
    
    snapshot.forEach((itemDoc) => {
      const item = itemDoc.data();
      itemsByCategory[item.type] = itemsByCategory[item.type] || [];
      itemsByCategory[item.type].push({ id: itemDoc.id, ...item });
    });

    // Render items by category
    await renderCategoryItems('badge', badgeList, itemsByCategory.badge || []);
    await renderCategoryItems('color', colorList, itemsByCategory.color || []);
    await renderCategoryItems('gif', gifList, itemsByCategory.gif || []);
  });
}

// Render items for a category
async function renderCategoryItems(category, container, items) {
  if (items.length === 0) {
    container.innerHTML = `<div style="color: #666; padding: 20px; text-align: center;">No ${category}s in shop yet. Admins and mods can add items.</div>`;
    return;
  }

  for (const item of items) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'shop-item';
    itemDiv.style.cssText = 'border: 2px solid #0066cc; padding: 15px; margin: 10px 0; background: rgba(0, 0, 0, 0.5);';
    
    // Escape all user/admin input to prevent XSS
    const escapedItemId = escapeJs(item.id || '');
    const escapedItemName = escapeHtml(item.name || '');
    const escapedItemNameAttr = escapeHtmlAttr(item.name || '');
    const escapedItemValue = escapeHtmlAttr(item.value || '');
    const escapedItemColor = item.type === 'color' ? escapeHtmlAttr(item.value || '#ffffff') : '';
    const escapedPrice = String(item.price || 0);
    
    let previewContent = '';
    if (item.type === 'color') {
      previewContent = `<div style="color: ${escapedItemColor}; font-weight: bold; font-size: 18px;">${escapedItemName}</div>`;
    } else if (item.type === 'badge') {
      previewContent = `<img src="${escapedItemValue}" alt="${escapedItemNameAttr}" style="width: 32px; height: 32px; display: inline-block;">`;
    } else if (item.type === 'gif') {
      previewContent = `<img src="${escapedItemValue}" alt="${escapedItemNameAttr}" style="max-width: 100px; max-height: 100px; display: inline-block;">`;
    }
    
    let controls = '';
    if (currentUserIsAdmin || currentUserIsMod) {
      controls = `
        <button onclick="deleteShopItem('${escapedItemId}')" style="background: #cc0000; color: #fff; padding: 5px 10px; border: none; cursor: pointer; margin-left: 10px;">Delete</button>
        <button onclick="editShopItem('${escapedItemId}')" style="background: #0066cc; color: #fff; padding: 5px 10px; border: none; cursor: pointer; margin-left: 5px;">Edit</button>
      `;
    }
    
    // Check if user owns this item
    let ownedButton = '';
    if (currentUserId) {
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const ownedItems = userData.ownedItems || [];
        const isOwned = ownedItems.includes(item.id);
        
        if (isOwned) {
          ownedButton = `<span style="color: #00ff00; font-weight: bold;">OWNED</span>`;
        } else {
          ownedButton = `<button onclick="purchaseShopItem('${escapedItemId}', ${escapedPrice})" style="background: #00ff00; color: #000; padding: 5px 15px; border: none; cursor: pointer; font-weight: bold;">Buy (${escapedPrice} points)</button>`;
        }
      }
    }
    
    itemDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="color: #00ffff; margin: 0 0 10px 0;">${escapedItemName}</h3>
          <div style="margin: 10px 0;">${previewContent}</div>
          <div style="color: #ffff00; font-size: 14px;">Price: ${escapedPrice} points</div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          ${ownedButton}
          ${controls}
        </div>
      </div>
    `;
    
    container.appendChild(itemDiv);
  }
}

// Update shop UI (show admin buttons, display points)
function updateShopUI() {
  const adminControls = document.getElementById('adminShopControls');
  if (adminControls) {
    if (currentUserIsAdmin || currentUserIsMod) {
      adminControls.style.display = 'block';
    } else {
      adminControls.style.display = 'none';
    }
  }
  
  const giveItemFreeBtn = document.getElementById('giveItemFreeBtn');
  if (giveItemFreeBtn) {
    if (currentUserIsAdmin) {
      giveItemFreeBtn.style.display = 'inline-block';
    } else {
      giveItemFreeBtn.style.display = 'none';
    }
  }
  
  const pointsDisplay = document.getElementById('userPoints');
  if (pointsDisplay) {
    pointsDisplay.textContent = `Your Points: ${currentUserPoints}`;
  }
}

// Purchase shop item
window.purchaseShopItem = async function(itemId, price) {
  if (!auth.currentUser) {
    alert('Please log in to purchase items');
    return;
  }
  
  if (currentUserPoints < price) {
    alert(`You don't have enough points! You need ${price} points but only have ${currentUserPoints}.`);
    return;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const ownedItems = userData.ownedItems || [];
      
      if (ownedItems.includes(itemId)) {
        alert('You already own this item!');
        return;
      }
      
      // Deduct points and add item to owned items
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        points: userData.points - price,
        ownedItems: [...ownedItems, itemId]
      });
      
      currentUserPoints = userData.points - price;
      updateShopUI();
      alert('Item purchased successfully!');
      loadShopItems(); // Refresh to show updated ownership
    }
  } catch (err) {
    console.error('Error purchasing item:', err);
    alert('Error purchasing item: ' + err.message);
  }
};

// Open add item modal (admin/mod only)
window.addShopItem = function(category) {
  if (!currentUserIsAdmin && !currentUserIsMod) {
    alert('Admin/Mod only');
    return;
  }
  
  const modal = document.getElementById('addItemModal');
  const form = document.getElementById('addItemForm');
  const typeInput = document.getElementById('addItemType');
  const nameInput = document.getElementById('addItemName');
  const priceInput = document.getElementById('addItemPrice');
  const imageSection = document.getElementById('addItemImageSection');
  const colorSection = document.getElementById('addItemColorSection');
  const imageFileInput = document.getElementById('addItemImageFile');
  const imageUrlInput = document.getElementById('addItemImageUrl');
  const colorValueInput = document.getElementById('addItemColorValue');
  const previewDiv = document.getElementById('addItemImagePreview');
  
  if (!modal) {
    alert('Modal not found. Please refresh the page.');
    return;
  }
  
  // Reset form
  form.reset();
  if (previewDiv) previewDiv.innerHTML = '';
  
  // Set category type
  typeInput.value = category;
  
  // Show/hide sections based on category
  if (category === 'badge' || category === 'gif') {
    imageSection.style.display = 'block';
    colorSection.style.display = 'none';
    
    // For GIFs, only show file upload (no URL option)
    if (category === 'gif') {
      const imageLabel = document.getElementById('addItemImageLabel');
      const imageOr = document.getElementById('addItemImageOr');
      const imageUrlLabel = document.getElementById('addItemImageUrlLabel');
      const imageUrlInput = document.getElementById('addItemImageUrl');
      if (imageLabel) imageLabel.textContent = 'GIF File:';
      if (imageFileInput) imageFileInput.setAttribute('accept', 'image/gif');
      if (imageOr) imageOr.style.display = 'none';
      if (imageUrlLabel) imageUrlLabel.style.display = 'none';
      if (imageUrlInput) imageUrlInput.style.display = 'none';
    } else {
      // For badges, show both file and URL
      const imageLabel = document.getElementById('addItemImageLabel');
      const imageOr = document.getElementById('addItemImageOr');
      const imageUrlLabel = document.getElementById('addItemImageUrlLabel');
      const imageUrlInput = document.getElementById('addItemImageUrl');
      if (imageLabel) imageLabel.textContent = 'Image:';
      if (imageFileInput) imageFileInput.setAttribute('accept', 'image/*');
      if (imageOr) imageOr.style.display = 'block';
      if (imageUrlLabel) imageUrlLabel.style.display = 'block';
      if (imageUrlInput) imageUrlInput.style.display = 'block';
    }
  } else if (category === 'color') {
    imageSection.style.display = 'none';
    colorSection.style.display = 'block';
    if (colorValueInput) colorValueInput.value = '#ff0000';
    const colorPicker = document.getElementById('addItemColorPicker');
    if (colorPicker) colorPicker.value = '#ff0000';
    
    // Reset glow options
    const glowEnabled = document.getElementById('addItemGlowEnabled');
    const glowColorSection = document.getElementById('addItemGlowColorSection');
    const glowColorValue = document.getElementById('addItemGlowColorValue');
    const glowColorPicker = document.getElementById('addItemGlowColorPicker');
    if (glowEnabled) glowEnabled.checked = false;
    if (glowColorSection) glowColorSection.style.display = 'none';
    if (glowColorValue) glowColorValue.value = '';
    if (glowColorPicker) glowColorPicker.value = '#ffff00';
  }
  
  // Show modal
  modal.style.display = 'flex';
};

// Preview image when file is selected
window.previewAddItemImage = function(event) {
  const file = event.target.files[0];
  const previewDiv = document.getElementById('addItemImagePreview');
  const imageUrlInput = document.getElementById('addItemImageUrl');
  
  if (file && previewDiv) {
    // Validate image file before processing
    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      event.target.value = ''; // Clear the input
      previewDiv.innerHTML = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      // Sanitize the data URL before using it
      const sanitizedUrl = sanitizeImageDataUrl(e.target.result);
      if (sanitizedUrl) {
        const escapedUrl = escapeHtmlAttr(sanitizedUrl);
        previewDiv.innerHTML = `<img src="${escapedUrl}" alt="Preview" style="max-width: 200px; max-height: 200px; border: 2px solid #0066cc;">`;
        // Clear URL input when file is selected
        if (imageUrlInput) imageUrlInput.value = '';
      } else {
        alert('Invalid image file');
        event.target.value = '';
        previewDiv.innerHTML = '';
      }
    };
    reader.readAsDataURL(file);
  } else if (previewDiv) {
    previewDiv.innerHTML = '';
  }
};

// Close add item modal
window.closeAddItemModal = function() {
  const modal = document.getElementById('addItemModal');
  const form = document.getElementById('addItemForm');
  const previewDiv = document.getElementById('addItemImagePreview');
  
  if (modal) modal.style.display = 'none';
  if (form) form.reset();
  if (previewDiv) previewDiv.innerHTML = '';
};

// Submit add item form
window.submitAddItem = async function() {
  if (!currentUserIsAdmin && !currentUserIsMod) {
    alert('Admin/Mod only');
    return;
  }
  
  const typeInput = document.getElementById('addItemType');
  const nameInput = document.getElementById('addItemName');
  const priceInput = document.getElementById('addItemPrice');
  const imageFileInput = document.getElementById('addItemImageFile');
  const imageUrlInput = document.getElementById('addItemImageUrl');
  const colorValueInput = document.getElementById('addItemColorValue');
  
  const category = typeInput.value;
  const name = nameInput.value.trim();
  const price = parseInt(priceInput.value);
  
  if (!name) {
    alert('Please enter an item name');
    return;
  }
  
  if (isNaN(price) || price < 0) {
    alert('Please enter a valid price (0 or greater)');
    return;
  }
  
  let value = '';
  
  if (category === 'badge' || category === 'gif') {
    // Get image from file or URL (URL only for badges)
    const file = imageFileInput.files[0];
    if (file) {
      // Validate image file before processing
      const validation = validateImageFile(file);
      if (!validation.valid) {
        alert(validation.error);
        return;
      }
      
      // Convert file to base64 data URL
      const reader = new FileReader();
      reader.onload = async function(e) {
        // Sanitize the data URL before storing
        const sanitizedUrl = sanitizeImageDataUrl(e.target.result);
        if (!sanitizedUrl) {
          alert('Invalid image file. Please try a different image.');
          return;
        }
        value = sanitizedUrl;
        await saveShopItem(category, name, value, price);
      };
      reader.readAsDataURL(file);
      return; // Will continue in reader.onload
    } else if (category === 'badge' && imageUrlInput.value.trim()) {
      // Validate URL for badges (admin can provide URL)
      const urlValidation = validateUrl(imageUrlInput.value.trim());
      if (!urlValidation.valid) {
        alert(urlValidation.error);
        return;
      }
      value = imageUrlInput.value.trim();
    } else {
      if (category === 'gif') {
        alert('Please select a GIF file');
      } else {
        alert('Please select an image file or enter an image URL');
      }
      return;
    }
  } else if (category === 'color') {
    const nameColor = colorValueInput.value.trim();
    if (!nameColor || !/^#[0-9A-F]{6}$/i.test(nameColor)) {
      alert('Please enter a valid hex color code (e.g., #ff0000)');
      return;
    }
    
    const glowEnabled = document.getElementById('addItemGlowEnabled').checked;
    const glowColorValue = document.getElementById('addItemGlowColorValue');
    const glowColor = glowEnabled && glowColorValue ? glowColorValue.value.trim() : null;
    
    if (glowEnabled && (!glowColor || !/^#[0-9A-F]{6}$/i.test(glowColor))) {
      alert('Please enter a valid glow color hex code (e.g., #ffff00)');
      return;
    }
    
    // Store as JSON object with nameColor and optional glowColor
    value = JSON.stringify({
      nameColor: nameColor,
      glowColor: glowColor
    });
  }
  
  await saveShopItem(category, name, value, price);
};

// Save shop item to database
async function saveShopItem(category, name, value, price) {
  try {
    await addDoc(collection(db, 'shopItems'), {
      name: name,
      type: category,
      value: value,
      price: price,
      addedAt: Date.now(),
      addedBy: auth.currentUser.uid
    });
    
    alert('Item added to shop!');
    closeAddItemModal();
    // Shop will update live via onSnapshot listener
  } catch (err) {
    console.error('Error adding shop item:', err);
    alert('Error adding item: ' + err.message);
  }
}

// Delete shop item (admin/mod only)
window.deleteShopItem = async function(itemId) {
  if (!currentUserIsAdmin && !currentUserIsMod) {
    alert('Admin/Mod only');
    return;
  }
  
  if (!confirm('Delete this item from the shop?')) {
    return;
  }
  
  try {
    await deleteDoc(doc(db, 'shopItems', itemId));
    alert('Item deleted from shop!');
  } catch (err) {
    console.error('Error deleting shop item:', err);
    alert('Error deleting item: ' + err.message);
  }
};

// Edit shop item (admin/mod only)
window.editShopItem = async function(itemId) {
  if (!currentUserIsAdmin && !currentUserIsMod) {
    alert('Admin/Mod only');
    return;
  }
  
  try {
    const itemDoc = await getDoc(doc(db, 'shopItems', itemId));
    if (!itemDoc.exists()) {
      alert('Item not found');
      return;
    }
    
    const item = itemDoc.data();
    const newPriceStr = prompt(`Current price: ${item.price}. Enter new price:`, item.price);
    const newPrice = parseInt(newPriceStr);
    if (isNaN(newPrice) || newPrice < 0) {
      alert('Invalid price');
      return;
    }
    
    await updateDoc(doc(db, 'shopItems', itemId), {
      price: newPrice
    });
    alert('Item price updated!');
  } catch (err) {
    console.error('Error editing shop item:', err);
    alert('Error editing item: ' + err.message);
  }
};

// Give shop item for free (admin only)
window.giveShopItemFree = async function() {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  const username = prompt('Enter username to give item to:');
  if (!username) return;
  
  // Find user by username
  const usersRef = collection(db, 'users');
  const usersSnapshot = await getDocs(usersRef);
  let targetUserId = null;
  
  usersSnapshot.forEach((userDoc) => {
    if (userDoc.data().username && userDoc.data().username.toLowerCase() === username.toLowerCase()) {
      targetUserId = userDoc.id;
    }
  });
  
  if (!targetUserId) {
    alert(`User "${username}" not found`);
    return;
  }
  
  // Show available items
  const shopRef = collection(db, 'shopItems');
  const shopSnapshot = await getDocs(shopRef);
  const items = [];
  shopSnapshot.forEach((itemDoc) => {
    items.push({ id: itemDoc.id, ...itemDoc.data() });
  });
  
  if (items.length === 0) {
    alert('No items in shop');
    return;
  }
  
  const itemNames = items.map((item, idx) => `${idx + 1}. ${item.name} (${item.type})`).join('\n');
  const choiceStr = prompt(`Available items:\n${itemNames}\n\nEnter item number to give:`);
  const choice = parseInt(choiceStr) - 1;
  
  if (isNaN(choice) || choice < 0 || choice >= items.length) {
    alert('Invalid selection');
    return;
  }
  
  const selectedItem = items[choice];
  
  try {
    const userDoc = await getDoc(doc(db, 'users', targetUserId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const ownedItems = userData.ownedItems || [];
      
      if (ownedItems.includes(selectedItem.id)) {
        alert('User already owns this item!');
        return;
      }
      
      await updateDoc(doc(db, 'users', targetUserId), {
        ownedItems: [...ownedItems, selectedItem.id]
      });
      
      alert(`${selectedItem.name} given to ${username} for free!`);
    }
  } catch (err) {
    console.error('Error giving item:', err);
    alert('Error giving item: ' + err.message);
  }
};

// Create inventory modal
function createInventoryModal() {
  if (document.getElementById('inventoryModal')) return; // Already exists
  
  const invModal = document.createElement('div');
  invModal.id = 'inventoryModal';
  invModal.className = 'chat-modal';
  invModal.style.display = 'none';
  invModal.innerHTML = `
    <div class="chat-modal-content" style="max-width: 600px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; color: #00ffff;">INVENTORY</h3>
        <button onclick="closeInventoryModal()" style="background: #cc0000; color: #fff; border: none; padding: 5px 10px; cursor: pointer;">Close</button>
      </div>
      <div id="inventoryContent">
        <p style="color: #ffff00; text-align: center;">Loading inventory...</p>
      </div>
    </div>
  `;
  document.body.appendChild(invModal);
}

// Open inventory modal
window.openInventoryModal = async function() {
  if (!auth.currentUser) {
    alert('Please log in to view inventory');
    return;
  }
  
  createInventoryModal();
  const modal = document.getElementById('inventoryModal');
  const content = document.getElementById('inventoryContent');
  
  if (!modal || !content) return;
  
  modal.style.display = 'flex';
  content.innerHTML = '<p style="color: #ffff00; text-align: center;">Loading inventory...</p>';
  
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (!userDoc.exists()) {
      content.innerHTML = '<p style="color: #ffff00; text-align: center;">User not found</p>';
      return;
    }
    
    const userData = userDoc.data();
    const ownedItems = userData.ownedItems || [];
    const equippedBadge = userData.equippedBadge || null;
    const equippedColor = userData.equippedColor || null;
    
    if (ownedItems.length === 0) {
      content.innerHTML = '<p style="color: #ffff00; text-align: center;">You don\'t own any items yet. Visit the shop to purchase items!</p>';
      return;
    }
    
    // Get shop items to see what user owns
    const shopRef = collection(db, 'shopItems');
    const shopSnapshot = await getDocs(shopRef);
    const itemsByType = { badge: [], color: [], gif: [] };
    
    shopSnapshot.forEach((itemDoc) => {
      if (ownedItems.includes(itemDoc.id)) {
        const item = itemDoc.data();
        itemsByType[item.type].push({ id: itemDoc.id, ...item });
      }
    });
    
    let html = '';
    
    // Badges section
    if (itemsByType.badge.length > 0) {
      html += '<h3 style="color: #00ffff; margin-top: 20px; margin-bottom: 10px;">BADGES</h3>';
      itemsByType.badge.forEach(badge => {
        const isEquipped = equippedBadge === badge.id;
        html += `
          <div style="border: 2px solid #0066cc; padding: 15px; margin: 10px 0; background: rgba(0, 0, 0, 0.5); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 15px;">
              <img src="${badge.value}" alt="${badge.name}" style="width: 32px; height: 32px;">
              <div>
                <div style="color: #00ffff; font-weight: bold;">${badge.name}</div>
                ${isEquipped ? '<div style="color: #00ff00; font-size: 12px;">EQUIPPED</div>' : ''}
              </div>
            </div>
            <button onclick="equipBadge('${badge.id}')" style="background: ${isEquipped ? '#666' : '#00ff00'}; color: ${isEquipped ? '#999' : '#000'}; padding: 8px 15px; border: none; cursor: pointer; font-weight: bold;" ${isEquipped ? 'disabled' : ''}>
              ${isEquipped ? 'EQUIPPED' : 'EQUIP'}
            </button>
          </div>
        `;
      });
    }
    
    // Colors section
    if (itemsByType.color.length > 0) {
      html += '<h3 style="color: #00ffff; margin-top: 20px; margin-bottom: 10px;">COLORED NAMES</h3>';
      itemsByType.color.forEach(colorItem => {
        const isEquipped = equippedColor === colorItem.id;
        
        // Parse color value (could be old format string or new JSON format)
        let nameColor = '#ffffff';
        let glowColor = null;
        try {
          const colorData = typeof colorItem.value === 'string' && colorItem.value.startsWith('{') 
            ? JSON.parse(colorItem.value)
            : { nameColor: colorItem.value };
          nameColor = colorData.nameColor || colorItem.value || '#ffffff';
          glowColor = colorData.glowColor || null;
        } catch (e) {
          // Fallback to old format
          nameColor = colorItem.value || '#ffffff';
        }
        
        const glowStyle = glowColor ? `text-shadow: 0 0 10px ${glowColor}, 0 0 20px ${glowColor}, 0 0 30px ${glowColor};` : '';
        
        html += `
          <div style="border: 2px solid #0066cc; padding: 15px; margin: 10px 0; background: rgba(0, 0, 0, 0.5); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 15px;">
              <div style="width: 32px; height: 32px; background: ${nameColor}; border: 2px solid #fff;"></div>
              <div>
                <div style="color: ${nameColor}; font-weight: bold; ${glowStyle}">${colorItem.name}${glowColor ? ' (Glow)' : ''}</div>
                ${isEquipped ? '<div style="color: #00ff00; font-size: 12px;">EQUIPPED</div>' : ''}
              </div>
            </div>
            <button onclick="equipColor('${colorItem.id}')" style="background: ${isEquipped ? '#666' : '#00ff00'}; color: ${isEquipped ? '#999' : '#000'}; padding: 8px 15px; border: none; cursor: pointer; font-weight: bold;" ${isEquipped ? 'disabled' : ''}>
              ${isEquipped ? 'EQUIPPED' : 'EQUIP'}
            </button>
          </div>
        `;
      });
    }
    
    // GIFs section - just display owned GIFs (no equip needed)
    if (itemsByType.gif.length > 0) {
      html += '<h3 style="color: #00ffff; margin-top: 20px; margin-bottom: 10px;">GIFS</h3>';
      html += '<p style="color: #ffff00; font-size: 12px; margin-bottom: 10px;">Click the GIF button in chat or comments to use your GIFs!</p>';
      itemsByType.gif.forEach(gifItem => {
        html += `
          <div style="border: 2px solid #0066cc; padding: 15px; margin: 10px 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; gap: 15px;">
            <img src="${gifItem.value}" alt="${gifItem.name}" style="max-width: 50px; max-height: 50px;">
            <div style="color: #00ffff; font-weight: bold;">${gifItem.name}</div>
          </div>
        `;
      });
    }
    
    content.innerHTML = html || '<p style="color: #ffff00; text-align: center;">You don\'t own any items yet.</p>';
  } catch (err) {
    console.error('Error loading inventory:', err);
    content.innerHTML = '<p style="color: #ff0000; text-align: center;">Error loading inventory</p>';
  }
};

// Close inventory modal
window.closeInventoryModal = function() {
  const modal = document.getElementById('inventoryModal');
  if (modal) modal.style.display = 'none';
};

// Equip badge (only one at a time)
window.equipBadge = async function(badgeId) {
  if (!auth.currentUser) {
    alert('Please log in');
    return;
  }
  
  try {
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      equippedBadge: badgeId
    });
    
    alert('Badge equipped!');
    openInventoryModal(); // Refresh inventory
    // Clear cache in chat.js to refresh display
    if (window.userRoleMap) {
      window.userRoleMap.delete(auth.currentUser.uid);
    }
  } catch (err) {
    console.error('Error equipping badge:', err);
    alert('Error equipping badge: ' + err.message);
  }
};

// Equip color
window.equipColor = async function(colorId) {
  if (!auth.currentUser) {
    alert('Please log in');
    return;
  }
  
  try {
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      equippedColor: colorId
    });
    
    alert('Color equipped!');
    openInventoryModal(); // Refresh inventory
    // Clear cache in chat.js to refresh display
    if (window.userRoleMap) {
      window.userRoleMap.delete(auth.currentUser.uid);
    }
  } catch (err) {
    console.error('Error equipping color:', err);
    alert('Error equipping color: ' + err.message);
  }
};


// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    createShopModal();
    createInventoryModal();
  });
} else {
  createShopModal();
  createInventoryModal();
}
