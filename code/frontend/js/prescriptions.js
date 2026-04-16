let allPrescriptions = [];
let currentPage = 1;
const PAGE_SIZE = 10;

// form state
let _allPatients  = [];
let _allDoctors   = [];
let _allMeds      = [];
let _selPatient   = null;
let _selDoctor    = null;
let _selMed       = null;

// =============================================
// INIT
// =============================================

async function init() {
    await loadPrescriptions();
}

async function loadPrescriptions() {
    try {
        allPrescriptions = await api.get('/prescriptions');
        currentPage = 1;
        renderTable();
    } catch (err) {
        document.getElementById('pres-tbody').innerHTML =
            '<tr><td colspan="7" class="empty">Σφάλμα φόρτωσης</td></tr>';
    }
}

function renderTable() {
    const q      = document.getElementById('search-input').value.toLowerCase();
    const filtered = q ? allPrescriptions.filter(p =>
        (p.patient_last_name + ' ' + p.patient_first_name).toLowerCase().includes(q) ||
        p.patient_amka.includes(q) ||
        p.medication.toLowerCase().includes(q)
    ) : allPrescriptions;

    const tbody = document.getElementById('pres-tbody');
    const start = (currentPage - 1) * PAGE_SIZE;
    const page  = filtered.slice(start, start + PAGE_SIZE);

    if (!page.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">Δεν βρέθηκαν συνταγές</td></tr>';
        renderPagination(0);
        return;
    }

    tbody.innerHTML = page.map(r => `
        <tr>
            <td><span class="mono">#${r.id}</span></td>
            <td><strong>${r.patient_last_name} ${r.patient_first_name}</strong>
                <div style="font-size:11px;color:var(--text-secondary)">${r.patient_amka}</div></td>
            <td>${r.medication}</td>
            <td>${r.dose} · ${r.freq}</td>
            <td>${new Date(r.pres_day).toLocaleDateString('el-GR')}</td>
            <td>${new Date(r.exp_date).toLocaleDateString('el-GR')}</td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-outline" onclick="viewPrescription(${r.id})">Προβολή</button>
                    <button class="btn btn-sm btn-primary" onclick="editPrescription(${r.id})">Επεξεργασία</button>
                    <button class="btn btn-sm btn-danger"  onclick="deletePrescription(${r.id})">Διαγραφή</button>
                </div>
            </td>
        </tr>
    `).join('');
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
function searchPrescriptions() { currentPage = 1; renderTable(); }

// =============================================
// VIEW
// =============================================

async function viewPrescription(id) {
    const r = await api.get(`/prescriptions/${id}`);
    document.getElementById('modal-title').textContent = `Συνταγή #${r.id}`;
    document.getElementById('modal-body').innerHTML = `
        <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Ασθενής</span>
                <strong>${r.patient_last_name} ${r.patient_first_name}</strong>
                <span class="mono" style="margin-left:6px;font-size:11px">${r.patient_amka}</span></div>
            <div class="detail-item"><span class="detail-label">Γιατρός</span>
                ${r.doctor_last_name} ${r.doctor_first_name}</div>
            <div class="detail-item"><span class="detail-label">Φάρμακο</span>
                <strong>${r.medication}</strong></div>
            <div class="detail-item"><span class="detail-label">Δόση</span>${r.dose}</div>
            <div class="detail-item"><span class="detail-label">Συχνότητα</span>${r.freq}</div>
            <div class="detail-item"><span class="detail-label">Ημ. Συνταγής</span>
                ${new Date(r.pres_day).toLocaleDateString('el-GR')}</div>
            <div class="detail-item"><span class="detail-label">Λήξη</span>
                ${new Date(r.exp_date).toLocaleDateString('el-GR')}</div>
            <div class="detail-item"><span class="detail-label">Τμήμα</span>${r.department}</div>
            <div class="detail-item"><span class="detail-label">Νοσηλεία</span>#${r.hospitalization_id}</div>
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Κλείσιμο</button>
        <button class="btn btn-primary" onclick="editPrescription(${r.id})">Επεξεργασία</button>
    `;
    openModal();
}

// =============================================
// NEW
// =============================================

async function newPrescription() {
    await loadFormMeta();
    _selPatient = null; _selDoctor = null; _selMed = null;

    document.getElementById('modal-title').textContent = 'Νέα Συνταγή';
    document.getElementById('modal-body').innerHTML = prescriptionForm({});
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="savePrescription()">Αποθήκευση</button>
    `;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('f-pres-day').value = today;
    openModal();
}

async function loadFormMeta() {
    [_allPatients, _allDoctors, _allMeds] = await Promise.all([
        api.get('/patients'),
        api.get('/doctors'),
        api.get('/prescriptions/meta/medications')
    ]);
}

function prescriptionForm(r) {
    return `
        <div class="form-grid">

            <!-- ΑΣΘΕΝΗΣ -->
            <div class="form-group form-full">
                <label>Ασθενής *</label>
                <input id="f-patient-search" type="text" class="form-input"
                    placeholder="Αναζήτηση ονόματος ή ΑΜΚΑ..." oninput="searchPresPatient()">
                <div id="f-patient-results" style="display:none;max-height:150px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    margin-top:4px;background:var(--surface)"></div>
                <div id="f-patient-selected" style="margin-top:6px;font-size:13px;color:var(--blue)">
                    ${r.patient_id ? `✓ <strong>${r.patient_last_name} ${r.patient_first_name}</strong>
                        <span style="color:var(--text-secondary)">${r.patient_amka}</span>` : ''}
                </div>
                <input type="hidden" id="f-patient-id" value="${r.patient_id || ''}">
            </div>

            <!-- ΝΟΣΗΛΕΙΑ -->
            <div class="form-group form-full" id="f-hosp-section" style="${r.patient_id ? '' : 'display:none'}">
                <label>Νοσηλεία *</label>
                <select id="f-hosp-id" class="form-input">
                    <option value="${r.hospitalization_id || ''}">
                        ${r.hospitalization_id ? `#${r.hospitalization_id} · ${r.department}` : '— Επιλέξτε —'}
                    </option>
                </select>
            </div>

            <!-- ΓΙΑΤΡΟΣ -->
            <div class="form-group form-full">
                <label>Γιατρός *</label>
                <input id="f-doctor-search" type="text" class="form-input"
                    placeholder="Αναζήτηση γιατρού..." oninput="searchPresDoctor()">
                <div id="f-doctor-results" style="display:none;max-height:150px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    margin-top:4px;background:var(--surface)"></div>
                <div id="f-doctor-selected" style="margin-top:6px;font-size:13px;color:var(--blue)">
                    ${r.doctor_id ? `✓ <strong>${r.doctor_last_name} ${r.doctor_first_name}</strong>` : ''}
                </div>
                <input type="hidden" id="f-doctor-id" value="${r.doctor_id || ''}">
            </div>

            <!-- ΦΑΡΜΑΚΟ -->
            <div class="form-group form-full">
                <label>Φάρμακο *</label>
                <input id="f-med-search" type="text" class="form-input"
                    placeholder="Αναζήτηση φαρμάκου..." oninput="searchPresMed()">
                <div id="f-med-results" style="display:none;max-height:150px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    margin-top:4px;background:var(--surface)"></div>
                <div id="f-med-selected" style="margin-top:6px;font-size:13px;color:var(--blue)">
                    ${r.medication_id ? `✓ <strong>${r.medication}</strong>` : ''}
                </div>
                <input type="hidden" id="f-med-id" value="${r.medication_id || ''}">
            </div>

            <!-- ΔΟΣΗ -->
            <div class="form-group">
                <label>Δόση *</label>
                <input id="f-dose" type="text" class="form-input"
                    placeholder="π.χ. 500mg" value="${r.dose || ''}">
            </div>

            <!-- ΣΥΧΝΟΤΗΤΑ -->
            <div class="form-group">
                <label>Συχνότητα *</label>
                <input id="f-freq" type="text" class="form-input"
                    placeholder="π.χ. 2x ημερησίως" value="${r.freq || ''}">
            </div>

            <!-- ΗΜΕΡΟΜΗΝΙΑ ΣΥΝΤΑΓΗΣ -->
            <div class="form-group">
                <label>Ημ. Συνταγής *</label>
                <input id="f-pres-day" type="date" class="form-input"
                    value="${r.pres_day ? r.pres_day.split('T')[0] : ''}">
            </div>

            <!-- ΛΗΞΗ -->
            <div class="form-group">
                <label>Ημ. Λήξης *</label>
                <input id="f-exp-date" type="date" class="form-input"
                    value="${r.exp_date ? r.exp_date.split('T')[0] : ''}">
            </div>

        </div>
    `;
}

// Patient search
function searchPresPatient() {
    const q = document.getElementById('f-patient-search').value.toLowerCase();
    const results = document.getElementById('f-patient-results');
    if (!q) { results.style.display = 'none'; return; }

    const filtered = _allPatients.filter(p =>
        (p.first_name + ' ' + p.last_name).toLowerCase().includes(q) ||
        p.patient_amka.includes(q)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(p => `
        <div onclick="selectPresPatient(${p.id}, '${p.last_name} ${p.first_name}', '${p.patient_amka}')"
            style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
            <strong>${p.last_name} ${p.first_name}</strong>
            <span style="color:var(--text-secondary);margin-left:8px">${p.patient_amka}</span>
        </div>
    `).join('');
}

async function selectPresPatient(id, name, amka) {
    _selPatient = id;
    document.getElementById('f-patient-id').value = id;
    document.getElementById('f-patient-search').value = '';
    document.getElementById('f-patient-results').style.display = 'none';
    document.getElementById('f-patient-selected').innerHTML = `
        ✓ <strong>${name}</strong>
        <span style="color:var(--text-secondary)">${amka}</span>
        <button onclick="clearPresPatient()" style="background:none;border:none;cursor:pointer;
            color:var(--text-secondary);margin-left:6px">✕</button>
    `;
    // Φόρτωσε ενεργές νοσηλείες
    try {
        const hosps  = await api.get('/hospitalizations');
        const active = hosps.filter(h => h.patient_id == id && !h.discharge_date);
        const sel    = document.getElementById('f-hosp-id');
        sel.innerHTML = '<option value="">— Επιλέξτε Νοσηλεία —</option>' +
            active.map(h => `<option value="${h.id}">
                #${h.id} · ${h.department} · ${new Date(h.admission_date).toLocaleDateString('el-GR')}
            </option>`).join('');
        document.getElementById('f-hosp-section').style.display = 'block';
    } catch(e) {}
}

function clearPresPatient() {
    _selPatient = null;
    document.getElementById('f-patient-id').value = '';
    document.getElementById('f-patient-selected').innerHTML = '';
    document.getElementById('f-hosp-section').style.display = 'none';
}

// Doctor search
function searchPresDoctor() {
    const q = document.getElementById('f-doctor-search').value.toLowerCase();
    const results = document.getElementById('f-doctor-results');
    if (!q) { results.style.display = 'none'; return; }

    const filtered = _allDoctors.filter(d =>
        (d.first_name + ' ' + d.last_name).toLowerCase().includes(q)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(d => `
        <div onclick="selectPresDoctor(${d.id}, '${d.last_name} ${d.first_name}')"
            style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
            ${d.last_name} ${d.first_name}
            <span style="color:var(--text-secondary);margin-left:8px;font-size:11px">${d.specialization || ''}</span>
        </div>
    `).join('');
}

function selectPresDoctor(id, name) {
    _selDoctor = id;
    document.getElementById('f-doctor-id').value = id;
    document.getElementById('f-doctor-search').value = '';
    document.getElementById('f-doctor-results').style.display = 'none';
    document.getElementById('f-doctor-selected').innerHTML = `
        ✓ <strong>${name}</strong>
        <button onclick="clearPresDoctor()" style="background:none;border:none;cursor:pointer;
            color:var(--text-secondary);margin-left:6px">✕</button>
    `;
}

function clearPresDoctor() {
    _selDoctor = null;
    document.getElementById('f-doctor-id').value = '';
    document.getElementById('f-doctor-selected').innerHTML = '';
}

// Medication search
function searchPresMed() {
    const q = document.getElementById('f-med-search').value.toLowerCase();
    const results = document.getElementById('f-med-results');
    if (!q) { results.style.display = 'none'; return; }

    const filtered = _allMeds.filter(m =>
        m.name.toLowerCase().includes(q)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(m => `
        <div onclick="selectPresMed(${m.id}, '${m.name.replace(/'/g,"\\'")}')"
            style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
            ${m.name}
            <span style="color:var(--text-secondary);margin-left:8px;font-size:11px">${m.auth_country}</span>
        </div>
    `).join('');
}

function selectPresMed(id, name) {
    _selMed = id;
    document.getElementById('f-med-id').value = id;
    document.getElementById('f-med-search').value = '';
    document.getElementById('f-med-results').style.display = 'none';
    document.getElementById('f-med-selected').innerHTML = `
        ✓ <strong>${name}</strong>
        <button onclick="clearPresMed()" style="background:none;border:none;cursor:pointer;
            color:var(--text-secondary);margin-left:6px">✕</button>
    `;
}

function clearPresMed() {
    _selMed = null;
    document.getElementById('f-med-id').value = '';
    document.getElementById('f-med-selected').innerHTML = '';
}

// =============================================
// SAVE
// =============================================

async function savePrescription(editId = null) {
    const patientId = document.getElementById('f-patient-id').value;
    const hospId    = document.getElementById('f-hosp-id')?.value;
    const doctorId  = document.getElementById('f-doctor-id').value;
    const medId     = document.getElementById('f-med-id').value;
    const dose      = document.getElementById('f-dose').value;
    const freq      = document.getElementById('f-freq').value;
    const presDay   = document.getElementById('f-pres-day').value;
    const expDate   = document.getElementById('f-exp-date').value;

    if (!patientId) { alert('Παρακαλώ επιλέξτε ασθενή'); return; }
    if (!hospId)    { alert('Παρακαλώ επιλέξτε νοσηλεία'); return; }
    if (!doctorId)  { alert('Παρακαλώ επιλέξτε γιατρό'); return; }
    if (!medId)     { alert('Παρακαλώ επιλέξτε φάρμακο'); return; }
    if (!dose)      { alert('Παρακαλώ εισάγετε δόση'); return; }
    if (!freq)      { alert('Παρακαλώ εισάγετε συχνότητα'); return; }
    if (!presDay)   { alert('Παρακαλώ εισάγετε ημερομηνία συνταγής'); return; }
    if (!expDate)   { alert('Παρακαλώ εισάγετε ημερομηνία λήξης'); return; }

    const payload = {
        patient_id:          parseInt(patientId),
        hospitalization_id:  parseInt(hospId),
        doctor_id:           parseInt(doctorId),
        medication_id:       parseInt(medId),
        dose, freq,
        pres_day: presDay,
        exp_date: expDate
    };

    try {
        if (editId) await api.put(`/prescriptions/${editId}`, payload);
        else        await api.post('/prescriptions', payload);
        closeModal();
        loadPrescriptions();
    } catch (err) { alert('Σφάλμα: ' + err.message); }
}

// =============================================
// EDIT
// =============================================

async function editPrescription(id) {
    await loadFormMeta();
    const r = await api.get(`/prescriptions/${id}`);
    _selPatient = r.patient_id;
    _selDoctor  = r.doctor_id;
    _selMed     = r.medication_id;

    document.getElementById('modal-title').textContent = `Επεξεργασία Συνταγής #${id}`;
    document.getElementById('modal-body').innerHTML = prescriptionForm(r);

    // Φόρτωσε νοσηλείες για τον ασθενή
    try {
        const hosps  = await api.get('/hospitalizations');
        const active = hosps.filter(h => h.patient_id == r.patient_id);
        const sel    = document.getElementById('f-hosp-id');
        sel.innerHTML = active.map(h => `
            <option value="${h.id}" ${h.id == r.hospitalization_id ? 'selected' : ''}>
                #${h.id} · ${h.department} · ${new Date(h.admission_date).toLocaleDateString('el-GR')}
            </option>`).join('');
        document.getElementById('f-hosp-section').style.display = 'block';
    } catch(e) {}

    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="savePrescription(${id})">Αποθήκευση</button>
    `;
    openModal();
}

async function deletePrescription(id) {
    if (!confirm('Διαγραφή συνταγής;')) return;
    try {
        await api.delete(`/prescriptions/${id}`, {});
        loadPrescriptions();
    } catch (err) { alert('Σφάλμα: ' + err.message); }
}

function openModal()  { document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }

init();
