// MadeGood Budget Tracker

const TOTAL_BUDGET = 500_000;

const CATEGORIES = {
  a8_paid:       'A8 Paid Influencers',
  madegood_paid: 'MadeGood Paid Influencers',
  shipping:      'Shipping & PR Mailers',
};

const API = `${SUPABASE_URL}/rest/v1/madegood_budget_entries`;
const HEADERS = {
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type':  'application/json',
};

let allEntries = [];
let currentFilter = 'all';
let pendingDeleteId = null;

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  setupListeners();
  await loadEntries();
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function loadEntries() {
  const resp = await fetch(`${API}?order=date.desc,created_at.desc`, { headers: HEADERS });
  if (!resp.ok) {
    document.getElementById('entries-tbody').innerHTML =
      `<tr><td colspan="7" class="empty-row">Error loading data.</td></tr>`;
    return;
  }
  allEntries = await resp.json();
  render();
}

async function saveEntry(entry) {
  const resp = await fetch(API, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify(entry),
  });
  return resp.ok;
}

async function deleteEntry(id) {
  const resp = await fetch(`${API}?id=eq.${id}`, { method: 'DELETE', headers: HEADERS });
  return resp.ok;
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  renderSummary();
  renderTable();
}

function renderSummary() {
  const actuals  = allEntries.filter(e => e.entry_type === 'actual');
  const planned  = allEntries.filter(e => e.entry_type === 'planned');
  const totalActual  = sum(actuals);
  const totalPlanned = sum(planned);
  const remaining = TOTAL_BUDGET - totalActual;

  document.getElementById('total-spent').textContent     = fmt(totalActual);
  document.getElementById('total-remaining').textContent = `${fmt(remaining)} remaining`;

  const actualPct  = Math.min((totalActual  / TOTAL_BUDGET) * 100, 100);
  const plannedPct = Math.min((totalPlanned / TOTAL_BUDGET) * 100, 100 - actualPct);
  document.getElementById('progress-actual').style.width  = `${actualPct}%`;
  document.getElementById('progress-planned').style.width = `${plannedPct}%`;

  for (const cat of Object.keys(CATEGORIES)) {
    const catActual  = sum(allEntries.filter(e => e.category === cat && e.entry_type === 'actual'));
    const catPlanned = sum(allEntries.filter(e => e.category === cat && e.entry_type === 'planned'));
    document.getElementById(`cat-${cat}-actual`).textContent  = fmt(catActual);
    document.getElementById(`cat-${cat}-planned`).textContent = catPlanned > 0 ? `+ ${fmt(catPlanned)} planned` : '';
  }
}

function renderTable() {
  const rows = currentFilter === 'all'
    ? allEntries
    : allEntries.filter(e => e.entry_type === currentFilter);

  const tbody = document.getElementById('entries-tbody');

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">No entries yet. Click "+ Add Entry" to get started.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(e => {
    const handle = e.creator_handle
      ? `<span class="handle-text">@${e.creator_handle.replace(/^@/, '')}</span> `
      : '';
    const desc = e.description
      ? `<span class="desc-text">${esc(e.description)}</span>`
      : '';
    return `
      <tr class="${e.entry_type === 'planned' ? 'planned-row' : ''}">
        <td style="white-space:nowrap">${fmtDate(e.date)}</td>
        <td><span class="type-badge ${e.entry_type}">${e.entry_type === 'actual' ? 'Actual' : 'Planned'}</span></td>
        <td><span class="cat-badge ${e.category}">${CATEGORIES[e.category] || e.category}</span></td>
        <td>${handle}${desc}</td>
        <td class="amount-${e.entry_type}" style="white-space:nowrap">${fmt(Number(e.amount))}</td>
        <td class="notes-text">${esc(e.notes || '')}</td>
        <td><button class="btn-row-delete" data-id="${e.id}" title="Delete entry">✕</button></td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-row-delete').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id));
  });
}

// ── Form ──────────────────────────────────────────────────────────────────────

async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const category = document.getElementById('f-category').value;
  const isPaidCategory = ['a8_paid', 'madegood_paid'].includes(category);

  const entry = {
    date:           document.getElementById('f-date').value,
    entry_type:     document.getElementById('f-type').value,
    category,
    creator_handle: isPaidCategory ? (document.getElementById('f-handle').value.trim().replace(/^@/, '') || null) : null,
    description:    document.getElementById('f-description').value.trim() || null,
    amount:         parseFloat(document.getElementById('f-amount').value),
    notes:          document.getElementById('f-notes').value.trim() || null,
  };

  const ok = await saveEntry(entry);
  btn.disabled = false;
  btn.textContent = 'Add Entry';

  if (!ok) { alert('Error saving entry. Please try again.'); return; }
  closeModal();
  await loadEntries();
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal() {
  document.getElementById('entry-form').reset();
  document.getElementById('f-date').value = today();
  document.getElementById('field-handle').classList.remove('hidden');
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function confirmDelete(id) {
  pendingDeleteId = id;
  document.getElementById('delete-overlay').classList.remove('hidden');
}

function closeDeleteModal() {
  pendingDeleteId = null;
  document.getElementById('delete-overlay').classList.add('hidden');
}

// ── Listeners ─────────────────────────────────────────────────────────────────

function setupListeners() {
  document.getElementById('btn-add-entry').addEventListener('click', openModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  document.getElementById('entry-form').addEventListener('submit', handleSubmit);

  document.getElementById('f-category').addEventListener('change', e => {
    const show = ['a8_paid', 'madegood_paid'].includes(e.target.value);
    document.getElementById('field-handle').classList.toggle('hidden', !show);
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderTable();
    });
  });

  document.getElementById('delete-cancel').addEventListener('click', closeDeleteModal);
  document.getElementById('delete-overlay').addEventListener('click', e => {
    if (e.target.id === 'delete-overlay') closeDeleteModal();
  });
  document.getElementById('delete-confirm').addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    await deleteEntry(pendingDeleteId);
    closeDeleteModal();
    await loadEntries();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sum(entries) {
  return entries.reduce((s, e) => s + Number(e.amount), 0);
}

function fmt(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function fmtDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', init);
