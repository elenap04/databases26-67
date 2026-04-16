let allHosp    = [];
let currentTab = 'all';
let currentPage = 1;
const PAGE_SIZE = 10;

// Search state
let selectedKEN = [];
let selectedICD = [];
let selectedDiscICD = [];
let allKEN = [];
let allICD = [];

async function loadHosp() {
    try {
        allHosp = await api.get('/hospitalizations');
        filterAndRender();
    } catch (err) {
        document.getElementById('hosp-tbody').innerHTML =
            '<tr><td colspan="7" class="empty">Σφάλμα φόρτωσης</td></tr>';
    }
}

function switchTab(tab) {
    currentTab  = tab;
    currentPage = 1;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    const titles = {
        all:       'Όλες οι Νοσηλείες',
        active:    'Ενεργές Νοσηλείες',
        completed: 'Ολοκληρωμένες Νοσηλείες'
    };
    document.getElementById('tab-title').textContent = titles[tab];
    filterAndRender();
}

function filterAndRender() {
    const q = document.getElementById('search-input').value.toLowerCase();
    let filtered = allHosp;
    if (currentTab === 'active')    filtered = filtered.filter(h => !h.discharge_date);
    if (currentTab === 'completed') filtered = filtered.filter(h =>  h.discharge_date);
    if (q) {
        filtered = filtered.filter(h =>
            h.patient_first_name.toLowerCase().includes(q) ||
            h.patient_last_name.toLowerCase().includes(q)  ||
            h.patient_amka.includes(q)
        );
    }
    renderTable(filtered);
}

function searchHosp() { currentPage = 1; filterAndRender(); }

function renderTable(hosps) {
    const tbody = document.getElementById('hosp-tbody');
    const start = (currentPage - 1) * PAGE_SIZE;
    const page  = hosps.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">Δεν βρέθηκαν νοσηλείες</td></tr>';
        renderPagination(0);
        return;
    }

    tbody.innerHTML = page.map(h => {
        const isActive = !h.discharge_date;
        return `
            <tr>
                <td><span class="mono">#${h.id}</span></td>
                <td>
                    <strong>${h.patient_last_name} ${h.patient_first_name}</strong><br>
                    <small style="color:var(--text-secondary)">${h.patient_amka}</small>
                </td>
                <td>${h.department}</td>
                <td>${new Date(h.admission_date).toLocaleDateString('el-GR')}</td>
                <td>${h.discharge_date
                    ? new Date(h.discharge_date).toLocaleDateString('el-GR')
                    : '<span style="color:var(--green);font-weight:500">-</span>'}</td>
                <td>${h.total_cost
                    ? Number(h.total_cost).toLocaleString('el-GR', {style:'currency',currency:'EUR'})
                    : '—'}</td>
               <td>
    <div class="action-btns">
        <button class="btn btn-sm btn-outline" onclick="viewHosp(${h.id})">Προβολή</button>
        ${isActive ? `<button class="btn btn-sm btn-danger" onclick="dischargeHosp(${h.id})">Έξοδος</button>` : ''}
        ${!isActive && h.evaluation_id ? `<button class="btn btn-sm btn-outline" onclick="viewEval(${h.id})">Προβολή Αξιολόγησης</button>` : ''}
    </div>
</td>
            </tr>
        `;
    }).join('');
    renderPagination(hosps.length);
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

function changePage(page) { currentPage = page; filterAndRender(); }

// =============================================
// VIEW
// =============================================

async function viewHosp(id) {
    try {
        const h = await api.get(`/hospitalizations/${id}`);
        document.getElementById('modal-title').textContent = `Νοσηλεία #${h.id}`;
        document.getElementById('modal-body').innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Ασθενής</span>
                    <strong>${h.patient_last_name} ${h.patient_first_name}</strong>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Τμήμα</span>${h.department}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Κλίνη</span>
                    <span class="mono">${h.bed_no}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Εισαγωγή</span>
                    ${new Date(h.admission_date).toLocaleDateString('el-GR')}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Έξοδος</span>
                    ${h.discharge_date ? new Date(h.discharge_date).toLocaleDateString('el-GR') : 'Ενεργή'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Συνολικό Κόστος</span>
                    ${h.total_cost ? Number(h.total_cost).toLocaleString('el-GR', {style:'currency',currency:'EUR'}) : '—'}
                </div>
            </div>

            ${h.admission_diagnoses?.length ? `
                <div style="margin-top:16px">
                    <div class="card-title" style="margin-bottom:8px">Διαγνώσεις Εισαγωγής</div>
                    ${h.admission_diagnoses.map(d => `
                        <div style="font-size:13px;padding:4px 0">
                            <span class="mono">${d.hosp_entry_code}</span> — ${d.description}
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${h.discharge_diagnoses?.length ? `
                <div style="margin-top:16px">
                    <div class="card-title" style="margin-bottom:8px">Διαγνώσεις Εξόδου</div>
                    ${h.discharge_diagnoses.map(d => `
                        <div style="font-size:13px;padding:4px 0">
                            <span class="mono">${d.hosp_entry_code}</span> — ${d.description}
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${h.ken?.length ? `
                <div style="margin-top:16px">
                    <div class="card-title" style="margin-bottom:8px">ΚΕΝ</div>
                    ${h.ken.map(k => `
                        <div style="font-size:13px;padding:4px 0">
                            <span class="mono">${k.code}</span> — Βάση: ${k.base_cost}€ · MDH: ${k.mdh} · Extra: ${k.daily_extra_charge}€/ημέρα
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${h.surgeries?.length ? `
                <div style="margin-top:16px">
                    <div class="card-title" style="margin-bottom:8px">Χειρουργεία (${h.surgeries.length})</div>
                    ${h.surgeries.map(s => `
                        <div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--border)">
                            <strong>${s.procedure_name}</strong>
                            <span style="color:var(--text-secondary);margin-left:8px">
                                ${new Date(s.start_time).toLocaleDateString('el-GR')} · 
                                ${s.surgeon_last_name} ${s.surgeon_first_name} · 
                                ${s.cost ? Number(s.cost).toLocaleString('el-GR', {style:'currency',currency:'EUR'}) : '—'}
                            </span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${h.lab_exams?.length ? `
                <div style="margin-top:16px">
                    <div class="card-title" style="margin-bottom:8px">Εργαστηριακές Εξετάσεις (${h.lab_exams.length})</div>
                    ${h.lab_exams.map(e => `
                        <div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--border)">
                            <strong>${e.type}</strong>
                            <span style="color:var(--text-secondary);margin-left:8px">
                                ${new Date(e.date).toLocaleDateString('el-GR')} · 
                                ${e.numeric_result ? e.numeric_result + ' ' + (e.unit || '') : e.text_result || '—'}
                            </span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${h.prescriptions?.length ? `
                <div style="margin-top:16px">
                    <div class="card-title" style="margin-bottom:8px">Συνταγές (${h.prescriptions.length})</div>
                    ${h.prescriptions.map(p => `
                        <div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--border)">
                            <strong>${p.medication}</strong>
                            <span style="color:var(--text-secondary);margin-left:8px">
                                ${p.dose} · ${p.freq} · 
                                ${new Date(p.pres_day).toLocaleDateString('el-GR')} — 
                                ${new Date(p.exp_date).toLocaleDateString('el-GR')}
                            </span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="closeModal()">Κλείσιμο</button>
            ${!h.discharge_date ? `<button class="btn btn-danger" onclick="dischargeHosp(${h.id})">Έξοδος Ασθενή</button>` : ''}
        `;
        openModal();
    } catch (err) {
        alert('Σφάλμα φόρτωσης: ' + err.message);
    }
}

async function viewEval(id) {
    try {
        const h = await api.get(`/hospitalizations/${id}`);
        document.getElementById('modal-title').textContent = `Αξιολόγηση Νοσηλείας #${id}`;
        document.getElementById('modal-body').innerHTML = h.evaluation ? `
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Ασθενής</span>
                    <strong>${h.patient_last_name} ${h.patient_first_name}</strong>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Τμήμα</span>${h.department}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Ιατρική Φροντίδα</span>
                    ${h.evaluation.qual_med_care}/5
                </div>
                <div class="detail-item">
                    <span class="detail-label">Νοσηλευτική Φροντίδα</span>
                    ${h.evaluation.qual_nurse_care}/5
                </div>
                <div class="detail-item">
                    <span class="detail-label">Καθαριότητα</span>
                    ${h.evaluation.cleanness}/5
                </div>
                <div class="detail-item">
                    <span class="detail-label">Φαγητό</span>
                    ${h.evaluation.food}/5
                </div>
                <div class="detail-item">
                    <span class="detail-label">Συνολική Εντύπωση</span>
                    ${h.evaluation.tot_experience}/5
                </div>
                <div class="detail-item">
                    <span class="detail-label">Μέσος Όρος</span>
                    ${((h.evaluation.qual_med_care + h.evaluation.qual_nurse_care + 
                        h.evaluation.cleanness + h.evaluation.food + 
                        h.evaluation.tot_experience) / 5).toFixed(1)}/5
                </div>
            </div>
        ` : '<div class="empty">Δεν υπάρχει αξιολόγηση</div>';

        document.getElementById('modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="closeModal()">Κλείσιμο</button>
        `;
        openModal();
    } catch (err) {
        alert('Σφάλμα φόρτωσης: ' + err.message);
    }
}


// =============================================
// SEARCH HELPERS — KEN & ICD
// =============================================

async function loadSearchData() {
    try { allKEN = await api.get('/ken'); }          catch(e) { allKEN = []; }
    try { allICD = await api.get('/hosp-entries'); }  catch(e) { allICD = []; }
    selectedKEN     = [];
    selectedICD     = [];
    selectedDiscICD = [];
}


function selectKEN(code) {
    if (selectedKEN.find(s => s.code === code)) return;
    selectedKEN.push({ code });
    document.getElementById('ken-search').value = '';
    document.getElementById('ken-results').style.display = 'none';
    renderSelectedKEN();
}

function removeKEN(code) {
    selectedKEN = selectedKEN.filter(s => s.code !== code);
    renderSelectedKEN();
}

function renderSelectedKEN() {
    document.getElementById('ken-selected').innerHTML = selectedKEN.map(s => `
        <span style="display:inline-flex;align-items:center;gap:6px;
                     background:#dbeafe;color:var(--blue);padding:4px 10px;
                     border-radius:99px;font-size:12px;font-weight:500">
            <span class="mono">${s.code}</span>
            <button onclick="removeKEN('${s.code}')"
                style="background:none;border:none;cursor:pointer;
                       color:var(--blue);font-size:14px;line-height:1">✕</button>
        </span>
    `).join('');
}

function searchICD(targetId) {
    const inputId   = targetId === 'icd' ? 'icd-search'       : 'disc-icd-search';
    const resultsId = targetId === 'icd' ? 'icd-results'      : 'disc-icd-results';
    const selected  = targetId === 'icd' ? selectedICD        : selectedDiscICD;

    const q       = document.getElementById(inputId).value.toLowerCase();
    const results = document.getElementById(resultsId);
    if (!q) { results.style.display = 'none'; return; }

    const filtered = allICD.filter(c =>
        (c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)) &&
        !selected.find(s => s.code === c.code)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(c => `
        <div onclick="selectICD('${c.code}', '${c.description.replace(/'/g, "\\'")}', '${targetId}')"
            style="padding:8px 12px;cursor:pointer;font-size:13px;
                   border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'"
            onmouseout="this.style.background=''">
            <span class="mono">${c.code}</span> — ${c.description}
        </div>
    `).join('');
}

function selectICD(code, description, targetId) {
    const selected  = targetId === 'icd' ? selectedICD    : selectedDiscICD;
    const inputId   = targetId === 'icd' ? 'icd-search'   : 'disc-icd-search';
    const resultsId = targetId === 'icd' ? 'icd-results'  : 'disc-icd-results';

    if (selected.find(s => s.code === code)) return;
    selected.push({ code, description });
    document.getElementById(inputId).value = '';
    document.getElementById(resultsId).style.display = 'none';

    if (targetId === 'icd') renderSelectedICD();
    else renderSelectedDiscICD();
}

function removeICD(code, targetId) {
    if (targetId === 'icd') {
        selectedICD = selectedICD.filter(s => s.code !== code);
        renderSelectedICD();
    } else {
        selectedDiscICD = selectedDiscICD.filter(s => s.code !== code);
        renderSelectedDiscICD();
    }
}

function renderSelectedICD() {
    document.getElementById('icd-selected').innerHTML = selectedICD.map(s => `
        <span style="display:inline-flex;align-items:center;gap:6px;
                     background:#dcfce7;color:var(--green);padding:4px 10px;
                     border-radius:99px;font-size:12px;font-weight:500">
            <span class="mono">${s.code}</span>
            <button onclick="removeICD('${s.code}', 'icd')"
                style="background:none;border:none;cursor:pointer;
                       color:var(--green);font-size:14px;line-height:1">✕</button>
        </span>
    `).join('');
}

function renderSelectedDiscICD() {
    document.getElementById('disc-icd-selected').innerHTML = selectedDiscICD.map(s => `
        <span style="display:inline-flex;align-items:center;gap:6px;
                     background:#ffe4e6;color:var(--rose);padding:4px 10px;
                     border-radius:99px;font-size:12px;font-weight:500">
            <span class="mono">${s.code}</span>
            <button onclick="removeICD('${s.code}', 'disc')"
                style="background:none;border:none;cursor:pointer;
                       color:var(--rose);font-size:14px;line-height:1">✕</button>
        </span>
    `).join('');
}

// =============================================
// NEW HOSPITALIZATION
// =============================================


let allPatients     = [];
let allTriageServed = [];
let selectedPatientId = null;
let selectedTriageId  = null;

function searchPatient() {
    const q       = document.getElementById('patient-search').value.toLowerCase();
    const results = document.getElementById('patient-results');
    if (!q) { results.style.display = 'none'; return; }

    const filtered = allPatients.filter(p =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q)  ||
        p.patient_amka.includes(q)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(p => `
        <div onclick="selectPatient(${p.id}, '${p.last_name} ${p.first_name}', '${p.patient_amka}')"
            style="padding:8px 12px;cursor:pointer;font-size:13px;
                   border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'"
            onmouseout="this.style.background=''">
            <strong>${p.last_name} ${p.first_name}</strong>
            <span style="color:var(--text-secondary);margin-left:8px">${p.patient_amka}</span>
        </div>
    `).join('');
}

function selectPatient(id, name, amka) {
    selectedPatientId = id;
    document.getElementById('f-patient').value = id;
    document.getElementById('patient-search').value = '';
    document.getElementById('patient-results').style.display = 'none';
    document.getElementById('patient-selected').innerHTML = `
        ✓ <strong>${name}</strong> <span style="color:var(--text-secondary)">${amka}</span>
        <button onclick="clearPatient()" style="background:none;border:none;cursor:pointer;
            color:var(--text-secondary);margin-left:6px">✕</button>
    `;
}

function clearPatient() {
    selectedPatientId = null;
    document.getElementById('f-patient').value = '';
    document.getElementById('patient-selected').innerHTML = '';
}

function searchTriage() {
    const q       = document.getElementById('triage-search').value.toLowerCase();
    const results = document.getElementById('triage-results');
    if (!q) { results.style.display = 'none'; return; }

    const filtered = allTriageServed.filter(t =>
        t.patient_last_name.toLowerCase().includes(q) ||
        t.patient_first_name.toLowerCase().includes(q)||
        t.patient_amka.includes(q) ||
        String(t.id).includes(q)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(t => `
        <div onclick="selectTriage(${t.id}, '${t.patient_last_name} ${t.patient_first_name}', ${t.urg_level})"
            style="padding:8px 12px;cursor:pointer;font-size:13px;
                   border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'"
            onmouseout="this.style.background=''">
            <span class="mono">#${t.id}</span>
            <strong style="margin-left:8px">${t.patient_last_name} ${t.patient_first_name}</strong>
            <span style="color:var(--text-secondary);margin-left:8px">
                Επίπεδο ${t.urg_level} · ${new Date(t.service_time).toLocaleDateString('el-GR')}
            </span>
        </div>
    `).join('');
}

function selectTriage(id, name, level) {
    selectedTriageId = id;
    document.getElementById('f-triage').value = id;
    document.getElementById('triage-search').value = '';
    document.getElementById('triage-results').style.display = 'none';
    document.getElementById('triage-selected').innerHTML = `
        ✓ <strong>#${id}</strong> — ${name}
        <span style="color:var(--text-secondary)">Επίπεδο ${level}</span>
        <button onclick="clearTriage()" style="background:none;border:none;cursor:pointer;
            color:var(--text-secondary);margin-left:6px">✕</button>
    `;
}

function clearTriage() {
    selectedTriageId = null;
    document.getElementById('f-triage').value = '';
    document.getElementById('triage-selected').innerHTML = '';
}

async function newHosp() {
    const depts  = await api.get('/departments');
    await loadSearchData();

    document.getElementById('modal-title').textContent = 'Νέα Νοσηλεία';
    document.getElementById('modal-body').innerHTML = `
        <div class="form-grid">

            <!-- ΑΣΘΕΝΗΣ — search -->
            <div class="form-group form-full">
                <label>Ασθενής *</label>
                <input id="patient-search" type="text" class="form-input"
                    placeholder="Αναζήτηση ονόματος ή ΑΜΚΑ..." oninput="searchPatient()">
                <div id="patient-results" style="display:none;max-height:150px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    margin-top:4px;background:var(--surface)"></div>
                <div id="patient-selected" style="margin-top:6px;font-size:13px;color:var(--blue)"></div>
                <input type="hidden" id="f-patient">
            </div>

            <!-- TRIAGE — search -->
            <div class="form-group form-full">
                <label>Triage Entry *</label>
                <input id="triage-search" type="text" class="form-input"
                    placeholder="Αναζήτηση triage..." oninput="searchTriage()">
                <div id="triage-results" style="display:none;max-height:150px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    margin-top:4px;background:var(--surface)"></div>
                <div id="triage-selected" style="margin-top:6px;font-size:13px;color:var(--blue)"></div>
                <input type="hidden" id="f-triage">
            </div>

            <div class="form-group">
                <label>Τμήμα Νοσηλείας *</label>
                <select id="f-dept" class="form-input" onchange="loadBeds()">
                    ${depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Κλίνη *</label>
                <select id="f-bed" class="form-input"></select>
            </div>

            <div class="form-group form-full">
                <label>Ημερομηνία Εισαγωγής *</label>
                <input id="f-admission" type="datetime-local" class="form-input" step="60">
            </div>

            <div class="form-group form-full">
                <label>Διαγνώσεις Εισαγωγής (ICD-10)</label>
                <input id="icd-search" type="text" class="form-input"
                    placeholder="Αναζήτηση κωδικού ή περιγραφής..." oninput="searchICD('icd')">
                <div id="icd-results" style="display:none;max-height:150px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    margin-top:4px;background:var(--surface)"></div>
                <div id="icd-selected" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
            </div>
        </div>
    `;
    
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="saveHosp()">Αποθήκευση</button>
    `;
    openModal();
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('f-admission').value = now.toISOString().slice(0, 16);
    loadBeds();

    // Φόρτωσε patients και triage για search
    allPatients = await api.get('/patients');
    allTriageServed = (await api.get('/triage')).filter(t => t.service_time);
}

async function saveHosp() {
    try {
        const triageVal = document.getElementById('f-triage').value;
        if (!triageVal) {
            alert('Παρακαλώ επιλέξτε Triage Entry');
            return;
        }
        const patientVal = document.getElementById('f-patient').value;
        if (!patientVal) {
            alert('Παρακαλώ επιλέξτε Ασθενή');
            return;
        }
        const admissionRaw = document.getElementById('f-admission').value;
        if (!admissionRaw) {
            alert('Παρακαλώ εισάγετε ημερομηνία εισαγωγής');
            return;
        }

        await api.post('/hospitalizations', {
            patient_id:           parseInt(patientVal),
            bed_dept_id:          parseInt(document.getElementById('f-dept').value),
            bed_no:               parseInt(document.getElementById('f-bed').value),
            admission_date:       admissionRaw.replace('T', ' '),
            triage_entry_id:      parseInt(triageVal),
            ken_codes:            [],
            admission_diag_codes: selectedICD.map(s => s.code)
        });

        document.getElementById('modal').classList.remove('open');
        loadHosp();
    } catch (err) {
        alert('Σφάλμα: ' + err.message);
    }
}

async function loadBeds() {
    const deptId = document.getElementById('f-dept')?.value;
    if (!deptId) return;
    const beds = await api.get(`/departments/${deptId}/beds`);
    const available = beds.filter(b => b.status === 'Available');
    document.getElementById('f-bed').innerHTML = available.length === 0
        ? '<option value="">Δεν υπάρχουν διαθέσιμες κλίνες</option>'
        : available.map(b => `<option value="${b.no}">${b.no} (${b.type})</option>`).join('');
}


function searchKEN() {
    const q       = document.getElementById('ken-search').value.toLowerCase();
    const results = document.getElementById('ken-results');
    if (!q) { results.style.display = 'none'; return; }

    const filtered = allKEN.filter(k =>
        k.code.toLowerCase().includes(q) &&
        !selectedKEN.find(s => s.code === k.code)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(k => `
        <div onclick="selectKEN('${k.code}')"
            style="padding:8px 12px;cursor:pointer;font-size:13px;
                   border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'"
            onmouseout="this.style.background=''">
            <span class="mono">${k.code}</span>
            <span style="color:var(--text-secondary);margin-left:8px">
                Βάση: ${k.base_cost}€ · MDH: ${k.mdh} · Extra: ${k.daily_extra_charge}€/ημέρα
            </span>
        </div>
    `).join('');
}

// =============================================
// DISCHARGE
// =============================================

async function dischargeHosp(id) {
    await loadSearchData();

    document.getElementById('modal-title').textContent = 'Έξοδος Ασθενή';
    document.getElementById('modal-body').innerHTML = `
        <div class="form-grid">
            <div class="form-group form-full">
                <label>Ημερομηνία Εξόδου *</label>
                <input id="f-discharge" type="datetime-local" class="form-input" step="60">
            </div>

            <div class="form-group form-full">
                <label>Κωδικοί ΚΕΝ</label>
                <input id="ken-search" type="text" class="form-input"
                    placeholder="Αναζήτηση ΚΕΝ..." oninput="searchKEN()">
                <div id="ken-results" style="display:none;max-height:150px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    margin-top:4px;background:var(--surface)"></div>
                <div id="ken-selected" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
            </div>

            <div class="form-group form-full">
                <label>Διαγνώσεις Εξόδου (ICD-10)</label>
                <input id="disc-icd-search" type="text" class="form-input"
                    placeholder="Αναζήτηση κωδικού ή περιγραφής..." oninput="searchICD('disc')">
                <div id="disc-icd-results" style="display:none;max-height:150px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    margin-top:4px;background:var(--surface)"></div>
                <div id="disc-icd-selected" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
            </div>
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-danger" onclick="confirmDischarge(${id})">Επιβεβαίωση Εξόδου</button>
    `;
    openModal();
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('f-discharge').value = now.toISOString().slice(0, 16);
}

async function confirmDischarge(id) {
    const dischargeRaw = document.getElementById('f-discharge').value;
    if (!dischargeRaw) {
        alert('Παρακαλώ εισάγετε ημερομηνία εξόδου');
        return;
    }
    try {
        await api.put(`/hospitalizations/${id}/discharge`, {
            discharge_date:       dischargeRaw.replace('T', ' '),
            discharge_diag_codes: selectedDiscICD.map(s => s.code),
            ken_codes:            selectedKEN.map(s => s.code)  // ← αυτό πρέπει να υπάρχει
        });
        document.getElementById('modal').classList.remove('open');
        loadHosp();
    } catch (err) {
        alert('Σφάλμα: ' + err.message);
    }
}

// =============================================
// EVALUATION
// =============================================

function openModal()  { document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }

loadHosp();
