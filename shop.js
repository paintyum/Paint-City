// Shop system - allows admins/mods to add items, users to purchase
import { db, auth } from './firebase.js';
import { escapeHtml, escapeHtmlAttr, escapeJs } from './xss-utils.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, getDoc, updateDoc, deleteDoc, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
    // Initialize shop if on shop.html page
    if (document.getElementById('shopItems')) {
      loadShopItems();
      updateShopUI();
    }
  } else {
    currentUserIsAdmin = false;
    currentUserIsMod = false;
    currentUserPoints = 0;
    currentUserId = null;
    
    // Show login message if on shop.html page
    const main = document.querySelector('main');
    const shopItems = document.getElementById('shopItems');
    if (main && shopItems) {
      main.innerHTML = `
        <div style="text-align: center; padding: 50px 20px;">
          <h1 style="color: #00ffff; margin-bottom: 20px;">SHOP</h1>
          <p style="color: #ffff00; font-size: 18px; margin-bottom: 30px;">Please log in to access the shop</p>
          <a href="/" style="display: inline-block; background: #0066cc; color: #ffff00; padding: 10px 20px; text-decoration: none; border: 2px solid #00ffff; font-weight: bold;">Go to Home</a>
        </div>
      `;
    }
  }
});

// Load and display shop items
function loadShopItems() {
  const shopItemsContainer = document.getElementById('shopItems');
  if (!shopItemsContainer) return;

  const shopRef = collection(db, 'shopItems');
  const q = query(shopRef, orderBy('addedAt', 'desc'));

  onSnapshot(q, async (snapshot) => {
    shopItemsContainer.innerHTML = '';

    if (snapshot.empty) {
      shopItemsContainer.innerHTML = '<div style="color: #666; padding: 20px; text-align: center;">No items in shop yet. Admins and mods can add items.</div>';
      return;
    }

    snapshot.forEach(async (itemDoc) => {
      const item = itemDoc.data();
      const itemId = itemDoc.id;
      
      const itemDiv = document.createElement('div');
      itemDiv.className = 'shop-item';
      itemDiv.style.cssText = 'border: 2px solid #0066cc; padding: 15px; margin: 10px 0; background: rgba(0, 0, 0, 0.5);';
      
      // Escape all user/admin input to prevent XSS
      const escapedItemId = escapeJs(itemId || '');
      const escapedItemName = escapeHtml(item.name || '');
      const escapedItemNameAttr = escapeHtmlAttr(item.name || '');
      const escapedItemValue = escapeHtmlAttr(item.value || '');
      const escapedItemColor = item.type === 'color' ? escapeHtmlAttr(item.value || '#ffffff') : '';
      const escapedPrice = String(item.price || 0);
      const escapedType = escapeHtml(item.type ? item.type.toUpperCase() : '');
      
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
          const isOwned = ownedItems.includes(itemId);
          
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
            <div style="color: #ffff00; font-size: 14px;">Type: ${escapedType} | Price: ${escapedPrice} points</div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${ownedButton}
            ${controls}
          </div>
        </div>
      `;
      
      shopItemsContainer.appendChild(itemDiv);
    });
  });
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

// Add shop item (admin/mod only)
window.addShopItem = async function() {
  if (!currentUserIsAdmin && !currentUserIsMod) {
    alert('Admin/Mod only');
    return;
  }
  
  const name = prompt('Item name:');
  if (!name) return;
  
  const type = prompt('Item type (color, badge, or gif):');
  if (!['color', 'badge', 'gif'].includes(type.toLowerCase())) {
    alert('Type must be color, badge, or gif');
    return;
  }
  
  const value = prompt(`Item value (${type === 'color' ? 'hex color code like #ff0000' : 'image URL'}):`);
  if (!value) return;
  
  const priceStr = prompt('Price in points:');
  const price = parseInt(priceStr);
  if (isNaN(price) || price < 0) {
    alert('Invalid price');
    return;
  }
  
  try {
    await addDoc(collection(db, 'shopItems'), {
      name: name,
      type: type.toLowerCase(),
      value: value,
      price: price,
      addedAt: Date.now(),
      addedBy: auth.currentUser.uid
    });
    alert('Item added to shop!');
  } catch (err) {
    console.error('Error adding shop item:', err);
    alert('Error adding item: ' + err.message);
  }
};

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

