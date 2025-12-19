import { updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, auth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc as firestoreDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ref = collection(db,'comments');
const q = query(ref, orderBy('timestamp', 'desc'));

let currentUserIsAdmin = false;

// Check if current user is admin
auth.onAuthStateChanged(async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      currentUserIsAdmin = userDoc.data().isAdmin || false;
    }
  }
});

const comments = document.getElementById('comments');
if (!comments) {
  console.error('Comments element not found');
}

onSnapshot(q, async (snap) => {
  if (!comments) return;
  comments.innerHTML='';
  
  for (const d of snap.docs) {
    const commentData = d.data();
    const userId = commentData.userId;
    const commentId = d.id;
    
    // Try to get the username from the users collection
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      // Only show comment if user still exists
      if (userDoc.exists()) {
        const username = userDoc.data().username;
        const deleteBtn = currentUserIsAdmin ? `<button onclick="deleteComment('${commentId}')" class="delete-btn">Delete</button>` : '';
        const timeoutBtn = currentUserIsAdmin ? `<button onclick="timeoutUser('${userId}', '${username}')" class="timeout-btn">Timeout</button>` : '';
        
        comments.innerHTML += `
          <div class="comment-item">
            <span><b>${username}</b>: ${commentData.text}</span>
            <span class="admin-controls">${deleteBtn} ${timeoutBtn}</span>
          </div>`;
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      // Skip this comment if we can't fetch the user
    }
  }
});

window.postComment = async function(){
  if (!auth.currentUser) {
    alert('You must be logged in to comment');
    return;
  }
  
  if (!commentInput.value.trim()) {
    alert('Comment cannot be empty');
    return;
  }

  // Check if user is timed out
  const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
  if (userDoc.exists()) {
    const userData = userDoc.data();
    if (userData.timeoutUntil && userData.timeoutUntil > Date.now()) {
      const timeLeft = Math.ceil((userData.timeoutUntil - Date.now()) / 1000 / 60);
      alert(`You are timed out for ${timeLeft} more minutes`);
      return;
    }
  }
  
  await addDoc(ref,{
    userId: auth.currentUser.uid,
    text: commentInput.value,
    timestamp: Date.now()
  });
  commentInput.value='';
}

window.deleteComment = async function(commentId) {
  if (!currentUserIsAdmin) {
    alert('Admin only');
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

window.timeoutUser = async function(userId, username) {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  const minutes = prompt(`Timeout ${username} for how many minutes?`);
  if (!minutes || isNaN(minutes)) return;
  
  try {
    const timeoutUntil = Date.now() + (parseInt(minutes) * 60 * 1000);
    await updateDoc(doc(db, 'users', userId), {
      timeoutUntil: timeoutUntil
    });
    alert(`${username} timed out for ${minutes} minutes`);
  } catch (err) {
    alert('Error timing out user');
    console.error(err);
  }
}