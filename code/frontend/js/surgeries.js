let allSurgeries = [];
let currentTab   = 'all';
let currentPage  = 1;
const PAGE_SIZE  = 10;

// Surgery form state
let _surgeryPatient    = null;
let _surgeryHosp       = null;
let _surgerySurgeon    = null;
let _surgeryAssistants = [];
let _allStaffForSurgery = [];

// =============================================
// INIT
// =============================================

async function init() {
    const depts = await api.get('/departments');
    const sel   = document.getElementById('dept-filter');
    depts.filter(d => d.name !== 'Emergency Department').forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id; opt.textContent = d.name;
        sel.appendChild(opt);
    });
    await loadSurgeries();
}

async function loadSurgeries() {
    try {
        const tab    = currentTab;
        const deptId = document.getElementById('dept-filter').value;
        let url = '/surgeries?';
        if (tab === 'emergency') url += 'type=emergency';
        else if (tab === 'regular') {
            url += 'type=regular';
            if (deptId) url += `&dept_id=${deptId}`;
        }
        allSurgeries = await api.get(url);
        currentPage  = 1;
        renderTable(allSurgeries);
    } catch (err) {
        document.getElementById('surg-tbody').innerHTML =
            '<tr><td colspan="8" class="empty">Σφάλμα φόρτωσης</td></tr>';
    }
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    const deptRow = document.getElementById('dept-filter-row');
    deptRow.style.display = tab === 'regular' ? 'flex' : 'none';

    const titles = {
        all:       'Όλα τα Χειρουργεία',
        emergency: 'Έκτακτα Χειρουργεία',
        regular:   'Προγραμματισμένα Χειρουργεία'
    };
    document.getElementById('tab-title').textContent = titles[tab];
    loadSurgeries();
}

function renderTable(surgeries) {
    const tbody = document.getElementById('surg-tbody');
    const start = (currentPage - 1) * PAGE_SIZE;
    const page  = surgeries.slice(start, start + PAGE_SIZE);

    if (!page.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">Δεν βρέθηκαν χειρουργεία</td></tr>';
        renderPagination(0);
        return;
    }

    tbody.innerHTML = page.map(s => `
        <tr>
            <td><span class="mono">#${s.id}</span></td>
            <td>
                <strong>${s.patient_last_name} ${s.patient_first_name}</strong>
            </td>
            <td>${s.procedure_name}</td>
            <td>${s.department}</td>
            <td>${new Date(s.start_time).toLocaleString('el-GR', {
                day:'2-digit', month:'2-digit', year:'numeric',
                hour:'2-digit', minute:'2-digit'
            })}</td>
            <td>${s.duration} λεπτά</td>
            <td>${Number(s.cost).toLocaleString('el-GR', {style:'currency', currency:'EUR'})}</td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-outline" onclick="viewSurgery(${s.id})">Προβολή</button>
                </div>
            </td>
        </tr>
    `).join('');
    renderPagination(surgeries.length);
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
function changePage(p) { currentPage = p; renderTable(allSurgeries); }

// =============================================
// VIEW
// =============================================

async function viewSurgery(id) {
    const s = await api.get(`/surgeries/${id}`);
    document.getElementById('modal-title').textContent = `Χειρουργείο #${s.id}`;
    document.getElementById('modal-body').innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <span class="detail-label">Ασθενής</span>
                <strong>${s.patient_last_name} ${s.patient_first_name}</strong>
            </div>
            <div class="detail-item">
                <span class="detail-label">Διαδικασία</span>${s.procedure_name}
            </div>
            <div class="detail-item">
                <span class="detail-label">Τμήμα</span>${s.department}
            </div>
            <div class="detail-item">
                <span class="detail-label">Αίθουσα</span>${s.operating_room_type} #${s.operating_room_id}
            </div>
            <div class="detail-item">
                <span class="detail-label">Κύριος Χειρουργός</span>
                ${s.surgeon_last_name} ${s.surgeon_first_name}
            </div>
            <div class="detail-item">
                <span class="detail-label">Έναρξη</span>
                ${new Date(s.start_time).toLocaleString('el-GR')}
            </div>
            <div class="detail-item">
                <span class="detail-label">Διάρκεια</span>${s.duration} λεπτά
            </div>
            <div class="detail-item">
                <span class="detail-label">Κόστος</span>
                ${Number(s.cost).toLocaleString('el-GR', {style:'currency',currency:'EUR'})}
            </div>
        </div>

        ${s.assistants?.length ? `
            <div style="margin-top:16px">
                <div class="card-title" style="margin-bottom:8px">Ομάδα Χειρουργείου</div>
                ${s.assistants.map(a => `
                    <div style="font-size:13px;padding:5px 0;border-bottom:1px solid var(--border)">
                        <strong>${a.last_name} ${a.first_name}</strong>
                        <span style="color:var(--text-secondary);margin-left:8px">${a.staff_type}</span>
                    </div>
                `).join('')}
            </div>
        ` : '<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">Δεν υπάρχει καταγεγραμμένη ομάδα χειρουργείου.</div>'}
    `;
    document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-outline" onclick="closeModal()">Κλείσιμο</button>
    ${!s.is_finalized ? `
        <button class="btn btn-primary" onclick="finalizeSurgery(${s.id})">Οριστικοποίηση</button>
    ` : '<span style="color:var(--green);font-size:13px">✓ Οριστικοποιημένο</span>'}
    `;
    openModal();
}

async function finalizeSurgery(id) {
    if (!confirm('Οριστικοποίηση χειρουργείου;')) return;
    try {
        await api.put(`/surgeries/${id}/finalize`, {});
        closeModal();
        loadSurgeries();
    } catch (err) {
        alert('Σφάλμα: ' + err.message);
    }
}

// =============================================
// NEW SURGERY
// =============================================

async function newSurgery(isEmergency = false) {
    const [depts, mpEntries, opRooms, allPatients, allStaff] = await Promise.all([
        api.get('/departments'),
        api.get('/surgeries/meta/mp-entries'),
        api.get('/surgeries/meta/operating-rooms'),
        api.get('/patients'),
        api.get('/staff')
    ]);

    const emergencyDept = depts.find(d => d.name === 'Emergency Department');
    const regularDepts  = depts.filter(d => d.name !== 'Emergency Department');

    _surgeryPatient    = null;
    _surgeryHosp       = null;
    _surgerySurgeon    = null;
    _surgeryAssistants = [];
    window._allPatients     = allPatients;
    window._allStaff        = allStaff;
    window._mpEntries        = mpEntries;
    window._isEmergency      = isEmergency;

    document.getElementById('modal-title').textContent =
        isEmergency ? 'Νέο Έκτακτο Χειρουργείο' : 'Νέο Προγραμματισμένο Χειρουργείο';

    document.getElementById('modal-body').innerHTML = `
        <div class="form-grid">

            <!-- ΑΣΘΕΝΗΣ -->
            <div class="form-group form-full">
                <label>Ασθενής *</label>
                <input id="surg-patient-search" type="text" class="form-input"
                    placeholder="Αναζήτηση ονόματος ή ΑΜΚΑ..." oninput="searchSurgeryPatient()">
                <div id="surg-patient-results" style="display:none;max-height:150px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    margin-top:4px;background:var(--surface)"></div>
                <div id="surg-patient-selected" style="margin-top:6px;font-size:13px;color:var(--blue)"></div>
                <input type="hidden" id="f-patient-id">
            </div>

            <!-- ΝΟΣΗΛΕΙΑ -->
            <div class="form-group form-full" id="hosp-section" style="display:none">
                <label>Νοσηλεία *</label>
                <select id="f-hosp" class="form-input" onchange="onHospChange()">
                    <option value="">— Επιλέξτε Νοσηλεία —</option>
                </select>
            </div>

            <!-- ΤΜΗΜΑ -->
            <div class="form-group form-full">
                <label>Τμήμα</label>
                ${isEmergency
                    ? `<div style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);
                            border-radius:var(--radius-sm);font-size:13px;color:var(--text-secondary)">
                            🏥 Emergency Department <small>(αυτόματη επιλογή)</small>
                       </div>
                       <input type="hidden" id="f-dept-id" value="${emergencyDept?.id || ''}">`
                    : `<select id="f-dept-id" class="form-input" onchange="onDeptChangeSurgery()">
                            <option value="">— Επιλέξτε Τμήμα —</option>
                            ${regularDepts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                       </select>`
                }
            </div>

            <!-- ΔΙΑΔΙΚΑΣΙΑ -->
            <div class="form-group form-full">
                <label>Ιατρική Διαδικασία *</label>
                <input id="surg-mp-search" type="text" class="form-input"
                    placeholder="Αναζήτηση διαδικασίας..." oninput="searchMpEntry()">
                <div id="surg-mp-results" style="display:none;max-height:150px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    margin-top:4px;background:var(--surface)"></div>
                <div id="surg-mp-selected" style="margin-top:6px;font-size:13px;color:var(--blue)"></div>
                <input type="hidden" id="f-mp-code">
            </div>

            <!-- ΑΙΘΟΥΣΑ -->
            <div class="form-group">
                <label>Αίθουσα Χειρουργείου *</label>
                <select id="f-op-room" class="form-input">
                    <option value="">— Επιλέξτε Αίθουσα —</option>
                    ${opRooms.map(r => `<option value="${r.id}">${r.type} #${r.id}</option>`).join('')}
                </select>
            </div>

            <!-- ΕΝΑΡΞΗ -->
            <div class="form-group">
                <label>Ημερομηνία & Ώρα Έναρξης *</label>
                <input id="f-start" type="datetime-local" class="form-input" step="60">
            </div>

            <!-- ΔΙΑΡΚΕΙΑ -->
            <div class="form-group">
                <label>Διάρκεια (λεπτά) *</label>
                <input id="f-duration" type="number" class="form-input" min="1" placeholder="π.χ. 90">
            </div>

            <!-- ΚΟΣΤΟΣ -->
            <div class="form-group">
                <label>Κόστος (€) *</label>
                <input id="f-cost" type="number" class="form-input" min="0" step="0.01" placeholder="π.χ. 1500.00">
            </div>

            <!-- ΚΥΡΙΟΣ ΧΕΙΡΟΥΡΓΟΣ -->
            <div class="form-group form-full">
                <label>Κύριος Χειρουργός *</label>
                <input id="surg-surgeon-search" type="text" class="form-input"
                    placeholder="Αναζήτηση γιατρού..." oninput="searchSurgeon()">
                <div id="surg-surgeon-results" style="display:none;max-height:150px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    margin-top:4px;background:var(--surface)"></div>
                <div id="surg-surgeon-selected" style="margin-top:6px;font-size:13px;color:var(--blue)"></div>
                <input type="hidden" id="f-surgeon-id">
            </div>

            <!-- ΟΜΑΔΑ ΧΕΙΡΟΥΡΓΕΙΟΥ -->
            <div class="form-group form-full">
                <label>Ομάδα Χειρουργείου <small>(γιατροί & νοσηλευτές)</small></label>
                <input id="surg-team-search" type="text" class="form-input"
                    placeholder="Αναζήτηση μέλους ομάδας..." oninput="searchSurgeryTeam()">
                <div id="surg-team-results" style="display:none;max-height:150px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    margin-top:4px;background:var(--surface)"></div>
                <div id="surg-team-selected" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
            </div>

        </div>
    `;

    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="saveSurgery()">Αποθήκευση</button>
    `;

    // Default start time
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('f-start').value = now.toISOString().slice(0, 16);

    // Load staff for emergency dept by default
    if (isEmergency && emergencyDept) {
        loadStaffForDept(emergencyDept.id);
    }

    openModal();
}

function onDeptChangeSurgery() {
    const deptId = document.getElementById('f-dept-id').value;
    if (!deptId) {
        window._surgeryDeptStaff = [];
        return;
    }
    loadStaffForDept(deptId);
}

function loadStaffForDept(deptId) {
    const allStaff = window._allStaff || [];
    window._surgeryDeptStaff = allStaff.filter(s =>
        (s.staff_type === 'Doctor' || s.staff_type === 'Nurse') &&
        s.department_id == deptId
    );
}

// Patient search
function searchSurgeryPatient() {
    const q       = document.getElementById('surg-patient-search').value.toLowerCase();
    const results = document.getElementById('surg-patient-results');
    if (!q) { results.style.display = 'none'; return; }

    const filtered = (window._allPatients || []).filter(p =>
        (p.first_name + ' ' + p.last_name).toLowerCase().includes(q) ||
        p.patient_amka.includes(q)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(p => `
        <div onclick="selectSurgeryPatient(${p.id}, '${p.last_name} ${p.first_name}', '${p.patient_amka}')"
            style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
            <strong>${p.last_name} ${p.first_name}</strong>
            <span style="color:var(--text-secondary);margin-left:8px">${p.patient_amka}</span>
        </div>
    `).join('');
}

async function selectSurgeryPatient(id, name, amka) {
    document.getElementById('f-patient-id').value = id;
    document.getElementById('surg-patient-search').value = '';
    document.getElementById('surg-patient-results').style.display = 'none';
    document.getElementById('surg-patient-selected').innerHTML = `
        ✓ <strong>${name}</strong>
        <span style="color:var(--text-secondary)">${amka}</span>
        <button onclick="clearSurgeryPatient()"
            style="background:none;border:none;cursor:pointer;color:var(--text-secondary);margin-left:6px">✕</button>
    `;

    // Φόρτωσε ενεργές νοσηλείες του ασθενή
    try {
        const hosps = await api.get(`/hospitalizations`);
        const active = hosps.filter(h => h.patient_id == id && !h.discharge_date);
        const sel = document.getElementById('f-hosp');
        sel.innerHTML = '<option value="">— Επιλέξτε Νοσηλεία —</option>' +
            active.map(h => `<option value="${h.id}">
                #${h.id} · ${h.department} · ${new Date(h.admission_date).toLocaleDateString('el-GR')}
            </option>`).join('');
        document.getElementById('hosp-section').style.display = 'block';
    } catch(e) {}
}

function clearSurgeryPatient() {
    document.getElementById('f-patient-id').value = '';
    document.getElementById('surg-patient-selected').innerHTML = '';
    document.getElementById('hosp-section').style.display = 'none';
}

// MP Entry search
function searchMpEntry() {
    const q       = document.getElementById('surg-mp-search').value.toLowerCase();
    const results = document.getElementById('surg-mp-results');
    if (!q) { results.style.display = 'none'; return; }

    const filtered = (window._mpEntries || []).filter(mp =>
        mp.description.toLowerCase().includes(q) || mp.code.toLowerCase().includes(q)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(mp => `
    <div onclick="selectMpEntry('${mp.code}', '${mp.description.replace(/'/g, "\\'")}')"
        style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
        onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
        <span class="mono">${mp.code}</span> — ${mp.description}
    </div>
`).join('');
}

function selectMpEntry(code, description) {
    document.getElementById('f-mp-code').value = code;
    document.getElementById('surg-mp-search').value = '';
    document.getElementById('surg-mp-results').style.display = 'none';
    document.getElementById('surg-mp-selected').innerHTML = `
        ✓ <span class="mono">${code}</span> — ${description}
        <button onclick="clearMpEntry()"
            style="background:none;border:none;cursor:pointer;color:var(--text-secondary);margin-left:6px">✕</button>
    `;
}

function clearMpEntry() {
    document.getElementById('f-mp-code').value = '';
    document.getElementById('surg-mp-selected').innerHTML = '';
}

// Surgeon search
function searchSurgeon() {
    const q       = document.getElementById('surg-surgeon-search').value.toLowerCase();
    const results = document.getElementById('surg-surgeon-results');
    if (!q) { results.style.display = 'none'; return; }

    const deptStaff = window._surgeryDeptStaff || window._allStaff || [];
    const filtered = deptStaff.filter(s =>
        s.staff_type === 'Doctor' &&
        (s.first_name + ' ' + s.last_name).toLowerCase().includes(q)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(s => `
        <div onclick="selectSurgeon(${s.id}, '${s.last_name} ${s.first_name}')"
            style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
            ${s.last_name} ${s.first_name}
        </div>
    `).join('');
}

function selectSurgeon(id, name) {
    document.getElementById('f-surgeon-id').value = id;
    document.getElementById('surg-surgeon-search').value = '';
    document.getElementById('surg-surgeon-results').style.display = 'none';
    document.getElementById('surg-surgeon-selected').innerHTML = `
        ✓ <strong>${name}</strong>
        <button onclick="clearSurgeon()"
            style="background:none;border:none;cursor:pointer;color:var(--text-secondary);margin-left:6px">✕</button>
    `;
}

function clearSurgeon() {
    document.getElementById('f-surgeon-id').value = '';
    document.getElementById('surg-surgeon-selected').innerHTML = '';
}

// Team search
function searchSurgeryTeam() {
    const q       = document.getElementById('surg-team-search').value.toLowerCase();
    const results = document.getElementById('surg-team-results');
    if (!q) { results.style.display = 'none'; return; }

    const deptStaff = window._surgeryDeptStaff || window._allStaff || [];
    const surgeonId = parseInt(document.getElementById('f-surgeon-id').value);

    const filtered = deptStaff.filter(s =>
        (s.staff_type === 'Doctor' || s.staff_type === 'Nurse') &&
        (s.first_name + ' ' + s.last_name).toLowerCase().includes(q) &&
        s.id !== surgeonId &&
        !_surgeryAssistants.find(a => a.id === s.id)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(s => `
        <div onclick="selectTeamMember(${s.id}, '${s.last_name} ${s.first_name}', '${s.staff_type}')"
            style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
            ${s.last_name} ${s.first_name}
            <span style="color:var(--text-secondary);margin-left:8px;font-size:11px">${s.staff_type}</span>
        </div>
    `).join('');
}

function selectTeamMember(id, name, type) {
    if (_surgeryAssistants.find(a => a.id === id)) return;
    _surgeryAssistants.push({ id, name, type });
    document.getElementById('surg-team-search').value = '';
    document.getElementById('surg-team-results').style.display = 'none';
    renderTeamSelected();
}

function removeTeamMember(id) {
    _surgeryAssistants = _surgeryAssistants.filter(a => a.id !== id);
    renderTeamSelected();
}

function renderTeamSelected() {
    document.getElementById('surg-team-selected').innerHTML = _surgeryAssistants.map(a => `
        <span style="display:inline-flex;align-items:center;gap:4px;
                     background:#dbeafe;color:var(--blue);padding:4px 10px;
                     border-radius:99px;font-size:12px;font-weight:500">
            ${a.name} <small>(${a.type})</small>
            <button onclick="removeTeamMember(${a.id})"
                style="background:none;border:none;cursor:pointer;color:var(--blue);font-size:13px">✕</button>
        </span>
    `).join('');
}

// =============================================
// SAVE
// =============================================

async function saveSurgery() {
    const patientId = document.getElementById('f-patient-id').value;
    const hospId    = document.getElementById('f-hosp')?.value || null;
    const mpCode    = document.getElementById('f-mp-code').value;
    const opRoomId  = document.getElementById('f-op-room').value;
    const startRaw  = document.getElementById('f-start').value;
    const duration  = document.getElementById('f-duration').value;
    const cost      = document.getElementById('f-cost').value;
    const surgeonId = document.getElementById('f-surgeon-id').value;

    if (!patientId) { alert('Παρακαλώ επιλέξτε ασθενή'); return; }
    if (!mpCode)    { alert('Παρακαλώ επιλέξτε ιατρική διαδικασία'); return; }
    if (!opRoomId)  { alert('Παρακαλώ επιλέξτε αίθουσα χειρουργείου'); return; }
    if (!startRaw)  { alert('Παρακαλώ επιλέξτε ημερομηνία έναρξης'); return; }
    if (!duration)  { alert('Παρακαλώ εισάγετε διάρκεια'); return; }
    if (!cost)      { alert('Παρακαλώ εισάγετε κόστος'); return; }
    if (!surgeonId) { alert('Παρακαλώ επιλέξτε κύριο χειρουργό'); return; }

    try {
        await api.post('/surgeries', {
            patient_id:         parseInt(patientId),
            hospitalization_id: hospId ? parseInt(hospId) : null,
            operating_room_id:  parseInt(opRoomId),
            doctor_id:          parseInt(surgeonId),
            mp_entryA_code:     mpCode,
            start_time:         startRaw.replace('T', ' '),
            duration:           parseInt(duration),
            cost:               parseFloat(cost),
            assistant_ids:      _surgeryAssistants.map(a => a.id)
        });
        closeModal();
        loadSurgeries();
    } catch (err) {
        alert('Σφάλμα: ' + err.message);
    }
}

function openModal()  { document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }

init();
