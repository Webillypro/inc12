"use strict";

/* ------------------------------------------------------------------
   CampusConnect registration validator
   Pattern: HTML attributes give the first line of defence (required,
   pattern, type, minlength, maxlength); a rule table in JS adds the
   rules attributes cannot express and replaces generic browser text
   with specific messages. One loop (checkField) runs every rule.
------------------------------------------------------------------- */

const form = document.querySelector("#regForm");
const sections = Array.from(form.querySelectorAll(".step"));
const fields = Array.from(form.querySelectorAll("input, select, textarea"));
const summaryEl = document.querySelector("#error-summary");
const statusEl = document.querySelector("#projectStatus");
let currentStep = 0;
let summaryFields = []; // fields currently listed in the error summary

/* ---------- field identity helpers ---------- */

// A radio group is validated as ONE control: its first radio represents it.
function repOf(field) {
  return field.type === "radio" ? form.querySelector('input[name="' + field.name + '"]') : field;
}
const controls = fields.filter(function (f) { return repOf(f) === f; });
// Rules and error elements are keyed by id (radio group: by name).
function keyOf(field) { return field.type === "radio" ? field.name : field.id; }
// aria-invalid / aria-describedby live on the fieldset for a radio group.
function ariaTarget(field) { return field.type === "radio" ? field.closest("fieldset") : field; }
function errorOf(field) { return document.getElementById(keyOf(field) + "_err"); }

controls.forEach(function (field) {
  if (!field.id) field.id = "field-" + fields.indexOf(field);
  let error = errorOf(field);
  if (!error) {
    error = document.createElement("p");
    error.id = keyOf(field) + "_err";
    error.className = "field-error";
    field.insertAdjacentElement("afterend", error);
  }
  const target = ariaTarget(field);
  const describedBy = new Set((target.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
  describedBy.add(error.id);
  target.setAttribute("aria-describedby", Array.from(describedBy).join(" "));
  error.setAttribute("aria-live", "polite");
});

/* ---------- rule table ---------- */

// Read a control's value in a type-appropriate way.
function valueOf(field) {
  if (field.type === "checkbox") return field.checked;
  if (field.type === "radio") {
    const picked = form.querySelector('input[name="' + field.name + '"]:checked');
    return picked ? picked.value : "";
  }
  if (field.multiple) return Array.from(field.selectedOptions).map(function (o) { return o.value; });
  return field.value;
}

// Password requirements. `key` matches <li data-rule="..."> in the checklist.
// Length uses String.length so it agrees with the minlength attribute.
const PW_RULES = [
  { key: "len",    need: "at least 8 characters", ok: function (v) { return v.length >= 8; } },
  { key: "upper",  need: "an uppercase letter",   ok: function (v) { return /\p{Lu}/u.test(v); } },
  { key: "lower",  need: "a lowercase letter",    ok: function (v) { return /\p{Ll}/u.test(v); } },
  { key: "digit",  need: "a digit",               ok: function (v) { return /\d/.test(v); } },
  // A symbol is anything that is not a letter, number, combining mark or whitespace.
  { key: "symbol", need: "a symbol (spaces do not count)", ok: function (v) { return /[^\p{L}\p{N}\p{M}\s]/u.test(v); } }
];
function missingPassword(v) {
  return PW_RULES.filter(function (r) { return !r.ok(v); }).map(function (r) { return r.need; });
}
function joinList(items) {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

const CAMPUS_DOMAIN = "student.gsu.edu";
// Local part: same character set the HTML spec allows for type=email.
const LOCAL_PART = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/;

// Each check is { ok(value) -> boolean, msg }. The FIRST failing check wins,
// so order goes from "most basic" to "most specific".
const RULES = {
  fullname: { label: "Full name", checks: [
    { ok: function (v) { return v.trim() !== ""; }, msg: "Enter your full name." },
    { ok: function (v) { return /^[A-Za-z '\-]+$/.test(v); }, msg: "Use letters, spaces, apostrophes and hyphens only." },
    { ok: function (v) { return /[A-Za-z]/.test(v); }, msg: "Your name must contain at least one letter." }
  ]},
  campusEmail: { label: "Campus email", checks: [
    { ok: function (v) { return v !== ""; }, msg: "Enter your campus email address." },
    { ok: function (v) { return v.split("@").length === 2; }, msg: "Email must contain exactly one @ sign." },
    { ok: function (v) { return LOCAL_PART.test(v.split("@")[0]); }, msg: "The part before @ is missing or contains invalid characters." },
    // Exact, case-insensitive match: rejects student.gsu.edu.evil.com, mail.student.gsu.edu, trailing dots.
    { ok: function (v) { return v.split("@")[1].toLowerCase() === CAMPUS_DOMAIN; }, msg: "Email must end in @" + CAMPUS_DOMAIN + "." }
  ]},
  studentId: { label: "Student ID", checks: [
    { ok: function (v) { return v !== ""; }, msg: "Enter your student ID." },
    { ok: function (v) { return /^\d+$/.test(v); }, msg: "Student ID must contain digits only (0-9), with no spaces." },
    { ok: function (v) { return v.length === 9; }, msg: function (v) { return "Student ID must be exactly 9 digits (you entered " + v.length + ")."; } },
    { ok: function (v) { return v[0] !== "0"; }, msg: "Student ID cannot start with 0." }
  ]},
  password: { label: "Password", checks: [
    { ok: function (v) { return v !== ""; }, msg: "Enter a practice password." },
    { ok: function (v) { return missingPassword(v).length === 0; },
      msg: function (v) { return "Password still needs " + joinList(missingPassword(v)) + "."; } }
  ]},
  confirm: { label: "Confirm password", checks: [
    { ok: function (v) { return v !== ""; }, msg: "Re-enter your password to confirm it." },
    // Compared untrimmed on purpose: a trailing space is part of the password.
    { ok: function (v) { return v === document.querySelector("#password").value; }, msg: "Passwords do not match." }
  ]},
  tier: { label: "Tier", checks: [
    { ok: function (v) { return v !== ""; }, msg: "Choose a membership tier." }
  ]},
  interests: { label: "Interests", checks: [
    { ok: function (v) { return v.length >= 1; }, msg: "Choose at least one interest." },
    { ok: function (v) { return v.length <= 3; }, msg: function (v) { return "Choose no more than 3 interests (you chose " + v.length + ")."; } }
  ]},
  bio: { label: "Bio", checks: [
    // maxlength only limits typing; programmatic or pre-filled values bypass it, so check here too.
    { ok: function (v) { return v.length <= 140; }, msg: function (v) { return "Bio must be 140 characters or fewer (currently " + v.length + ")."; } }
  ]},
  terms: { label: "Terms", checks: [
    { ok: function (v) { return v === true; }, msg: "You must accept the terms to continue." }
  ]}
};

function customMessage(field) {
  const rule = RULES[keyOf(field)];
  if (!rule) return "";
  const value = valueOf(field);
  for (const check of rule.checks) {
    if (!check.ok(value)) return typeof check.msg === "function" ? check.msg(value) : check.msg;
  }
  return "";
}

function labelOf(field) {
  const rule = RULES[keyOf(field)];
  return rule ? rule.label : field.name;
}

/* ---------- checking and error display ---------- */

function checkField(field) {
  field = repOf(field);
  field.setCustomValidity("");
  field.setCustomValidity(customMessage(field));
  const valid = field.checkValidity(); // native attribute rules + our custom message
  // "Error:" is literal text so the message never relies on colour or icons.
  errorOf(field).textContent = valid ? "" : "Error: " + field.validationMessage;
  ariaTarget(field).setAttribute("aria-invalid", String(!valid));
  return valid;
}

function showStep(index, moveFocus) {
  currentStep = index;
  sections.forEach(function (section, i) { section.classList.toggle("active", i === index); });
  document.querySelector("#stepNum").textContent = index + 1;
  hideSummary();
  statusEl.textContent = "";
  if (index === 1) updateChecklist();
  if (index === 2) updateBioCount();
  if (index === 3) buildReview(); // always rebuilt, so the review can never show stale data
  if (moveFocus !== false) sections[index].querySelector("h2").focus();
}

function hideSummary() {
  summaryEl.hidden = true;
  summaryEl.replaceChildren();
  summaryEl.removeAttribute("role");
  summaryFields = [];
}

function renderSummary(invalid, moveFocus) {
  summaryFields = invalid;
  summaryEl.replaceChildren();
  const heading = document.createElement("h2");
  heading.id = "error-summary-title";
  heading.textContent = "Please correct these fields";
  const list = document.createElement("ul");
  invalid.forEach(function (field) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#" + field.id;
    link.textContent = labelOf(field) + ": " + field.validationMessage;
    link.addEventListener("click", function (event) {
      event.preventDefault();
      showStep(sections.indexOf(field.closest(".step")));
      field.focus();
    });
    item.appendChild(link);
    list.appendChild(item);
  });
  summaryEl.append(heading, list);
  summaryEl.setAttribute("aria-labelledby", heading.id);
  // role=alert announces the summary once, when it first appears. Live
  // refreshes drop the role so typing does not re-announce it every keystroke.
  if (moveFocus) summaryEl.setAttribute("role", "alert"); else summaryEl.removeAttribute("role");
  summaryEl.hidden = false;
  if (moveFocus) summaryEl.focus();
}

// Keep the summary honest while the user fixes things.
function refreshSummary() {
  if (summaryEl.hidden) return;
  const still = summaryFields.filter(function (f) { return ariaTarget(f).getAttribute("aria-invalid") === "true"; });
  if (still.length) renderSummary(still, false); else hideSummary();
}

/* ---------- password checklist and bio counter ---------- */

function updateChecklist() {
  const pw = document.querySelector("#password").value;
  PW_RULES.forEach(function (rule) {
    const item = document.querySelector('#pwRules [data-rule="' + rule.key + '"]');
    const met = rule.ok(pw);
    let badge = item.querySelector(".rule-state");
    if (!badge) {
      badge = document.createElement("strong");
      badge.className = "rule-state";
      item.append(" ", badge);
    }
    item.dataset.state = met ? "met" : "needed";
    badge.textContent = met ? "— Met" : "— Needed"; // text, not just colour
  });
}

function updateBioCount() {
  document.querySelector("#bioCount").textContent = 140 - document.querySelector("#bio").value.length;
}

/* ---------- review step ---------- */

function buildReview() {
  const review = document.querySelector("#reviewSummary");
  review.replaceChildren();
  const byId = function (id) { return document.getElementById(id); };
  const tier = form.querySelector('input[name="tier"]:checked');
  const interests = Array.from(byId("interests").selectedOptions).map(function (o) { return o.text; });
  const groups = [
    { title: "Identity", rows: [
      ["Full name", byId("fullname").value],
      ["Campus email", byId("campusEmail").value],
      ["Student ID", byId("studentId").value]
    ]},
    // Passwords are never echoed back, not even masked by length.
    { title: "Security", rows: [["Password", "Set (hidden)"]] },
    { title: "Profile", rows: [
      ["Tier", tier ? tier.parentElement.textContent.trim() : "(none chosen)"],
      ["Interests", interests.length ? interests.join(", ") : "(none chosen)"],
      ["Bio", byId("bio").value || "(none)"],
      ["Terms", byId("terms").checked ? "Accepted" : "Not accepted"]
    ]}
  ];
  groups.forEach(function (group, index) {
    const block = document.createElement("section");
    block.className = "review-group";
    const heading = document.createElement("h3");
    heading.textContent = group.title;
    const list = document.createElement("dl");
    group.rows.forEach(function (row) {
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = row[0];
      detail.textContent = row[1]; // textContent: user input can never become markup
      list.append(term, detail);
    });
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit " + group.title;
    edit.addEventListener("click", function () { showStep(index); });
    block.append(heading, list, edit);
    review.appendChild(block);
  });
}

/* ---------- navigation ---------- */

function goNext() {
  const invalid = controls.filter(function (field) {
    return sections[currentStep].contains(field) && !checkField(field);
  });
  if (invalid.length) { renderSummary(invalid, true); return; }
  showStep(Math.min(3, currentStep + 1));
}

form.addEventListener("click", function (event) {
  if (event.target.closest("[data-back]")) showStep(Math.max(0, currentStep - 1));
  if (event.target.closest("[data-next]")) goNext();
});

// Enter inside a text input means "Next", never an early whole-form submit.
form.addEventListener("keydown", function (event) {
  if (event.key === "Enter" && !event.isComposing && event.target.matches("input") && currentStep < 3) {
    event.preventDefault();
    goNext();
  }
});

/* ---------- timing: blur validates, input/change re-validates and clears ---------- */

fields.forEach(function (field) {
  const target = repOf(field);
  field.addEventListener("blur", function () { checkField(target); });
  ["input", "change"].forEach(function (type) {
    field.addEventListener(type, function () {
      statusEl.textContent = "";
      if (target.id === "password") updateChecklist();
      if (ariaTarget(target).getAttribute("aria-invalid") === "true") checkField(target);
      if (target.id === "password") {
        // The confirmation depends on the password: recheck it if it has been used.
        const confirm = document.querySelector("#confirm");
        if (confirm.value !== "" || confirm.getAttribute("aria-invalid") === "true") checkField(confirm);
      }
      if (target.id === "bio") updateBioCount();
      refreshSummary();
    });
  });
});

/* ---------- final submit ---------- */

form.addEventListener("submit", function (event) {
  event.preventDefault();
  // Re-validate EVERY field, including earlier steps, in case anything went stale.
  const invalid = controls.filter(function (field) { return !checkField(field); });
  if (invalid.length) { renderSummary(invalid, true); return; }
  if (currentStep !== 3) showStep(3); else buildReview();
  statusEl.textContent = "All checks passed. Nothing was sent: this practice project has no server.";
});

updateChecklist();
updateBioCount();
showStep(0, false);
