import { db, auth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUserIsAdmin = false;
let allReviews = [];

// Check if current user is admin
auth.onAuthStateChanged(async (user) => {
  const newReviewBtn = document.getElementById('newReviewBtn');
  
  if (!user) {
    currentUserIsAdmin = false;
    return;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      currentUserIsAdmin = userDoc.data().isAdmin || false;
      
      if (currentUserIsAdmin && newReviewBtn) {
        newReviewBtn.classList.add('show');
      }
      
      if (currentUserIsAdmin && allReviews.length > 0) {
        refreshReviewDisplay();
      }
    }
  } catch (err) {
    console.error('Error checking admin status:', err);
    currentUserIsAdmin = false;
  }
});

// Refresh review display
function refreshReviewDisplay() {
  const reviewsContainer = document.getElementById('reviewsContainer');
  reviewsContainer.innerHTML = '';
  
  allReviews.forEach(review => {
    displayReview(review.id, review.data);
  });
  
  allReviews.forEach(review => {
    loadCommentsForReview(review.id);
  });
}

// Function to display a single review
function displayReview(reviewId, review) {
  const reviewsContainer = document.getElementById('reviewsContainer');
  
  const deleteBtn = currentUserIsAdmin ? 
    `<button onclick="deleteReview('${reviewId}')" class="delete-review-btn">Delete Review</button>` : '';
  
  const editBtn = currentUserIsAdmin ?
    `<button onclick="editReview('${reviewId}')" class="edit-review-btn">Edit Review</button>` : '';
  
  // Handle legacy 'ok' rating as 'highly-enjoyed'
  const rating = review.rating === 'ok' ? 'highly-enjoyed' : review.rating;
  
  const glowClass = rating === 'must-listen' ? 'glow-red' : 
                    rating === 'not-good' ? 'glow-gray' : 
                    rating === 'highly-enjoyed' ? 'glow-blue' : 
                    rating === 'enjoyed' ? 'glow-yellow' : '';
  
  const ratingLabel = rating === 'must-listen' ? '<div class="rating-label rating-must-listen">MUST LISTEN</div>' :
                      rating === 'highly-enjoyed' ? '<div class="rating-label rating-highly-enjoyed">HIGHLY ENJOYED</div>' :
                      rating === 'enjoyed' ? '<div class="rating-label rating-enjoyed">ENJOYED</div>' :
                      rating === 'not-good' ? '<div class="rating-label rating-not-good">NOT GOOD</div>' : '';
  
  const postDate = new Date(review.timestamp);
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

  // Handle multiple genres
  let genreDisplay = 'Unknown';
  if (review.genres && Array.isArray(review.genres) && review.genres.length > 0) {
    genreDisplay = review.genres.join(', ');
  } else if (review.genre) {
    genreDisplay = review.genre;
  }

  reviewsContainer.innerHTML += `
    <div class="review">
      <div class="review-header">
        <div class="album-cover-container">
          ${review.albumCover ? `<img src="${review.albumCover}" alt="Album Cover" class="album-cover ${glowClass}">` : ''}
          ${ratingLabel}
        </div>
        <div class="review-info">
          <b>${review.albumTitle} – ${review.artist}</b>
          <div class="review-genre">Genre: ${genreDisplay}</div>
          <div class="review-date">Posted: ${dateString} at ${timeString}</div>
          <div class="admin-buttons">
            ${editBtn}
            ${deleteBtn}
          </div>
        </div>
      </div>
      <p>${review.reviewText}</p>
      
      <h3>Comments</h3>
      <div class="review-comments" id="comments-${reviewId}"></div>
      <textarea class="comment-input" id="commentInput-${reviewId}"></textarea><br>
      <button onclick="postReviewComment('${reviewId}')">Post</button>
    </div>
  `;
}

// Load all reviews and build genre filter
const reviewsRef = collection(db, 'reviews');
const q = query(reviewsRef, orderBy('timestamp', 'desc'));

onSnapshot(q, (snapshot) => {
  const reviewsContainer = document.getElementById('reviewsContainer');
  reviewsContainer.innerHTML = '';
  
  allReviews = [];
  const genres = new Set();
  
  snapshot.forEach((docSnap) => {
    const review = docSnap.data();
    const reviewId = docSnap.id;
    
    allReviews.push({ id: reviewId, data: review });
    displayReview(reviewId, review);
    
    // Collect all genres
    if (review.genres && Array.isArray(review.genres)) {
      review.genres.forEach(genre => {
        if (genre && genre.trim()) {
          genres.add(genre.trim());
        }
      });
    } else if (review.genre) {
      genres.add(review.genre);
    }
  });
  
  updateGenreFilter(genres);
  
  snapshot.forEach((docSnap) => {
    loadCommentsForReview(docSnap.id);
  });
});

// Update genre filter dropdown
function updateGenreFilter(genres) {
  const genreList = document.getElementById('genreList');
  if (!genreList) return;
  
  const sortedGenres = Array.from(genres).sort();
  
  let options = '<option value="all">All Genres</option>';
  sortedGenres.forEach(genre => {
    options += `<option value="${genre}">${genre}</option>`;
  });
  
  genreList.innerHTML = options;
}

// Filter reviews by genre and search
window.filterReviews = function() {
  const reviewsContainer = document.getElementById('reviewsContainer');
  const genreFilter = document.getElementById('genreFilter');
  const albumArtistSearch = document.getElementById('albumArtistSearch');
  
  if (!reviewsContainer) return;
  
  reviewsContainer.innerHTML = '';
  
  let filteredReviews = allReviews;
  
  // Filter by genre
  const genreValue = genreFilter ? genreFilter.value.trim().toLowerCase() : '';
  if (genreValue && genreValue !== 'all' && genreValue !== '') {
    filteredReviews = filteredReviews.filter(review => {
      // Check if review has genres array
      if (review.data.genres && Array.isArray(review.data.genres)) {
        return review.data.genres.some(g => g.toLowerCase().includes(genreValue));
      }
      // Fallback to old genre field
      const genre = review.data.genre || '';
      return genre.toLowerCase().includes(genreValue);
    });
  }
  
  // Filter by album/artist search
  const searchValue = albumArtistSearch ? albumArtistSearch.value.trim().toLowerCase() : '';
  if (searchValue) {
    filteredReviews = filteredReviews.filter(review => {
      const albumTitle = (review.data.albumTitle || '').toLowerCase();
      const artist = (review.data.artist || '').toLowerCase();
      return albumTitle.includes(searchValue) || artist.includes(searchValue);
    });
  }
  
  filteredReviews.forEach(review => {
    displayReview(review.id, review.data);
  });
  
  filteredReviews.forEach(review => {
    loadCommentsForReview(review.id);
  });
};

// Show new review form
window.showNewReviewForm = function() {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  document.getElementById('editReviewId').value = '';
  document.getElementById('modalTitle').textContent = 'New Album Review';
  document.getElementById('newReviewForm').reset();
  document.getElementById('albumCoverPreview').style.display = 'none';
  
  const modal = document.getElementById('newReviewModal');
  modal.classList.add('show');
};

// Edit review
window.editReview = async function(reviewId) {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  const reviewDoc = await getDoc(doc(db, 'reviews', reviewId));
  if (!reviewDoc.exists()) return;
  
  const review = reviewDoc.data();
  
  document.getElementById('editReviewId').value = reviewId;
  document.getElementById('modalTitle').textContent = 'Edit Album Review';
  document.getElementById('albumTitle').value = review.albumTitle;
  document.getElementById('artist').value = review.artist;
  
  // Handle multiple genres
  if (review.genres && Array.isArray(review.genres)) {
    document.getElementById('genreInput').value = review.genres.join(', ');
  } else if (review.genre) {
    document.getElementById('genreInput').value = review.genre;
  } else {
    document.getElementById('genreInput').value = '';
  }
  
  document.getElementById('reviewText').value = review.reviewText;
  
  if (review.albumCover) {
    document.getElementById('albumCoverPreview').src = review.albumCover;
    document.getElementById('albumCoverPreview').style.display = 'block';
  }
  
  if (review.rating === 'must-listen') {
    document.getElementById('mustListen').checked = true;
  } else if (review.rating === 'highly-enjoyed') {
    document.getElementById('highlyEnjoyed').checked = true;
  } else if (review.rating === 'enjoyed') {
    document.getElementById('enjoyed').checked = true;
  } else if (review.rating === 'not-good') {
    document.getElementById('notGood').checked = true;
  } else if (review.rating === 'ok') {
    // Legacy support - convert old 'ok' rating to 'highly-enjoyed'
    document.getElementById('highlyEnjoyed').checked = true;
  }
  
  const modal = document.getElementById('newReviewModal');
  modal.classList.add('show');
};

// Hide new review form
window.hideNewReviewForm = function() {
  const modal = document.getElementById('newReviewModal');
  modal.classList.remove('show');
  document.getElementById('newReviewForm').reset();
  document.getElementById('albumCoverPreview').style.display = 'none';
  document.getElementById('editReviewId').value = '';
};

// Preview album cover
window.previewAlbumCover = function(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('albumCoverPreview');
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
};

// Submit new or edited review
window.submitNewReview = async function() {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  const editReviewId = document.getElementById('editReviewId').value;
  const albumTitle = document.getElementById('albumTitle').value.trim();
  const artist = document.getElementById('artist').value.trim();
  const genreInput = document.getElementById('genreInput').value.trim();
  const reviewText = document.getElementById('reviewText').value.trim();
  const albumCoverFile = document.getElementById('albumCoverInput').files[0];
  
  let rating = '';
  if (document.getElementById('mustListen').checked) rating = 'must-listen';
  else if (document.getElementById('highlyEnjoyed').checked) rating = 'highly-enjoyed';
  else if (document.getElementById('enjoyed').checked) rating = 'enjoyed';
  else if (document.getElementById('notGood').checked) rating = 'not-good';
  
  if (!albumTitle || !artist || !reviewText || !genreInput) {
    alert('Please fill in all fields');
    return;
  }
  
  // Parse genres - split by comma and trim whitespace
  const genres = genreInput.split(',').map(g => g.trim()).filter(g => g.length > 0);
  
  const reviewData = {
    albumTitle: albumTitle,
    artist: artist,
    genres: genres,
    reviewText: reviewText,
    rating: rating
  };
  
  if (editReviewId) {
    if (albumCoverFile) {
      const reader = new FileReader();
      reader.onload = async function(e) {
        reviewData.albumCover = e.target.result;
        await updateDoc(doc(db, 'reviews', editReviewId), reviewData);
        hideNewReviewForm();
        alert('Review updated!');
      };
      reader.readAsDataURL(albumCoverFile);
    } else {
      const existingReview = await getDoc(doc(db, 'reviews', editReviewId));
      reviewData.albumCover = existingReview.data().albumCover || '';
      await updateDoc(doc(db, 'reviews', editReviewId), reviewData);
      hideNewReviewForm();
      alert('Review updated!');
    }
  } else {
    reviewData.timestamp = Date.now();
    
    if (albumCoverFile) {
      const reader = new FileReader();
      reader.onload = async function(e) {
        reviewData.albumCover = e.target.result;
        await addDoc(reviewsRef, reviewData);
        hideNewReviewForm();
        alert('Review posted!');
      };
      reader.readAsDataURL(albumCoverFile);
    } else {
      reviewData.albumCover = '';
      await addDoc(reviewsRef, reviewData);
      hideNewReviewForm();
      alert('Review posted!');
    }
  }
};

// Delete review
window.deleteReview = async function(reviewId) {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  if (confirm('Delete this review?')) {
    await deleteDoc(doc(db, 'reviews', reviewId));
  }
};

// Load comments for a specific review
// Store unsubscribe functions for each review's comments
const commentUnsubscribes = {};

async function loadCommentsForReview(reviewId) {
  // Unsubscribe from previous listener if it exists
  if (commentUnsubscribes[reviewId]) {
    commentUnsubscribes[reviewId]();
    delete commentUnsubscribes[reviewId];
  }
  
  const commentsRef = collection(db, 'reviews', reviewId, 'comments');
  const q = query(commentsRef, orderBy('timestamp', 'asc'));
  
  const unsubscribe = onSnapshot(q, async (snapshot) => {
    const commentsContainer = document.getElementById(`comments-${reviewId}`);
    if (!commentsContainer) return;
    
    // Clear existing comments
    commentsContainer.innerHTML = '';
    
    // If no comments, show empty state
    if (snapshot.empty) {
      return;
    }
    
    const comments = [];
    const userIds = new Set();
    
    // First pass: collect all unique user IDs
    for (const docSnap of snapshot.docs) {
      const comment = docSnap.data();
      if (comment.userId) {
        userIds.add(comment.userId);
      }
    }
    
    // Fetch all user data in parallel
    const userDataMap = new Map();
    const userFetchPromises = Array.from(userIds).map(async (userId) => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          userDataMap.set(userId, userDoc.data().username);
        }
      } catch (err) {
        console.error('Error fetching user:', err);
      }
    });
    
    await Promise.all(userFetchPromises);
    
    // Second pass: build comments array with usernames
    const allComments = [];
    const repliesMap = new Map(); // Map parent comment ID to array of replies
    
    for (const docSnap of snapshot.docs) {
      const comment = docSnap.data();
      const commentId = docSnap.id;
      const userId = comment.userId;
      const username = userDataMap.get(userId);
      
      if (username) {
        const commentData = {
          commentId,
          username,
          userId: userId,
          text: comment.text,
          likes: comment.likes || 0,
          dislikes: comment.dislikes || 0,
          likedBy: comment.likedBy || [],
          dislikedBy: comment.dislikedBy || [],
          timestamp: comment.timestamp || 0,
          parentCommentId: comment.parentCommentId || null
        };
        
        if (comment.parentCommentId) {
          // This is a reply
          if (!repliesMap.has(comment.parentCommentId)) {
            repliesMap.set(comment.parentCommentId, []);
          }
          repliesMap.get(comment.parentCommentId).push(commentData);
        } else {
          // This is a top-level comment
          allComments.push(commentData);
        }
      }
    }
    
    // Sort top-level comments by likes (descending), then by timestamp (ascending)
    allComments.sort((a, b) => {
      if (b.likes !== a.likes) {
        return b.likes - a.likes;
      }
      return a.timestamp - b.timestamp;
    });
    
    // Sort replies by timestamp (ascending)
    repliesMap.forEach((replies) => {
      replies.sort((a, b) => a.timestamp - b.timestamp);
    });
    
    
    // Render comments with replies
    const currentUserId = auth.currentUser ? auth.currentUser.uid : null;
    
    function renderComment(comment, isReply = false, originalAuthorId = null) {
      const hasLiked = currentUserId ? comment.likedBy.includes(currentUserId) : false;
      const hasDisliked = currentUserId ? comment.dislikedBy.includes(currentUserId) : false;
      
      const likeClass = hasLiked ? 'active' : '';
      const dislikeClass = hasDisliked ? 'active' : '';
      
      const deleteCommentBtn = currentUserIsAdmin ? 
        `<button class="delete-comment-btn" onclick="deleteComment('${reviewId}', '${comment.commentId}')">Delete</button>` : '';
      
      // Show reply button only if:
      // 1. It's a top-level comment (not a reply) - anyone can reply, OR
      // 2. It's a reply AND the current user is the original comment author
      let replyBtn = '';
      if (!isReply) {
        replyBtn = `<button class="reply-btn" onclick="showReplyForm('${reviewId}', '${comment.commentId}')">Reply</button>`;
      } else if (originalAuthorId && currentUserId === originalAuthorId) {
        replyBtn = `<button class="reply-btn" onclick="showReplyForm('${reviewId}', '${comment.commentId}')">Reply</button>`;
      }
      
      // Add admin badge for "paint" username
      const adminBadge = comment.username.toLowerCase() === 'paint' ? 
        `<img src="favicon.png" alt="Admin" class="admin-badge" style="width: 16px; height: 16px; vertical-align: middle; margin-left: 5px; display: inline-block;">` : '';
      
      const replyClass = isReply ? 'comment-reply' : '';
      const indentStyle = isReply ? 'style="margin-left: 30px; border-left: 2px solid #0066cc; padding-left: 10px;"' : '';
      
      let html = `
        <div class="comment-item-full ${replyClass}" ${indentStyle}>
          <div class="comment-content">
            <b>${comment.username}</b>${adminBadge}: ${comment.text}
          </div>
          <div class="comment-actions">
            <button class="like-btn ${likeClass}" onclick="likeComment('${reviewId}', '${comment.commentId}')">
              👍 ${comment.likes}
            </button>
            <button class="dislike-btn ${dislikeClass}" onclick="dislikeComment('${reviewId}', '${comment.commentId}')">
              👎 ${comment.dislikes}
            </button>
            ${replyBtn}
            ${deleteCommentBtn}
          </div>
          <div id="reply-form-${comment.commentId}" style="display: none; margin-top: 10px;">
            <textarea class="reply-input" id="reply-input-${comment.commentId}" rows="2" placeholder="Write a reply..."></textarea>
            <div style="margin-top: 5px;">
              <button onclick="postReply('${reviewId}', '${comment.commentId}')" style="background: #0066cc; color: #ffff00; padding: 5px 10px; border: 2px solid #00ffff; cursor: pointer; font-size: 11px; margin-right: 5px;">Post Reply</button>
              <button onclick="hideReplyForm('${comment.commentId}')" style="background: #666; color: #fff; padding: 5px 10px; border: 2px solid #999; cursor: pointer; font-size: 11px;">Cancel</button>
            </div>
          </div>
        </div>
      `;
      
      // Add replies if they exist
      // Pass the original comment author's ID so only they can reply to replies
      if (repliesMap.has(comment.commentId)) {
        const replies = repliesMap.get(comment.commentId);
        replies.forEach(reply => {
          html += renderComment(reply, true, comment.userId);
        });
      }
      
      return html;
    }
    
    allComments.forEach(comment => {
      commentsContainer.innerHTML += renderComment(comment);
    });
  }, (error) => {
    console.error('Error in comments snapshot:', error);
  });
  
  // Store the unsubscribe function
  commentUnsubscribes[reviewId] = unsubscribe;
}

// Track if a comment is being posted to prevent duplicates
const postingComments = new Set();

// Post comment on a review
window.postReviewComment = async function(reviewId) {
  // Prevent double-posting
  if (postingComments.has(reviewId)) {
    return;
  }
  
  if (!auth.currentUser) {
    alert('You must be logged in to comment');
    return;
  }
  
  const commentInput = document.getElementById(`commentInput-${reviewId}`);
  const text = commentInput.value.trim();
  
  if (!text) {
    alert('Comment cannot be empty');
    return;
  }
  
  // Mark as posting
  postingComments.add(reviewId);
  
  try {
    const commentsRef = collection(db, 'reviews', reviewId, 'comments');
    await addDoc(commentsRef, {
      userId: auth.currentUser.uid,
      text: text,
      timestamp: Date.now(),
      likes: 0,
      dislikes: 0,
      likedBy: [],
      dislikedBy: [],
      parentCommentId: null
    });
    
    commentInput.value = '';
  } catch (err) {
    console.error('Error posting comment:', err);
    alert('Error posting comment');
  } finally {
    // Remove from posting set after a short delay
    setTimeout(() => {
      postingComments.delete(reviewId);
    }, 1000);
  }
};

// Show reply form
window.showReplyForm = function(reviewId, parentCommentId) {
  const replyForm = document.getElementById(`reply-form-${parentCommentId}`);
  if (replyForm) {
    replyForm.style.display = 'block';
    const replyInput = document.getElementById(`reply-input-${parentCommentId}`);
    if (replyInput) {
      replyInput.focus();
    }
  }
};

// Hide reply form
window.hideReplyForm = function(parentCommentId) {
  const replyForm = document.getElementById(`reply-form-${parentCommentId}`);
  if (replyForm) {
    replyForm.style.display = 'none';
    const replyInput = document.getElementById(`reply-input-${parentCommentId}`);
    if (replyInput) {
      replyInput.value = '';
    }
  }
};

// Post a reply
window.postReply = async function(reviewId, parentCommentId) {
  if (!auth.currentUser) {
    alert('You must be logged in to reply');
    return;
  }
  
  const replyInput = document.getElementById(`reply-input-${parentCommentId}`);
  const text = replyInput.value.trim();
  
  if (!text) {
    alert('Reply cannot be empty');
    return;
  }
  
  try {
    const commentsRef = collection(db, 'reviews', reviewId, 'comments');
    await addDoc(commentsRef, {
      userId: auth.currentUser.uid,
      text: text,
      timestamp: Date.now(),
      likes: 0,
      dislikes: 0,
      likedBy: [],
      dislikedBy: [],
      parentCommentId: parentCommentId
    });
    
    hideReplyForm(parentCommentId);
  } catch (err) {
    console.error('Error posting reply:', err);
    alert('Error posting reply');
  }
};

// Delete comment
window.deleteComment = async function(reviewId, commentId) {
  if (!currentUserIsAdmin) {
    alert('Admin only');
    return;
  }
  
  if (confirm('Delete this comment?')) {
    await deleteDoc(doc(db, 'reviews', reviewId, 'comments', commentId));
  }
};

// Like a comment
window.likeComment = async function(reviewId, commentId) {
  if (!auth.currentUser) {
    alert('You must be logged in to like comments');
    return;
  }
  
  const commentRef = doc(db, 'reviews', reviewId, 'comments', commentId);
  const commentSnap = await getDoc(commentRef);
  
  if (!commentSnap.exists()) return;
  
  const commentData = commentSnap.data();
  const likedBy = commentData.likedBy || [];
  const dislikedBy = commentData.dislikedBy || [];
  const currentUserId = auth.currentUser.uid;
  
  let likes = commentData.likes || 0;
  let dislikes = commentData.dislikes || 0;
  
  if (likedBy.includes(currentUserId)) {
    likes -= 1;
    const index = likedBy.indexOf(currentUserId);
    likedBy.splice(index, 1);
  } else {
    likes += 1;
    likedBy.push(currentUserId);
    
    if (dislikedBy.includes(currentUserId)) {
      dislikes -= 1;
      const index = dislikedBy.indexOf(currentUserId);
      dislikedBy.splice(index, 1);
    }
  }
  
  await updateDoc(commentRef, {
    likes: likes,
    dislikes: dislikes,
    likedBy: likedBy,
    dislikedBy: dislikedBy
  });
};

// Dislike a comment
window.dislikeComment = async function(reviewId, commentId) {
  if (!auth.currentUser) {
    alert('You must be logged in to dislike comments');
    return;
  }
  
  const commentRef = doc(db, 'reviews', reviewId, 'comments', commentId);
  const commentSnap = await getDoc(commentRef);
  
  if (!commentSnap.exists()) return;
  
  const commentData = commentSnap.data();
  const likedBy = commentData.likedBy || [];
  const dislikedBy = commentData.dislikedBy || [];
  const currentUserId = auth.currentUser.uid;
  
  let likes = commentData.likes || 0;
  let dislikes = commentData.dislikes || 0;
  
  if (dislikedBy.includes(currentUserId)) {
    dislikes -= 1;
    const index = dislikedBy.indexOf(currentUserId);
    dislikedBy.splice(index, 1);
  } else {
    dislikes += 1;
    dislikedBy.push(currentUserId);
    
    if (likedBy.includes(currentUserId)) {
      likes -= 1;
      const index = likedBy.indexOf(currentUserId);
      likedBy.splice(index, 1);
    }
  }
  
  await updateDoc(commentRef, {
    likes: likes,
    dislikes: dislikes,
    likedBy: likedBy,
    dislikedBy: dislikedBy
  });
};