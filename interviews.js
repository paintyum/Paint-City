import { db, auth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUserIsAdmin = false;

// Check if current user is admin
auth.onAuthStateChanged(async (user) => {
  const newInterviewBtn = document.getElementById('newInterviewBtn');
  
  if (!user) {
    currentUserIsAdmin = false;
    return;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      currentUserIsAdmin = userDoc.data().isAdmin || false;
      
      if (currentUserIsAdmin && newInterviewBtn) {
        newInterviewBtn.classList.add('show');
      }
    }
  } catch (err) {
    console.error('Error checking admin status:', err);
    currentUserIsAdmin = false;
  }
});

// Load all interviews
const interviewsRef = collection(db, 'interviews');
const q = query(interviewsRef, orderBy('timestamp', 'desc'));

onSnapshot(q, (snapshot) => {
  const interviewsContainer = document.getElementById('interviewsContainer');
  interviewsContainer.innerHTML = '';
  
  snapshot.forEach((docSnap) => {
    const interview = docSnap.data();
    const interviewId = docSnap.id;
    
    const deleteBtn = currentUserIsAdmin ? 
      `<button onclick="deleteInterview('${interviewId}')" class="delete-interview-btn">Delete Interview</button>` : '';
    
    // Format date
    const postDate = new Date(interview.timestamp);
    const dateString = postDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });

    interviewsContainer.innerHTML += `
      <div class="interview-item">
        <h3>${interview.title}</h3>
        <div class="interview-date">Posted: ${dateString}</div>
        
        <div class="youtube-embed">
          <iframe width="100%" height="450" 
            src="https://www.youtube.com/embed/${interview.youtubeId}" 
            title="${interview.title}"
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
          </iframe>
        </div>
        
        ${interview.description ? `<p class="interview-description">${interview.description}</p>` : ''}
        ${deleteBtn}
      </div>
    `;
  });
});

// Show new interview form
window.showNewInterviewForm = function() {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  const modal = document.getElementById('newInterviewModal');
  modal.classList.add('show');
};

// Hide new interview form
window.hideNewInterviewForm = function() {
  const modal = document.getElementById('newInterviewModal');
  modal.classList.remove('show');
  document.getElementById('newInterviewForm').reset();
};

// Submit new interview
window.submitNewInterview = async function() {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  const title = document.getElementById('interviewTitle').value.trim();
  const youtubeId = document.getElementById('youtubeId').value.trim();
  const description = document.getElementById('interviewDescription').value.trim();
  
  if (!title || !youtubeId) {
    alert('Please fill in title and YouTube ID');
    return;
  }
  
  await addDoc(interviewsRef, {
    title: title,
    youtubeId: youtubeId,
    description: description,
    timestamp: Date.now()
  });
  
  hideNewInterviewForm();
  alert('Interview posted!');
};

// Delete interview
window.deleteInterview = async function(interviewId) {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  if (confirm('Delete this interview?')) {
    await deleteDoc(doc(db, 'interviews', interviewId));
  }
};