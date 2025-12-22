import { db, auth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, getDocs, where, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { escapeHtml, escapeHtmlAttr, escapeJs } from './xss-utils.js';
import { validateImageFile, sanitizeImageDataUrl } from './image-security.js';

let currentUserIsAdmin = false;
let currentUserIsMod = false;
let allReviews = [];

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
      const userData = userDoc.data();
      currentUserIsAdmin = userData.isAdmin || false;
      currentUserIsMod = userData.isMod || false;
      
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
  
  // Escape reviewId for use in onclick handlers
  const escapedReviewIdForHandlers = escapeJs(reviewId || '');
  
  const deleteBtn = currentUserIsAdmin ? 
    `<button onclick="deleteReview('${escapedReviewIdForHandlers}')" class="delete-review-btn">Delete Review</button>` : '';
  
  const editBtn = currentUserIsAdmin ?
    `<button onclick="editReview('${escapedReviewIdForHandlers}')" class="edit-review-btn">Edit Review</button>` : '';
  
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

  // Handle multiple genres - escape for safety
  let genreDisplay = 'Unknown';
  if (review.genres && Array.isArray(review.genres) && review.genres.length > 0) {
    genreDisplay = review.genres.map(g => escapeHtml(g)).join(', ');
  } else if (review.genre) {
    genreDisplay = escapeHtml(review.genre);
  }

  // Escape all user/admin input
  const escapedAlbumTitle = escapeHtml(review.albumTitle || '');
  const escapedArtist = escapeHtml(review.artist || '');
  const escapedReviewText = escapeHtml(review.reviewText || '');
  const escapedAlbumCover = review.albumCover ? escapeHtmlAttr(review.albumCover) : null;
  const escapedReviewId = escapeJs(reviewId || '');

  reviewsContainer.innerHTML += `
    <div class="review">
      <div class="review-header">
        <div class="album-cover-container">
          ${escapedAlbumCover ? `<img src="${escapedAlbumCover}" alt="Album Cover" class="album-cover ${glowClass}">` : ''}
          ${ratingLabel}
        </div>
        <div class="review-info">
          <b>${escapedAlbumTitle} – ${escapedArtist}</b>
          <div class="review-genre">Genre: ${genreDisplay}</div>
          <div class="review-date">Posted: ${escapeHtml(dateString)} at ${escapeHtml(timeString)}</div>
          <div class="admin-buttons">
            ${editBtn}
            ${deleteBtn}
          </div>
        </div>
      </div>
      <p>${escapedReviewText}</p>
      
      <h3>Comments</h3>
      <div class="review-comments" id="comments-${reviewId}"></div>
      <div style="margin: 10px 0;">
        <div style="color: #ffff00; margin-bottom: 5px;">Your Rating (optional):</div>
        <div class="star-rating" id="userStarRating-${escapeHtmlAttr(reviewId)}" style="font-size: 20px; cursor: pointer;">
          <span onclick="setUserRating('${escapedReviewId}', 1)" id="userStar1-${escapeHtmlAttr(reviewId)}">☆</span>
          <span onclick="setUserRating('${escapedReviewId}', 2)" id="userStar2-${escapeHtmlAttr(reviewId)}">☆</span>
          <span onclick="setUserRating('${escapedReviewId}', 3)" id="userStar3-${escapeHtmlAttr(reviewId)}">☆</span>
          <span onclick="setUserRating('${escapedReviewId}', 4)" id="userStar4-${escapeHtmlAttr(reviewId)}">☆</span>
          <span onclick="setUserRating('${escapedReviewId}', 5)" id="userStar5-${escapeHtmlAttr(reviewId)}">☆</span>
        </div>
        <input type="hidden" id="userRating-${escapeHtmlAttr(reviewId)}" value="0">
      </div>
      <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
        <button onclick="openGifPicker('comment-${escapedReviewId}')" style="background: #0066cc; color: #ffff00; padding: 5px 10px; border: 2px solid #00ffff; cursor: pointer; font-size: 12px;">GIF</button>
        <textarea class="comment-input" id="commentInput-${escapeHtmlAttr(reviewId)}" style="flex: 1;"></textarea>
      </div>
      <button onclick="postReviewComment('${escapedReviewId}')">Post</button>
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
    const escapedGenre = escapeHtml(genre);
    const escapedGenreAttr = escapeHtmlAttr(genre);
    options += `<option value="${escapedGenreAttr}">${escapedGenre}</option>`;
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
  document.getElementById('adminRating').value = '0';
  // Reset stars
  for (let i = 1; i <= 5; i++) {
    const star = document.getElementById('star' + i);
    if (star) {
      star.textContent = '☆';
      star.style.color = '#666';
    }
  }
};

// Preview album cover
window.previewAlbumCover = function(event) {
  const file = event.target.files[0];
  if (file) {
    // Validate image file before processing
    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      event.target.value = ''; // Clear the input
      const preview = document.getElementById('albumCoverPreview');
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
      const preview = document.getElementById('albumCoverPreview');
      if (sanitizedUrl && preview) {
        preview.src = sanitizedUrl;
        preview.style.display = 'block';
      } else {
        alert('Invalid image file');
        event.target.value = '';
        if (preview) {
          preview.style.display = 'none';
          preview.src = '';
        }
      }
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
      // Validate image file before processing
      const validation = validateImageFile(albumCoverFile);
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
        reviewData.albumCover = sanitizedUrl;
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
      // Validate image file before processing
      const validation = validateImageFile(albumCoverFile);
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
        reviewData.albumCover = sanitizedUrl;
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
    
    // Fetch all user data and roles in parallel
    const userDataMap = new Map();
    const userFetchPromises = Array.from(userIds).map(async (userId) => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          userDataMap.set(userId, {
            username: userData.username,
            isAdmin: userData.isAdmin || false,
            isMod: userData.isMod || false
          });
        }
      } catch (err) {
        console.error('Error fetching user:', err);
      }
    });
    
    await Promise.all(userFetchPromises);
    
    // Collect all GIF IDs
    const gifIds = new Set();
    for (const docSnap of snapshot.docs) {
      const comment = docSnap.data();
      if (comment.gifId) {
        gifIds.add(comment.gifId);
      }
    }
    
    // Load all GIF data in parallel
    const gifDataMap = new Map();
    const gifFetchPromises = Array.from(gifIds).map(async (gifId) => {
      try {
        const gifDoc = await getDoc(doc(db, 'shopItems', gifId));
        if (gifDoc.exists()) {
          gifDataMap.set(gifId, gifDoc.data());
        }
      } catch (err) {
        console.error('Error loading GIF:', err);
      }
    });
    
    await Promise.all(gifFetchPromises);
    
    // Second pass: build comments array with usernames
    const allComments = [];
    const repliesMap = new Map(); // Map parent comment ID to array of replies
    
    for (const docSnap of snapshot.docs) {
      const comment = docSnap.data();
      const commentId = docSnap.id;
      const userId = comment.userId;
      const userData = userDataMap.get(userId);
      
      if (userData && userData.username) {
        const commentData = {
          commentId,
          username: userData.username,
          userId: userId,
          isAdmin: userData.isAdmin,
          isMod: userData.isMod,
          text: comment.text || '',
          likes: comment.likes || 0,
          dislikes: comment.dislikes || 0,
          likedBy: comment.likedBy || [],
          dislikedBy: comment.dislikedBy || [],
          timestamp: comment.timestamp || 0,
          parentCommentId: comment.parentCommentId || null,
          starRating: comment.starRating || 0,
          gifId: comment.gifId || null,
          gifData: comment.gifId ? gifDataMap.get(comment.gifId) || null : null
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
    
    async function renderComment(comment, isReply = false, originalAuthorId = null) {
      const hasLiked = currentUserId ? comment.likedBy.includes(currentUserId) : false;
      const hasDisliked = currentUserId ? comment.dislikedBy.includes(currentUserId) : false;
      
      const likeClass = hasLiked ? 'active' : '';
      const dislikeClass = hasDisliked ? 'active' : '';
      
      // Escape all user input to prevent XSS
      const escapedReviewId = escapeJs(reviewId || '');
      const escapedCommentId = escapeJs(comment.commentId || '');
      const escapedUsername = escapeHtml(comment.username || '');
      const escapedUserId = escapeJs(comment.userId || '');
      const safeUsername = escapeJs(comment.username || '');
      const safeId = (comment.username || '').replace(/[^a-zA-Z0-9]/g, '_');
      const escapedSafeId = escapeHtmlAttr(safeId);
      
      const deleteCommentBtn = (currentUserIsAdmin || currentUserIsMod) ? 
        `<button class="delete-comment-btn" onclick="deleteComment('${escapedReviewId}', '${escapedCommentId}')">Delete</button>` : '';
      
      // Show reply button only if:
      // 1. It's a top-level comment (not a reply) - anyone can reply, OR
      // 2. It's a reply AND the current user is the original comment author
      let replyBtn = '';
      if (!isReply) {
        replyBtn = `<button class="reply-btn" onclick="showReplyForm('${escapedReviewId}', '${escapedCommentId}')">Reply</button>`;
      } else if (originalAuthorId && currentUserId === originalAuthorId) {
        replyBtn = `<button class="reply-btn" onclick="showReplyForm('${escapedReviewId}', '${escapedCommentId}')">Reply</button>`;
      }
      
      // Get shop items for this user
      const shopItems = await getUserShopItems(comment.userId);
      const equippedBadgeUrl = shopItems.badge || null;
      const nameColor = shopItems.nameColor || '#ffffff';
      const glowColor = shopItems.glowColor || null;
      const escapedNameColor = escapeHtmlAttr(nameColor);
      const glowStyle = glowColor ? `text-shadow: 0 0 10px ${escapeHtmlAttr(glowColor)}, 0 0 20px ${escapeHtmlAttr(glowColor)}, 0 0 30px ${escapeHtmlAttr(glowColor)};` : '';
      
      // Add badges based on role and equipped items
      let badges = '';
      const isAdmin = comment.isAdmin || comment.username.toLowerCase() === 'paint';
      if (isAdmin) {
        badges += `<img src="favicon.png" alt="Admin" class="admin-badge" style="width: 16px; height: 16px; vertical-align: middle; margin-left: 5px; display: inline-block;">`;
      }
      if (comment.isMod) {
        badges += `<img src="mod-badge.png" alt="Mod" class="mod-badge" style="width: 16px; height: 16px; vertical-align: middle; margin-left: 5px; display: inline-block;">`;
      }
      if (equippedBadgeUrl) {
        const escapedBadgeUrl = escapeHtmlAttr(equippedBadgeUrl);
        badges += `<img src="${escapedBadgeUrl}" alt="Badge" style="width: 16px; height: 16px; vertical-align: middle; margin-left: 5px; display: inline-block;">`;
      }
      
      const replyClass = isReply ? 'comment-reply' : '';
      const indentStyle = isReply ? 'style="margin-left: 30px; border-left: 2px solid #0066cc; padding-left: 10px;"' : '';
      
      // Make username clickable for admins/mods (only for other users, not self)
      let usernameHtml = `<b style="color: ${escapedNameColor}; ${glowStyle}">${escapedUsername}</b>${badges}`;
      let timeoutBanButtons = '';
      
      // If admin/mod, make username clickable with menu
      if (currentUserIsAdmin || currentUserIsMod) {
        usernameHtml = `<span class="review-comment-username-clickable" onclick="showReviewCommentAdminMenu('${escapedSafeId}', '${escapedUserId}', '${safeUsername}', event)" style="cursor: pointer;">${usernameHtml}</span>`;
        
        const isOwnName = currentUserId === comment.userId;
        let menuContent = '';
        
        if (isOwnName && currentUserIsAdmin) {
          // Own name: Change Level and Give Points
          menuContent = `
            <button onclick="adminChangeLevel('${escapedUserId}', '${safeUsername}')" style="background: #0066cc; color: #ffff00;">Change Level (Admin)</button>
            <button onclick="adminGivePoints('${escapedUserId}', '${safeUsername}')" style="background: #ffaa00; color: #000; margin-top: 5px;">Give Points (Admin)</button>
          `;
        } else if (!isOwnName) {
          // Other users: all options
          menuContent = `
            <button onclick="timeoutReviewUserFromMinutes('${escapedUserId}', '${safeUsername}', '${escapedReviewId}', 5)">Timeout 5 min</button>
            <button onclick="timeoutReviewUserFromMinutes('${escapedUserId}', '${safeUsername}', '${escapedReviewId}', 30)">Timeout 30 min</button>
            <button onclick="timeoutReviewUserFromMinutes('${escapedUserId}', '${safeUsername}', '${escapedReviewId}', 60)">Timeout 1 hour</button>
            <button onclick="timeoutReviewUserFromMinutes('${escapedUserId}', '${safeUsername}', '${escapedReviewId}', 1440)">Timeout 1 day</button>
            <button onclick="banReviewUser('${escapedUserId}', '${safeUsername}', '${escapedReviewId}')" style="background: #cc0000; color: #fff; margin-top: 5px;">BAN USER</button>
            ${currentUserIsAdmin ? `<button onclick="adminChangeLevel('${escapedUserId}', '${safeUsername}')" style="background: #0066cc; color: #ffff00; margin-top: 5px;">Change Level (Admin)</button>` : ''}
            ${currentUserIsAdmin ? `<button onclick="adminGivePoints('${escapedUserId}', '${safeUsername}')" style="background: #ffaa00; color: #000; margin-top: 5px;">Give Points (Admin)</button>` : ''}
          `;
        }
        
        if (menuContent) {
          // Add hidden menu that will be shown on click
          timeoutBanButtons = `
            <div class="review-comment-admin-menu" id="reviewCommentMenu_${escapedSafeId}" style="display: none; position: absolute; background: rgba(0, 0, 0, 0.95); border: 2px solid #0066cc; padding: 5px; z-index: 10000; min-width: 150px;">
              ${menuContent}
            </div>
          `;
        }
      }
      
      // Display star rating if comment has one
      let starRatingDisplay = '';
      if (comment.starRating && comment.starRating >= 1 && comment.starRating <= 5) {
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
          starsHtml += i <= comment.starRating ? '★' : '☆';
        }
        starRatingDisplay = `<div style="color: #ffff00; font-size: 16px; margin: 5px 0;">${starsHtml}</div>`;
      }
      
      // Handle GIF in comment - escape URLs and alt text
      let commentContentHtml = '';
      if (comment.gifData) {
        const gifUrl = escapeHtmlAttr(comment.gifData.value || '');
        const gifAlt = escapeHtmlAttr(comment.gifData.name || 'GIF');
        commentContentHtml = `<img src="${gifUrl}" alt="${gifAlt}" style="max-width: 150px; max-height: 150px; vertical-align: middle; margin: 5px 0;">`;
      }
      if (comment.text) {
        // Escape comment text to prevent XSS
        const escapedCommentText = escapeHtml(comment.text);
        commentContentHtml += escapedCommentText;
      }
      
      const escapedCommentIdAttr = escapeHtmlAttr(comment.commentId || '');
      let html = `
        <div class="comment-item-full ${replyClass}" ${indentStyle} style="position: relative;">
          <div class="comment-content">
            ${usernameHtml}: ${commentContentHtml}
            ${starRatingDisplay}
            ${timeoutBanButtons}
          </div>
          <div class="comment-actions">
            <button class="like-btn ${likeClass}" onclick="likeComment('${escapedReviewId}', '${escapedCommentId}')">
              👍 ${escapeHtml(String(comment.likes || 0))}
            </button>
            <button class="dislike-btn ${dislikeClass}" onclick="dislikeComment('${escapedReviewId}', '${escapedCommentId}')">
              👎 ${escapeHtml(String(comment.dislikes || 0))}
            </button>
            ${replyBtn}
            ${deleteCommentBtn}
          </div>
          <div id="reply-form-${escapedCommentIdAttr}" style="display: none; margin-top: 10px;">
            <textarea class="reply-input" id="reply-input-${escapedCommentIdAttr}" rows="2" placeholder="Write a reply..."></textarea>
            <div style="margin-top: 5px;">
              <button onclick="postReply('${escapedReviewId}', '${escapedCommentId}')" style="background: #0066cc; color: #ffff00; padding: 5px 10px; border: 2px solid #00ffff; cursor: pointer; font-size: 11px; margin-right: 5px;">Post Reply</button>
              <button onclick="hideReplyForm('${escapedCommentId}')" style="background: #666; color: #fff; padding: 5px 10px; border: 2px solid #999; cursor: pointer; font-size: 11px;">Cancel</button>
            </div>
          </div>
        </div>
      `;
      
      // Add replies if they exist
      // Pass the original comment author's ID so only they can reply to replies
      if (repliesMap.has(comment.commentId)) {
        const replies = repliesMap.get(comment.commentId);
        for (const reply of replies) {
          html += await renderComment(reply, true, comment.userId);
        }
      }
      
      return html;
    }
    
    // Render all comments asynchronously
    (async () => {
      for (const comment of allComments) {
        const commentHtml = await renderComment(comment);
        commentsContainer.innerHTML += commentHtml;
      }
    })();
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
  
  // Check if user is timed out
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      // Check if user is timed out
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
      
      // Check if username is banned
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
    console.error('Error checking timeout/ban status:', err);
  }
  
  const commentInput = document.getElementById(`commentInput-${reviewId}`);
  const text = commentInput.value.trim();
  const userRating = parseInt(document.getElementById(`userRating-${reviewId}`).value) || 0;
  const gifId = window.pendingCommentGifId?.[reviewId] || null;
  
  if (!text && !gifId) {
    alert('Comment cannot be empty');
    return;
  }
  
  // Mark as posting
  postingComments.add(reviewId);
  
  try {
    const commentsRef = collection(db, 'reviews', reviewId, 'comments');
    const commentData = {
      userId: auth.currentUser.uid,
      text: text || '',
      timestamp: Date.now(),
      likes: 0,
      dislikes: 0,
      likedBy: [],
      dislikedBy: [],
      parentCommentId: null
    };
    
    // Add star rating if provided (optional)
    if (userRating >= 1 && userRating <= 5) {
      commentData.starRating = userRating;
    }
    
    // Add GIF if present
    if (gifId) {
      commentData.gifId = gifId;
      window.pendingCommentGifId = window.pendingCommentGifId || {};
      window.pendingCommentGifId[reviewId] = null; // Clear pending GIF
    }
    
    await addDoc(commentsRef, commentData);
    
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
  if (!currentUserIsAdmin && !currentUserIsMod) {
    alert('Moderator only');
    return;
  }
  
  if (confirm('Delete this comment?')) {
    await deleteDoc(doc(db, 'reviews', reviewId, 'comments', commentId));
  }
};

// Use GIF in comment (called from gif-picker.js)
window.useGifInComment = async function(gifId, reviewId) {
  if (!auth.currentUser) return;
  
  // Store pending GIF ID for this review
  window.pendingCommentGifId = window.pendingCommentGifId || {};
  window.pendingCommentGifId[reviewId] = gifId;
  
  // Clear comment input
  const commentInput = document.getElementById(`commentInput-${reviewId}`);
  if (commentInput) {
    commentInput.value = '';
  }
  
  // Post the comment with GIF
  await window.postReviewComment(reviewId);
};

// Admin give points (for comments - uses same function from chat.js, but defined here for consistency)
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
    const currentPoints = userData.points || 0;
    
    const pointsStr = prompt(`Give points to ${username} (current points: ${currentPoints}):`);
    if (pointsStr === null) return; // User cancelled
    
    const points = parseInt(pointsStr);
    if (isNaN(points)) {
      alert('Invalid points amount');
      return;
    }
    
    // Update points (can be negative to subtract points)
    await updateDoc(doc(db, 'users', userId), {
      points: points
    });
    
    alert(`Set ${username}'s points to ${points}!`);
  } catch (err) {
    console.error('Error giving points:', err);
    alert('Error giving points: ' + err.message);
  }
};

// Show admin menu for review comment user (click handler)
window.showReviewCommentAdminMenu = function(menuId, userId, username, event) {
  if (!currentUserIsAdmin && !currentUserIsMod) {
    return;
  }
  
  if (event) {
    event.stopPropagation();
  }
  
  // Hide all other menus
  document.querySelectorAll('.review-comment-admin-menu').forEach(menu => {
    if (menu.id !== `reviewCommentMenu_${menuId}`) {
      menu.style.display = 'none';
    }
  });
  
  const menu = document.getElementById(`reviewCommentMenu_${menuId}`);
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

// Timeout user from review comments with specific minutes (admin/mod only)
window.timeoutReviewUserFromMinutes = async function(userId, username, reviewId, minutes) {
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
    await updateDoc(doc(db, 'users', userId), { chatTimeoutUntil: timeoutUntil });

    // Delete all comments from this user across all reviews
    const reviewsRef = collection(db, 'reviews');
    const allReviews = await getDocs(reviewsRef);
    const commentDeletePromises = [];
    for (const rDoc of allReviews.docs) {
      const commentsRef = collection(db, 'reviews', rDoc.id, 'comments');
      const userCommentsQuery = query(commentsRef, where('userId', '==', userId));
      const userComments = await getDocs(userCommentsQuery);
      userComments.forEach((cDoc) => {
        commentDeletePromises.push(deleteDoc(doc(db, 'reviews', rDoc.id, 'comments', cDoc.id)));
      });
    }
    await Promise.all(commentDeletePromises);
    alert(`${username} has been timed out for ${minutes} minute${minutes !== 1 ? 's' : ''}. All their comments have been deleted.`);
    
    // Hide menu
    document.querySelectorAll('.review-comment-admin-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  } catch (err) {
    console.error('Error timing out user:', err);
    alert('Error timing out user: ' + err.message);
  }
};

// Timeout user from review comments (admin/mod only) - with prompt
window.timeoutReviewUser = async function(userId, username, reviewId) {
  if (!currentUserIsAdmin && !currentUserIsMod) {
    alert('Moderator only');
    return;
  }
  
  const minutes = prompt(`Timeout ${username} for how many minutes? (5, 30, 60, 1440)`);
  if (!minutes || isNaN(minutes) || ![5, 30, 60, 1440].includes(parseInt(minutes))) {
    alert('Invalid timeout duration. Please enter 5, 30, 60, or 1440.');
    return;
  }
  
  await timeoutReviewUserFromMinutes(userId, username, reviewId, parseInt(minutes));
};

// Ban user from review comments (admin/mod only)
window.banReviewUser = async function(userId, username, reviewId) {
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

    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    await setDoc(doc(db, 'bannedUsernames', bannedUsername), { 
      username: bannedUsername, 
      bannedAt: Date.now(), 
      bannedBy: auth.currentUser.uid 
    });

    // Delete all comments from this user across all reviews
    const { getDocs, collection, query, where } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const reviewsRef = collection(db, 'reviews');
    const allReviews = await getDocs(reviewsRef);
    const commentDeletePromises = [];
    for (const rDoc of allReviews.docs) {
      const commentsRef = collection(db, 'reviews', rDoc.id, 'comments');
      const userCommentsQuery = query(commentsRef, where('userId', '==', userId));
      const userComments = await getDocs(userCommentsQuery);
      userComments.forEach((cDoc) => {
        commentDeletePromises.push(deleteDoc(doc(db, 'reviews', rDoc.id, 'comments', cDoc.id)));
      });
    }
    await Promise.all(commentDeletePromises);

    await deleteDoc(doc(db, 'users', userId));
    alert(`${username} has been banned. Their account and all comments have been deleted.`);
    
    // Hide menu
    document.querySelectorAll('.review-comment-admin-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  } catch (err) {
    console.error('Error banning user:', err);
    alert('Error banning user: ' + err.message);
  }
};

// Close admin menus when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.review-comment-username-clickable') && !e.target.closest('.review-comment-admin-menu')) {
    document.querySelectorAll('.review-comment-admin-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  }
});

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