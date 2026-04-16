let currentTab  = 'procs';
let currentPage = 1;
const PAGE_SIZE = 10;
let allRecords  = [];

// Form state
let _allStaff     = [];
let _allPatients  = [];
let _mpEntriesA   = [];
let _mpEntriesB   = [];
let _clinRooms    = [];
let _formSelectedDoctors = [];
let _formSelectedNurses  = [];
let _formSingleDoctor    = null;
let _selectedMpCode      = null;

// =============================================
// INIT
// =============================================

async function init() {
    await loadRecords();
}

function switchTab(tab) {
    currentTab  = tab;
    currentPage = 1;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('tab-title').textContent =
        tab === 'procs' ? 'Ιατρικές Πράξεις' : 'Εργαστηριακές Εξετάσεις';
    loadRecords();
}

async function loadRecords() {
    try {
        const url = currentTab === 'procs' ? '/medical/procs' : '/medical/lab-exams';
        allRecords  = await api.get(url);
        currentPage = 1;
        renderTable();
    } catch (err) {
        document.getElementById('med-tbody').innerHTML =
            '<tr><td colspan="7" class="empty">Σφάλμα φόρτωσης</td></tr>';
    }
}

function renderTable() {
    const tbody = document.getElementById('med-tbody');
    const start = (currentPage - 1) * PAGE_SIZE;
    const page  = allRecords.slice(start, start + PAGE_SIZE);

    if (!page.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">Δεν βρέθηκαν εγγραφές</td></tr>';
        renderPagination(0);
        return;
    }

    if (currentTab === 'procs') {
        tbody.innerHTML = page.map(r => `
            <tr>
                <td><span class="mono">#${r.id}</span></td>
                <td><strong>${r.patient_last_name ?? '—'} ${r.patient_first_name ?? ''}</strong></td>
                <td>${r.procedure_name}</td>
                <td><span style="background:${r.category==='Diagnostic'?'#dbeafe':'#dcfce7'};
                    color:${r.category==='Diagnostic'?'var(--blue)':'var(--green)'};
                    padding:2px 8px;border-radius:99px;font-size:11px">${r.category}</span></td>
                <td>${r.date ? new Date(r.date).toLocaleDateString('el-GR') : '—'}</td>
                <td>${Number(r.cost).toLocaleString('el-GR',{style:'currency',currency:'EUR'})}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-sm btn-outline" onclick="viewProc(${r.id})">Προβολή</button>
                        <button class="btn btn-sm btn-primary" onclick="editProc(${r.id})">Επεξεργασία</button>
                        <button class="btn btn-sm btn-danger"  onclick="deleteProc(${r.id})">Διαγραφή</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = page.map(r => `
            <tr>
                <td><span class="mono">#${r.id}</span></td>
                <td><strong>${r.patient_last_name ?? '—'} ${r.patient_first_name ?? ''}</strong></td>
                <td>${r.type}</td>
                <td>${new Date(r.date).toLocaleDateString('el-GR')}</td>
                <td>${r.numeric_result ? r.numeric_result + ' ' + (r.unit||'') : r.text_result || '—'}</td>
                <td>${Number(r.cost).toLocaleString('el-GR',{style:'currency',currency:'EUR'})}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-sm btn-outline" onclick="viewLabExam(${r.id})">Προβολή</button>
                        <button class="btn btn-sm btn-primary" onclick="editLabExam(${r.id})">Επεξεργασία</button>
                        <button class="btn btn-sm btn-danger"  onclick="deleteLabExam(${r.id})">Διαγραφή</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    renderPagination(allRecords.length);
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

// =============================================
// LOAD META
// =============================================

async function loadFormMeta() {
    [_allPatients, _allStaff, _mpEntriesA, _mpEntriesB, _clinRooms] = await Promise.all([
        api.get('/patients'),
        api.get('/staff'),
        api.get('/medical/meta/mp-entries-a'),
        api.get('/medical/meta/mp-entries-b'),
        api.get('/medical/meta/clinical-rooms')
    ]);
}

// =============================================
// PATIENT SEARCH
// =============================================

function patientSearchHTML() {
    return `
        <div class="form-group form-full">
            <label>Ασθενής *</label>
            <input id="f-patient-search" type="text" class="form-input"
                placeholder="Αναζήτηση ονόματος ή ΑΜΚΑ..." oninput="searchFormPatient()">
            <div id="f-patient-results" style="display:none;max-height:150px;overflow-y:auto;
                border:1px solid var(--border);border-radius:var(--radius-sm);
                margin-top:4px;background:var(--surface)"></div>
            <div id="f-patient-selected" style="margin-top:6px;font-size:13px;color:var(--blue)"></div>
            <input type="hidden" id="f-patient-id">
        </div>
        <div class="form-group form-full" id="f-hosp-section" style="display:none">
            <label>Νοσηλεία <small>(προαιρετικό)</small></label>
            <select id="f-hosp-id" class="form-input">
                <option value="">— Χωρίς Νοσηλεία —</option>
            </select>
        </div>
    `;
}

function searchFormPatient() {
    const q       = document.getElementById('f-patient-search').value.toLowerCase();
    const results = document.getElementById('f-patient-results');
    if (!q) { results.style.display = 'none'; return; }

    const filtered = _allPatients.filter(p =>
        (p.first_name + ' ' + p.last_name).toLowerCase().includes(q) ||
        p.patient_amka.includes(q)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(p => `
        <div onclick="selectFormPatient(${p.id}, '${p.last_name} ${p.first_name}', '${p.patient_amka}')"
            style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
            <strong>${p.last_name} ${p.first_name}</strong>
            <span style="color:var(--text-secondary);margin-left:8px">${p.patient_amka}</span>
        </div>
    `).join('');
}

async function selectFormPatient(id, name, amka) {
    document.getElementById('f-patient-id').value = id;
    document.getElementById('f-patient-search').value = '';
    document.getElementById('f-patient-results').style.display = 'none';
    document.getElementById('f-patient-selected').innerHTML = `
        ✓ <strong>${name}</strong>
        <span style="color:var(--text-secondary)">${amka}</span>
        <button onclick="clearFormPatient()"
            style="background:none;border:none;cursor:pointer;color:var(--text-secondary);margin-left:6px">✕</button>
    `;
    try {
        const hosps  = await api.get('/hospitalizations');
        const active = hosps.filter(h => h.patient_id == id && !h.discharge_date);
        const sel    = document.getElementById('f-hosp-id');
        sel.innerHTML = '<option value="">— Χωρίς Νοσηλεία —</option>' +
            active.map(h => `<option value="${h.id}">
                #${h.id} · ${h.department} · ${new Date(h.admission_date).toLocaleDateString('el-GR')}
            </option>`).join('');
        document.getElementById('f-hosp-section').style.display = 'block';
    } catch(e) {}
}

function clearFormPatient() {
    document.getElementById('f-patient-id').value = '';
    document.getElementById('f-patient-selected').innerHTML = '';
    document.getElementById('f-hosp-section').style.display = 'none';
}

// =============================================
// STAFF SEARCH (multi)
// =============================================

function staffSearchHTML(label, inputId, resultsId, selectedId, type) {
    return `
        <div class="form-group form-full">
            <label>${label}</label>
            <input id="${inputId}" type="text" class="form-input"
                placeholder="Αναζήτηση..." oninput="searchFormStaff('${type}','${inputId}','${resultsId}','${selectedId}')">
            <div id="${resultsId}" style="display:none;max-height:120px;overflow-y:auto;
                border:1px solid var(--border);border-radius:var(--radius-sm);
                margin-top:4px;background:var(--surface)"></div>
            <div id="${selectedId}" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px"></div>
        </div>
    `;
}

function searchFormStaff(type, inputId, resultsId, selectedId) {
    const q        = document.getElementById(inputId).value.toLowerCase();
    const results  = document.getElementById(resultsId);
    if (!q) { results.style.display = 'none'; return; }

    const selected  = type === 'doctor' ? _formSelectedDoctors : _formSelectedNurses;
    const staffType = type === 'doctor' ? 'Doctor' : 'Nurse';

    const filtered = _allStaff.filter(s =>
        s.staff_type === staffType &&
        (s.first_name + ' ' + s.last_name).toLowerCase().includes(q) &&
        !selected.find(x => x.id === s.id)
    ).slice(0, 8);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(s => `
        <div onclick="selectFormStaff('${type}',${s.id},'${s.last_name} ${s.first_name}','${inputId}','${resultsId}','${selectedId}')"
            style="padding:7px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
            ${s.last_name} ${s.first_name}
        </div>
    `).join('');
}

function selectFormStaff(type, id, name, inputId, resultsId, selectedId) {
    const selected = type === 'doctor' ? _formSelectedDoctors : _formSelectedNurses;
    if (selected.find(x => x.id === id)) return;
    selected.push({ id, name });
    document.getElementById(inputId).value = '';
    document.getElementById(resultsId).style.display = 'none';
    renderFormStaffSelected(type, selectedId);
}

function removeFormStaff(type, id, selectedId) {
    if (type === 'doctor') _formSelectedDoctors = _formSelectedDoctors.filter(x => x.id !== id);
    else                   _formSelectedNurses  = _formSelectedNurses.filter(x => x.id !== id);
    renderFormStaffSelected(type, selectedId);
}

function renderFormStaffSelected(type, selectedId) {
    const selected = type === 'doctor' ? _formSelectedDoctors : _formSelectedNurses;
    const bg    = type === 'doctor' ? '#dbeafe' : '#dcfce7';
    const color = type === 'doctor' ? 'var(--blue)' : 'var(--green)';
    document.getElementById(selectedId).innerHTML = selected.map(s => `
        <span style="display:inline-flex;align-items:center;gap:4px;background:${bg};color:${color};
                     padding:3px 8px;border-radius:99px;font-size:11px;font-weight:500">
            ${s.name}
            <button onclick="removeFormStaff('${type}',${s.id},'${selectedId}')"
                style="background:none;border:none;cursor:pointer;color:${color};font-size:13px">✕</button>
        </span>
    `).join('');
}

// =============================================
// DOCTOR SINGLE SEARCH
// =============================================

function singleDoctorSearchHTML() {
    return `
        <div class="form-group form-full">
            <label>Γιατρός *</label>
            <input id="f-doctor-search" type="text" class="form-input"
                placeholder="Αναζήτηση γιατρού..." oninput="searchSingleDoctor()">
            <div id="f-doctor-results" style="display:none;max-height:120px;overflow-y:auto;
                border:1px solid var(--border);border-radius:var(--radius-sm);
                margin-top:4px;background:var(--surface)"></div>
            <div id="f-doctor-selected" style="margin-top:6px;font-size:13px;color:var(--blue)"></div>
            <input type="hidden" id="f-doctor-id">
        </div>
    `;
}

function searchSingleDoctor() {
    const q       = document.getElementById('f-doctor-search').value.toLowerCase();
    const results = document.getElementById('f-doctor-results');
    if (!q) { results.style.display = 'none'; return; }

    const filtered = _allStaff.filter(s =>
        s.staff_type === 'Doctor' &&
        (s.first_name + ' ' + s.last_name).toLowerCase().includes(q)
    ).slice(0, 8);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(s => `
        <div onclick="selectSingleDoctor(${s.id},'${s.last_name} ${s.first_name}')"
            style="padding:7px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
            ${s.last_name} ${s.first_name}
        </div>
    `).join('');
}

function selectSingleDoctor(id, name) {
    _formSingleDoctor = id;
    document.getElementById('f-doctor-id').value = id;
    document.getElementById('f-doctor-search').value = '';
    document.getElementById('f-doctor-results').style.display = 'none';
    document.getElementById('f-doctor-selected').innerHTML = `
        ✓ <strong>${name}</strong>
        <button onclick="clearSingleDoctor()"
            style="background:none;border:none;cursor:pointer;color:var(--text-secondary);margin-left:6px">✕</button>
    `;
}

function clearSingleDoctor() {
    _formSingleDoctor = null;
    document.getElementById('f-doctor-id').value = '';
    document.getElementById('f-doctor-selected').innerHTML = '';
}

// =============================================
// MP ENTRY SEARCH
// =============================================

function mpSearchHTML(type) {
    return `
        <div class="form-group form-full">
            <label>Κωδικός Πράξης *</label>
            <input id="f-mp-search" type="text" class="form-input"
                placeholder="Αναζήτηση κωδικού ή περιγραφής..." oninput="searchMp('${type}')">
            <div id="f-mp-results" style="display:none;max-height:120px;overflow-y:auto;
                border:1px solid var(--border);border-radius:var(--radius-sm);
                margin-top:4px;background:var(--surface)"></div>
            <div id="f-mp-selected" style="margin-top:6px;font-size:13px;color:var(--blue)"></div>
            <input type="hidden" id="f-mp-code">
        </div>
    `;
}

function searchMp(type) {
    const q       = document.getElementById('f-mp-search').value.toLowerCase();
    const results = document.getElementById('f-mp-results');
    const entries = type === 'A' ? _mpEntriesA : _mpEntriesB;
    if (!q) { results.style.display = 'none'; return; }

    const filtered = entries.filter(e =>
        e.description?.toLowerCase().includes(q) || e.code.toLowerCase().includes(q)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(e => `
        <div onclick="selectMp('${e.code}','${(e.description||'').replace(/'/g,"\\'")}')"
            style="padding:7px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
            <span class="mono">${e.code}</span>${e.description ? ' — ' + e.description : ''}
        </div>
    `).join('');
}

function selectMp(code, description) {
    _selectedMpCode = code;
    document.getElementById('f-mp-code').value = code;
    document.getElementById('f-mp-search').value = '';
    document.getElementById('f-mp-results').style.display = 'none';
    document.getElementById('f-mp-selected').innerHTML = `
        ✓ <span class="mono">${code}</span>${description ? ' — ' + description : ''}
        <button onclick="clearMp()"
            style="background:none;border:none;cursor:pointer;color:var(--text-secondary);margin-left:6px">✕</button>
    `;
}

function clearMp() {
    _selectedMpCode = null;
    document.getElementById('f-mp-code').value = '';
    document.getElementById('f-mp-selected').innerHTML = '';
}

// =============================================
// MED PROC — VIEW
// =============================================

async function viewProc(id) {
    const r = await api.get(`/medical/procs/${id}`);
    document.getElementById('modal-title').textContent = `Ιατρική Πράξη #${r.id}`;
    document.getElementById('modal-body').innerHTML = `
        <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Ασθενής</span>
                <strong>${r.patient_last_name ?? '—'} ${r.patient_first_name ?? ''}</strong></div>
            <div class="detail-item"><span class="detail-label">Τμήμα</span>${r.department}</div>
            <div class="detail-item"><span class="detail-label">Διαδικασία</span>${r.procedure_name}</div>
            <div class="detail-item"><span class="detail-label">Κατηγορία</span>${r.category}</div>
            <div class="detail-item"><span class="detail-label">Ημερομηνία</span>
                ${r.date ? new Date(r.date).toLocaleDateString('el-GR') : '—'}</div>
            <div class="detail-item"><span class="detail-label">Διάρκεια</span>
                ${r.duration ? r.duration + ' λεπτά' : '—'}</div>
            <div class="detail-item"><span class="detail-label">Κόστος</span>
                ${Number(r.cost).toLocaleString('el-GR',{style:'currency',currency:'EUR'})}</div>
            <div class="detail-item"><span class="detail-label">Αίθουσα</span>${r.clinical_room_type}</div>
        </div>
        ${r.doctors?.length ? `
            <div style="margin-top:16px">
                <div class="card-title" style="margin-bottom:8px">Γιατροί</div>
                ${r.doctors.map(d=>`<div style="font-size:13px;padding:4px 0">
                    ${d.last_name} ${d.first_name}</div>`).join('')}
            </div>` : ''}
        ${r.nurses?.length ? `
            <div style="margin-top:12px">
                <div class="card-title" style="margin-bottom:8px">Νοσηλευτές</div>
                ${r.nurses.map(n=>`<div style="font-size:13px;padding:4px 0">
                    ${n.last_name} ${n.first_name}</div>`).join('')}
            </div>` : ''}
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Κλείσιμο</button>
        <button class="btn btn-primary" onclick="editProc(${r.id})">Επεξεργασία</button>
    `;
    openModal();
}

// =============================================
// MED PROC — NEW
// =============================================

async function newProc() {
    await loadFormMeta();
    _formSelectedDoctors = [];
    _formSelectedNurses  = [];
    _selectedMpCode      = null;

    document.getElementById('modal-title').textContent = 'Νέα Ιατρική Πράξη';
    document.getElementById('modal-body').innerHTML = `
        <div class="form-grid">
            ${patientSearchHTML()}
            ${mpSearchHTML('A')}
            <div class="form-group">
                <label>Κατηγορία *</label>
                <select id="f-category" class="form-input">
                    <option value="Diagnostic">Diagnostic</option>
                    <option value="Therapeutic">Therapeutic</option>
                </select>
            </div>
            <div class="form-group">
                <label>Αίθουσα *</label>
                <select id="f-clin-room" class="form-input">
                    <option value="">— Επιλέξτε —</option>
                    ${_clinRooms.map(r=>`<option value="${r.id}">${r.type} #${r.id}</option>`).join('')}
                </select>
            </div>
            <div class="form-group form-full">
                <label>Ημερομηνία *</label>
                <input id="f-date" type="datetime-local" class="form-input" step="60">
            </div>
            <div class="form-group">
                <label>Διάρκεια (λεπτά)</label>
                <input id="f-duration" type="number" class="form-input" min="1" placeholder="προαιρετικό">
            </div>
            <div class="form-group">
                <label>Κόστος (€) *</label>
                <input id="f-cost" type="number" class="form-input" min="0" step="0.01">
            </div>
            ${staffSearchHTML('Γιατροί','f-doc-search','f-doc-results','f-doc-selected','doctor')}
            ${staffSearchHTML('Νοσηλευτές','f-nurse-search','f-nurse-results','f-nurse-selected','nurse')}
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="saveProc()">Αποθήκευση</button>
    `;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    openModal();
    document.getElementById('f-date').value = now.toISOString().slice(0,16);
}

async function saveProc(editId = null) {
    const patientId = document.getElementById('f-patient-id')?.value || null;
    const hospEl    = document.getElementById('f-hosp-id');
    const hospId    = hospEl?.value ? parseInt(hospEl.value) : null;
    const mpCode    = document.getElementById('f-mp-code').value;
    const category  = document.getElementById('f-category').value;
    const clinRoom  = document.getElementById('f-clin-room').value;
    const dateRaw   = document.getElementById('f-date').value;
    const duration  = document.getElementById('f-duration').value;
    const cost      = document.getElementById('f-cost').value;

    if (!mpCode)   { alert('Παρακαλώ επιλέξτε κωδικό πράξης'); return; }
    if (!clinRoom) { alert('Παρακαλώ επιλέξτε αίθουσα'); return; }
    if (!dateRaw)  { alert('Παρακαλώ εισάγετε ημερομηνία'); return; }
    if (!cost)     { alert('Παρακαλώ εισάγετε κόστος'); return; }

    const payload = {
        patient_id:         patientId ? parseInt(patientId) : null,
        hospitalization_id: hospId,
        mp_entryA_code:     mpCode,
        clinical_room_id:   parseInt(clinRoom),
        category,
        date:               dateRaw.replace('T',' '),
        duration:           duration ? parseInt(duration) : null,
        cost:               parseFloat(cost),
        doctor_ids:         _formSelectedDoctors.map(d => d.id),
        nurse_ids:          _formSelectedNurses.map(n => n.id)
    };

    try {
        if (editId) await api.put(`/medical/procs/${editId}`, payload);
        else        await api.post('/medical/procs', payload);
        closeModal();
        loadRecords();
    } catch (err) { alert('Σφάλμα: ' + err.message); }
}

// =============================================
// MED PROC — EDIT
// =============================================

async function editProc(id) {
    await loadFormMeta();
    const r = await api.get(`/medical/procs/${id}`);

    _formSelectedDoctors = r.doctors?.map(d=>({id:d.id,name:`${d.last_name} ${d.first_name}`}))||[];
    _formSelectedNurses  = r.nurses?.map(n=>({id:n.id,name:`${n.last_name} ${n.first_name}`}))||[];
    _selectedMpCode      = r.mp_entryA_code;

    document.getElementById('modal-title').textContent = `Επεξεργασία Ιατρικής Πράξης #${id}`;
    document.getElementById('modal-body').innerHTML = `
        <div class="form-grid">
            <div class="form-group form-full">
                <label>Νοσηλεία</label>
                <div style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);
                    border-radius:var(--radius-sm);font-size:13px">
                    ${r.hospitalization_id ? `#${r.hospitalization_id} · ${r.department}` : '—'}
                </div>
                <input type="hidden" id="f-hosp-id" value="${r.hospitalization_id || ''}">
            </div>
            ${mpSearchHTML('A')}
            <div class="form-group">
                <label>Κατηγορία *</label>
                <select id="f-category" class="form-input">
                    <option value="Diagnostic"  ${r.category==='Diagnostic'?'selected':''}>Diagnostic</option>
                    <option value="Therapeutic" ${r.category==='Therapeutic'?'selected':''}>Therapeutic</option>
                </select>
            </div>
            <div class="form-group">
                <label>Αίθουσα *</label>
                <select id="f-clin-room" class="form-input">
                    ${_clinRooms.map(cr=>`<option value="${cr.id}" ${cr.id==r.clinical_room_id?'selected':''}>
                        ${cr.type} #${cr.id}</option>`).join('')}
                </select>
            </div>
            <div class="form-group form-full">
                <label>Ημερομηνία *</label>
                <input id="f-date" type="datetime-local" class="form-input" step="60"
                    value="${r.date ? new Date(r.date).toISOString().slice(0,16) : ''}">
            </div>
            <div class="form-group">
                <label>Διάρκεια (λεπτά)</label>
                <input id="f-duration" type="number" class="form-input" value="${r.duration||''}">
            </div>
            <div class="form-group">
                <label>Κόστος (€) *</label>
                <input id="f-cost" type="number" class="form-input" step="0.01" value="${r.cost}">
            </div>
            ${staffSearchHTML('Γιατροί','f-doc-search','f-doc-results','f-doc-selected','doctor')}
            ${staffSearchHTML('Νοσηλευτές','f-nurse-search','f-nurse-results','f-nurse-selected','nurse')}
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="saveProc(${id})">Αποθήκευση</button>
    `;

    document.getElementById('f-mp-selected').innerHTML =
        `✓ <span class="mono">${r.mp_entryA_code}</span> — ${r.procedure_name}
         <button onclick="clearMp()" style="background:none;border:none;cursor:pointer;
             color:var(--text-secondary);margin-left:6px">✕</button>`;
    document.getElementById('f-mp-code').value = r.mp_entryA_code;

    renderFormStaffSelected('doctor','f-doc-selected');
    renderFormStaffSelected('nurse','f-nurse-selected');
    openModal();
}

async function deleteProc(id) {
    if (!confirm('Διαγραφή ιατρικής πράξης;')) return;
    try {
        await api.delete(`/medical/procs/${id}`, {});
        loadRecords();
    } catch (err) { alert('Σφάλμα: ' + err.message); }
}

// =============================================
// LAB EXAM — VIEW
// =============================================

async function viewLabExam(id) {
    const r = await api.get(`/medical/lab-exams/${id}`);
    document.getElementById('modal-title').textContent = `Εργαστηριακή Εξέταση #${r.id}`;
    document.getElementById('modal-body').innerHTML = `
        <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Ασθενής</span>
                <strong>${r.patient_last_name ?? '—'} ${r.patient_first_name ?? ''}</strong></div>
            <div class="detail-item"><span class="detail-label">Τμήμα</span>${r.department}</div>
            <div class="detail-item"><span class="detail-label">Τύπος</span>${r.type}</div>
            <div class="detail-item"><span class="detail-label">Ημερομηνία</span>
                ${new Date(r.date).toLocaleDateString('el-GR')}</div>
            <div class="detail-item"><span class="detail-label">Αποτέλεσμα</span>
                ${r.numeric_result ? r.numeric_result+' '+(r.unit||'') : r.text_result||'—'}</div>
            <div class="detail-item"><span class="detail-label">Κόστος</span>
                ${Number(r.cost).toLocaleString('el-GR',{style:'currency',currency:'EUR'})}</div>
            <div class="detail-item"><span class="detail-label">Γιατρός</span>
                ${r.doctor_last_name} ${r.doctor_first_name}</div>
            <div class="detail-item"><span class="detail-label">Αίθουσα</span>${r.clinical_room_type}</div>
            <div class="detail-item"><span class="detail-label">Κωδικός</span>
                <span class="mono">${r.mp_entryB_code}</span>
                ${r.mp_entry_desc ? ' — '+r.mp_entry_desc : ''}</div>
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Κλείσιμο</button>
        <button class="btn btn-primary" onclick="editLabExam(${r.id})">Επεξεργασία</button>
    `;
    openModal();
}

// =============================================
// LAB EXAM — NEW
// =============================================

async function newLabExam() {
    await loadFormMeta();
    _formSingleDoctor = null;
    _selectedMpCode   = null;

    document.getElementById('modal-title').textContent = 'Νέα Εργαστηριακή Εξέταση';
    document.getElementById('modal-body').innerHTML = `
        <div class="form-grid">
            ${patientSearchHTML()}
            <div class="form-group form-full">
                <label>Τύπος Εξέτασης *</label>
                <input id="f-type" type="text" class="form-input" placeholder="π.χ. Blood Test, MRI...">
            </div>
            ${mpSearchHTML('B')}
            <div class="form-group">
                <label>Ημερομηνία *</label>
                <input id="f-date" type="datetime-local" class="form-input" step="60">
            </div>
            <div class="form-group">
                <label>Αίθουσα *</label>
                <select id="f-clin-room" class="form-input">
                    <option value="">— Επιλέξτε —</option>
                    ${_clinRooms.map(r=>`<option value="${r.id}">${r.type} #${r.id}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Αριθμητικό Αποτέλεσμα</label>
                <input id="f-num-result" type="number" class="form-input" placeholder="προαιρετικό">
            </div>
            <div class="form-group">
                <label>Μονάδα</label>
                <input id="f-unit" type="text" class="form-input" placeholder="π.χ. mg/dL">
            </div>
            <div class="form-group form-full">
                <label>Κειμενικό Αποτέλεσμα</label>
                <input id="f-text-result" type="text" class="form-input" placeholder="προαιρετικό">
            </div>
            <div class="form-group">
                <label>Κόστος (€) *</label>
                <input id="f-cost" type="number" class="form-input" min="0" step="0.01">
            </div>
            ${singleDoctorSearchHTML()}
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="saveLabExam()">Αποθήκευση</button>
    `;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    openModal();
    document.getElementById('f-date').value = now.toISOString().slice(0,16);
}

async function saveLabExam(editId = null) {
    const patientId = document.getElementById('f-patient-id')?.value || null;
    const hospEl    = document.getElementById('f-hosp-id');
    const hospId    = hospEl?.value ? parseInt(hospEl.value) : null;
    const type      = document.getElementById('f-type')?.value;
    const mpCode    = document.getElementById('f-mp-code').value;
    const clinRoom  = document.getElementById('f-clin-room')?.value;
    const dateRaw   = document.getElementById('f-date')?.value;
    const numResult = document.getElementById('f-num-result')?.value;
    const unit      = document.getElementById('f-unit')?.value;
    const txtResult = document.getElementById('f-text-result')?.value;
    const cost      = document.getElementById('f-cost').value;
    const doctorId  = document.getElementById('f-doctor-id')?.value;

    if (!type)     { alert('Παρακαλώ εισάγετε τύπο εξέτασης'); return; }
    if (!mpCode)   { alert('Παρακαλώ επιλέξτε κωδικό'); return; }
    if (!clinRoom) { alert('Παρακαλώ επιλέξτε αίθουσα'); return; }
    if (!dateRaw)  { alert('Παρακαλώ επιλέξτε ημερομηνία'); return; }
    if (!cost)     { alert('Παρακαλώ εισάγετε κόστος'); return; }
    if (!doctorId) { alert('Παρακαλώ επιλέξτε γιατρό'); return; }

    const payload = {
        patient_id:         patientId ? parseInt(patientId) : null,
        hospitalization_id: hospId,
        mp_entryB_code:     mpCode,
        clinical_room_id:   parseInt(clinRoom),
        doctor_id:          parseInt(doctorId),
        type,
        date:               dateRaw.replace('T',' '),
        numeric_result:     numResult ? parseFloat(numResult) : null,
        text_result:        txtResult || null,
        unit:               unit || null,
        cost:               parseFloat(cost)
    };

    try {
        if (editId) await api.put(`/medical/lab-exams/${editId}`, payload);
        else        await api.post('/medical/lab-exams', payload);
        closeModal();
        loadRecords();
    } catch (err) { alert('Σφάλμα: ' + err.message); }
}

// =============================================
// LAB EXAM — EDIT
// =============================================

async function editLabExam(id) {
    await loadFormMeta();
    const r = await api.get(`/medical/lab-exams/${id}`);
    _formSingleDoctor = r.doctor_id;
    _selectedMpCode   = r.mp_entryB_code;

    document.getElementById('modal-title').textContent = `Επεξεργασία Εξέτασης #${id}`;
    document.getElementById('modal-body').innerHTML = `
        <div class="form-grid">
            <div class="form-group form-full">
                <label>Νοσηλεία</label>
                <div style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);
                    border-radius:var(--radius-sm);font-size:13px">
                    ${r.hospitalization_id ? `#${r.hospitalization_id} · ${r.department}` : '—'}
                </div>
                <input type="hidden" id="f-hosp-id" value="${r.hospitalization_id || ''}">
            </div>
            <div class="form-group form-full">
                <label>Τύπος Εξέτασης *</label>
                <input id="f-type" type="text" class="form-input" value="${r.type}">
            </div>
            ${mpSearchHTML('B')}
            <div class="form-group">
                <label>Ημερομηνία *</label>
                <input id="f-date" type="datetime-local" class="form-input" step="60"
                    value="${new Date(r.date).toISOString().slice(0,16)}">
            </div>
            <div class="form-group">
                <label>Αίθουσα *</label>
                <select id="f-clin-room" class="form-input">
                    ${_clinRooms.map(cr=>`<option value="${cr.id}" ${cr.id==r.clinical_room_id?'selected':''}>
                        ${cr.type} #${cr.id}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Αριθμητικό Αποτέλεσμα</label>
                <input id="f-num-result" type="number" class="form-input" value="${r.numeric_result||''}">
            </div>
            <div class="form-group">
                <label>Μονάδα</label>
                <input id="f-unit" type="text" class="form-input" value="${r.unit||''}">
            </div>
            <div class="form-group form-full">
                <label>Κειμενικό Αποτέλεσμα</label>
                <input id="f-text-result" type="text" class="form-input" value="${r.text_result||''}">
            </div>
            <div class="form-group">
                <label>Κόστος (€) *</label>
                <input id="f-cost" type="number" class="form-input" step="0.01" value="${r.cost}">
            </div>
            ${singleDoctorSearchHTML()}
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="saveLabExam(${id})">Αποθήκευση</button>
    `;

    document.getElementById('f-mp-selected').innerHTML =
        `✓ <span class="mono">${r.mp_entryB_code}</span>${r.mp_entry_desc?' — '+r.mp_entry_desc:''}
         <button onclick="clearMp()" style="background:none;border:none;cursor:pointer;
             color:var(--text-secondary);margin-left:6px">✕</button>`;
    document.getElementById('f-mp-code').value = r.mp_entryB_code;

    document.getElementById('f-doctor-selected').innerHTML =
        `✓ <strong>${r.doctor_last_name} ${r.doctor_first_name}</strong>
         <button onclick="clearSingleDoctor()" style="background:none;border:none;cursor:pointer;
             color:var(--text-secondary);margin-left:6px">✕</button>`;
    document.getElementById('f-doctor-id').value = r.doctor_id;

    openModal();
}

async function deleteLabExam(id) {
    if (!confirm('Διαγραφή εργαστηριακής εξέτασης;')) return;
    try {
        await api.delete(`/medical/lab-exams/${id}`, {});
        loadRecords();
    } catch (err) { alert('Σφάλμα: ' + err.message); }
}

function openModal()  { document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }

init();
