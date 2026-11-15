const STORE_KEY = 'inkwell-browser-account-v2';
const SESSION_KEY = 'inkwell-browser-session-v2';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let account = readAccount();
let toastTimer;

function readAccount() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); }
  catch { return null; }
}
function saveAccount() { localStorage.setItem(STORE_KEY, JSON.stringify(account)); }
function initials(name = '') { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'I'; }
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
}
function passwordHash(password, salt) {
  const bytes = Uint8Array.from(atob(salt), char => char.charCodeAt(0));
  return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
    .then(key => crypto.subtle.deriveBits({ name: 'PBKDF2', salt: bytes, iterations: 120000, hash: 'SHA-256' }, key, 256))
    .then(bits => btoa(String.fromCharCode(...new Uint8Array(bits))));
}
function newSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

function setAuthMode(mode) {
  const create = mode === 'create';
  $$('.auth-tab').forEach(tab => {
    const selected = tab.dataset.mode === mode;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
  $$('.create-only').forEach(field => field.hidden = !create);
  $('#auth-year').required = create;
  $('#auth-password').autocomplete = create ? 'new-password' : 'current-password';
  $('#auth-eyebrow').textContent = create ? 'WELCOME TO YOUR SPACE' : 'GOOD TO HAVE YOU BACK';
  $('#auth-title').textContent = create ? 'Create your account' : 'Log in to Inkwell';
  $('#auth-intro').textContent = create ? 'Start with your details. Your Inkwell stays on this device.' : 'Log in on the same browser and device to open your saved space.';
  $('#auth-submit').innerHTML = create ? 'Create my space <span>→</span>' : 'Log in <span>→</span>';
  $('#auth-error').textContent = '';
}

function showAuth() {
  $('#auth-view').hidden = false;
  $('#app-view').hidden = true;
  setAuthMode(account ? 'login' : 'create');
  $('#auth-username').value = account?.username || '';
}
function showApp() {
  $('#auth-view').hidden = true;
  $('#app-view').hidden = false;
  updateProfileLabels();
  $('#today-label').textContent = new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
  const week = getWeekNumber(new Date());
  $('#week-pill').textContent = `WEEK ${week} · ${account.year.toUpperCase()}`;
  applyTheme(account.theme || 'preppy', false);
  renderAll();
  showPage('overview');
}
function getWeekNumber(date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  copy.setUTCDate(copy.getUTCDate() + 4 - (copy.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return Math.ceil((((copy - yearStart) / 86400000) + 1) / 7);
}

$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const mode = $('.auth-tab.active').dataset.mode;
  const username = $('#auth-username').value.trim();
  const password = $('#auth-password').value;
  const error = $('#auth-error');
  error.textContent = '';
  const submit = $('#auth-submit');
  submit.disabled = true;
  try {
    if (!crypto?.subtle) throw new Error('Your browser cannot create a local password check. Please open Inkwell in a modern browser.');
    if (mode === 'create') {
      if (account) throw new Error('A local profile already exists here. Please log in, or clear it from Settings.');
      const salt = newSalt();
      const verifier = await passwordHash(password, salt);
      account = { username, year: $('#auth-year').value, salt, verifier, tasks: [], events: [], clubs: [], notes: [], theme: 'preppy', accent: '#8063b4' };
      saveAccount();
      localStorage.setItem(SESSION_KEY, username.toLowerCase());
    } else {
      if (!account || username.toLowerCase() !== account.username.toLowerCase()) throw new Error('We couldn’t find that username on this device. Check it or create a local account.');
      const verifier = await passwordHash(password, account.salt);
      if (verifier !== account.verifier) throw new Error('That password doesn’t match this local account. Try again.');
      localStorage.setItem(SESSION_KEY, account.username.toLowerCase());
    }
    $('#auth-password').value = '';
    showApp();
  } catch (err) {
    error.textContent = err.message || 'Something went wrong. Please try again.';
  } finally {
    submit.disabled = false;
  }
});
$$('.auth-tab').forEach(tab => tab.addEventListener('click', () => setAuthMode(tab.dataset.mode)));

function updateProfileLabels() {
  const name = account.username;
  const badge = initials(name);
  $('#welcome-title').textContent = `Welcome, ${name}`;
  $('#sidebar-name').textContent = name;
  $('#sidebar-year').textContent = account.year;
  $('#sidebar-avatar').textContent = badge;
  $('#top-avatar').textContent = badge;
  $('#settings-username').value = name;
  $('#settings-year').value = account.year;
  $('#accent-picker').value = account.accent || '#8063b4';
}

function showPage(name) {
  const page = $(`#page-${name}`);
  if (!page) return;
  $$('.page-view').forEach(section => section.classList.toggle('active', section === page));
  $$('.nav-item[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === name));
  $('#breadcrumb-title').textContent = page.dataset.title;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$$('.nav-item[data-page]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)));
document.addEventListener('click', event => {
  const goto = event.target.closest('[data-goto]');
  if (goto) showPage(goto.dataset.goto);
});

function applyTheme(theme, persist = true) {
  account.theme = theme;
  document.body.dataset.theme = theme;
  $$('.theme-option').forEach(option => option.classList.toggle('selected', option.dataset.theme === theme));
  $('#accent-row').classList.toggle('show', theme === 'custom');
  if (theme === 'custom') {
    document.documentElement.style.setProperty('--accent', account.accent || '#8063b4');
    document.documentElement.style.setProperty('--accent-soft', `color-mix(in srgb, ${account.accent || '#8063b4'} 14%, white)`);
  } else {
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-soft');
  }
  if (persist && account) saveAccount();
}
$$('.theme-option').forEach(option => option.addEventListener('click', () => {
  applyTheme(option.dataset.theme);
  showToast(`${option.querySelector('strong').textContent} look applied`);
}));
$('#accent-picker').addEventListener('input', event => {
  account.accent = event.target.value;
  if (account.theme === 'custom') applyTheme('custom');
  saveAccount();
});
$('#profile-form').addEventListener('submit', event => {
  event.preventDefault();
  account.username = $('#settings-username').value.trim();
  account.year = $('#settings-year').value;
  localStorage.setItem(SESSION_KEY, account.username.toLowerCase());
  saveAccount();
  updateProfileLabels();
  $('#welcome-title').textContent = `Welcome, ${account.username}`;
  $('#week-pill').textContent = `WEEK ${getWeekNumber(new Date())} · ${account.year.toUpperCase()}`;
  showToast('Profile saved');
});

function dateStamp(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(date);
}
function fullDate(value) {
  if (!value) return 'No date set';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function deleteButton(label, action) {
  const button = make('button', 'delete-button', '×');
  button.type = 'button';
  button.title = `Delete ${label}`;
  button.setAttribute('aria-label', `Delete ${label}`);
  button.addEventListener('click', action);
  return button;
}
function updateCount(selector, count, noun) {
  $(selector).textContent = `${count} ${noun}${count === 1 ? '' : 's'}`;
}
function renderTasks() {
  const root = $('#task-list');
  root.replaceChildren();
  const tasks = [...account.tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9999').localeCompare(b.due || '9999'));
  $('#task-empty').hidden = tasks.length > 0;
  updateCount('#task-count', tasks.length, 'task');
  const remaining = tasks.filter(task => !task.done).length;
  $('#nav-task-count').textContent = remaining;
  $('#nav-task-count').hidden = remaining === 0;
  for (const task of tasks) {
    const row = make('div', `item-row${task.done ? ' done' : ''}`);
    const check = make('button', 'check-button', task.done ? '✓' : '');
    check.type = 'button';
    check.setAttribute('aria-label', task.done ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`);
    check.addEventListener('click', () => { task.done = !task.done; saveAccount(); renderAll(); });
    const main = make('div', 'item-main');
    main.append(make('strong', '', task.title));
    main.append(make('span', '', [task.subject, task.due ? `Due ${fullDate(task.due)}` : 'No due date'].filter(Boolean).join(' · ')));
    const priority = make('span', `pill ${task.priority === 'Important' ? '' : task.priority === 'Whenever' ? 'lilac' : 'green'}`, task.priority || 'Normal');
    row.append(check, main, priority, deleteButton(task.title, () => { account.tasks = account.tasks.filter(item => item.id !== task.id); saveAccount(); renderAll(); showToast('Task removed'); }));
    root.append(row);
  }
  const preview = $('#overview-task-list');
  preview.replaceChildren();
  const upcoming = tasks.filter(task => !task.done).slice(0, 3);
  $('#overview-task-empty').hidden = upcoming.length > 0;
  for (const task of upcoming) {
    const row = make('div', 'preview-row');
    const check = make('button', 'preview-check');
    check.type = 'button'; check.setAttribute('aria-label', `Mark ${task.title} complete`);
    check.addEventListener('click', () => { task.done = true; saveAccount(); renderAll(); });
    const text = make('div', 'preview-row-text');
    text.append(make('strong', '', task.title), make('span', '', [task.subject, task.due ? `Due ${dateStamp(task.due)}` : 'No due date'].filter(Boolean).join(' · ')));
    row.append(check, text);
    preview.append(row);
  }
  $('#overview-tasks').textContent = remaining;
}
function renderEvents() {
  const root = $('#event-list'); root.replaceChildren();
  const events = [...account.events].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
  $('#event-empty').hidden = events.length > 0;
  updateCount('#event-count', events.length, 'event');
  for (const event of events) {
    const row = make('div', 'item-row');
    const date = make('div', 'preview-date', dateStamp(event.date) || 'DATE');
    const main = make('div', 'item-main');
    main.append(make('strong', '', event.title), make('span', '', [fullDate(event.date), event.time, event.type].filter(Boolean).join(' · ')));
    const kind = make('span', `pill ${event.type === 'Club' ? '' : event.type === 'Personal' ? 'lilac' : 'green'}`, event.type || 'School');
    row.append(date, main, kind, deleteButton(event.title, () => { account.events = account.events.filter(item => item.id !== event.id); saveAccount(); renderAll(); showToast('Event removed'); }));
    root.append(row);
  }
  const preview = $('#overview-event-list'); preview.replaceChildren();
  const upcoming = events.filter(event => !event.date || event.date >= todayIso()).slice(0, 3);
  $('#overview-event-empty').hidden = upcoming.length > 0;
  for (const event of upcoming) {
    const row = make('div', 'preview-row');
    row.append(make('div', 'preview-date', dateStamp(event.date) || 'DATE'));
    const text = make('div', 'preview-row-text');
    text.append(make('strong', '', event.title), make('span', '', [event.type, fullDate(event.date), event.time].filter(Boolean).join(' · ')));
    row.append(text); preview.append(row);
  }
  $('#overview-events').textContent = upcoming.length;
}
function renderClubs() {
  const root = $('#club-list'); root.replaceChildren();
  $('#club-empty').hidden = account.clubs.length > 0;
  updateCount('#club-count', account.clubs.length, 'group');
  const flowers = ['✿', '♡', '✦', '☼', '❀', '✳'];
  account.clubs.forEach((club, index) => {
    const card = make('article', 'club-card');
    const icon = make('div', 'club-card-icon', flowers[index % flowers.length]);
    const title = make('h3', '', club.name);
    const description = make('p', '', club.description || 'A little place to share what you love.');
    const details = make('div', 'club-details');
    [club.day, club.time, club.place].filter(Boolean).forEach(value => details.append(make('span', '', value)));
    card.append(deleteButton(club.name, () => { account.clubs = account.clubs.filter(item => item.id !== club.id); saveAccount(); renderAll(); showToast('Group removed'); }), icon, title, description, details);
    root.append(card);
  });
  $('#overview-clubs').textContent = account.clubs.length;
}
function renderNotes() {
  const root = $('#note-list'); root.replaceChildren();
  $('#note-empty').hidden = account.notes.length > 0;
  updateCount('#note-count', account.notes.length, 'note');
  [...account.notes].sort((a, b) => b.created - a.created).forEach(note => {
    const card = make('article', 'note-card');
    const tag = make('span', 'pill', note.tag || 'NOTE');
    const title = make('h3', '', note.title);
    const body = make('p', '', note.body);
    const date = make('span', 'note-date', new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(new Date(note.created)));
    card.append(deleteButton(note.title, () => { account.notes = account.notes.filter(item => item.id !== note.id); saveAccount(); renderAll(); showToast('Note deleted'); }), tag, title, body, date);
    root.append(card);
  });
}
function renderAll() {
  renderTasks(); renderEvents(); renderClubs(); renderNotes();
}
function itemId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

$('#task-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  account.tasks.push({ id: itemId(), title: data.get('title').trim(), subject: data.get('subject').trim(), due: data.get('due'), priority: data.get('priority'), done: false });
  saveAccount(); event.currentTarget.reset(); renderAll(); showToast('Task added to your list');
});
$('#event-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  account.events.push({ id: itemId(), title: data.get('title').trim(), date: data.get('date'), time: data.get('time'), type: data.get('type') });
  saveAccount(); event.currentTarget.reset(); renderAll(); showToast('Event saved to your calendar');
});
$('#club-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  account.clubs.push({ id: itemId(), name: data.get('name').trim(), day: data.get('day').trim(), time: data.get('time').trim(), place: data.get('place').trim(), description: data.get('description').trim() });
  saveAccount(); event.currentTarget.reset(); renderAll(); showToast('Group added to your space');
});
$('#note-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  account.notes.push({ id: itemId(), title: data.get('title').trim(), tag: data.get('tag').trim(), body: data.get('body').trim(), created: Date.now() });
  saveAccount(); event.currentTarget.reset(); renderAll(); showToast('Note saved');
});

function signOut() {
  localStorage.removeItem(SESSION_KEY);
  showAuth();
  showToast('You’ve logged out');
}
$('#signout-button').addEventListener('click', signOut);
$('#settings-signout').addEventListener('click', signOut);
$('#clear-account').addEventListener('click', () => {
  if (!confirm('Clear this local Inkwell account and all saved tasks, events, clubs and notes from this browser?')) return;
  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem(SESSION_KEY);
  account = null;
  showAuth();
});

const session = localStorage.getItem(SESSION_KEY);
if (account && session && session === account.username.toLowerCase()) showApp();
else showAuth();
