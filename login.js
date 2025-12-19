import { auth, db } from "./firebase.js";
import { containsSlur } from "./content-filter.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirmPassword");
const usernameInput = document.getElementById("username");
const loginBtn = document.getElementById("loginBtn");
const resetBtn = document.getElementById("resetBtn");

loginBtn.onclick = async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirm = confirmInput.value;
  const username = usernameInput.value.trim().toLowerCase();

  if (!email || !password) {
    alert("Email and password required");
    return;
  }

  // Check if user is trying to register (has username and confirm password filled)
  const isRegistering = username && confirm;

  if (isRegistering) {
    // 🆕 REGISTRATION FLOW
    if (password !== confirm) {
      alert("Passwords do not match");
      return;
    }

    // Validate username length
    if (username.length > 15) {
      alert("Username must be 15 characters or less");
      return;
    }

    if (username.length === 0) {
      alert("Username cannot be empty");
      return;
    }

    // Check for slurs in username
    if (containsSlur(username)) {
      alert("Username contains inappropriate language. Please choose a different username.");
      return;
    }

    // Check if email already exists
    try {
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      if (signInMethods.length > 0) {
        alert("Email already taken - try logging in or use a different email");
        return;
      }
    } catch (err) {
      console.error("Error checking email:", err);
    }

    // Check if username is banned
    try {
      const bannedUsernameDoc = await getDoc(doc(db, "bannedUsernames", username));
      if (bannedUsernameDoc.exists()) {
        alert("This username has been banned and cannot be used");
        return;
      }
    } catch (err) {
      console.error("Error checking banned username:", err);
    }

    // 🔍 CHECK USERNAME TAKEN
    const usernameQuery = query(
      collection(db, "users"),
      where("username", "==", username)
    );
    
    let existingUsername;
    try {
      existingUsername = await getDocs(usernameQuery);
    } catch (err) {
      alert("Error checking username. Check Firestore rules.");
      console.error(err);
      return;
    }

    if (!existingUsername.empty) {
      alert("Username already taken – try another");
      return;
    }

    // 🧾 CREATE ACCOUNT
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", userCred.user.uid), {
        username: username,
        points: 0,
        created: Date.now(),
        lastActive: Date.now()
      });

      window.location.href = "index.html";
    } catch (registerError) {
      if (registerError.code === 'auth/email-already-in-use') {
        alert("Email already taken – try logging in or use a different email");
      } else {
        alert("Registration error: " + registerError.message);
      }
      console.error(registerError);
    }
  } else {
    // 🔐 LOGIN FLOW (username and confirm are empty)
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "index.html";
    } catch (loginError) {
      if (loginError.code === 'auth/wrong-password' || loginError.code === 'auth/invalid-credential') {
        alert("Wrong password");
      } else if (loginError.code === 'auth/user-not-found') {
        alert("No account found - create one by filling in username and confirm password");
      } else {
        alert("Login error: " + loginError.message);
      }
      console.error(loginError);
    }
  }
};

// 🔐 PASSWORD RESET
resetBtn.onclick = async () => {
  const email = emailInput.value;
  if (!email) {
    alert("Enter your email first");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    alert("Password reset email sent");
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      alert("No account found with that email");
    } else {
      alert("Error: " + err.message);
    }
  }
};