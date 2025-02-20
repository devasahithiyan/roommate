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
  formSteps.forEach((stepEl, index) => {
    stepEl.classList.toggle("active", index === step);
  });
  const totalSteps = formSteps.length;
  const progressPercent = (step / (totalSteps - 1)) * 100;
  formProgress.style.width = progressPercent + "%";
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
function showLoading() {
  loadingOverlay.style.display = "flex";
}
function hideLoading() {
  loadingOverlay.style.display = "none";
}

/**************************************************************
  4. Loading & Storing Users from Firebase & Static Data
**************************************************************/
let staticUsers = [];
let firebaseUsers = [];

// Load static data from data.json
fetch("data.json")
  .then(res => res.json())
  .then(data => { staticUsers = data; })
  .catch(err => console.error("Error loading JSON data:", err));

// Fetch Firebase users
async function fetchFirebaseUsers() {
  showLoading();
  try {
    const querySnapshot = await getDocs(collection(window.db, "users"));
    firebaseUsers = [];
    querySnapshot.forEach(doc => { firebaseUsers.push(doc.data()); });
  } catch (err) {
    console.error("Error fetching Firebase users:", err);
  } finally {
    hideLoading();
  }
}
fetchFirebaseUsers();

/**************************************************************
  5. Utility & Matching Functions
**************************************************************/
/**
 * Parse "700-1000" etc. -> {min:700, max:1000}
 */
function parseBudget(budgetStr) {
  if (!budgetStr) return null;
  const nums = budgetStr.match(/\d+/g);
  if (!nums || nums.length < 2) return null;
  return { min: parseInt(nums[0], 10), max: parseInt(nums[1], 10) };
}

/**
 * Check if two budgets overlap
 */
function budgetsOverlap(b1, b2) {
  if (!b1 || !b2) return true;
  return !(b1.max < b2.min || b2.max < b1.min);
}

/**
 * Transform a user/candidate object into a standard shape
 */
function transformUser(obj) {
  return {
    fullName: obj.Name || obj.fullName || "",
    gender: obj.Gender || obj.gender || "",
    genderPref: obj.genderPref || obj["genderPref"] || "NoPreference",
    age: obj.Age || obj.age || "",
    homeCity: obj["Home city and State"] || obj.homeCity || "",
    course: obj["UCD Course & Year of Study"] || obj.course || "",
    contact: obj["Contact Information"] || obj.contact || "",
    arrivalDate: obj["Expected Arrival Date in Ireland"] || obj.arrivalDate || "",
    locationPref: obj["Preferred Location"] || obj.locationPref || "Any",
    budget: obj["Budget Range(per month) (€)"] || obj.budget || "",
    roomType: obj["Preferred Room Type"] || obj.roomType || "",
    leaseDuration: obj["Lease Duration"] || obj.leaseDuration || "",
    weekendPlans: obj["Weekend plans"] || obj.weekendPlans || "",
    partTime: obj["Part time work"] || obj.partTime || "",
    transport: obj["Preferred Mode of Transport"] || obj.transport || "",
    guestsPolicy: obj["Guests Policy"] || obj.guestsPolicy || "",
    cleanliness: obj["Cleanliness Level"] || obj.cleanliness || "",
    sleepSchedule: obj["Sleep Schedue"] || obj.sleepSchedule || "",
    smoking: obj["Smoking Preference"] || obj.smoking || "",
    drinking: obj["Drinking Preference"] || obj.drinking || "",
    diet: obj["Dietary Preference"] || obj.diet || "",
    cooking: obj["Cooking Frequency"] || obj.cooking || "",
    pets: obj["Pets Comfort"] || obj.pets || "",
    languages: obj["Languages Spoken"] || obj.languages || "",
    hobbies: obj["Hobbies & Interests"] || obj.hobbies || "",
    additionalComments: obj.additionalComments || ""
  };
}

/**
 * Improved matching algorithm:
 * - Hard filters:
 *   1) genderPref
 *   2) budget overlap
 *   3) leaseDuration
 *   4) locationPref
 * - Weighted preferences (cleanliness, smoking, drinking, etc.)
 * - Bonus for shared non-English languages
 */
function calculateMatchScore(userObj, candidateObj) {
  const user = transformUser(userObj);
  const candidate = transformUser(candidateObj);

  // 1) Gender preference
  if (user.genderPref === "Same" && user.gender !== candidate.gender) return 0;

  // 2) Budget overlap
  const userBudget = parseBudget(user.budget);
  const candidateBudget = parseBudget(candidate.budget);
  if (!budgetsOverlap(userBudget, candidateBudget)) return 0;

  // 3) Lease Duration
  if (user.leaseDuration && candidate.leaseDuration &&
      user.leaseDuration !== candidate.leaseDuration) {
    return 0;
  }

  // 4) Location preference
  if (user.locationPref !== "Any" &&
      user.locationPref !== candidate.locationPref) {
    return 0;
  }

  // Soft scoring
  let score = 0;
  if (user.cleanliness === candidate.cleanliness) score += 10;
  if (user.sleepSchedule === candidate.sleepSchedule) score += 8;
  if (user.smoking === candidate.smoking) score += 5;
  if (user.drinking === candidate.drinking) score += 5;
  if (user.diet === candidate.diet) score += 7;
  if (user.cooking === candidate.cooking) score += 5;
  if (user.pets === candidate.pets) score += 5;

  if (user.weekendPlans && candidate.weekendPlans &&
      user.weekendPlans.toLowerCase() === candidate.weekendPlans.toLowerCase()) {
    score += 5;
  }
  if (user.partTime && candidate.partTime &&
      user.partTime.toLowerCase() === candidate.partTime.toLowerCase()) {
    score += 3;
  }
  if (user.transport && candidate.transport &&
      user.transport.toLowerCase() === candidate.transport.toLowerCase()) {
    score += 3;
  }
  if (user.guestsPolicy && candidate.guestsPolicy &&
      user.guestsPolicy.toLowerCase() === candidate.guestsPolicy.toLowerCase()) {
    score += 2;
  }

  // Languages
  //   - Big bonus for shared non-English languages
  //   - Smaller bonus if only English is in common
  const userLangs = user.languages.toLowerCase().split(",").map(x => x.trim());
  const candLangs = candidate.languages.toLowerCase().split(",").map(x => x.trim());

  // Filter out "english" from the arrays
  const userNonEnglish = userLangs.filter(l => l !== "english" && l);
  const candNonEnglish = candLangs.filter(l => l !== "english" && l);

  // If we share at least 1 non-English language => big bonus
  const commonNonEng = userNonEnglish.filter(lang => candNonEnglish.includes(lang));
  if (commonNonEng.length > 0) {
    // For each shared non-English language, +12
    score += commonNonEng.length * 12;
  }

  // Otherwise, check if they only share "english"
  if (userLangs.includes("english") && candLangs.includes("english") && commonNonEng.length === 0) {
    // smaller bonus for "only english" in common
    score += 5;
  }

  // Hobbies
  const userHobbies = user.hobbies.toLowerCase().split(",").map(x => x.trim());
  const candHobbies = candidate.hobbies.toLowerCase().split(",").map(x => x.trim());
  const commonHobbies = userHobbies.filter(h => candHobbies.includes(h));
  score += commonHobbies.length * 3;

  return score;
}

/**************************************************************
  6. Displaying Matches
**************************************************************/
const resultsSection = document.getElementById("results-section");
const resultsDiv = document.getElementById("results");

function displayTopMatches(scoredMatches) {
  // Clear old results
  resultsDiv.innerHTML = "";
  resultsSection.style.display = "block"; // show container

  if (scoredMatches.length === 0) {
    resultsDiv.innerHTML = "<p>No matches found based on your criteria.</p>";
    return;
  }

  // find max
  const maxScore = Math.max(...scoredMatches.map(m => m.score));
  const top = scoredMatches
    .map(m => {
      const percentage = (maxScore === 0 ? 0 : (m.score / maxScore) * 100).toFixed(0);
      return { candidate: m.candidate, percentage: parseInt(percentage, 10) };
    })
    .sort((a, b) => b.percentage - a.percentage);

  // show all (or top 5) – choose whichever you prefer:
  const topMatches = top.slice(0, 5); // top 5
  // or show all:
  // const topMatches = top;

  topMatches.forEach(match => {
    const c = match.candidate;
    const name = c.Name || c.fullName || "Unknown";
    const course = c["UCD Course & Year of Study"] || c.course || "N/A";
    const budget = c["Budget Range(per month) (€)"] || c.budget || "N/A";
    const contact = c["Contact Information"] || c.contact || "N/A";
    const hobbies = c["Hobbies & Interests"] || c.hobbies || "N/A";

    const matchEl = document.createElement("div");
    matchEl.classList.add("match");
    matchEl.innerHTML = `
      <h3>${name} (Match: ${match.percentage}%)</h3>
      <div class="match-progress">
        <div class="match-progress-bar" style="width: ${match.percentage}%;"></div>
      </div>
      <p><strong>Course:</strong> ${course}</p>
      <p><strong>Budget:</strong> ${budget}</p>
      <p><strong>Hobbies:</strong> ${hobbies}</p>
      <p><strong>Contact:</strong> ${contact}</p>
    `;
    resultsDiv.appendChild(matchEl);
  });
}

/**************************************************************
  7. "Check Existing User" Feature
**************************************************************/
const checkUserBtn = document.getElementById("checkUserBtn");
const existingNameInput = document.getElementById("existingName");
const existingUserResults = document.getElementById("existingUserResults");
const formContainer = document.getElementById("formContainer");

function findUserByName(name, arr) {
  return arr.find(u => {
    const fullName = (u.Name || u.fullName || "").toLowerCase();
    return fullName.includes(name);
  });
}

checkUserBtn.addEventListener("click", async () => {
  const searchName = existingNameInput.value.trim().toLowerCase();
  if (!searchName) {
    existingUserResults.innerHTML = "<p style='color:red'>Please enter a name.</p>";
    return;
  }

  // fetch latest firebase data
  await fetchFirebaseUsers();

  const foundInStatic = findUserByName(searchName, staticUsers);
  const foundInFirebase = findUserByName(searchName, firebaseUsers);
  const foundUser = foundInStatic || foundInFirebase;

  if (!foundUser) {
    existingUserResults.innerHTML = `<p style="color:red">User not found. Please register below!</p>`;
    formContainer.scrollIntoView({ behavior: "smooth" });
  } else {
    existingUserResults.innerHTML = `<p style="color:green">User found! Showing matches...</p>`;
    const userObj = transformUser(foundUser);

    // Exclude foundUser from the match pool
    const allUsers = [...staticUsers, ...firebaseUsers].filter(u =>
      (u.Name || u.fullName) !== (foundUser.Name || foundUser.fullName)
    );
    // Calculate match score
    const scored = allUsers.map(candidate => ({
      candidate,
      score: calculateMatchScore(userObj, candidate)
    })).filter(m => m.score > 0);

    displayTopMatches(scored);
  }
});

/**************************************************************
  8. Handle New User Registration & Matching
**************************************************************/
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Build user object
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
    // Add to Firestore
    await addDoc(collection(window.db, "users"), newUser);
    // Refresh firebase users
    await fetchFirebaseUsers();
  } catch (error) {
    console.error("Error adding document:", error);
  } finally {
    hideLoading();
  }

  // Exclude new user from match pool
  const allUsersExceptSelf = [...staticUsers, ...firebaseUsers].filter(u =>
    (u.Name || u.fullName) !== newUser.fullName
  );
  const scoredMatches = allUsersExceptSelf
    .map(candidate => ({
      candidate,
      score: calculateMatchScore(newUser, candidate)
    }))
    .filter(m => m.score > 0);

  displayTopMatches(scoredMatches);
  document.getElementById("results-section").scrollIntoView({ behavior: "smooth" });
});
