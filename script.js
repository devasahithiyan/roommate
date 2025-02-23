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
  4. Firestore Data
**************************************************************/
let firebaseUsers = [];

/** Fetch all users from Firebase into the global firebaseUsers array. */
async function fetchFirebaseUsers() {
  showLoading();
  try {
    const snapshot = await getDocs(collection(window.db, "users"));
    firebaseUsers = [];
    snapshot.forEach(doc => {
      firebaseUsers.push(doc.data());
    });
    console.log("Fetched from Firebase:", firebaseUsers);
  } catch (err) {
    console.error("Error fetching Firebase users:", err);
  } finally {
    hideLoading();
  }
}

// On page load, immediately fetch any existing users
fetchFirebaseUsers();

/**************************************************************
  5. Matching Algorithm
   We must transform the Firestore doc fields to uniform keys
   so the matching logic can see them properly.
**************************************************************/
const MAX_POSSIBLE_SCORE = 126;
const K = 5; // top matches

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

/**
 * transformUser ensures all the keys used by matching are present.
 * Here we EXACTLY match the Firestore doc field names you showed:
 *
 *  Name
 *  Age
 *  Gender
 *  Budget Range(per month) (€)
 *  UCD Course & Year of Study
 *  Contact Information
 *  ...
 */
function transformUser(u) {
  return {
    name: u["Name"] || "",
    age: u["Age"] || "",
    gender: u["Gender"] || "",
    genderPref: u["Roommate Gender Preference"] || "NoPreference",  // or your actual doc field
    homeCity: u["Home city and State"] || "",
    course: u["UCD Course & Year of Study"] || "",
    contact: u["Contact Information"] || "",
    arrivalDate: u["Expected Arrival Date in Ireland"] || "",
    locationPref: u["Preferred Location"] || "ANY",
    budget: u["Budget Range(per month) (€)"] || "",
    roomType: u["Preferred Room Type"] || "",
    leaseDuration: u["Lease Duration"] || "",
    weekendPlans: u["Weekend plans"] || "",
    partTime: u["Part time work"] || "",
    transport: u["Preferred Mode of Transport"] || "",
    guestsPolicy: u["Guests Policy"] || "",
    cleanliness: u["Cleanliness Level"] || "",
    sleepSchedule: u["Sleep Schedule"] || "",
    smoking: u["Smoking Preference"] || "",
    drinking: u["Drinking Preference"] || "",
    diet: u["Dietary Preference"] || "",
    cooking: u["Cooking Frequency"] || "",
    pets: u["Pets Comfort"] || "",
    languages: u["Languages Spoken"] || "",
    hobbies: u["Hobbies & Interests"] || ""
  };
}

/**
 * Weighted raw score. 0 if any "hard filter" fails.
 */
function calculateRawScore(userObj, candidateObj) {
  const user = transformUser(userObj);
  const cand = transformUser(candidateObj);

  // Hard filters
  if (user.genderPref === "Same" && user.gender !== cand.gender) return 0;
  if (user.genderPref === "Opposite" && user.gender === cand.gender) return 0;

  const userB = parseBudget(user.budget);
  const candB = parseBudget(cand.budget);
  if (!budgetsOverlap(userB, candB)) return 0;
  if (user.leaseDuration && cand.leaseDuration && user.leaseDuration !== cand.leaseDuration) return 0;
  if (user.locationPref !== "ANY" && user.locationPref !== cand.locationPref) return 0;

  let score = 0;
  // Base weighting
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

  // Regional Language Bonus
  const userLangs = user.languages.toLowerCase().split(",").map(x => x.trim());
  const candLangs = cand.languages.toLowerCase().split(",").map(x => x.trim());
  const userRegional = userLangs.filter(l => l !== "english" && l);
  const candRegional = candLangs.filter(l => l !== "english" && l);

  let regionalOverlap = 0;
  userRegional.forEach(lang => {
    if (candRegional.includes(lang)) regionalOverlap++;
  });
  if (regionalOverlap > 2) regionalOverlap = 2;
  score += regionalOverlap * 20;

  // If no regional overlap, but both speak english
  if (regionalOverlap === 0 && userLangs.includes("english") && candLangs.includes("english")) {
    score += 3;
  }

  // Course Bonus
  if (user.course.trim().toLowerCase() === cand.course.trim().toLowerCase()) {
    score += 20;
  }

  // Hobbies Bonus
  const userHobbies = user.hobbies.toLowerCase().split(",").map(x => x.trim());
  const candHobbies = cand.hobbies.toLowerCase().split(",").map(x => x.trim());
  let hobbyOverlap = 0;
  userHobbies.forEach(h => {
    if (candHobbies.includes(h)) hobbyOverlap++;
  });
  if (hobbyOverlap > 4) hobbyOverlap = 4;
  score += hobbyOverlap * 2;

  return score;
}

/** Return top K matches, scored descending, ignoring zero. */
function findKNearestMatches(userObj, candidates, k) {
  const scored = candidates.map(candidate => ({
    candidate,
    score: calculateRawScore(userObj, candidate)
  }))
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

  // Convert raw score to a percentage
  const matchesWithPercentage = scoredMatches.map(m => {
    const pct = ((m.score / MAX_POSSIBLE_SCORE) * 100).toFixed(0);
    return { candidate: m.candidate, percentage: parseInt(pct, 10) };
  }).sort((a, b) => b.percentage - a.percentage);

  matchesWithPercentage.forEach(match => {
    // Use the Firestore fields to display user info
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
    resultsDiv.appendChild(matchDiv);
  });

  resultsSection.scrollIntoView({ behavior: "smooth" });
}

/**************************************************************
  7. Check Existing User
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
  await fetchFirebaseUsers(); // get the latest from Firestore
  hideLoading();

  // find user by "Name" in firebaseUsers
  const foundUser = firebaseUsers.find(u => {
    const storedName = (u["Name"] || "").toLowerCase();
    return storedName.includes(searchName);
  });

  if (!foundUser) {
    existingUserResults.innerHTML = `<p style="color:red">User not found. Please register below!</p>`;
  } else {
    existingUserResults.innerHTML = `<p style="color:green">User found! Calculating matches...</p>`;
    // Exclude them from candidates
    const candidates = firebaseUsers.filter(u => {
      const cName = (u["Name"] || "").toLowerCase().trim();
      const fName = (foundUser["Name"] || "").toLowerCase().trim();
      return cName !== fName;
    });
    const nearest = findKNearestMatches(foundUser, candidates, K);
    displayTopMatches(nearest);
  }
});

/**************************************************************
  8. New User Registration & Matching
     Store EXACT Firestore field keys matching the screenshot
**************************************************************/
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Make sure at least one language, hobby is selected
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

  // Build new doc with fields EXACTLY like your screenshot
  const newUserDoc = {
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
    "Any Special Requirements": document.getElementById("specialRequirements").value, // not required
    "Social Media Handle": document.getElementById("socialMedia").value, // not required
    "UCD Student ID Number": document.getElementById("studentID").value, // not required
    "Anything Else You'd Like to Share?": document.getElementById("additionalComments").value // optional
  };

  showLoading();
  try {
    await addDoc(collection(window.db, "users"), newUserDoc);
    await fetchFirebaseUsers();  // refresh local firebaseUsers
  } catch (err) {
    console.error("Error adding user:", err);
  } finally {
    hideLoading();
  }

  // Now find top matches for the newly added user
  // 1) transform new user doc the same way to see if we can find a match
  const newUserName = newUserDoc["Name"].toLowerCase().trim();
  const allCandidates = firebaseUsers.filter(u => {
    const docName = (u["Name"] || "").toLowerCase().trim();
    return docName !== newUserName;
  });
  const nearest = findKNearestMatches(newUserDoc, allCandidates, K);
  displayTopMatches(nearest);

  // Optionally refresh "All Users" table
  renderAllUsers();
});

/**************************************************************
  9. View All Users
     Show columns: Name, Course, Budget, Contact
**************************************************************/
const viewAllBtn = document.getElementById("viewAllBtn");
const allUsersDisplay = document.getElementById("allUsersDisplay");

viewAllBtn.addEventListener("click", async () => {
  showLoading();
  await fetchFirebaseUsers(); // get fresh data
  hideLoading();
  renderAllUsers();
});

function renderAllUsers() {
  if (firebaseUsers.length === 0) {
    allUsersDisplay.innerHTML = "<p>No users found!</p>";
    return;
  }
  let html = `<table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Course</th>
        <th>Budget</th>
        <th>Contact</th>
      </tr>
    </thead>
    <tbody>`;

  firebaseUsers.forEach(u => {
    // Pull fields from Firestore exactly as stored
    const name = u["Name"] || "";
    const course = u["UCD Course & Year of Study"] || "";
    const budget = u["Budget Range(per month) (€)"] || "";
    const contact = u["Contact Information"] || "";

    html += `<tr>
      <td>${name}</td>
      <td>${course}</td>
      <td>${budget}</td>
      <td>${contact}</td>
    </tr>`;
  });

  html += "</tbody></table>";
  allUsersDisplay.innerHTML = html;
}
