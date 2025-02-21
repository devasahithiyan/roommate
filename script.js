import { collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/**************************************************************
  1. Multi-step Form Logic
**************************************************************/
const form = document.getElementById("roommateForm");
const formSteps = Array.from(document.querySelectorAll(".form-step"));
const nextBtns = Array.from(document.querySelectorAll(".next-btn"));
const prevBtns = Array.from(document.querySelectorAll(".prev-btn"));
const formProgress = document.getElementById("formProgress");
const stepIndicator = document.getElementById("stepIndicator");

let currentStep = 0;
function updateFormStep(step) {
  formSteps.forEach((el, index) => {
    el.classList.toggle("active", index === step);
  });
  const totalSteps = formSteps.length;
  formProgress.style.width = ((step / (totalSteps - 1)) * 100) + "%";
  stepIndicator.textContent = `Step ${step + 1} of ${totalSteps}`;
}
nextBtns.forEach(btn => {
  btn.addEventListener("click", () => {
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

/**************************************************************
  2. Dark Mode Toggle
**************************************************************/
const darkModeToggle = document.getElementById("darkModeToggle");
darkModeToggle.addEventListener("change", () => {
  document.body.classList.toggle("dark-mode");
});

/**************************************************************
  3. Loading Overlay Helpers
**************************************************************/
const loadingOverlay = document.getElementById("loadingOverlay");
function showLoading() { loadingOverlay.style.display = "flex"; }
function hideLoading() { loadingOverlay.style.display = "none"; }

/**************************************************************
  4. Data Loading (Firebase & data.json)
**************************************************************/
let staticUsers = [];
let firebaseUsers = [];

fetch("data.json")
  .then(res => res.json())
  .then(data => { staticUsers = data; })
  .catch(err => console.error("Error loading data.json:", err));

async function fetchFirebaseUsers() {
  showLoading();
  try {
    const snapshot = await getDocs(collection(window.db, "users"));
    firebaseUsers = [];
    snapshot.forEach(doc => {
      firebaseUsers.push(doc.data());
    });
  } catch (err) {
    console.error("Error fetching Firebase users:", err);
  } finally {
    hideLoading();
  }
}
fetchFirebaseUsers();

/**************************************************************
  5. Matching Algorithm with KNN & Enhanced Priorities
**************************************************************/
/*
  Define maximum possible raw score as:
    - Base weighted categories: 58 points
    - Regional language bonus: up to 2 overlaps @ +20 each = 40 points
    - Hobby bonus: up to 4 overlaps @ +2 each = 8 points
    - Course bonus: if courses match, add +20 points (high priority)
  
  Total MAX_POSSIBLE_SCORE = 58 + 40 + 8 + 20 = 126
*/
const MAX_POSSIBLE_SCORE = 126;
const K = 5; // Top 5 matches

function parseBudget(budgetStr) {
  if (!budgetStr) return null;
  const nums = budgetStr.match(/\d+/g);
  return nums && nums.length >= 2 ? { min: parseInt(nums[0], 10), max: parseInt(nums[1], 10) } : null;
}

function budgetsOverlap(b1, b2) {
  if (!b1 || !b2) return true;
  return !(b1.max < b2.min || b2.max < b1.min);
}

function transformUser(u) {
  return {
    fullName: u.Name || u.fullName || "",
    gender: u.Gender || u.gender || "",
    genderPref: u.genderPref || u["genderPref"] || "NoPreference",
    age: u.Age || u.age || "",
    homeCity: u["Home city and State"] || u.homeCity || "",
    course: u["UCD Course & Year of Study"] || u.course || "",
    contact: u["Contact Information"] || u.contact || "",
    arrivalDate: u["Expected Arrival Date in Ireland"] || u.arrivalDate || "",
    locationPref: u["Preferred Location"] || u.locationPref || "Any",
    budget: u["Budget Range(per month) (€)"] || u.budget || "",
    roomType: u["Preferred Room Type"] || u.roomType || "",
    leaseDuration: u["Lease Duration"] || u.leaseDuration || "",
    weekendPlans: u["Weekend plans"] || u.weekendPlans || "",
    partTime: u["Part time work"] || u.partTime || "",
    transport: u["Preferred Mode of Transport"] || u.transport || "",
    guestsPolicy: u["Guests Policy"] || u.guestsPolicy || "",
    cleanliness: u["Cleanliness Level"] || u.cleanliness || "",
    sleepSchedule: u["Sleep Schedue"] || u.sleepSchedule || "",
    smoking: u["Smoking Preference"] || u.smoking || "",
    drinking: u["Drinking Preference"] || u.drinking || "",
    diet: u["Dietary Preference"] || u.diet || "",
    cooking: u["Cooking Frequency"] || u.cooking || "",
    pets: u["Pets Comfort"] || u.pets || "",
    languages: u["Languages Spoken"] || u.languages || "",
    hobbies: u["Hobbies & Interests"] || u.hobbies || "",
    additionalComments: u.additionalComments || ""
  };
}

function calculateRawScore(userObj, candidateObj) {
  const user = transformUser(userObj);
  const cand = transformUser(candidateObj);

  // Hard filters
  if (user.genderPref === "Same" && user.gender !== cand.gender) return 0;
  const userB = parseBudget(user.budget);
  const candB = parseBudget(cand.budget);
  if (!budgetsOverlap(userB, candB)) return 0;
  if (user.leaseDuration && cand.leaseDuration && user.leaseDuration !== cand.leaseDuration) return 0;
  if (user.locationPref !== "Any" && user.locationPref !== cand.locationPref) return 0;

  let score = 0;
  // Base weighted scoring (total = 58)
  if (user.cleanliness === cand.cleanliness) score += 10;
  if (user.sleepSchedule === cand.sleepSchedule) score += 8;
  if (user.smoking === cand.smoking) score += 5;
  if (user.drinking === cand.drinking) score += 5;
  if (user.diet === cand.diet) score += 7;
  if (user.cooking === cand.cooking) score += 5;
  if (user.pets === cand.pets) score += 5;
  if (user.weekendPlans && cand.weekendPlans &&
      user.weekendPlans.toLowerCase() === cand.weekendPlans.toLowerCase()) score += 5;
  if (user.partTime && cand.partTime &&
      user.partTime.toLowerCase() === cand.partTime.toLowerCase()) score += 3;
  if (user.transport && cand.transport &&
      user.transport.toLowerCase() === cand.transport.toLowerCase()) score += 3;
  if (user.guestsPolicy && cand.guestsPolicy &&
      user.guestsPolicy.toLowerCase() === cand.guestsPolicy.toLowerCase()) score += 2;

  // Regional Language Bonus (non-English)
  const userLangs = user.languages.toLowerCase().split(",").map(x => x.trim());
  const candLangs = cand.languages.toLowerCase().split(",").map(x => x.trim());
  const userRegional = userLangs.filter(l => l !== "english" && l);
  const candRegional = candLangs.filter(l => l !== "english" && l);
  let regionalOverlap = 0;
  userRegional.forEach(lang => { if (candRegional.includes(lang)) regionalOverlap++; });
  if (regionalOverlap > 2) regionalOverlap = 2;
  // Each shared regional language gets a high bonus of +20
  score += regionalOverlap * 20;
  // If no regional overlap, but both list english, add a small bonus
  if (regionalOverlap === 0 && userLangs.includes("english") && candLangs.includes("english")) {
    score += 3;
  }

  // Course Bonus: if courses match (ignoring case), add +20 points (very high priority)
  if (user.course.trim().toLowerCase() === cand.course.trim().toLowerCase()) {
    score += 20;
  }

  // Hobbies Bonus (cap at 4 overlaps, +2 each)
  const userHobbies = user.hobbies.toLowerCase().split(",").map(x => x.trim());
  const candHobbies = cand.hobbies.toLowerCase().split(",").map(x => x.trim());
  let hobbyOverlap = 0;
  userHobbies.forEach(h => { if (candHobbies.includes(h)) hobbyOverlap++; });
  if (hobbyOverlap > 4) hobbyOverlap = 4;
  score += hobbyOverlap * 2;

  return score;
}

/**
 * K-Nearest Neighbors: Return top K matches sorted by raw score.
 */
function findKNearestMatches(userObj, candidates, k) {
  const scored = candidates
    .map(candidate => ({ candidate, score: calculateRawScore(userObj, candidate) }))
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/**************************************************************
  6. Display Matches
**************************************************************/
const resultsSection = document.getElementById("results-section");
const resultsDiv = document.getElementById("results");

function displayTopMatches(scoredMatches) {
  resultsDiv.innerHTML = "";
  resultsSection.style.display = "block";

  if (scoredMatches.length === 0) {
    resultsDiv.innerHTML = "<p>No matches found based on your criteria.</p>";
    return;
  }

  // Map raw score to percentage relative to MAX_POSSIBLE_SCORE
  const matchesWithPercentage = scoredMatches.map(m => {
    const pct = ((m.score / MAX_POSSIBLE_SCORE) * 100).toFixed(0);
    return { candidate: m.candidate, percentage: parseInt(pct, 10) };
  }).sort((a, b) => b.percentage - a.percentage);

  matchesWithPercentage.forEach(match => {
    const c = match.candidate;
    const name = c.Name || c.fullName || "Unknown";
    const course = c["UCD Course & Year of Study"] || c.course || "N/A";
    const budget = c["Budget Range(per month) (€)"] || c.budget || "N/A";
    const contact = c["Contact Information"] || c.contact || "N/A";
    const hobbies = c["Hobbies & Interests"] || c.hobbies || "N/A";

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
    resultsDiv.appendChild(matchDiv);
  });

  // Auto-scroll to the results section
  resultsSection.scrollIntoView({ behavior: "smooth" });
}

/**************************************************************
  7. Check Existing User Feature
**************************************************************/
const checkUserBtn = document.getElementById("checkUserBtn");
const existingNameInput = document.getElementById("existingName");
const existingUserResults = document.getElementById("existingUserResults");

checkUserBtn.addEventListener("click", async () => {
  const searchName = existingNameInput.value.trim().toLowerCase();
  if (!searchName) {
    existingUserResults.innerHTML = "<p style='color:red'>Please enter a name.</p>";
    return;
  }

  showLoading();
  await fetchFirebaseUsers();
  hideLoading();

  const foundStatic = staticUsers.find(u => (u.Name || u.fullName || "").toLowerCase().includes(searchName));
  const foundFirebase = firebaseUsers.find(u => (u.Name || u.fullName || "").toLowerCase().includes(searchName));
  const foundUser = foundStatic || foundFirebase;

  if (!foundUser) {
    existingUserResults.innerHTML = `<p style="color:red">User not found. Please register below!</p>`;
  } else {
    existingUserResults.innerHTML = `<p style="color:green">User found! Calculating matches...</p>`;
    const allCandidates = [...staticUsers, ...firebaseUsers].filter(u =>
      (u.Name || u.fullName) !== (foundUser.Name || foundUser.fullName)
    );
    const nearest = findKNearestMatches(foundUser, allCandidates, K);
    displayTopMatches(nearest);
  }
});

/**************************************************************
  8. New User Registration & Matching
**************************************************************/
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const newUser = {
    fullName: document.getElementById("fullName").value,
    gender: document.getElementById("gender").value,
    genderPref: document.getElementById("genderPref").value,
    age: document.getElementById("age").value,
    homeCity: document.getElementById("homeCity").value,
    course: document.getElementById("course").value,
    contact: document.getElementById("contact").value,
    arrivalDate: document.getElementById("arrivalDate").value,
    locationPref: document.getElementById("locationPref").value,
    budget: document.getElementById("budget").value,
    roomType: document.getElementById("roomType").value,
    leaseDuration: document.getElementById("leaseDuration").value,
    weekendPlans: document.getElementById("weekendPlans").value,
    partTime: document.getElementById("partTime").value,
    transport: document.getElementById("transport").value,
    guestsPolicy: document.getElementById("guestsPolicy").value,
    cleanliness: document.getElementById("cleanliness").value,
    sleepSchedule: document.getElementById("sleepSchedule").value,
    smoking: document.getElementById("smoking").value,
    drinking: document.getElementById("drinking").value,
    diet: document.getElementById("diet").value,
    cooking: document.getElementById("cooking").value,
    pets: document.getElementById("pets").value,
    languages: document.getElementById("languages").value,
    hobbies: document.getElementById("hobbies").value,
    additionalComments: document.getElementById("additionalComments").value
  };

  showLoading();
  try {
    await addDoc(collection(window.db, "users"), newUser);
    await fetchFirebaseUsers();
  } catch (err) {
    console.error("Error adding user:", err);
  } finally {
    hideLoading();
  }

  const allCandidates = [...staticUsers, ...firebaseUsers].filter(u =>
    (u.Name || u.fullName) !== newUser.fullName
  );
  const nearest = findKNearestMatches(newUser, allCandidates, K);
  displayTopMatches(nearest);
});
