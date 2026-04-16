let allShifts   = [];
let currentTab  = 'all';
let currentPage = 1;
const PAGE_SIZE = 10;

// =============================================
// INIT
// =============================================

async function init() {
    // Φόρτωσε τμήματα στο dropdown
    const depts = await api.get('/departments');
    const sel   = document.getElementById('dept-filter');
    depts.forEach(d => {
        const opt = document.createElement('option');
        opt.value       = d.id;
        opt.textContent = d.name;
        sel.appendChild(opt);
    });
    await loadShifts();
}

async function loadShifts() {
    try {
        const deptId = document.getElementById('dept-filter').value;
        const url    = deptId ? `/shifts?dept_id=${deptId}` : '/shifts';
        allShifts    = await api.get(url);
        currentPage  = 1;
        filterAndRender();
    } catch (err) {
        document.getElementById('shifts-tbody').innerHTML =
            '<tr><td colspan="8" class="empty">Σφάλμα φόρτωσης</td></tr>';
    }
}

function switchTab(tab) {
    currentTab  = tab;
    currentPage = 1;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    const titles = { all: 'Όλες οι Βάρδιες', pending: 'Προσωρινές', finalized: 'Οριστικές' };
    document.getElementById('tab-title').textContent = titles[tab];
    filterAndRender();
}

function filterAndRender() {
    let filtered = allShifts;
    if (currentTab === 'pending')   filtered = filtered.filter(s => !s.is_finalized);
    if (currentTab === 'finalized') filtered = filtered.filter(s =>  s.is_finalized);
    document.getElementById('shifts-count').textContent = `${filtered.length} βάρδιες`;
    renderTable(filtered);
}

function renderTable(shifts) {
    const tbody = document.getElementById('shifts-tbody');
    const start = (currentPage - 1) * PAGE_SIZE;
    const page  = shifts.slice(start, start + PAGE_SIZE);

    if (!page.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">Δεν βρέθηκαν βάρδιες</td></tr>';
        renderPagination(0);
        return;
    }

    const TYPE_EL = { Morning: 'Πρωινή', Afternoon: 'Απογευματινή', Night: 'Νυχτερινή' };

    tbody.innerHTML = page.map(s => `
        <tr>
            <td><span class="mono">#${s.id}</span></td>
            <td><strong>${s.department}</strong></td>
            <td><span class="badge" style="background:${typeColor(s.type)};color:#fff;
                padding:2px 8px;border-radius:99px;font-size:11px">
                ${TYPE_EL[s.type] || s.type}
            </span></td>
            <td>${fmtDt(s.start_time)}</td>
            <td>${fmtDt(s.end_time)}</td>
            <td style="font-size:12px;color:var(--text-secondary)">
                🩺 ${s.doctors_count} &nbsp; 💊 ${s.nurses_count} &nbsp; 📋 ${s.admin_count}
            </td>
            <td>
                ${s.is_finalized
                    ? '<span style="color:var(--green);font-size:12px;font-weight:500">✓ Οριστική</span>'
                    : '<span style="color:var(--amber,#f59e0b);font-size:12px">⏳ Προσωρινή</span>'}
            </td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-outline" onclick="viewShift(${s.id})">Προβολή</button>
                    ${!s.is_finalized ? `
                        <button class="btn btn-sm btn-primary" onclick="manageStaff(${s.id})">Προσωπικό</button>
                        <button class="btn btn-sm btn-outline" onclick="finalizeShift(${s.id})">Οριστικοποίηση</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteShift(${s.id})">Διαγραφή</button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
    renderPagination(shifts.length);
}

function typeColor(type) {
    return type === 'Morning' ? '#3b82f6' : type === 'Afternoon' ? '#f59e0b' : '#6366f1';
}

function fmtDt(dt) {
    return new Date(dt).toLocaleString('el-GR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function renderPagination(total) {
    const pages = Math.ceil(total / PAGE_SIZE);
    const el    = document.getElementById('pagination');
    if (pages <= 1) { el.innerHTML = ''; return; }
    el.innerHTML = `
        <button class="btn btn-sm btn-outline" ${currentPage === 1 ? 'disabled' : ''}
            onclick="changePage(${currentPage - 1})">← Προηγ.</button>
        <span class="page-info">Σελίδα ${currentPage} / ${pages}</span>
        <button class="btn btn-sm btn-outline" ${currentPage === pages ? 'disabled' : ''}
            onclick="changePage(${currentPage + 1})">Επόμ. →</button>
    `;
}
function changePage(p) { currentPage = p; filterAndRender(); }

// =============================================
// VIEW
// =============================================

async function viewShift(id) {
    const s = await api.get(`/shifts/${id}`);
    const TYPE_EL = { Morning: 'Πρωινή', Afternoon: 'Απογευματινή', Night: 'Νυχτερινή' };

    document.getElementById('modal-title').textContent = `Βάρδια #${s.id}`;
    document.getElementById('modal-body').innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <span class="detail-label">Τμήμα</span>
                <strong>${s.department}</strong>
            </div>
            <div class="detail-item">
                <span class="detail-label">Τύπος</span>${TYPE_EL[s.type] || s.type}
            </div>
            <div class="detail-item">
                <span class="detail-label">Έναρξη</span>${fmtDt(s.start_time)}
            </div>
            <div class="detail-item">
                <span class="detail-label">Λήξη</span>${fmtDt(s.end_time)}
            </div>
            <div class="detail-item">
                <span class="detail-label">Κατάσταση</span>
                ${s.is_finalized ? '✓ Οριστική' : '⏳ Προσωρινή'}
            </div>
        </div>

        ${s.doctors?.length ? `
            <div style="margin-top:16px">
                <div class="card-title" style="margin-bottom:8px">🩺 Γιατροί (${s.doctors.length})</div>
                ${s.doctors.map(d => `
                    <div style="font-size:13px;padding:5px 0;border-bottom:1px solid var(--border)">
                        <strong>${d.last_name} ${d.first_name}</strong>
                        <span style="color:var(--text-secondary);margin-left:8px">
                            ${d.grade} · ${d.specialization}
                        </span>
                    </div>
                `).join('')}
            </div>
        ` : '<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">Δεν υπάρχουν γιατροί σε αυτή τη βάρδια.</div>'}

        ${s.nurses?.length ? `
            <div style="margin-top:16px">
                <div class="card-title" style="margin-bottom:8px">💊 Νοσηλευτές (${s.nurses.length})</div>
                ${s.nurses.map(n => `
                    <div style="font-size:13px;padding:5px 0;border-bottom:1px solid var(--border)">
                        <strong>${n.last_name} ${n.first_name}</strong>
                        <span style="color:var(--text-secondary);margin-left:8px">${n.grade}</span>
                    </div>
                `).join('')}
            </div>
        ` : ''}

        ${s.admins?.length ? `
            <div style="margin-top:16px">
                <div class="card-title" style="margin-bottom:8px">📋 Διοικητικοί (${s.admins.length})</div>
                ${s.admins.map(a => `
                    <div style="font-size:13px;padding:5px 0;border-bottom:1px solid var(--border)">
                        <strong>${a.last_name} ${a.first_name}</strong>
                        <span style="color:var(--text-secondary);margin-left:8px">${a.role}</span>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Κλείσιμο</button>
        ${!s.is_finalized ? `
            <button class="btn btn-primary" onclick="closeModal();manageStaff(${s.id})">Διαχείριση Προσωπικού</button>
            <button class="btn btn-outline" onclick="finalizeShift(${s.id})">Οριστικοποίηση</button>
        ` : ''}
    `;
    openModal();
}

// =============================================
// NEW SHIFT
// =============================================

const SHIFT_HOURS = {
    Morning:   { start: '07:00', end: '15:00' },
    Afternoon: { start: '15:00', end: '23:00' },
    Night:     { start: '23:00', end: '07:00' }
};

// State για νέα βάρδια
let _newShiftStaff    = { doctors: [], nurses: [], admins: [] };
let _allStaffForShift = { doctors: [], nurses: [], admins: [] };

async function newShift() {
    const depts = await api.get('/departments');
    _newShiftStaff = { doctors: [], nurses: [], admins: [] };

    document.getElementById('modal-title').textContent = 'Νέα Βάρδια';
    document.getElementById('modal-body').innerHTML = `
        <div class="form-grid" style="margin-bottom:20px">
            <div class="form-group form-full">
                <label>Τμήμα *</label>
                <select id="f-dept" class="form-input" onchange="onDeptChange()">
                    <option value="">— Επιλέξτε Τμήμα —</option>
                    ${depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Τύπος *</label>
                <select id="f-type" class="form-input" onchange="updateShiftTimes()">
                    <option value="Morning">Πρωινή (07:00–15:00)</option>
                    <option value="Afternoon">Απογευματινή (15:00–23:00)</option>
                    <option value="Night">Νυχτερινή (23:00–07:00)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Ημερομηνία Έναρξης *</label>
                <input id="f-date" type="date" class="form-input" onchange="updateShiftTimes()">
            </div>
            <div class="form-group form-full" style="background:var(--bg);border-radius:var(--radius-sm);
                padding:10px 14px;font-size:13px;color:var(--text-secondary)">
                <span id="shift-time-preview">Επιλέξτε τύπο και ημερομηνία</span>
            </div>
        </div>

        <!-- ΠΡΟΣΩΠΙΚΟ — εμφανίζεται μετά την επιλογή τμήματος -->
        <div id="staff-section" style="display:none">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">

                <div>
                    <div class="card-title" style="margin-bottom:8px">🩺 Γιατροί</div>
                    <input id="doc-search" type="text" class="form-input"
                        placeholder="Αναζήτηση..." oninput="searchNewStaff('doctors')"
                        style="margin-bottom:6px;font-size:12px">
                    <div id="doc-results" style="display:none;max-height:120px;overflow-y:auto;
                        border:1px solid var(--border);border-radius:var(--radius-sm);
                        background:var(--surface);margin-bottom:6px"></div>
                    <div id="doc-selected" style="display:flex;flex-wrap:wrap;gap:4px"></div>
                </div>

                <div>
                    <div class="card-title" style="margin-bottom:8px">💊 Νοσηλευτές</div>
                    <input id="nurse-search" type="text" class="form-input"
                        placeholder="Αναζήτηση..." oninput="searchNewStaff('nurses')"
                        style="margin-bottom:6px;font-size:12px">
                    <div id="nurse-results" style="display:none;max-height:120px;overflow-y:auto;
                        border:1px solid var(--border);border-radius:var(--radius-sm);
                        background:var(--surface);margin-bottom:6px"></div>
                    <div id="nurse-selected" style="display:flex;flex-wrap:wrap;gap:4px"></div>
                </div>

                <div>
                    <div class="card-title" style="margin-bottom:8px">📋 Διοικητικοί</div>
                    <input id="admin-search" type="text" class="form-input"
                        placeholder="Αναζήτηση..." oninput="searchNewStaff('admins')"
                        style="margin-bottom:6px;font-size:12px">
                    <div id="admin-results" style="display:none;max-height:120px;overflow-y:auto;
                        border:1px solid var(--border);border-radius:var(--radius-sm);
                        background:var(--surface);margin-bottom:6px"></div>
                    <div id="admin-selected" style="display:flex;flex-wrap:wrap;gap:4px"></div>
                </div>

            </div>
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="saveShift()">Δημιουργία</button>
    `;

    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('f-date').value = today;
    updateShiftTimes();
    openModal();
}

async function onDeptChange() {
    const deptId = document.getElementById('f-dept').value;
    if (!deptId) {
        document.getElementById('staff-section').style.display = 'none';
        return;
    }

    // Φόρτωσε προσωπικό που ανήκει στο τμήμα
    const allStaff = await api.get('/staff');
    _allStaffForShift.doctors = allStaff.filter(s => s.staff_type === 'Doctor' && s.department_id == deptId);
    _allStaffForShift.nurses  = allStaff.filter(s => s.staff_type === 'Nurse'  && s.department_id == deptId);
    _allStaffForShift.admins  = allStaff.filter(s => s.staff_type === 'Administration' && s.department_id == deptId);

    // Reset επιλογών
    _newShiftStaff = { doctors: [], nurses: [], admins: [] };
    ['doc-selected','nurse-selected','admin-selected'].forEach(id => {
        document.getElementById(id).innerHTML = '';
    });

    document.getElementById('staff-section').style.display = 'block';
}

function searchNewStaff(type) {
    const inputId   = type === 'doctors' ? 'doc-search'   : type === 'nurses' ? 'nurse-search'  : 'admin-search';
    const resultsId = type === 'doctors' ? 'doc-results'  : type === 'nurses' ? 'nurse-results' : 'admin-results';
    const q         = document.getElementById(inputId).value.toLowerCase();
    const results   = document.getElementById(resultsId);

    if (!q) { results.style.display = 'none'; return; }

    const pool = _allStaffForShift[type].filter(s =>
        (s.first_name + ' ' + s.last_name).toLowerCase().includes(q) &&
        !_newShiftStaff[type].find(x => x.id === s.id)
    ).slice(0, 8);

    if (!pool.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = pool.map(s => `
        <div onclick="selectNewStaff('${type}', ${s.id}, '${s.last_name} ${s.first_name}')"
            style="padding:7px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'"
            onmouseout="this.style.background=''">
            ${s.last_name} ${s.first_name}
        </div>
    `).join('');
}

function selectNewStaff(type, id, name) {
    if (_newShiftStaff[type].find(x => x.id === id)) return;
    _newShiftStaff[type].push({ id, name });

    const inputId   = type === 'doctors' ? 'doc-search'   : type === 'nurses' ? 'nurse-search'  : 'admin-search';
    const resultsId = type === 'doctors' ? 'doc-results'  : type === 'nurses' ? 'nurse-results' : 'admin-results';
    const selectedId= type === 'doctors' ? 'doc-selected' : type === 'nurses' ? 'nurse-selected': 'admin-selected';
    const color     = type === 'doctors' ? '#dbeafe'      : type === 'nurses' ? '#dcfce7'       : '#fef3c7';
    const textColor = type === 'doctors' ? 'var(--blue)'  : type === 'nurses' ? 'var(--green)'  : '#92400e';

    document.getElementById(inputId).value = '';
    document.getElementById(resultsId).style.display = 'none';
    renderNewStaffSelected(type, selectedId, color, textColor);
}

function removeNewStaff(type, id) {
    _newShiftStaff[type] = _newShiftStaff[type].filter(x => x.id !== id);
    const selectedId= type === 'doctors' ? 'doc-selected' : type === 'nurses' ? 'nurse-selected': 'admin-selected';
    const color     = type === 'doctors' ? '#dbeafe'      : type === 'nurses' ? '#dcfce7'       : '#fef3c7';
    const textColor = type === 'doctors' ? 'var(--blue)'  : type === 'nurses' ? 'var(--green)'  : '#92400e';
    renderNewStaffSelected(type, selectedId, color, textColor);
}

function renderNewStaffSelected(type, containerId, bg, color) {
    document.getElementById(containerId).innerHTML = _newShiftStaff[type].map(s => `
        <span style="display:inline-flex;align-items:center;gap:4px;background:${bg};color:${color};
                     padding:3px 8px;border-radius:99px;font-size:11px;font-weight:500">
            ${s.name}
            <button onclick="removeNewStaff('${type}', ${s.id})"
                style="background:none;border:none;cursor:pointer;color:${color};font-size:13px;line-height:1">✕</button>
        </span>
    `).join('');
}

function updateShiftTimes() {
    const type = document.getElementById('f-type')?.value;
    const date = document.getElementById('f-date')?.value;
    if (!type || !date) return;

    const hours = SHIFT_HOURS[type];
    const startDt = `${date} ${hours.start}:00`;
    let endDate = date;
    if (type === 'Night') {
        const d = new Date(date); d.setDate(d.getDate() + 1);
        endDate = d.toISOString().slice(0, 10);
    }
    const endDt = `${endDate} ${hours.end}:00`;

    document.getElementById('shift-time-preview').innerHTML =
        `⏰ <strong>Έναρξη:</strong> ${startDt} &nbsp;→&nbsp; <strong>Λήξη:</strong> ${endDt}`;

    window._shiftStartTime = startDt;
    window._shiftEndTime   = endDt;
}

async function saveShift() {
    const dept_id = document.getElementById('f-dept').value;
    const type    = document.getElementById('f-type').value;
    const date    = document.getElementById('f-date').value;

    if (!dept_id) { alert('Παρακαλώ επιλέξτε τμήμα'); return; }
    if (!date)    { alert('Παρακαλώ επιλέξτε ημερομηνία'); return; }

    updateShiftTimes();

    try {
        const result = await api.post('/shifts', {
            dept_id:    parseInt(dept_id),
            type,
            start_time: window._shiftStartTime,
            end_time:   window._shiftEndTime
        });

        const shiftId = result.id;

        // ← χρησιμοποίησε _newShiftStaff αντί window._newShiftStaff
        for (const s of _newShiftStaff.doctors)
            await api.post(`/shifts/${shiftId}/staff`, { staff_id: s.id, staff_type: 'doctor' });
        for (const s of _newShiftStaff.nurses)
            await api.post(`/shifts/${shiftId}/staff`, { staff_id: s.id, staff_type: 'nurse' });
        for (const s of _newShiftStaff.admins)
            await api.post(`/shifts/${shiftId}/staff`, { staff_id: s.id, staff_type: 'admin' });

        closeModal();
        loadShifts();
    } catch (err) {
        alert('Σφάλμα: ' + err.message);
    }
}

function toggleNewStaff(type, id, checked) {
    if (checked) window._newShiftStaff[type].add(id);
    else         window._newShiftStaff[type].delete(id);
}

function updateShiftTimes() {
    const type = document.getElementById('f-type')?.value;
    const date = document.getElementById('f-date')?.value;
    if (!type || !date) return;

    const hours = SHIFT_HOURS[type];
    const startDt = `${date} ${hours.start}:00`;

    let endDate = date;
    if (type === 'Night') {
        // +1 ημέρα για Night shift
        const d = new Date(date); d.setDate(d.getDate() + 1);
        endDate = d.toISOString().slice(0, 10);
    }
    const endDt = `${endDate} ${hours.end}:00`;

    document.getElementById('shift-time-preview').innerHTML =
        `⏰ <strong>Έναρξη:</strong> ${startDt} &nbsp;→&nbsp; <strong>Λήξη:</strong> ${endDt}`;

    window._shiftStartTime = startDt;
    window._shiftEndTime   = endDt;
}




// =============================================
// MANAGE STAFF
// =============================================



async function toggleStaff(shiftId, staffId, staffType, isAssigned, btn) {
    try {
        if (isAssigned) {
            await api.delete(`/shifts/${shiftId}/staff`, { staff_id: staffId, staff_type: staffType });
            btn.textContent = '+';
            btn.className   = 'btn btn-sm btn-outline';
            btn.setAttribute('onclick', `toggleStaff(${shiftId}, ${staffId}, '${staffType}', false, this)`);
        } else {
            await api.post(`/shifts/${shiftId}/staff`, { staff_id: staffId, staff_type: staffType });
            btn.textContent = '✕';
            btn.className   = 'btn btn-sm btn-danger';
            btn.setAttribute('onclick', `toggleStaff(${shiftId}, ${staffId}, '${staffType}', true, this)`);
        }
    } catch (err) {
        alert('Σφάλμα: ' + err.message);
    }
}

async function manageStaff(shiftId) {
    const [shift, allStaff] = await Promise.all([
        api.get(`/shifts/${shiftId}`),
        api.get('/staff')
    ]);

    const TYPE_EL = { Morning: 'Πρωινή', Afternoon: 'Απογευματινή', Night: 'Νυχτερινή' };
    const deptId  = shift.dept_id;

    // Φιλτράρισμα ανά τμήμα
    const allDocs   = allStaff.filter(s => s.staff_type === 'Doctor'         && s.department_id == deptId);
    const allNurses = allStaff.filter(s => s.staff_type === 'Nurse'          && s.department_id == deptId);
    const allAdmins = allStaff.filter(s => s.staff_type === 'Administration' && s.department_id == deptId);

    // Ήδη ανατεθειμένοι — ξεκινάμε από αυτούς
    let _assigned = {
        doctors: shift.doctors.map(d => ({ id: d.id, name: `${d.last_name} ${d.first_name}` })),
        nurses:  shift.nurses.map(n  => ({ id: n.id, name: `${n.last_name} ${n.first_name}` })),
        admins:  shift.admins.map(a  => ({ id: a.id, name: `${a.last_name} ${a.first_name}` }))
    };
    window._manageShiftId   = shiftId;
    window._manageAllStaff  = { doctors: allDocs, nurses: allNurses, admins: allAdmins };
    window._manageAssigned  = _assigned;

    document.getElementById('modal-title').textContent =
        `Προσωπικό — Βάρδια #${shiftId} · ${shift.department} · ${TYPE_EL[shift.type]}`;

    document.getElementById('modal-body').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">

            <div>
                <div class="card-title" style="margin-bottom:8px">🩺 Γιατροί</div>
                <input id="mgr-doc-search" type="text" class="form-input"
                    placeholder="Αναζήτηση..." oninput="searchManageStaff('doctors')"
                    style="margin-bottom:6px;font-size:12px">
                <div id="mgr-doc-results" style="display:none;max-height:120px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    background:var(--surface);margin-bottom:6px"></div>
                <div id="mgr-doc-selected" style="display:flex;flex-wrap:wrap;gap:4px"></div>
            </div>

            <div>
                <div class="card-title" style="margin-bottom:8px">💊 Νοσηλευτές</div>
                <input id="mgr-nurse-search" type="text" class="form-input"
                    placeholder="Αναζήτηση..." oninput="searchManageStaff('nurses')"
                    style="margin-bottom:6px;font-size:12px">
                <div id="mgr-nurse-results" style="display:none;max-height:120px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    background:var(--surface);margin-bottom:6px"></div>
                <div id="mgr-nurse-selected" style="display:flex;flex-wrap:wrap;gap:4px"></div>
            </div>

            <div>
                <div class="card-title" style="margin-bottom:8px">📋 Διοικητικοί</div>
                <input id="mgr-admin-search" type="text" class="form-input"
                    placeholder="Αναζήτηση..." oninput="searchManageStaff('admins')"
                    style="margin-bottom:6px;font-size:12px">
                <div id="mgr-admin-results" style="display:none;max-height:120px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    background:var(--surface);margin-bottom:6px"></div>
                <div id="mgr-admin-selected" style="display:flex;flex-wrap:wrap;gap:4px"></div>
            </div>

        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal();loadShifts()">Αποθήκευση</button>
        ${!shift.is_finalized ? `<button class="btn btn-primary" onclick="finalizeShift(${shiftId})">Οριστικοποίηση</button>` : ''}
    `;
    openModal();

    // Render ήδη ανατεθειμένων
    renderManageSelected('doctors');
    renderManageSelected('nurses');
    renderManageSelected('admins');
}

function searchManageStaff(type) {
    const inputId   = `mgr-${type === 'doctors' ? 'doc' : type === 'nurses' ? 'nurse' : 'admin'}-search`;
    const resultsId = `mgr-${type === 'doctors' ? 'doc' : type === 'nurses' ? 'nurse' : 'admin'}-results`;
    const q         = document.getElementById(inputId).value.toLowerCase();
    const results   = document.getElementById(resultsId);

    if (!q) { results.style.display = 'none'; return; }

    const pool = window._manageAllStaff[type].filter(s =>
        (s.first_name + ' ' + s.last_name).toLowerCase().includes(q) &&
        !window._manageAssigned[type].find(x => x.id === s.id)
    ).slice(0, 8);

    if (!pool.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = pool.map(s => `
        <div onclick="addManageStaff('${type}', ${s.id}, '${s.last_name} ${s.first_name}')"
            style="padding:7px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'"
            onmouseout="this.style.background=''">
            ${s.last_name} ${s.first_name}
        </div>
    `).join('');
}

async function addManageStaff(type, id, name) {
    const staffType = type === 'doctors' ? 'doctor' : type === 'nurses' ? 'nurse' : 'admin';
    try {
        await api.post(`/shifts/${window._manageShiftId}/staff`, { staff_id: id, staff_type: staffType });
        window._manageAssigned[type].push({ id, name });
        const inputId   = `mgr-${type === 'doctors' ? 'doc' : type === 'nurses' ? 'nurse' : 'admin'}-search`;
        const resultsId = `mgr-${type === 'doctors' ? 'doc' : type === 'nurses' ? 'nurse' : 'admin'}-results`;
        document.getElementById(inputId).value = '';
        document.getElementById(resultsId).style.display = 'none';
        renderManageSelected(type);
    } catch (err) { alert('Σφάλμα: ' + err.message); }
}

async function removeManageStaff(type, id) {
    const staffType = type === 'doctors' ? 'doctor' : type === 'nurses' ? 'nurse' : 'admin';
    try {
        await api.delete(`/shifts/${window._manageShiftId}/staff`, { staff_id: id, staff_type: staffType });
        window._manageAssigned[type] = window._manageAssigned[type].filter(s => s.id !== id);
        renderManageSelected(type);
    } catch (err) { alert('Σφάλμα: ' + err.message); }
}

function renderManageSelected(type) {
    const containerId = `mgr-${type === 'doctors' ? 'doc' : type === 'nurses' ? 'nurse' : 'admin'}-selected`;
    const bg    = type === 'doctors' ? '#dbeafe' : type === 'nurses' ? '#dcfce7' : '#fef3c7';
    const color = type === 'doctors' ? 'var(--blue)' : type === 'nurses' ? 'var(--green)' : '#92400e';

    document.getElementById(containerId).innerHTML = window._manageAssigned[type].map(s => `
        <span style="display:inline-flex;align-items:center;gap:4px;background:${bg};color:${color};
                     padding:3px 8px;border-radius:99px;font-size:11px;font-weight:500">
            ${s.name}
            <button onclick="removeManageStaff('${type}', ${s.id})"
                style="background:none;border:none;cursor:pointer;color:${color};font-size:13px;line-height:1">✕</button>
        </span>
    `).join('');
}

// =============================================
// FINALIZE / DELETE
// =============================================

async function finalizeShift(id) {
    if (!confirm('Οριστικοποίηση βάρδιας; Δεν θα μπορεί να τροποποιηθεί.')) return;
    try {
        await api.put(`/shifts/${id}/finalize`, {});
        closeModal();
        loadShifts();
    } catch (err) {
        alert('Σφάλμα: ' + err.message);
    }
}

async function deleteShift(id) {
    if (!confirm('Διαγραφή βάρδιας;')) return;
    try {
        await api.delete(`/shifts/${id}`, {});
        loadShifts();
    } catch (err) {
        alert('Σφάλμα: ' + err.message);
    }
}

function openModal()  { document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }

init();
