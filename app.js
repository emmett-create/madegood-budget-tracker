// MadeGood Budget Tracker                                                                                                                                                                                
                                                                                                                                                                                                            
  const TOTAL_BUDGET = 500_000;                                                                                                                                                                             
  const CATS = {                                                                                                                                                                                            
    a8_paid:       'A8 Paid Influencers',                   
    madegood_paid: 'MadeGood Paid Influencers',
    shipping:      'Shipping & PR Mailers',
  };

  const API = `${SUPABASE_URL}/rest/v1/madegood_budget_entries`;
  const SB  = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
                                                                                                                                                                                                            
  let rows        = [];
  let typeFilter  = 'all';                                                                                                                                                                                  
  let catFilter   = null;                                   
  let search      = '';                                                                                                                                                                                     
  let sortCol     = 'date';
  let sortDir     = 'desc';                                                                                                                                                                                 
  let view        = 'table';                                
  let calY        = new Date().getFullYear();
  let calM        = new Date().getMonth();                                                                                                                                                                  
  let deleteId    = null;
  let editId      = null;                                                                                                                                                                                   
                                                            
  // ── Boot ─────────────────────────────────────────────────────────────────────                                                                                                                          
  document.addEventListener('DOMContentLoaded', () => {
    bindAll();                                                                                                                                                                                              
    load();                                                                                                                                                                                                 
  });
                                                                                                                                                                                                            
  // ── Data ─────────────────────────────────────────────────────────────────────                                                                                                                          
  async function load() {
    const r = await fetch(`${API}?order=date.desc,created_at.desc`, { headers: SB });                                                                                                                       
    rows = r.ok ? await r.json() : [];                                                                                                                                                                      
    render();
  }                                                                                                                                                                                                         
                                                            
  async function insert(entry) {                                                                                                                                                                            
    const r = await fetch(API, {
      method: 'POST',                                                                                                                                                                                       
      headers: { ...SB, 'Prefer': 'return=minimal' },       
      body: JSON.stringify(entry),                                                                                                                                                                          
    });
    return r.ok;                                                                                                                                                                                            
  }                                                         

  async function remove(id) {
    const r = await fetch(`${API}?id=eq.${id}`, { method: 'DELETE', headers: SB });
    return r.ok;                                                                                                                                                                                            
  }
                                                                                                                                                                                                            
  async function update(id, data) {                         
    const r = await fetch(`${API}?id=eq.${id}`, {
      method: 'PATCH',                                                                                                                                                                                      
      headers: { ...SB, 'Prefer': 'return=minimal' },
      body: JSON.stringify(data),                                                                                                                                                                           
    });                                                     
    return r.ok;
  }

  // ── Render ────────────────────────────────────────────────────────────────────                                                                                                                         
  function render() {
    renderSummary();                                                                                                                                                                                        
    view === 'calendar' ? renderCal() : renderTable();      
  }                                                                                                                                                                                                         
   
  function renderSummary() {                                                                                                                                                                                
    const act  = rows.filter(r => r.entry_type === 'actual');
    const plan = rows.filter(r => r.entry_type === 'planned');                                                                                                                                              
    const tAct  = sum(act);
    const tPlan = sum(plan);                                                                                                                                                                                
                                                            
    setText('total-spent',     fmt(tAct));                                                                                                                                                                  
    setText('total-remaining', fmt(TOTAL_BUDGET - tAct) + ' remaining');
                                                                                                                                                                                                            
    const aPct = Math.min(tAct  / TOTAL_BUDGET * 100, 100);                                                                                                                                                 
    const pPct = Math.min(tPlan / TOTAL_BUDGET * 100, 100 - aPct);                                                                                                                                          
    setStyle('progress-actual',  'width', aPct + '%');                                                                                                                                                      
    setStyle('progress-planned', 'width', pPct + '%');                                                                                                                                                      
                                                                                                                                                                                                            
    for (const cat of Object.keys(CATS)) {                                                                                                                                                                  
      const ca = sum(rows.filter(r => r.category === cat && r.entry_type === 'actual'));                                                                                                                    
      const cp = sum(rows.filter(r => r.category === cat && r.entry_type === 'planned'));                                                                                                                   
      setText(`cat-${cat}-actual`,  fmt(ca));
      setText(`cat-${cat}-planned`, cp > 0 ? '+ ' + fmt(cp) + ' planned' : '');                                                                                                                             
      const pct = (ca + cp) > 0 ? Math.round(ca / (ca + cp) * 100) : 0;                                                                                                                                     
      setStyle(`cat-${cat}-bar`, 'width', pct + '%');                                                                                                                                                       
    }                                                                                                                                                                                                       
  }                                                                                                                                                                                                         
                                                            
  // ── Table view ────────────────────────────────────────────────────────────────                                                                                                                         
  function filtered() {
    let data = [...rows];                                                                                                                                                                                   
    if (typeFilter !== 'all') data = data.filter(r => r.entry_type === typeFilter);                                                                                                                         
    if (catFilter)            data = data.filter(r => r.category === catFilter);
    if (search) {                                                                                                                                                                                           
      const q = search.toLowerCase();                       
      data = data.filter(r =>                                                                                                                                                                               
        (r.creator_handle || '').toLowerCase().includes(q) ||
        (r.description    || '').toLowerCase().includes(q) ||                                                                                                                                               
        (r.notes          || '').toLowerCase().includes(q)
      );                                                                                                                                                                                                    
    }                                                       
    data.sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];                                                                                                                                                                 
      if (sortCol === 'amount') { av = +av; bv = +bv; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;                                                                                                                                                       
      if (av > bv) return sortDir === 'asc' ?  1 : -1;                                                                                                                                                      
      return 0;                                                                                                                                                                                             
    });                                                                                                                                                                                                     
    return data;                                            
  }

  function renderTable() {
    document.querySelectorAll('th.sh').forEach(th => {
      const col = th.dataset.col;                                                                                                                                                                           
      const isSorted = col === sortCol;
      th.classList.toggle('sorted', isSorted);                                                                                                                                                              
      th.textContent = {                                    
        date:       'Date',                                                                                                                                                                                 
        entry_type: 'Type',                                                                                                                                                                                 
        category:   'Category',
        amount:     'Amount',                                                                                                                                                                               
      }[col] + (isSorted ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕');
    });                                                                                                                                                                                                     
   
    const data = filtered();                                                                                                                                                                                
    const tbody = document.getElementById('entries-tbody'); 
                                                                                                                                                                                                            
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-cell">No entries match your filters.</td></tr>`;                                                                                                  
      return;                                                                                                                                                                                               
    }
                                                                                                                                                                                                            
    tbody.innerHTML = data.map(e => {                       
      const h = e.creator_handle ? `<span class="handle-text">@${e.creator_handle.replace(/^@/, '')}</span>` : '';
      const d = e.description    ? `<span>${esc(e.description)}</span>` : '';                                                                                                                               
      const convertBtn = e.entry_type === 'planned'                                                                                                                                                         
        ? `<button class="btn-convert" data-id="${e.id}">→ Actual</button> `                                                                                                                                
        : '';                                                                                                                                                                                               
      return `<tr class="${e.entry_type === 'planned' ? 'dim' : ''}">
        <td style="white-space:nowrap;color:#8b949e">${fmtDate(e.date)}</td>                                                                                                                                
        <td><span class="badge-type ${e.entry_type}">${e.entry_type === 'actual' ? 'Actual' : 'Planned'}</span></td>                                                                                        
        <td><span class="badge-cat ${e.category}">${CATS[e.category] || e.category}</span></td>                                                                                                             
        <td>${h}${d}</td>                                                                                                                                                                                   
        <td class="amount-${e.entry_type}" style="white-space:nowrap">${fmt(+e.amount)}</td>                                                                                                                
        <td class="note-text">${esc(e.notes || '')}</td>                                                                                                                                                    
        <td style="white-space:nowrap">${convertBtn}<button class="btn-edit" data-id="${e.id}" title="Edit">✏</button> <button class="btn-del" data-id="${e.id}">✕</button></td>                            
      </tr>`;                                                                                                                                                                                               
    }).join('');                                                                                                                                                                                            
                                                                                                                                                                                                            
    tbody.querySelectorAll('.btn-del').forEach(b =>                                                                                                                                                         
      b.addEventListener('click', () => openDelete(b.dataset.id))
    );                                                                                                                                                                                                      
    tbody.querySelectorAll('.btn-edit').forEach(b =>        
      b.addEventListener('click', () => {                                                                                                                                                                   
        const entry = rows.find(r => String(r.id) === b.dataset.id);
        if (entry) openEditModal(entry);                                                                                                                                                                    
      })                                                                                                                                                                                                    
    );
    tbody.querySelectorAll('.btn-convert').forEach(b =>                                                                                                                                                     
      b.addEventListener('click', () => quickConvert(b.dataset.id))
    );
  }

  // ── Calendar ──────────────────────────────────────────────────────────────────                                                                                                                         
  function renderCal() {
    const MONTHS = ['January','February','March','April','May','June',                                                                                                                                      
                    'July','August','September','October','November','December'];                                                                                                                           
    setText('cal-title', `${MONTHS[calM]} ${calY}`);
                                                                                                                                                                                                            
    const todayStr   = new Date().toISOString().split('T')[0];
    const firstDow   = new Date(calY, calM, 1).getDay();                                                                                                                                                    
    const daysInMo   = new Date(calY, calM + 1, 0).getDate();                                                                                                                                               
                                                                                                                                                                                                            
    const byDay = {};                                                                                                                                                                                       
    rows.forEach(e => {                                                                                                                                                                                     
      const dt = new Date(e.date + 'T12:00:00');            
      if (dt.getFullYear() === calY && dt.getMonth() === calM) {                                                                                                                                            
        (byDay[e.date] = byDay[e.date] || []).push(e);
      }                                                                                                                                                                                                     
    });                                                     
                                                                                                                                                                                                            
    let html = '';                                          
    for (let i = 0; i < firstDow; i++) html += `<div class="cal-day faded"></div>`;
                                                                                                                                                                                                            
    for (let d = 1; d <= daysInMo; d++) {
      const ds  = `${calY}-${pad(calM + 1)}-${pad(d)}`;                                                                                                                                                     
      const es  = byDay[ds] || [];                                                                                                                                                                          
      const cls = [
        'cal-day',                                                                                                                                                                                          
        ds === todayStr ? 'is-today' : '',                  
        es.length       ? 'clickable' : '',
      ].filter(Boolean).join(' ');

      const catPills = Object.keys(CATS).map(cat => {
        const catEs  = es.filter(e => e.category === cat);
        if (!catEs.length) return '';
        const total   = sum(catEs);
        const allPlan = catEs.every(e => e.entry_type === 'planned');
        return `<div class="cal-dot ${cat}${allPlan ? ' cal-dot-plan' : ''}">${fmt(total)}</div>`;                                                                                                          
      }).join('');                                                                                                                                                                                          
                                                                                                                                                                                                            
      html += `<div class="${cls}" data-date="${ds}">                                                                                                                                                       
        <div class="cal-day-num">${d}</div>                 
        ${catPills}                                                                                                                                                                                         
      </div>`;
    }                                                                                                                                                                                                       
                                                            
    document.getElementById('cal-days').innerHTML = html;
    document.getElementById('cal-detail').classList.add('hidden');
                                                                                                                                                                                                            
    document.querySelectorAll('.cal-day.clickable').forEach(cell => {
      cell.addEventListener('click', () => {                                                                                                                                                                
        const ds = cell.dataset.date;                       
        showCalDetail(ds, byDay[ds] || []);                                                                                                                                                                 
      });
    });                                                                                                                                                                                                     
  }                                                         

  function showCalDetail(ds, entries) {                                                                                                                                                                     
    const detail = document.getElementById('cal-detail');
    setText('cal-detail-date', fmtDateLong(ds));                                                                                                                                                            
                                                            
    document.getElementById('cal-detail-tbody').innerHTML = entries.map(e => {                                                                                                                              
      const h = e.creator_handle ? `<span class="handle-text">@${e.creator_handle.replace(/^@/, '')}</span>` : '';
      const d = e.description    ? `<span>${esc(e.description)}</span>` : '';                                                                                                                               
      return `<tr class="${e.entry_type === 'planned' ? 'dim' : ''}">                                                                                                                                       
        <td><span class="badge-type ${e.entry_type}">${e.entry_type === 'actual' ? 'Actual' : 'Planned'}</span></td>
        <td><span class="badge-cat ${e.category}">${CATS[e.category] || e.category}</span></td>                                                                                                             
        <td>${h}${d}</td>                                                                                                                                                                                   
        <td class="amount-${e.entry_type}">${fmt(+e.amount)}</td>                                                                                                                                           
        <td class="note-text">${esc(e.notes || '')}</td>                                                                                                                                                    
      </tr>`;                                                                                                                                                                                               
    }).join('');
                                                                                                                                                                                                            
    detail.classList.remove('hidden');                      
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }                                                                                                                                                                                                         
   
  // ── Bind events ───────────────────────────────────────────────────────────────                                                                                                                         
  function bindAll() {                                      

    document.getElementById('btn-add-entry').addEventListener('click', openModal);                                                                                                                          
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancel').addEventListener('click', closeModal);                                                                                                                            
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') closeModal();                                                                                                                                                    
    });                                                                                                                                                                                                     
    document.getElementById('entry-form').addEventListener('submit', async e => {
      e.preventDefault();                                                                                                                                                                                   
      const btn    = document.getElementById('btn-submit'); 
      const isEdit = !!editId;                                                                                                                                                                              
      btn.disabled = true; btn.textContent = 'Saving…';
      const cat  = document.getElementById('f-category').value;                                                                                                                                             
      const paid = ['a8_paid','madegood_paid'].includes(cat);                                                                                                                                               
      const payload = {
        date:           document.getElementById('f-date').value,                                                                                                                                            
        entry_type:     document.getElementById('f-type').value,                                                                                                                                            
        category:       cat,
        creator_handle: paid ? (document.getElementById('f-handle').value.trim().replace(/^@/,'') || null) : null,                                                                                          
        description:    document.getElementById('f-description').value.trim() || null,                                                                                                                      
        amount:         parseFloat(document.getElementById('f-amount').value),
        notes:          document.getElementById('f-notes').value.trim() || null,                                                                                                                            
      };                                                                                                                                                                                                    
      const ok = isEdit ? await update(editId, payload) : await insert(payload);
      btn.disabled = false; btn.textContent = isEdit ? 'Save Changes' : 'Add Entry';                                                                                                                        
      if (!ok) { alert('Error saving — please try again.'); return; }                                                                                                                                       
      closeModal();                                                                                                                                                                                         
      await load();                                                                                                                                                                                         
    });                                                                                                                                                                                                     
                                                            
    document.getElementById('f-category').addEventListener('change', e => {                                                                                                                                 
      const show = ['a8_paid','madegood_paid'].includes(e.target.value);
      document.getElementById('field-handle').classList.toggle('hidden', !show);                                                                                                                            
    });                                                     
                                                                                                                                                                                                            
    document.getElementById('delete-cancel').addEventListener('click', closeDelete);
    document.getElementById('delete-overlay').addEventListener('click', e => {                                                                                                                              
      if (e.target.id === 'delete-overlay') closeDelete();  
    });                                                                                                                                                                                                     
    document.getElementById('delete-confirm').addEventListener('click', async () => {
      if (!deleteId) return;                                                                                                                                                                                
      await remove(deleteId);                               
      closeDelete();
      await load();                                                                                                                                                                                         
    });
                                                                                                                                                                                                            
    document.querySelectorAll('.cat-card').forEach(card => {
      card.addEventListener('click', () => {
        const cat = card.dataset.cat;
        if (catFilter === cat) {
          catFilter = null;                                                                                                                                                                                 
          card.classList.remove('selected');
          document.getElementById('filter-banner').classList.add('hidden');                                                                                                                                 
        } else {                                            
          catFilter = cat;                                                                                                                                                                                  
          document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');                                                                                                                                                                   
          setText('filter-banner-label', CATS[cat]);        
          document.getElementById('filter-banner').classList.remove('hidden');                                                                                                                              
          if (view !== 'table') switchView('table');
        }                                                                                                                                                                                                   
        renderTable();                                      
      });
    });

    document.getElementById('filter-clear').addEventListener('click', () => {                                                                                                                               
      catFilter = null;
      document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('selected'));                                                                                                                  
      document.getElementById('filter-banner').classList.add('hidden');
      renderTable();
    });
                                                                                                                                                                                                            
    document.querySelectorAll('.ttab').forEach(tab => {
      tab.addEventListener('click', () => {                                                                                                                                                                 
        document.querySelectorAll('.ttab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        typeFilter = tab.dataset.filter;                                                                                                                                                                    
        renderTable();
      });                                                                                                                                                                                                   
    });                                                     

    document.getElementById('search-input').addEventListener('input', e => {
      search = e.target.value;
      renderTable();
    });

    document.querySelectorAll('th.sh').forEach(th => {                                                                                                                                                      
      th.addEventListener('click', () => {
        const col = th.dataset.col;                                                                                                                                                                         
        if (sortCol === col) {                              
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';                                                                                                                                                     
        } else {
          sortCol = col;                                                                                                                                                                                    
          sortDir = col === 'amount' ? 'desc' : 'asc';      
        }
        renderTable();
      });                                                                                                                                                                                                   
    });
                                                                                                                                                                                                            
    document.getElementById('vt-table').addEventListener('click',    () => switchView('table'));
    document.getElementById('vt-calendar').addEventListener('click', () => switchView('calendar'));

    document.getElementById('cal-prev').addEventListener('click', () => {                                                                                                                                   
      if (--calM < 0) { calM = 11; calY--; }
      renderCal();                                                                                                                                                                                          
    });                                                     
    document.getElementById('cal-next').addEventListener('click', () => {
      if (++calM > 11) { calM = 0; calY++; }
      renderCal();                                                                                                                                                                                          
    });
    document.getElementById('cal-detail-close').addEventListener('click', () => {                                                                                                                           
      document.getElementById('cal-detail').classList.add('hidden');
    });
  }                                                                                                                                                                                                         
   
  function switchView(v) {                                                                                                                                                                                  
    view = v;                                               
    document.getElementById('vt-table').classList.toggle('active',    v === 'table');
    document.getElementById('vt-calendar').classList.toggle('active', v === 'calendar');
    document.getElementById('view-table').classList.toggle('hidden',    v !== 'table');                                                                                                                     
    document.getElementById('view-calendar').classList.toggle('hidden', v !== 'calendar');
    v === 'calendar' ? renderCal() : renderTable();                                                                                                                                                         
  }                                                         
                                                                                                                                                                                                            
  // ── Modal helpers ─────────────────────────────────────────────────────────────
  function openModal() {                                                                                                                                                                                    
    editId = null;                                          
    document.getElementById('modal-title').textContent = 'Add Entry';
    document.getElementById('btn-submit').textContent  = 'Add Entry';
    document.getElementById('entry-form').reset();                                                                                                                                                          
    document.getElementById('f-date').value = todayStr();
    document.getElementById('field-handle').classList.remove('hidden');                                                                                                                                     
    document.getElementById('modal-overlay').classList.remove('hidden');                                                                                                                                    
  }
  function openEditModal(entry) {                                                                                                                                                                           
    editId = entry.id;                                      
    document.getElementById('modal-title').textContent = 'Edit Entry';
    document.getElementById('btn-submit').textContent  = 'Save Changes';
    document.getElementById('entry-form').reset();                                                                                                                                                          
    document.getElementById('f-date').value        = entry.date;
    document.getElementById('f-type').value        = entry.entry_type;                                                                                                                                      
    document.getElementById('f-category').value    = entry.category;                                                                                                                                        
    document.getElementById('f-handle').value      = entry.creator_handle || '';
    document.getElementById('f-description').value = entry.description || '';                                                                                                                               
    document.getElementById('f-amount').value      = entry.amount;
    document.getElementById('f-notes').value       = entry.notes || '';                                                                                                                                     
    const showHandle = ['a8_paid','madegood_paid'].includes(entry.category);
    document.getElementById('field-handle').classList.toggle('hidden', !showHandle);                                                                                                                        
    document.getElementById('modal-overlay').classList.remove('hidden');                                                                                                                                    
  }
  function quickConvert(id) {                                                                                                                                                                               
    const entry = rows.find(r => String(r.id) === id);      
    if (!entry) return;                                                                                                                                                                                     
    openEditModal({ ...entry, entry_type: 'actual' });
    document.getElementById('modal-title').textContent = 'Convert to Actual';                                                                                                                               
  }                                                         
  function closeModal() {
    editId = null;                                                                                                                                                                                          
    document.getElementById('modal-overlay').classList.add('hidden');
  }                                                                                                                                                                                                         
  function openDelete(id) {                                 
    deleteId = id;
    document.getElementById('delete-overlay').classList.remove('hidden');
  }                                                                                                                                                                                                         
  function closeDelete() {
    deleteId = null;                                                                                                                                                                                        
    document.getElementById('delete-overlay').classList.add('hidden');
  }

  // ── Utilities ─────────────────────────────────────────────────────────────────
  function sum(arr) { return arr.reduce((s, r) => s + Number(r.amount), 0); }
  function fmt(n)   { return '$' + Math.round(n).toLocaleString('en-US'); }                                                                                                                                 
  function pad(n)   { return String(n).padStart(2, '0'); }
  function todayStr() { return new Date().toISOString().split('T')[0]; }                                                                                                                                    
                                                            
  function fmtDate(s) {                                                                                                                                                                                     
    if (!s) return '';                                      
    const [y, m, d] = s.split('-');
    return `${+m}/${+d}/${y}`;                                                                                                                                                                              
  }
  function fmtDateLong(s) {                                                                                                                                                                                 
    if (!s) return '';                                      
    return new Date(s + 'T12:00:00').toLocaleDateString('en-US',
      { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });                                                                                                                                 
  }
  function setText(id, val) {                                                                                                                                                                               
    const el = document.getElementById(id);                 
    if (el) el.textContent = val;                                                                                                                                                                           
  }
  function setStyle(id, prop, val) {                                                                                                                                                                        
    const el = document.getElementById(id);                 
    if (el) el.style[prop] = val;
  }
  function esc(s) {                                                                                                                                                                                         
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
