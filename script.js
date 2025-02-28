// Firebase Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Replace with your actual Firebase config:
const firebaseConfig = {
  apiKey: "AIzaSyAVLTCw2-...",
  authDomain: "roommate-a8e89.firebaseapp.com",
  projectId: "roommate-a8e89",
  storageBucket: "roommate-a8e89.firebasestorage.app",
  messagingSenderId: "583407477445",
  appId: "1:583407477445:web:8ec652955ce67ed49806ac"
};
const app = initializeApp(firebaseConfig);
window.db = getFirestore(app);

/****************************************************
  Debug Log Function (for development)
*****************************************************/
function debugLog(message, data) {
  console.log(`[DEBUG] ${message}`, data || '');
}

/****************************************************
  Loading Overlay State Management
*****************************************************/
let loadingCounter = 0;
const loadingOverlay = document.getElementById("loadingOverlay");

function showLoading() {
  loadingCounter++;
  loadingOverlay.style.display = "flex";
}

function hideLoading() {
  loadingCounter--;
  if (loadingCounter <= 0) {
    loadingCounter = 0;
    loadingOverlay.style.display = "none";
  }
}

/****************************************************
  1. Form Steps & Progress + Validation
*****************************************************/
const form = document.getElementById("roommateForm");
const formSteps = Array.from(document.querySelectorAll(".form-step"));
const nextBtns = Array.from(document.querySelectorAll(".next-btn"));
const prevBtns = Array.from(document.querySelectorAll(".prev-btn"));
const formProgress = document.getElementById("formProgress");
const stepIndicator = document.getElementById("stepIndicator");

let currentStep = 0;

function validateCurrentStep(stepIndex) {
  const stepEl = formSteps[stepIndex];
  const requiredFields = stepEl.querySelectorAll("[required]");
  let valid = true;
  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      valid = false;
      field.classList.add("invalid");
    } else {
      field.classList.remove("invalid");
    }
  });
  if (!valid) {
    alert("Please fill out all required fields in this step before proceeding.");
  }
  return valid;
}

function updateFormStep(step) {
  formSteps.forEach((el, idx) => {
    el.classList.toggle("active", idx === step);
  });
  const totalSteps = formSteps.length;
  formProgress.style.width = ((step / (totalSteps - 1)) * 100) + "%";
  stepIndicator.textContent = `Step ${step + 1} of ${totalSteps}`;
}

nextBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    if (!validateCurrentStep(currentStep)) return;
    if (currentStep < formSteps.length - 1) {
      currentStep++;
      updateFormStep(currentStep);
    }
  });
});

prevBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    if (currentStep > 0) {
      currentStep--;
      updateFormStep(currentStep);
    }
  });
});

updateFormStep(currentStep);

/****************************************************
  2. Dark Mode Toggle
*****************************************************/
const darkModeToggle = document.getElementById("darkModeToggle");
darkModeToggle.addEventListener("change", () => {
  document.body.classList.toggle("dark-mode");
});

/****************************************************
  3. Fetching Users from Firestore
*****************************************************/
let firebaseUsers = [];
const totalUsersElem = document.getElementById("totalUsers");

async function fetchFirebaseUsers() {
  showLoading();
  try {
    firebaseUsers = [];
    const snapshot = await getDocs(collection(window.db, "users"));
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      data.docId = docSnap.id;
      firebaseUsers.push(data);
    });
    updateTotalUsers();
  } catch (err) {
    console.error("Error fetching Firebase users:", err);
  } finally {
    hideLoading();
  }
}
fetchFirebaseUsers();

/****************************************************
  Update Total Registered Users UI
*****************************************************/
function updateTotalUsers() {
  const count = firebaseUsers.length;
  totalUsersElem.textContent = `${count} Registered Users`;
}

/****************************************************
  4. Matching Helpers (Less Restrictive)
*****************************************************/
const MAX_POSSIBLE_SCORE = 126;
const K = 5; // show top 5 matches

function parseBudget(budgetStr) {
  if (!budgetStr) return null;
  const nums = budgetStr.match(/\d+/g);
  if (!nums || nums.length < 2) return null;
  return { min: parseInt(nums[0], 10), max: parseInt(nums[1], 10) };
}

function budgetsOverlap(b1, b2) {
  if (!b1 || !b2) return true;
  return !(b1.max < b2.min || b2.max < b1.min);
}

function isGenderCompatible(user, candidate) {
  function sideAllows(gPref, selfGender, otherGender) {
    if (!gPref || gPref === "NoPreference") return true;
    if (gPref === "Same") return selfGender === otherGender;
    if (gPref === "Opposite") return selfGender !== otherGender;
    return true;
  }
  const userOk = sideAllows(user.genderPref, user.gender, candidate.gender);
  const candOk = sideAllows(candidate.genderPref, candidate.gender, user.gender);
  return userOk && candOk;
}

function isLocationCompatible(uLoc, cLoc) {
  if (!uLoc || !cLoc) return true;
  if (uLoc === "ANY" || cLoc === "ANY") return true;
  return uLoc === cLoc;
}

function isLeaseCompatible(uLease, cLease) {
  if (!uLease || !cLease) return true;
  return uLease === cLease;
}

/****************************************************
  5. transformUser + calculateRawScore (with Logs)
*****************************************************/
function transformUser(u) {
  return {
    name: u["Name"] || u["fullName"] || "",
    email: u["Email"] || u["email"] || "",
    age: u["Age"] || u["age"] || "",
    gender: u["Gender"] || u["gender"] || "",
    genderPref: u["Roommate Gender Preference"] || u["genderPref"] || "NoPreference",
    homeCity: u["Home city and State"] || u["homeCity"] || "",
    course: u["UCD Course & Year of Study"] || u["course"] || "",
    contact: u["Contact Information"] || u["contact"] || "",
    arrivalDate: u["Expected Arrival Date in Ireland"] || u["arrivalDate"] || "",
    locationPref: u["Preferred Location"] || u["locationPref"] || "ANY",
    budget: u["Budget Range(per month) (€)"] || u["budget"] || "",
    roomType: u["Preferred Room Type"] || u["roomType"] || "",
    leaseDuration: u["Lease Duration"] || u["leaseDuration"] || "",
    weekendPlans: u["Weekend plans"] || u["weekendPlans"] || "",
    partTime: u["Part time work"] || u["partTimeWork"] || "",
    transport: u["Preferred Mode of Transport"] || u["transportPref"] || "",
    guestsPolicy: u["Guests Policy"] || u["guestsPolicy"] || "",
    cleanliness: u["Cleanliness Level"] || u["cleanliness"] || "",
    sleepSchedule: u["Sleep Schedule"] || u["sleepSchedule"] || "",
    smoking: u["Smoking Preference"] || u["smoking"] || "",
    drinking: u["Drinking Preference"] || u["drinking"] || "",
    diet: u["Dietary Preference"] || u["diet"] || "",
    cooking: u["Cooking Frequency"] || u["cooking"] || "",
    pets: u["Pets Comfort"] || u["pets"] || "",
    languages: u["Languages Spoken"] || (Array.isArray(u["languages"]) ? u["languages"].join(", ") : u["languages"] || ""),
    hobbies: u["Hobbies & Interests"] || (Array.isArray(u["hobbies"]) ? u["hobbies"].join(", ") : u["hobbies"] || ""),
    docId: u["docId"] || ""
  };
}

function calculateRawScore(userObj, candidateObj) {
  try {
    const user = transformUser(userObj);
    const cand = transformUser(candidateObj);
    debugLog(`Calculating score: ${user.name} vs. ${cand.name}`);
  
    if (!isGenderCompatible(user, cand)) {
      debugLog("Failed gender check");
      return 0;
    }
    if (!isLocationCompatible(user.locationPref, cand.locationPref)) {
      debugLog("Failed location check");
      return 0;
    }
    if (!isLeaseCompatible(user.leaseDuration, cand.leaseDuration)) {
      debugLog("Failed lease check");
      return 0;
    }
    const userB = parseBudget(user.budget);
    const candB = parseBudget(cand.budget);
    if (!budgetsOverlap(userB, candB)) {
      debugLog("Failed budget check (no overlap)");
      return 0;
    }
  
    let score = 0;
    if (user.cleanliness === cand.cleanliness) score += 10;
    if (user.sleepSchedule === cand.sleepSchedule) score += 8;
    if (user.smoking === cand.smoking) score += 5;
    if (user.drinking === cand.drinking) score += 5;
    if (user.diet === cand.diet) score += 7;
    if (user.cooking === cand.cooking) score += 5;
    if (user.pets === cand.pets) score += 5;
    if (user.weekendPlans.toLowerCase() === cand.weekendPlans.toLowerCase()) score += 5;
    if (user.partTime.toLowerCase() === cand.partTime.toLowerCase()) score += 3;
    if (user.transport.toLowerCase() === cand.transport.toLowerCase()) score += 3;
    if (user.guestsPolicy.toLowerCase() === cand.guestsPolicy.toLowerCase()) score += 2;
  
    const userLangs = user.languages.toLowerCase().split(",").map(x => x.trim());
    const candLangs = cand.languages.toLowerCase().split(",").map(x => x.trim());
    const userRegional = userLangs.filter(l => l !== "english" && l);
    const candRegional = candLangs.filter(l => l !== "english" && l);
    let regionalOverlap = 0;
    userRegional.forEach(lang => {
      if (candRegional.includes(lang)) {
        regionalOverlap++;
      }
    });
    if (regionalOverlap > 2) regionalOverlap = 2;
    score += regionalOverlap * 20;
    if (regionalOverlap === 0 && userLangs.includes("english") && candLangs.includes("english")) {
      score += 3;
    }
  
    if (user.course.trim().toLowerCase() === cand.course.trim().toLowerCase()) {
      score += 20;
    }
  
    const userHobbies = user.hobbies.toLowerCase().split(",").map(x => x.trim());
    const candHobbies = cand.hobbies.toLowerCase().split(",").map(x => x.trim());
    let hobbyOverlap = 0;
    userHobbies.forEach(h => {
      if (candHobbies.includes(h)) {
        hobbyOverlap++;
      }
    });
    if (hobbyOverlap > 4) hobbyOverlap = 4;
    score += hobbyOverlap * 2;
  
    debugLog(`Score for ${user.name} vs. ${cand.name}: ${score}`);
    return score;
  } catch (err) {
    console.error("Error in score calculation:", err);
    return 0;
  }
}

/****************************************************
  6. findKNearestMatches & display
*****************************************************/
function findKNearestMatches(userObj, candidates, k) {
  const scored = candidates.map(candidate => ({
    candidate,
    score: calculateRawScore(userObj, candidate)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

const modalOverlay = document.getElementById("userModal");
const modalCloseBtn = document.getElementById("closeModal");
const modalBody = document.getElementById("userModalBody");

function openUserModal(userObj) {
  const rows = [];
  for (const key in userObj) {
    if (!userObj[key] || key === "docId") continue;
    rows.push(`
      <div class="row">
        <div class="label">${key}:</div>
        <div class="value">${userObj[key]}</div>
      </div>
    `);
  }
  modalBody.innerHTML = rows.join("") || "<p>No additional details found.</p>";
  modalOverlay.style.display = "flex";
}

modalCloseBtn.addEventListener("click", () => {
  modalOverlay.style.display = "none";
});

const resultsSection = document.getElementById("results-section");
const resultsDiv = document.getElementById("results");
const feedbackSection = document.querySelector(".feedback-section");

function displayTopMatches(scoredMatches) {
  resultsDiv.innerHTML = "";
  resultsSection.style.display = "block";
  if (scoredMatches.length === 0) {
    resultsDiv.innerHTML = "<p>No matches found based on your criteria.</p>";
    return;
  }
  const matchesWithPercentage = scoredMatches.map(m => {
    const pct = ((m.score / MAX_POSSIBLE_SCORE) * 100).toFixed(0);
    return { candidate: m.candidate, percentage: parseInt(pct, 10) };
  });
  matchesWithPercentage.forEach(match => {
    const c = match.candidate;
    const name = c["Name"] || "Unknown";
    const course = c["UCD Course & Year of Study"] || "N/A";
    const budget = c["Budget Range(per month) (€)"] || "N/A";
    const contact = c["Contact Information"] || "N/A";
    const hobbies = c["Hobbies & Interests"] || "N/A";
    const matchDiv = document.createElement("div");
    matchDiv.classList.add("match");
    matchDiv.innerHTML = `
      <h3>${name} (Match: ${match.percentage}%)</h3>
      <div class="match-progress">
        <div class="match-progress-bar" style="width: ${match.percentage}%;"></div>
      </div>
      <p><strong>Course:</strong> ${course}</p>
      <p><strong>Budget:</strong> ${budget}</p>
      <p><strong>Hobbies:</strong> ${hobbies}</p>
      <p><strong>Contact:</strong> ${contact}</p>
    `;
    matchDiv.addEventListener("click", () => {
      openUserModal(c);
    });
    resultsDiv.appendChild(matchDiv);
  });
  resultsSection.scrollIntoView({ behavior: "smooth" });
  // Show feedback section now that matches are visible.
  feedbackSection.classList.remove("hidden");
}

/****************************************************
  7. Improved "Find Matches" for Returning Users
*****************************************************/
const checkUserBtn = document.getElementById("checkUserBtn");
const existingNameInput = document.getElementById("existingName");
const existingUserResults = document.getElementById("existingUserResults");
const autocompleteResults = document.getElementById("autocompleteResults");

checkUserBtn.addEventListener("click", async () => {
  const searchName = existingNameInput.value.trim().toLowerCase();
  if (!searchName) {
    existingUserResults.innerHTML = "<p style='color:red'>Please enter a name.</p>";
    return;
  }
  
  showLoading();
  try {
    await fetchFirebaseUsers();
    const foundUser = firebaseUsers.find(u => {
      const userName = (u["Name"] || "").toLowerCase().trim();
      return userName.includes(searchName) || searchName.includes(userName);
    });
    if (!foundUser) {
      existingUserResults.innerHTML = `<p style="color:red">User not found. Please register below!</p>`;
      return;
    }
    
    existingUserResults.innerHTML = `<p style="color:green">User found! Calculating matches...</p>`;
    const allCandidates = firebaseUsers.filter(u => u.docId !== foundUser.docId);
    const nearest = findKNearestMatches(foundUser, allCandidates, K);
    displayTopMatches(nearest);
    
    if (nearest.length === 0) {
      existingUserResults.innerHTML = `<p style="color:red">No matches found based on your criteria.</p>`;
    } else {
      existingUserResults.innerHTML = `<p style="color:green">Found ${nearest.length} match(es). See below!</p>`;
      resultsSection.scrollIntoView({ behavior: "smooth" });
    }
  } catch (err) {
    console.error("Error finding matches:", err);
    existingUserResults.innerHTML = `<p style="color:red">An error occurred while finding matches. Please try again.</p>`;
  } finally {
    hideLoading();
  }
});

/****************************************************
  Autocomplete for Returning User Search
*****************************************************/
existingNameInput.addEventListener("input", () => {
  const query = existingNameInput.value.trim().toLowerCase();
  autocompleteResults.innerHTML = "";
  if (query.length === 0) return;
  
  const suggestions = firebaseUsers.filter(u => {
    const userName = (u["Name"] || "").toLowerCase();
    return userName.includes(query);
  });
  
  suggestions.forEach(u => {
    const suggestionItem = document.createElement("div");
    suggestionItem.classList.add("autocomplete-suggestion");
    suggestionItem.textContent = u["Name"];
    suggestionItem.addEventListener("click", () => {
      existingNameInput.value = u["Name"];
      autocompleteResults.innerHTML = "";
    });
    autocompleteResults.appendChild(suggestionItem);
  });
});

document.addEventListener("click", (e) => {
  if (!existingNameInput.contains(e.target) && !autocompleteResults.contains(e.target)) {
    autocompleteResults.innerHTML = "";
  }
});

/****************************************************
  8. New User Registration & Duplicate Check
*****************************************************/
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateCurrentStep(currentStep)) return;
  
  const selectedLangs = Array.from(document.querySelectorAll('input[name="languages"]:checked'))
    .map(cb => cb.value);
  if (selectedLangs.length === 0) {
    alert("Please select at least one Language.");
    return;
  }
  const selectedHobbies = Array.from(document.querySelectorAll('input[name="hobbies"]:checked'))
    .map(cb => cb.value);
  if (selectedHobbies.length === 0) {
    alert("Please select at least one Hobby.");
    return;
  }
  
  showLoading();
  try {
    await fetchFirebaseUsers();
    const newUserDoc = {
      "Email": document.getElementById("email").value,
      "Name": document.getElementById("fullName").value,
      "Age": document.getElementById("age").value,
      "Gender": document.getElementById("gender").value,
      "Roommate Gender Preference": document.getElementById("genderPref").value,
      "Home city and State": document.getElementById("homeCity").value,
      "UCD Course & Year of Study": document.getElementById("course").value,
      "Contact Information": document.getElementById("contact").value,
      "Expected Arrival Date in Ireland": document.getElementById("arrivalDate").value,
      "Preferred Location": document.getElementById("locationPref").value,
      "Budget Range(per month) (€)": document.getElementById("budget").value,
      "Preferred Room Type": document.getElementById("roomType").value,
      "Lease Duration": document.getElementById("leaseDuration").value,
      "Cleanliness Level": document.getElementById("cleanliness").value,
      "Sleep Schedule": document.getElementById("sleepSchedule").value,
      "Smoking Preference": document.getElementById("smoking").value,
      "Drinking Preference": document.getElementById("drinking").value,
      "Dietary Preference": document.getElementById("diet").value,
      "Cooking Frequency": document.getElementById("cooking").value,
      "Pets Comfort": document.getElementById("pets").value,
      "Preferred Mode of Transport": document.getElementById("transportPref").value,
      "Part time work": document.getElementById("partTimeWork").value,
      "Weekend plans": document.getElementById("weekendPlans").value,
      "Guests Policy": document.getElementById("guestsPolicy").value,
      "Languages Spoken": selectedLangs.join(", "),
      "Hobbies & Interests": selectedHobbies.join(", "),
      "Any Special Requirements": document.getElementById("specialRequirements").value,
      "Social Media Handle": document.getElementById("socialMedia").value,
      "UCD Student ID Number": document.getElementById("studentID").value,
      "Anything Else You'd Like to Share?": document.getElementById("additionalComments").value
    };
    
    const newNameLower = (newUserDoc["Name"] || "").toLowerCase().trim();
    const newEmailLower = (newUserDoc["Email"] || "").toLowerCase().trim();
    const duplicate = firebaseUsers.find(u => {
      const uName = (u["Name"] || "").toLowerCase().trim();
      const uEmail = (u["Email"] || "").toLowerCase().trim();
      return (uName === newNameLower && uEmail === newEmailLower);
    });
    
    if (duplicate) {
      hideLoading();
      alert("Duplicate submission detected. A user with the same name and email already exists.");
      return;
    }
    
    const docRef = await addDoc(collection(window.db, "users"), newUserDoc);
    debugLog("Document written with ID: ", docRef.id);
    newUserDoc.docId = docRef.id;
    
    await fetch("https://formsubmit.co/ajax/devasahithiyan@gmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUserDoc),
    });
    
    await fetchFirebaseUsers();
    const allCandidates = firebaseUsers.filter(u => u.docId !== newUserDoc.docId);
    const nearest = findKNearestMatches(newUserDoc, allCandidates, K);
    displayTopMatches(nearest);
    
    alert("Registration successful! Scroll down to see your matches.");
    
  } catch (err) {
    console.error("Error adding user or sending email:", err);
    alert("There was an error processing your submission. Please try again.");
  } finally {
    hideLoading();
  }
});

/****************************************************
  11. Feedback: "Was this helpful?" and Count
*****************************************************/
const helpfulBtn = document.getElementById("helpfulBtn");
const helpedCountText = document.getElementById("helpedCountText");

function updateHelpedCount() {
  let count = localStorage.getItem("helpfulCount");
  if (!count) {
    count = 0;
    localStorage.setItem("helpfulCount", count);
  }
  helpedCountText.textContent = `Helped ${count} users so far`;
}

helpfulBtn.addEventListener("click", () => {
  let count = parseInt(localStorage.getItem("helpfulCount")) || 0;
  count++;
  localStorage.setItem("helpfulCount", count);
  updateHelpedCount();
  alert("Thank you for your feedback!");
});

// Initialize the helped count on page load
updateHelpedCount();
