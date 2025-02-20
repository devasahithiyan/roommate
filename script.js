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
  4. Load & Store Users
**************************************************************/
let staticUsers = [];
let firebaseUsers = [];

// Load static data from data.json
fetch("data.json")
  .then(res => res.json())
  .then(data => { staticUsers = data; })
  .catch(err => console.error("Error loading JSON data:", err));

// Fetch from Firestore
async function fetchFirebaseUsers() {
  showLoading();
  try {
    const snapshot = await getDocs(collection(window.db, "users"));
    firebaseUsers = [];
    snapshot.forEach(doc => {
      firebaseUsers.push(doc.data());
    });
  } catch (error) {
    console.error("Error fetching Firebase users:", error);
  } finally {
    hideLoading();
  }
}
fetchFirebaseUsers();

/**************************************************************
  5. Utility & Matching
**************************************************************/
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

function calculateMatchScore(userObj, candidateObj) {
  const user = transformUser(userObj);
  const candidate = transformUser(candidateObj);

  // Hard filters
  if (user.genderPref === "Same" && user.gender !== candidate.gender) return 0;
  const userBudget = parseBudget(user.budget);
  const candBudget = parseBudget(candidate.budget);
  if (!budgetsOverlap(userBudget, candBudget)) return 0;
  if (user.leaseDuration && candidate.leaseDuration &&
      user.leaseDuration !== candidate.leaseDuration) return 0;
  if (user.locationPref !== "Any" && user.locationPref !== candidate.locationPref) return 0;

  // Weighted scoring
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

  // Language weighting
  const userLangs = user.languages.toLowerCase().split(",").map(x => x.trim());
  const candLangs = candidate.languages.toLowerCase().split(",").map(x => x.trim());
  const userNonEng = userLangs.filter(l => l !== "english" && l);
  const candNonEng = candLangs.filter(l => l !== "english" && l);
  const commonNonEng = userNonEng.filter(lang => candNonEng.includes(lang));
  // If they share one or more non-English languages, big bonus
  if (commonNonEng.length > 0) {
    score += commonNonEng.length * 12;
  }
  // If they don't share non-English, but both have "english"
  if (commonNonEng.length === 0 && userLangs.includes("english") && candLangs.includes("english")) {
    score += 5;
  }

  // Hobbies overlap
  const userHobbies = user.hobbies.toLowerCase().split(",").map(x => x.trim());
  const candHobbies = candidate.hobbies.toLowerCase().split(",").map(x => x.trim());
  const commonHobbies = userHobbies.filter(h => candHobbies.includes(h));
  score += commonHobbies.length * 3;

  return score;
}

/**************************************************************
  6. Display Matches
**************************************************************/
const resultsSection = document.getElementById("results-section");
const resultsDiv = document.getElementById("results");

function displayTopMatches(scoredMatches) {
  // Clear old
  resultsDiv.innerHTML = "";
  resultsSection.style.display = "block";

  if (scoredMatches.length === 0) {
    resultsDiv.innerHTML = "<p>No matches found based on your criteria.</p>";
    return;
  }

  // Highest score -> 100%
  const maxScore = Math.max(...scoredMatches.map(m => m.score));
  const mapped = scoredMatches
    .map(m => {
      const pct = maxScore ? ((m.score / maxScore) * 100).toFixed(0) : 0;
      return { candidate: m.candidate, percentage: parseInt(pct, 10) };
    })
    .sort((a, b) => b.percentage - a.percentage);

  // take top 5
  const topFive = mapped.slice(0, 5);

  topFive.forEach(match => {
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

  // Finally, scroll to the card section
  resultsSection.scrollIntoView({ behavior: "smooth" });
}

/**************************************************************
  7. "Check Existing User"
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

  showLoading();
  await fetchFirebaseUsers();
  hideLoading();

  const foundStatic = findUserByName(searchName, staticUsers);
  const foundFirebase = findUserByName(searchName, firebaseUsers);
  const foundUser = foundStatic || foundFirebase;

  if (!foundUser) {
    existingUserResults.innerHTML = `<p style="color:red">User not found. Please register below!</p>`;
    formContainer.scrollIntoView({ behavior: "smooth" });
  } else {
    existingUserResults.innerHTML = `<p style="color:green">User found! Showing matches...</p>`;
    const userObj = transformUser(foundUser);

    // Filter out foundUser from the match pool
    const allUsers = [...staticUsers, ...firebaseUsers].filter(u =>
      (u.Name || u.fullName) !== (foundUser.Name || foundUser.fullName)
    );
    const scored = allUsers
      .map(candidate => ({ candidate, score: calculateMatchScore(userObj, candidate) }))
      .filter(m => m.score > 0);

    displayTopMatches(scored);
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

  // Exclude newUser from match pool
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
});
