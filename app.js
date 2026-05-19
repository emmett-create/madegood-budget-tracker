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

let allEntries    = [];
let typeFilter    = 'all';       // 'all' | 'actual' | 'planned'
let categoryFilter = null;       // null | 'a8_paid' | 'madegood_paid' | 'shipping'
let searchText    = '';
let sortCol       = 'date';
let sortDir       = 'desc';
let currentView   = 'table';
let calYear       = new Date().getFullYear();
let calMonth      = new Date().getMonth();
let pendingDeleteId = null;

// ── Init ──────────────────────────────────────────────────────────────────────

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
  if (currentView === 'table') renderTable();
  else renderCalendar();
}

function renderSummary() {
  const actuals  = allEntries.filter(e => e.entry_type === 'actual');
  const planned  = allEntries.filter(e => e.entry_type === 'planned');
  const totalActual  = sum(actuals);
  const totalPlanned = sum(planned);
  const remaining    = TOTAL_BUDGET - totalActual;

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

// ── Table view ────────────────────────────────────────────────────────────────

function getFilteredSorted() {
  let rows = [...allEntries];

  if (typeFilter !== 'all')   rows = rows.filter(e => e.entry_type === typeFilter);
  if (categoryFilter)         rows = rows.filter(e => e.category === categoryFilter);
  if (searchText) {
    const q = searchText.toLowerCase();
    rows = rows.filter(e =>
      (e.creator_handle || '').toLowerCase().includes(q) ||
      (e.description    || '').toLowerCase().includes(q) ||
      (e.notes          || '').toLowerCase().includes(q)
    );
  }

  rows.sort((a, b) => {
    let av, bv;
    switch (sortCol) {
      case 'date':       av = a.date;       bv = b.date;       break;
      case 'amount':     av = Number(a.amount); bv = Number(b.amount); break;
      case 'category':   av = a.category;   bv = b.category;   break;
      case 'entry_type': av = a.entry_type; bv = b.entry_type; break;
      default:           av = a.date;       bv = b.date;
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  return rows;
}

function renderTable() {
  // Update sort icons on headers
  document.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === sortCol) {
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });

  const rows = getFilteredSorted();
  const tbody = document.getElementById('entries-tbody');

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">No entries match your filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(e => {
    const handle = e.creator_handle
      ? `<span class="handle-text">@${e.creator_handle.replace(/^@/, '')}</span> `
      : '';
    const desc = e.description ? `<span class="desc-text">${esc(e.description)}</span>` : '';
    return `
      <tr class="${e.entry_type === 'planned' ? 'planned-row' : ''}">
        <td style="white-space:nowrap">${fmtDate(e.date)}</td>
        <td><span class="type-badge ${e.entry_type}">${e.entry_type === 'actual' ? 'Actual' : 'Planned'}</span></td>
        <td><span class="cat-badge ${e.category}">${CATEGORIES[e.category] || e.category}</span></td>
        <td>${handle}${desc}</td>
        <td class="amount-${e.entry_type}" style="white-space:nowrap">${fmt(Number(e.amount))}</td>
        <td class="notes-text">${esc(e.notes || '')}</td>
        <td><button class="btn-row-delete" data-id="${e.id}" title="Delete">✕</button></td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-row-delete').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id));
  });
}

// ── Calendar view ─────────────────────────────────────────────────────────────

function renderCalendar() {
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  document.getElementById('cal-title').textContent = `${MONTHS[calMonth]} ${calYear}`;

  const firstDow   = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today      = new Date();
  const todayStr   = today.toISOString().split('T')[0];

  // Group entries by date string
  const byDay = {};
  for (const e of allEntries) {
    const d = new Date(e.date + 'T12:00:00');
    if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
      if (!byDay[e.date]) byDay[e.date] = [];
      byDay[e.date].push(e);
    }
  }

  const container = document.getElementById('cal-days');
  let html = '';

  // Leading empty cells
  for (let i = 0; i < firstDow; i++) {
    html += `<div class="cal-day empty-day"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const entries = byDay[dateStr] || [];
    const isToday = dateStr === todayStr;
    const hasEntries = entries.length > 0;

    const actualAmt  = sum(entries.filter(e => e.entry_type === 'actual'));
    const plannedAmt = sum(entries.filter(e => e.entry_type === 'planned'));

    let dots = '';
    if (actualAmt  > 0) dots += `<div class="cal-entry-dot actual">${fmt(actualAmt)}</div>`;
    if (plannedAmt > 0) dots += `<div class="cal-entry-dot planned">${fmt(plannedAmt)}</div>`;

    html += `<div class="cal-day${isToday ? ' today' : ''}${!hasEntries ? '' : ' has-entries'}"
                  data-date="${dateStr}">
               <div class="cal-day-num">${d}</div>
               ${dots}
             </div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.cal-day.has-entries').forEach(cell => {
    cell.addEventListener('click', () => showCalDetail(cell.dataset.date, byDay[cell.dataset.date]));
  });

  // Hide detail if open
  document.getElementById('cal-detail').classList.add('hidden');
}

function showCalDetail(dateStr, entries) {
  const detail = document.getElementById('cal-detail');
  document.getElementById('cal-detail-date').textContent = fmtDateLong(dateStr);

  const tbody = document.getElementById('cal-detail-tbody');
  tbody.innerHTML = entries.map(e => {
    const handle = e.creator_handle ? `<span class="handle-text">@${e.creator_handle.replace(/^@/, '')}</span> ` : '';
    const desc   = e.description ? `<span class="desc-text">${esc(e.description)}</span>` : '';
    return `<tr class="${e.entry_type === 'planned' ? 'planned-row' : ''}">
      <td><span class="type-badge ${e.entry_type}">${e.entry_type === 'actual' ? 'Actual' : 'Planned'}</span></td>
      <td><span class="cat-badge ${e.category}">${CATEGORIES[e.category] || e.category}</span></td>
      <td>${handle}${desc}</td>
      <td class="amount-${e.entry_type}">${fmt(Number(e.amount))}</td>
      <td class="notes-text">${esc(e.notes || '')}</td>
    </tr>`;
  }).join('');

  detail.classList.remove('hidden');
  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Form ──────────────────────────────────────────────────────────────────────

async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const category = document.getElementById('f-category').value;
  const isPaid   = ['a8_paid', 'madegood_paid'].includes(category);

  const entry = {
    date:           document.getElementById('f-date').value,
    entry_type:     document.getElementById('f-type').value,
    category,
    creator_handle: isPaid ? (document.getElementById('f-handle').value.trim().replace(/^@/, '') || null) : null,
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

  // Category card click — filter table
  document.querySelectorAll('.cat-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.dataset.cat;
      if (categoryFilter === cat) {
        categoryFilter = null;
        card.classList.remove('active-filter');
      } else {
        categoryFilter = cat;
        document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('active-filter'));
        card.classList.add('active-filter');
        // Switch to table view so filter is visible
        switchView('table');
      }
      renderTable();
    });
  });

  // Show/hide creator handle field
  document.getElementById('f-category').addEventListener('change', e => {
    const show = ['a8_paid', 'madegood_paid'].includes(e.target.value);
    document.getElementById('field-handle').classList.toggle('hidden', !show);
  });

  // Type filter tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      typeFilter = tab.dataset.filter;
      renderTable();
    });
  });

  // Search
  document.getElementById('search-input').addEventListener('input', e => {
    searchText = e.target.value;
    renderTable();
  });

  // Column sort
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      if (sortCol === th.dataset.col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = th.dataset.col;
        sortDir = th.dataset.col === 'amount' ? 'desc' : 'asc';
      }
      renderTable();
    });
  });

  // View tabs
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });

  // Calendar nav
  document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });
  document.getElementById('cal-detail-close').addEventListener('click', () => {
    document.getElementById('cal-detail').classList.add('hidden');
  });

  // Delete
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

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === view);
  });
  document.getElementById('view-table').classList.toggle('hidden', view !== 'table');
  document.getElementById('view-calendar').classList.toggle('hidden', view !== 'calendar');
  if (view === 'calendar') renderCalendar();
  else renderTable();
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

function fmtDateLong(str) {
  if (!str) return '';
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', init);
