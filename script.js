/****************************************************
  1. Firebase Initialization (Replace config!)
*****************************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// TODO: Replace with your actual Firebase config:
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
  2. Form Steps & Progress + Validation
*****************************************************/
const form = document.getElementById("roommateForm");
const formSteps = Array.from(document.querySelectorAll(".form-step"));
const nextBtns = Array.from(document.querySelectorAll(".next-btn"));
const prevBtns = Array.from(document.querySelectorAll(".prev-btn"));
const formProgress = document.getElementById("formProgress");
const stepIndicator = document.getElementById("stepIndicator");

let currentStep = 0;

/** Check if all required fields in the current step are filled. */
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
  3. Dark Mode Toggle
*****************************************************/
const darkModeToggle = document.getElementById("darkModeToggle");
darkModeToggle.addEventListener("change", () => {
  document.body.classList.toggle("dark-mode");
});

/****************************************************
  4. Loading Overlay
*****************************************************/
const loadingOverlay = document.getElementById("loadingOverlay");
function showLoading() {
  loadingOverlay.style.display = "flex";
}
function hideLoading() {
  loadingOverlay.style.display = "none";
}

/****************************************************
  5. Fetching Users from Firestore
*****************************************************/
let firebaseUsers = [];
async function fetchFirebaseUsers() {
  showLoading();
  try {
    firebaseUsers = [];
    const snapshot = await getDocs(collection(window.db, "users"));
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      // Store the docId for deletion
      data.docId = docSnap.id;
      firebaseUsers.push(data);
    });
  } catch (err) {
    console.error("Error fetching Firebase users:", err);
  } finally {
    hideLoading();
  }
}
fetchFirebaseUsers();

/****************************************************
  6. Matching Algorithm
*****************************************************/
const MAX_POSSIBLE_SCORE = 126;
const K = 5; // top K matches

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
    name: u["Name"] || "",
    age: u["Age"] || "",
    gender: u["Gender"] || "",
    genderPref: u["Roommate Gender Preference"] || "NoPreference",
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
    hobbies: u["Hobbies & Interests"] || "",
    docId: u["docId"] || ""
  };
}

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
  // Weighted scoring
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

function findKNearestMatches(userObj, candidates, k) {
  const uniqueMap = new Map();
  for (const c of candidates) {
    const cName = (c["Name"] || "").toLowerCase().trim();
    if (!uniqueMap.has(cName)) {
      uniqueMap.set(cName, c);
    }
  }
  const uniqueCandidates = Array.from(uniqueMap.values());

  const scored = uniqueCandidates.map(candidate => ({
    candidate,
    score: calculateRawScore(userObj, candidate)
  }));
  const filtered = scored.filter(m => m.score > 0).sort((a, b) => b.score - a.score);
  return filtered.slice(0, k);
}

/****************************************************
  7. Modal Handling (for full user data)
*****************************************************/
const modalOverlay = document.getElementById("userModal");
const modalCloseBtn = document.getElementById("closeModal");
const modalBody = document.getElementById("userModalBody");

function openUserModal(userObj) {
  const rows = [];
  for (const key of Object.keys(userObj)) {
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

/****************************************************
  8. Display Matches (cards clickable => modal)
*****************************************************/
const resultsSection = document.getElementById("results-section");
const resultsDiv = document.getElementById("results");

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
  }).sort((a, b) => b.percentage - a.percentage);

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
}

/****************************************************
  9. Check Existing User
*****************************************************/
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

  const foundUser = firebaseUsers.find(u =>
    (u["Name"] || "").toLowerCase().trim() === searchName
  );

  if (!foundUser) {
    existingUserResults.innerHTML = `<p style="color:red">User not found. Please register below!</p>`;
  } else {
    existingUserResults.innerHTML = `<p style="color:green">User found! Calculating matches...</p>`;
    const allCandidates = firebaseUsers.filter(u => {
      const cName = (u["Name"] || "").toLowerCase().trim();
      const fName = (foundUser["Name"] || "").toLowerCase().trim();
      return cName !== fName;
    });
    const nearest = findKNearestMatches(foundUser, allCandidates, K);
    displayTopMatches(nearest);
  }
});

/****************************************************
 10. New User Registration & Matching
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
    "Any Special Requirements": document.getElementById("specialRequirements").value,
    "Social Media Handle": document.getElementById("socialMedia").value,
    "UCD Student ID Number": document.getElementById("studentID").value,
    "Anything Else You'd Like to Share?": document.getElementById("additionalComments").value
  };

  showLoading();
  try {
    await addDoc(collection(window.db, "users"), newUserDoc);
    await fetchFirebaseUsers();
  } catch (err) {
    console.error("Error adding user:", err);
  } finally {
    hideLoading();
  }

  const newName = (newUserDoc["Name"] || "").toLowerCase().trim();
  const allCandidates = firebaseUsers.filter(u => {
    const cName = (u["Name"] || "").toLowerCase().trim();
    return cName !== newName;
  });
  const nearest = findKNearestMatches(newUserDoc, allCandidates, K);
  displayTopMatches(nearest);
  renderAllUsers();
});

/****************************************************
 11. View All Users => Card Layout + Delete
*****************************************************/
const viewAllBtn = document.getElementById("viewAllBtn");
const allUsersGrid = document.getElementById("allUsersGrid");

viewAllBtn.addEventListener("click", async () => {
  showLoading();
  await fetchFirebaseUsers();
  hideLoading();
  renderAllUsers();
});

function renderAllUsers() {
  if (firebaseUsers.length === 0) {
    allUsersGrid.innerHTML = "<p>No users found!</p>";
    return;
  }

  // Sort users by name (ascending order)
  firebaseUsers.sort((a, b) => {
    const nameA = (a["Name"] || "").toLowerCase();
    const nameB = (b["Name"] || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  allUsersGrid.innerHTML = "";
  firebaseUsers.forEach((userDoc) => {
    const name = userDoc["Name"] || "Unnamed";
    const course = userDoc["UCD Course & Year of Study"] || "N/A";
    const budget = userDoc["Budget Range(per month) (€)"] || "N/A";
    const contact = userDoc["Contact Information"] || "N/A";
    const docId = userDoc["docId"];

    const card = document.createElement("div");
    card.classList.add("user-card");
    card.innerHTML = `
      <button class="delete-btn" data-docid="${docId}">Delete</button>
      <h3>${name}</h3>
      <small><strong>Course:</strong> ${course}</small>
      <small><strong>Budget:</strong> ${budget}</small>
      <small><strong>Contact:</strong> ${contact}</small>
    `;

    card.addEventListener("click", () => {
      openUserModal(userDoc);
    });

    const deleteBtn = card.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("Are you sure you want to delete this user?")) {
        try {
          showLoading();
          const docRef = doc(window.db, "users", docId);
          await deleteDoc(docRef);
          await fetchFirebaseUsers();
          renderAllUsers();
        } catch (err) {
          console.error("Error deleting doc:", err);
        } finally {
          hideLoading();
        }
      }
    });

    allUsersGrid.appendChild(card);
  });
}

/****************************************************
 12. Random Fill Button
*****************************************************/
const randomFillBtn = document.getElementById("randomFillBtn");
randomFillBtn.addEventListener("click", () => {
  const names = ["Alice Johnson","Bob Singh","Carol Tan","David Lee","Evelyn Roy","Frank Murphy","Georgia Paul","Vishal Singh J"];
  const cities = ["Chennai, TN","Bangalore, KA","Cochin, KL","Mumbai, MH","Dublin, IE","Galway, IE"];
  const courses = ["MSc CS 1st Year","MBA 2nd Year","MEng 1st Year","MA 1st Year","Marketing 2025"];
  const contactSamples = ["+91 9999999999", "email@example.com", "Telegram @xyz","+971551072879"];
  const randomName = names[Math.floor(Math.random() * names.length)];
  const randomCity = cities[Math.floor(Math.random() * cities.length)];
  const randomCourse = courses[Math.floor(Math.random() * courses.length)];
  const randomContact = contactSamples[Math.floor(Math.random() * contactSamples.length)];
  const randomAge = Math.floor(Math.random() * 10) + 20;
  const randomGender = ["Male","Female","Prefer not to say"][Math.floor(Math.random()*3)];
  const randomPref = ["NoPreference","Same","Opposite"][Math.floor(Math.random()*3)];

  document.getElementById("email").value = `test${Math.floor(Math.random()*1000)}@example.com`;
  document.getElementById("fullName").value = randomName;
  document.getElementById("gender").value = randomGender;
  document.getElementById("genderPref").value = randomPref;
  document.getElementById("age").value = randomAge;
  document.getElementById("homeCity").value = randomCity;
  document.getElementById("course").value = randomCourse;
  document.getElementById("contact").value = randomContact;
  document.getElementById("arrivalDate").value = "2025-09-01";

  const locOptions = ["ANY","ON-CAMPUS","OFF-CAMPUS"];
  const randomLoc = locOptions[Math.floor(Math.random()*locOptions.length)];
  document.getElementById("locationPref").value = randomLoc;

  const budOptions = [
    "600-700 (Average room)",
    "700-800 (Above average)",
    "800+ (Decent good room)"
  ];
  const randomBud = budOptions[Math.floor(Math.random()*budOptions.length)];
  document.getElementById("budget").value = randomBud;

  const roomTypeOptions = ["Single","Shared","Studio"];
  document.getElementById("roomType").value = roomTypeOptions[Math.floor(Math.random()*roomTypeOptions.length)];

  const leaseOptions = ["Short-term (3-6 months)","Long-term (6-12 months)"];
  document.getElementById("leaseDuration").value = leaseOptions[Math.floor(Math.random()*leaseOptions.length)];

  document.getElementById("cleanliness").value = ["Neat","Moderate","Messy"][Math.floor(Math.random()*3)];
  document.getElementById("sleepSchedule").value = ["Early Riser","Night Owl","Flexible"][Math.floor(Math.random()*3)];
  document.getElementById("smoking").value = ["Non-Smoker","Smoker","No Preference"][Math.floor(Math.random()*3)];
  document.getElementById("drinking").value = ["No","Occasionally","Yes"][Math.floor(Math.random()*3)];
  document.getElementById("diet").value = ["Vegetarian","Non-Vegetarian","Vegan","Eggetarian"][Math.floor(Math.random()*4)];
  document.getElementById("cooking").value = ["Often","Rarely","Eating Out"][Math.floor(Math.random()*3)];
  document.getElementById("pets").value = ["Comfortable","Not Comfortable","Bringing Own Pet"][Math.floor(Math.random()*3)];

  document.querySelectorAll('input[name="languages"]').forEach(cb => cb.checked = false);
  document.querySelectorAll('input[name="hobbies"]').forEach(cb => cb.checked = false);

  const langCheckboxes = Array.from(document.querySelectorAll('input[name="languages"]'));
  for (let i=0; i<1+Math.floor(Math.random()*3); i++){
    const randomCB = langCheckboxes[Math.floor(Math.random()*langCheckboxes.length)];
    randomCB.checked = true;
  }
  const hobCheckboxes = Array.from(document.querySelectorAll('input[name="hobbies"]'));
  for (let i=0; i<2+Math.floor(Math.random()*3); i++){
    const randomCB = hobCheckboxes[Math.floor(Math.random()*hobCheckboxes.length)];
    randomCB.checked = true;
  }

  document.getElementById("transportPref").value = ["Walking","Public Transport","Own Vehicle"][Math.floor(Math.random()*3)];
  document.getElementById("partTimeWork").value = ["Yes","No"][Math.floor(Math.random()*2)];
  document.getElementById("weekendPlans").value = ["Outing/travel","StayingHome","Mix"][Math.floor(Math.random()*3)];
  document.getElementById("guestsPolicy").value = ["Okay with visitor","Prefer no guest"][Math.floor(Math.random()*2)];
  document.getElementById("specialRequirements").value = "";
  document.getElementById("socialMedia").value = "@testAccount";
  document.getElementById("studentID").value = String(Math.floor(Math.random()*10000000));
  document.getElementById("additionalComments").value = "Randomly filled data for testing!";
  alert("Form fields randomly filled!");
});
