// ============================================================
// script.js  -  what the app DOES
// ============================================================

// ============================================================
// 1. THE DATA
// Everything the app knows lives in this one object called "state".
// ============================================================
const STORAGE_KEY = "studyNotes.v1";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const state = {
  tab: "notes",           // "notes", "homework" or "schedule"
  subjects: ["Maths", "English", "Science"],

  // Notes
  notes: [],              // each: {id, title, subject, summary, body, updated}
  activeSubject: "All",   // which subject chip is selected
  activeNoteId: null,     // which note is open
  view: "list",           // "list" = all notes, "note" = one note open
  search: "",

  // Homework
  homework: [],           // each: {id, text, subject, due, done}

  // Schedule
  schedule: []            // each: {id, day, start, end, title}
};

// Shortcut so we can type $("title") instead of document.getElementById("title")
const $ = (id) => document.getElementById(id);

// ============================================================
// 2. SAVING AND LOADING
// localStorage keeps data in your browser, even after you close it.
// ============================================================
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      subjects: state.subjects,
      notes: state.notes,
      homework: state.homework,
      schedule: state.schedule
    }));
  } catch (err) {
    console.error("Could not save:", err);
  }
}

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      state.subjects = data.subjects || state.subjects;
      state.notes = data.notes || [];
      state.homework = data.homework || [];
      state.schedule = data.schedule || [];
    }
  } catch (err) {
    console.error("Could not load:", err);
  }
}

// ============================================================
// 3. HELPERS
// ============================================================
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Turns "13:30" into "1:30 pm"
function niceTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return hour + ":" + String(m).padStart(2, "0") + " " + suffix;
}

function niceDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// Fills a <select> with the subject names
function fillSubjectSelect(select, chosen) {
  select.innerHTML = "";
  state.subjects.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  if (chosen) select.value = chosen;
}

// Fills every subject dropdown and suggestion list in the app
function refreshSubjectLists() {
  fillSubjectSelect($("hwSubject"), $("hwSubject").value);
  const list = $("subjectList");
  list.innerHTML = "";
  state.subjects.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    list.appendChild(opt);
  });
}

// ============================================================
// 4. TABS
// Shows one panel (Notes, Homework or Schedule) and hides the others.
// ============================================================
function showTab(name) {
  state.tab = name;
  ["notes", "homework", "schedule"].forEach((tab) => {
    $("panel-" + tab).hidden = tab !== name;
  });
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.tab === name));
  });
  if (name === "homework") renderHomework();
  if (name === "schedule") renderSchedule();
}

// ============================================================
// 5. NOTES TAB
// ============================================================
function getActiveNote() {
  return state.notes.find((n) => n.id === state.activeNoteId);
}

// Works out which notes to show, based on the subject chip and search box
function visibleNotes() {
  const q = state.search.trim().toLowerCase();
  return state.notes
    .filter((n) => state.activeSubject === "All" || n.subject === state.activeSubject)
    .filter((n) => !q || (n.title + " " + n.body + " " + n.summary).toLowerCase().includes(q))
    .sort((a, b) => b.updated - a.updated);   // newest first
}

// Shows either the list of notes or the single open note
function showNoteScreen() {
  $("listScreen").hidden = state.view !== "list";
  $("noteScreen").hidden = state.view !== "note";
}

function renderSubjects() {
  const box = $("subjects");
  box.innerHTML = "";

  ["All", ...state.subjects].forEach((name) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = name;
    btn.setAttribute("aria-pressed", String(state.activeSubject === name));
    btn.addEventListener("click", () => {
      state.activeSubject = name;
      renderSubjects();
      renderGrid();
    });
    box.appendChild(btn);
  });

  const add = document.createElement("button");
  add.className = "chip add";
  add.textContent = "+ Subject";
  add.addEventListener("click", addSubject);
  box.appendChild(add);
}

function renderGrid() {
  const grid = $("grid");
  grid.innerHTML = "";

  // The first card is always "Add note"
  const addCard = document.createElement("button");
  addCard.className = "card card-add";
  const plus = document.createElement("span");
  plus.className = "plus";
  plus.textContent = "+";
  const addText = document.createElement("span");
  addText.textContent = "Add note";
  addCard.append(plus, addText);
  addCard.addEventListener("click", createNote);
  grid.appendChild(addCard);

  // Then one card for each note. Click a card to open it.
  const notes = visibleNotes();
  notes.forEach((note) => {
    const card = document.createElement("button");
    card.className = "card";

    const title = document.createElement("h2");
    title.textContent = note.title || "Untitled note";

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = note.subject;

    // Show the summary on the card if there is one, otherwise the start of the note
    const preview = document.createElement("p");
    preview.textContent = note.summary || note.body || "Empty note. Click to start writing.";

    const date = document.createElement("span");
    date.className = "date";
    date.textContent = "Edited " + niceDate(note.updated);

    card.append(title, tag, preview, date);
    card.addEventListener("click", () => openNote(note.id));
    grid.appendChild(card);
  });

  // A friendly message when there is nothing to show
  const msg = $("noneMsg");
  if (notes.length === 0) {
    msg.hidden = false;
    msg.textContent = state.notes.length === 0
      ? "You have no notes yet. Press Add note to make your first one."
      : "No notes match. Try a different subject or search.";
  } else {
    msg.hidden = true;
  }
}

// Fills the note screen with the chosen note. We only call this when you open
// a note, not on every keystroke, otherwise your cursor would jump around.
function renderEditor() {
  const note = getActiveNote();
  if (!note) return;

  $("title").value = note.title;
  $("summary").value = note.summary;
  $("body").value = note.body;
  $("saved").textContent = "";
  fillSubjectSelect($("subjectSelect"), note.subject);
}

function openNote(id) {
  state.activeNoteId = id;
  state.view = "note";
  renderEditor();
  showNoteScreen();
  window.scrollTo(0, 0);
}

function goBackToList() {
  const note = getActiveNote();

  // If you opened a new note and left it totally blank, remove it so it doesn't clutter the page
  if (note && !note.title.trim() && !note.summary.trim() && !note.body.trim()) {
    state.notes = state.notes.filter((n) => n.id !== note.id);
    save();
  }

  state.activeNoteId = null;
  state.view = "list";
  renderSubjects();
  renderGrid();
  showNoteScreen();
}

function createNote() {
  const note = {
    id: newId(),
    title: "",
    subject: state.activeSubject === "All" ? state.subjects[0] : state.activeSubject,
    summary: "",
    body: "",
    updated: Date.now()
  };
  state.notes.push(note);
  save();
  openNote(note.id);
  $("title").focus();
}

function deleteNote() {
  const note = getActiveNote();
  if (!note) return;
  if (!confirm('Delete "' + (note.title || "Untitled note") + '"? This cannot be undone.')) return;

  state.notes = state.notes.filter((n) => n.id !== note.id);
  save();
  goBackToList();
}

function addSubject() {
  const name = prompt("New subject name:");
  if (!name || !name.trim()) return;
  const clean = name.trim();
  if (state.subjects.includes(clean)) return;

  state.subjects.push(clean);
  state.activeSubject = clean;
  save();
  refreshSubjectLists();
  renderSubjects();
  renderGrid();
}

// Runs every time you type in the title, summary or notes, or change the subject.
// It copies what's in the box into the note, then saves.
function updateActiveNote(field, value) {
  const note = getActiveNote();
  if (!note) return;
  note[field] = value;
  note.updated = Date.now();
  save();
  $("saved").textContent = "Saved ✓";
}

// ============================================================
// 6. HOMEWORK TAB
// ============================================================

// Works out the "Due in 3 days" text and whether it needs a warning colour
function dueInfo(due) {
  if (!due) return { text: "No due date", cls: "" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due + "T00:00:00");
  const diff = Math.round((dueDay - today) / 86400000);   // days between today and due date

  if (diff < 0) return { text: "Overdue by " + (-diff) + (diff === -1 ? " day" : " days"), cls: "overdue" };
  if (diff === 0) return { text: "Due today", cls: "soon" };
  if (diff === 1) return { text: "Due tomorrow", cls: "soon" };
  return { text: "Due in " + diff + " days", cls: "" };
}

// Unfinished first, then the soonest due date. Finished ones go to the bottom.
function sortHomework(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.due && b.due) return a.due.localeCompare(b.due);
  if (a.due) return -1;
  if (b.due) return 1;
  return 0;
}

function renderHomework() {
  const list = $("hwList");
  list.innerHTML = "";
  const items = [...state.homework].sort(sortHomework);

  items.forEach((hw) => {
    const li = document.createElement("li");
    li.className = "hw-item" + (hw.done ? " done" : "");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = hw.done;
    check.setAttribute("aria-label", "Mark as done: " + hw.text);
    check.addEventListener("change", () => {
      hw.done = check.checked;
      save();
      renderHomework();
    });

    const text = document.createElement("span");
    text.className = "text";
    text.textContent = hw.text;

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = hw.subject;

    const info = dueInfo(hw.due);
    const due = document.createElement("span");
    due.className = "due " + (hw.done ? "" : info.cls);
    due.textContent = info.text;

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.textContent = "×";
    del.setAttribute("aria-label", "Delete: " + hw.text);
    del.addEventListener("click", () => {
      state.homework = state.homework.filter((h) => h.id !== hw.id);
      save();
      renderHomework();
    });

    li.append(check, text, tag, due, del);
    list.appendChild(li);
  });

  $("hwNone").hidden = items.length > 0;
  $("clearDone").hidden = !state.homework.some((h) => h.done);
}

function addHomework(e) {
  e.preventDefault();   // stops the page reloading when the form is sent
  const text = $("hwText").value.trim();
  if (!text) return;

  state.homework.push({
    id: newId(),
    text: text,
    subject: $("hwSubject").value,
    due: $("hwDue").value,   // looks like "2026-11-05", or "" if empty
    done: false
  });
  save();
  $("hwText").value = "";
  $("hwDue").value = "";
  $("hwText").focus();
  renderHomework();
}

function clearFinished() {
  if (!confirm("Remove all finished homework?")) return;
  state.homework = state.homework.filter((h) => !h.done);
  save();
  renderHomework();
}

// ============================================================
// 7. SCHEDULE TAB
// ============================================================
function renderSchedule() {
  const week = $("week");
  week.innerHTML = "";

  // Which day is it today? (JavaScript counts Sunday as 0, so we shift it to start on Monday.)
  const todayName = DAYS[(new Date().getDay() + 6) % 7];

  DAYS.forEach((day) => {
    const col = document.createElement("div");
    col.className = "day" + (day === todayName ? " today" : "");

    const heading = document.createElement("h3");
    heading.textContent = day;
    col.appendChild(heading);

    const lessons = state.schedule
      .filter((s) => s.day === day)
      .sort((a, b) => a.start.localeCompare(b.start));   // earliest first

    if (lessons.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-day";
      empty.textContent = "Nothing yet";
      col.appendChild(empty);
    }

    lessons.forEach((lesson) => {
      const slot = document.createElement("div");
      slot.className = "slot";

      const info = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = lesson.title;
      const time = document.createElement("span");
      time.className = "time";
      time.textContent = niceTime(lesson.start) + (lesson.end ? " - " + niceTime(lesson.end) : "");
      info.append(name, time);

      const del = document.createElement("button");
      del.className = "icon-btn";
      del.textContent = "×";
      del.setAttribute("aria-label", "Remove " + lesson.title + " on " + day);
      del.addEventListener("click", () => {
        state.schedule = state.schedule.filter((s) => s.id !== lesson.id);
        save();
        renderSchedule();
      });

      slot.append(info, del);
      col.appendChild(slot);
    });

    week.appendChild(col);
  });
}

function addLesson(e) {
  e.preventDefault();
  const msg = $("schedMsg");
  const start = $("schedStart").value;
  const end = $("schedEnd").value;
  const title = $("schedWhat").value.trim();

  if (!start || !title) {
    msg.textContent = "Add a start time and what the lesson is.";
    return;
  }
  if (end && end <= start) {
    msg.textContent = "The end time has to be after the start time.";
    return;
  }
  msg.textContent = "";

  state.schedule.push({
    id: newId(),
    day: $("schedDay").value,
    start: start,
    end: end,
    title: title
  });
  save();
  $("schedWhat").value = "";
  renderSchedule();
}

// ============================================================
// 8. WIRING BUTTONS AND BOXES TO THE FUNCTIONS ABOVE
// ============================================================

// Tabs
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

// Notes
$("newNote").addEventListener("click", createNote);
$("backBtn").addEventListener("click", goBackToList);
$("deleteNote").addEventListener("click", deleteNote);

$("search").addEventListener("input", (e) => {
  state.search = e.target.value;
  renderGrid();
});

$("title").addEventListener("input", (e) => updateActiveNote("title", e.target.value));
$("summary").addEventListener("input", (e) => updateActiveNote("summary", e.target.value));
$("body").addEventListener("input", (e) => updateActiveNote("body", e.target.value));
$("subjectSelect").addEventListener("change", (e) => updateActiveNote("subject", e.target.value));

// Pressing the Escape key takes you back to all your notes
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.tab === "notes" && state.view === "note") goBackToList();
});

// Homework and schedule
$("hwForm").addEventListener("submit", addHomework);
$("clearDone").addEventListener("click", clearFinished);
$("schedForm").addEventListener("submit", addLesson);

// ============================================================
// 9. THEMES (the Playful / Formal / Retro Cute switch)
// We set a "data-theme" word on the page, and the CSS does the rest.
// ============================================================
const THEME_KEY = "studyNotes.theme";

// Add a new look here (and a matching block in style.css) and the button will cycle to it
const THEMES = [
  { id: "playful", label: "Playful" },
  { id: "formal",  label: "Formal" },
  { id: "retro",   label: "Retro Cute" }
];

function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  document.documentElement.setAttribute("data-theme", theme.id);
  $("themeBtn").textContent = "Look: " + theme.label;
  try { localStorage.setItem(THEME_KEY, theme.id); } catch (err) { console.error(err); }
}

function loadTheme() {
  let id = THEMES[0].id;
  try { id = localStorage.getItem(THEME_KEY) || id; } catch (err) { console.error(err); }
  applyTheme(id);
}

$("themeBtn").addEventListener("click", () => {
  const now = document.documentElement.getAttribute("data-theme");
  const index = THEMES.findIndex((t) => t.id === now);
  applyTheme(THEMES[(index + 1) % THEMES.length].id);   // next look, loops back at the end
});

// ============================================================
// 10. START THE APP
// ============================================================
loadTheme();
load();

// Fill the day dropdown on the schedule form
const daySelect = $("schedDay");
DAYS.forEach((day) => {
  const opt = document.createElement("option");
  opt.value = day;
  opt.textContent = day;
  daySelect.appendChild(opt);
});

refreshSubjectLists();
renderSubjects();
renderGrid();
showNoteScreen();
showTab("notes");