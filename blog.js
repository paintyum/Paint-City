import { db, auth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    
    const deleteBtn = currentUserIsAdmin ? 
      `<button onclick="deletePost('${postId}')" class="delete-post-btn">Delete</button>` : '';
    
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
    
    const imageHtml = post.imageUrl ? 
      `<img src="${post.imageUrl}" alt="Post image" class="blog-post-image">` : '';
    
    postsContainer.innerHTML += `
      <div class="blog-post">
        <div class="post-header">
          <div class="post-date">${dateString} at ${timeString}</div>
          ${deleteBtn}
        </div>
        <div class="post-content">${post.content}</div>
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
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.src = e.target.result;
      preview.style.display = 'block';
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
    const reader = new FileReader();
    reader.onload = async function(e) {
      postData.imageUrl = e.target.result;
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