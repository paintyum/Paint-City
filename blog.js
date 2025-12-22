import { db, auth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { escapeHtml, escapeHtmlAttr, escapeJs } from './xss-utils.js';
import { validateImageFile, sanitizeImageDataUrl } from './image-security.js';

let currentUserIsAdmin = false;

// Check if current user is admin
auth.onAuthStateChanged(async (user) => {
  const newPostBtn = document.getElementById('newPostBtn');
  
  if (!user) {
    currentUserIsAdmin = false;
    return;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      currentUserIsAdmin = userDoc.data().isAdmin || false;
      
      if (currentUserIsAdmin && newPostBtn) {
        newPostBtn.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Error checking admin status:', err);
    currentUserIsAdmin = false;
  }
});

// Load all blog posts
const postsRef = collection(db, 'blogPosts');
const q = query(postsRef, orderBy('timestamp', 'desc'));

onSnapshot(q, (snapshot) => {
  const postsContainer = document.getElementById('postsContainer');
  postsContainer.innerHTML = '';
  
  snapshot.forEach((docSnap) => {
    const post = docSnap.data();
    const postId = docSnap.id;
    
    // Escape all user input to prevent XSS
    const escapedPostId = escapeJs(postId || '');
    const escapedContent = escapeHtml(post.content || '');
    const escapedImageUrl = post.imageUrl ? escapeHtmlAttr(post.imageUrl) : null;
    
    const deleteBtn = currentUserIsAdmin ? 
      `<button onclick="deletePost('${escapedPostId}')" class="delete-post-btn">Delete</button>` : '';
    
    const postDate = new Date(post.timestamp);
    const dateString = postDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    const timeString = postDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    const imageHtml = escapedImageUrl ? 
      `<img src="${escapedImageUrl}" alt="Post image" class="blog-post-image">` : '';
    
    postsContainer.innerHTML += `
      <div class="blog-post">
        <div class="post-header">
          <div class="post-date">${escapeHtml(dateString)} at ${escapeHtml(timeString)}</div>
          ${deleteBtn}
        </div>
        <div class="post-content">${escapedContent}</div>
        ${imageHtml}
      </div>
    `;
  });
});

// Show new post form
window.showNewPostForm = function() {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  const modal = document.getElementById('newPostModal');
  modal.classList.add('show');
};

// Hide new post form
window.hideNewPostForm = function() {
  const modal = document.getElementById('newPostModal');
  modal.classList.remove('show');
  document.getElementById('postContent').value = '';
  document.getElementById('postImageInput').value = '';
  document.getElementById('postImagePreview').style.display = 'none';
  document.getElementById('postImagePreview').src = '';
};

// Preview post image
window.previewPostImage = function(event) {
  const file = event.target.files[0];
  const preview = document.getElementById('postImagePreview');
  
  if (file) {
    // Validate image file before processing
    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      event.target.value = ''; // Clear the input
      if (preview) {
        preview.style.display = 'none';
        preview.src = '';
      }
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      // Sanitize the data URL before using it
      const sanitizedUrl = sanitizeImageDataUrl(e.target.result);
      if (sanitizedUrl) {
        preview.src = sanitizedUrl;
        preview.style.display = 'block';
      } else {
        alert('Invalid image file');
        event.target.value = '';
        preview.style.display = 'none';
        preview.src = '';
      }
    };
    reader.readAsDataURL(file);
  } else {
    preview.style.display = 'none';
    preview.src = '';
  }
};

// Submit new post
window.submitNewPost = async function() {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  const content = document.getElementById('postContent').value.trim();
  const imageInput = document.getElementById('postImageInput');
  const imageFile = imageInput.files[0];
  
  if (!content) {
    alert('Post cannot be empty');
    return;
  }
  
  const postData = {
    content: content,
    timestamp: Date.now()
  };
  
  if (imageFile) {
    // Validate image file before processing
    const validation = validateImageFile(imageFile);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
      // Sanitize the data URL before storing
      const sanitizedUrl = sanitizeImageDataUrl(e.target.result);
      if (!sanitizedUrl) {
        alert('Invalid image file. Please try a different image.');
        return;
      }
      postData.imageUrl = sanitizedUrl;
      await addDoc(postsRef, postData);
      hideNewPostForm();
      alert('Post created!');
    };
    reader.readAsDataURL(imageFile);
  } else {
    postData.imageUrl = '';
    await addDoc(postsRef, postData);
    hideNewPostForm();
    alert('Post created!');
  }
};

// Delete post
window.deletePost = async function(postId) {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  if (confirm('Delete this post?')) {
    await deleteDoc(doc(db, 'blogPosts', postId));
  }
};