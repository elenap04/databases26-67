let allAbsences = [];
let currentPage = 1;
const PAGE_SIZE = 10;

let _allStaff   = [];
let _selStaff   = null;

const REASONS = ['Annual Leave', 'Sick Leave', 'Other', 'Permanent Leave'];
const REASON_LABELS = {
    'Annual Leave':   'Κανονική Άδεια',
    'Sick Leave':     'Ασθένεια',
    'Other':          'Άλλο',
    'Permanent Leave':'Μόνιμη Άδεια'
};
const REASON_COLORS = {
    'Annual Leave':   { bg:'#dbeafe', color:'var(--blue)' },
    'Sick Leave':     { bg:'#fee2e2', color:'#dc2626' },
    'Other':          { bg:'#f3f4f6', color:'var(--text-secondary)' },
    'Permanent Leave':{ bg:'#fef3c7', color:'#d97706' }
};

// =============================================
// INIT
// =============================================

async function init() {
    await loadAbsences();
}

async function loadAbsences() {
    try {
        allAbsences = await api.get('/absences');
        currentPage = 1;
        renderTable();
    } catch (err) {
        document.getElementById('abs-tbody').innerHTML =
            '<tr><td colspan="6" class="empty">Σφάλμα φόρτωσης</td></tr>';
    }
}

function renderTable() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const filtered = q ? allAbsences.filter(a =>
        (a.last_name + ' ' + a.first_name).toLowerCase().includes(q) ||
        a.staff_amka.includes(q) ||
        REASON_LABELS[a.reason]?.toLowerCase().includes(q)
    ) : allAbsences;

    const tbody = document.getElementById('abs-tbody');
    const start = (currentPage - 1) * PAGE_SIZE;
    const page  = filtered.slice(start, start + PAGE_SIZE);

    if (!page.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Δεν βρέθηκαν απουσίες</td></tr>';
        renderPagination(0);
        return;
    }

    tbody.innerHTML = page.map(a => {
        const rc = REASON_COLORS[a.reason] || REASON_COLORS['Other'];
        const isActive = !a.end_time || new Date(a.end_time) > new Date();
        return `
        <tr>
            <td>
                <strong>${a.last_name} ${a.first_name}</strong>
                <div style="font-size:11px;color:var(--text-secondary)">${a.staff_type}</div>
            </td>
            <td>
                <span style="background:${rc.bg};color:${rc.color};
                    padding:2px 8px;border-radius:99px;font-size:11px">
                    ${REASON_LABELS[a.reason]}
                </span>
            </td>
            <td>${new Date(a.start_time).toLocaleDateString('el-GR')}</td>
            <td>${a.end_time ? new Date(a.end_time).toLocaleDateString('el-GR') : '—'}</td>
            <td>
                ${isActive
                    ? '<span style="background:#dcfce7;color:var(--green);padding:2px 8px;border-radius:99px;font-size:11px">● Ενεργή</span>'
                    : '<span style="background:#f3f4f6;color:var(--text-secondary);padding:2px 8px;border-radius:99px;font-size:11px">Λήξει</span>'
                }
            </td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-primary" onclick="editAbsence(${a.id})">Επεξεργασία</button>
                    <button class="btn btn-sm btn-danger"  onclick="deleteAbsence(${a.id})">Διαγραφή</button>
                </div>
            </td>
        </tr>
    `}).join('');
    renderPagination(filtered.length);
}

function renderPagination(total) {
    const pages = Math.ceil(total / PAGE_SIZE);
    const el    = document.getElementById('pagination');
    if (pages <= 1) { el.innerHTML = ''; return; }
    el.innerHTML = `
        <button class="btn btn-sm btn-outline" ${currentPage===1?'disabled':''}
            onclick="changePage(${currentPage-1})">← Προηγ.</button>
        <span class="page-info">Σελίδα ${currentPage} / ${pages}</span>
        <button class="btn btn-sm btn-outline" ${currentPage===pages?'disabled':''}
            onclick="changePage(${currentPage+1})">Επόμ. →</button>
    `;
}
function changePage(p) { currentPage = p; renderTable(); }
function searchAbsences() { currentPage = 1; renderTable(); }

// =============================================
// NEW
// =============================================

async function newAbsence() {
    _allStaff = await api.get('/staff');
    _selStaff = null;

    document.getElementById('modal-title').textContent = 'Νέα Απουσία';
    document.getElementById('modal-body').innerHTML = absenceForm({});
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="saveAbsence()">Αποθήκευση</button>
    `;

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    openModal();
    document.getElementById('f-start').value = now.toISOString().slice(0,16);
}

function absenceForm(a) {
    return `
        <div class="form-grid">

            <!-- ΠΡΟΣΩΠΙΚΟ -->
            <div class="form-group form-full">
                <label>Μέλος Προσωπικού *</label>
                <input id="f-staff-search" type="text" class="form-input"
                    placeholder="Αναζήτηση ονόματος ή ΑΜΚΑ..." oninput="searchAbsStaff()">
                <div id="f-staff-results" style="display:none;max-height:150px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    margin-top:4px;background:var(--surface)"></div>
                <div id="f-staff-selected" style="margin-top:6px;font-size:13px;color:var(--blue)">
                    ${a.staff_id ? `✓ <strong>${a.last_name} ${a.first_name}</strong>
                        <span style="color:var(--text-secondary);margin-left:6px">${a.staff_type}</span>` : ''}
                </div>
                <input type="hidden" id="f-staff-id" value="${a.staff_id || ''}">
            </div>

            <!-- ΑΙΤΙΑ -->
            <div class="form-group form-full">
                <label>Αιτία *</label>
                <select id="f-reason" class="form-input">
                    ${REASONS.map(r => `
                        <option value="${r}" ${a.reason === r ? 'selected' : ''}>${REASON_LABELS[r]}</option>
                    `).join('')}
                </select>
            </div>

            <!-- ΕΝΑΡΞΗ -->
            <div class="form-group">
                <label>Έναρξη *</label>
                <input id="f-start" type="datetime-local" class="form-input" step="60"
                    value="${a.start_time ? new Date(a.start_time).toISOString().slice(0,16) : ''}">
            </div>

            <!-- ΛΗΞΗ -->
            <div class="form-group">
                <label>Λήξη <small>(κενό = ανοιχτή)</small></label>
                <input id="f-end" type="datetime-local" class="form-input" step="60"
                    value="${a.end_time ? new Date(a.end_time).toISOString().slice(0,16) : ''}">
            </div>

        </div>
    `;
}

// Staff search
function searchAbsStaff() {
    const q       = document.getElementById('f-staff-search').value.toLowerCase();
    const results = document.getElementById('f-staff-results');
    if (!q) { results.style.display = 'none'; return; }

    const filtered = _allStaff.filter(s =>
        (s.first_name + ' ' + s.last_name).toLowerCase().includes(q) ||
        s.staff_amka.includes(q)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(s => `
        <div onclick="selectAbsStaff(${s.id}, '${s.last_name} ${s.first_name}', '${s.staff_type}')"
            style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
            <strong>${s.last_name} ${s.first_name}</strong>
            <span style="color:var(--text-secondary);margin-left:8px;font-size:11px">${s.staff_type}</span>
        </div>
    `).join('');
}

function selectAbsStaff(id, name, type) {
    _selStaff = id;
    document.getElementById('f-staff-id').value = id;
    document.getElementById('f-staff-search').value = '';
    document.getElementById('f-staff-results').style.display = 'none';
    document.getElementById('f-staff-selected').innerHTML = `
        ✓ <strong>${name}</strong>
        <span style="color:var(--text-secondary);margin-left:6px">${type}</span>
        <button onclick="clearAbsStaff()" style="background:none;border:none;cursor:pointer;
            color:var(--text-secondary);margin-left:6px">✕</button>
    `;
}

function clearAbsStaff() {
    _selStaff = null;
    document.getElementById('f-staff-id').value = '';
    document.getElementById('f-staff-selected').innerHTML = '';
}

// =============================================
// SAVE
// =============================================

async function saveAbsence(editId = null) {
    const staffId = document.getElementById('f-staff-id').value;
    const reason  = document.getElementById('f-reason').value;
    const start   = document.getElementById('f-start').value;
    const end     = document.getElementById('f-end').value;

    if (!staffId) { alert('Παρακαλώ επιλέξτε μέλος προσωπικού'); return; }
    if (!start)   { alert('Παρακαλώ εισάγετε ημερομηνία έναρξης'); return; }

    const payload = {
        staff_id:   parseInt(staffId),
        reason,
        start_time: start.replace('T',' '),
        end_time:   end ? end.replace('T',' ') : null
    };

    try {
        if (editId) await api.put(`/absences/${editId}`, payload);
        else        await api.post('/absences', payload);
        closeModal();
        loadAbsences();
    } catch (err) { alert('Σφάλμα: ' + err.message); }
}

// =============================================
// EDIT
// =============================================

async function editAbsence(id) {
    _allStaff = await api.get('/staff');
    const a   = await api.get(`/absences/${id}`);
    _selStaff = a.staff_id;

    document.getElementById('modal-title').textContent = `Επεξεργασία Απουσίας #${id}`;
    document.getElementById('modal-body').innerHTML = absenceForm(a);
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="saveAbsence(${id})">Αποθήκευση</button>
    `;
    openModal();
}

async function deleteAbsence(id) {
    if (!confirm('Διαγραφή απουσίας;')) return;
    try {
        await api.delete(`/absences/${id}`, {});
        loadAbsences();
    } catch (err) { alert('Σφάλμα: ' + err.message); }
}

function openModal()  { document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }

init();
