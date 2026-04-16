// frontend/js/patients.js

let currentPage = 1;
const PAGE_SIZE = 10;
let allPatients = [];

async function loadPatients() {
    try {
        allPatients = await api.get('/patients');
        renderTable(allPatients);
    } catch (err) {
        document.getElementById('patients-tbody').innerHTML =
            '<tr><td colspan="7" class="empty">Σφάλμα φόρτωσης</td></tr>';
    }
}

function renderTable(patients) {
    const tbody = document.getElementById('patients-tbody');
    const start = (currentPage - 1) * PAGE_SIZE;
    const page  = patients.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">Δεν βρέθηκαν ασθενείς</td></tr>';
        renderPagination(0);
        return;
    }

    tbody.innerHTML = page.map(p => `
        <tr>
            <td><span class="mono">${p.patient_amka}</span></td>
            <td><strong>${p.last_name} ${p.first_name}</strong></td>
            <td>${p.age ?? '—'}</td>
            <td>${p.sex === 'Male' ? 'Άνδρας' : p.sex === 'Female' ? 'Γυναίκα' : 'Άλλο'}</td>
            <td>${p.blood_type || '—'}</td>
            <td>${p.phones || '—'}</td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-outline" onclick="viewPatient(${p.id})">Προβολή</button>
                    <button class="btn btn-sm btn-primary" onclick="editPatient(${p.id})">Επεξεργασία</button>
                    <button class="btn btn-sm btn-danger" onclick="deletePatient(${p.id})">Διαγραφή</button>
                </div>
            </td>
        </tr>
    `).join('');

    renderPagination(patients.length);
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

function changePage(page) {
    currentPage = page;
    renderTable(allPatients);
}

function searchPatients() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const filtered = allPatients.filter(p =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q)  ||
        p.patient_amka.includes(q)
    );
    currentPage = 1;
    renderTable(filtered);
}

// =============================================
// MODAL — VIEW
// =============================================

async function viewPatient(id) {
    try {
        const p = await api.get(`/patients/${id}`);
        document.getElementById('modal-title').textContent = `${p.last_name} ${p.first_name}`;
        document.getElementById('modal-body').innerHTML = `
            <div class="tabs" style="margin-bottom:16px">
                <button class="tab active" onclick="switchPatientTab('info',         ${id}, this)">Στοιχεία</button>
                <button class="tab"        onclick="switchPatientTab('allergies',    ${id}, this)">Αλλεργίες</button>
                <button class="tab"        onclick="switchPatientTab('prescriptions',${id}, this)">Συνταγές</button>
                <button class="tab"        onclick="switchPatientTab('lab-exams',    ${id}, this)">Εξετάσεις</button>
                <button class="tab"        onclick="switchPatientTab('surgeries',    ${id}, this)">Χειρουργεία</button>
                <button class="tab"        onclick="switchPatientTab('med-procs',    ${id}, this)">Ιατρικές Πράξεις</button>
            </div>
            <div id="patient-tab-content">
                ${patientInfoGrid(p)}
            </div>
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="closeModal()">Κλείσιμο</button>
            <button class="btn btn-primary" onclick="editPatient(${p.id})">Επεξεργασία</button>
        `;
        openModal();
    } catch (err) {
        alert('Σφάλμα φόρτωσης ασθενή');
    }
}

function patientInfoGrid(p) {
    const dob = p.date_of_birth
        ? new Date(p.date_of_birth).toLocaleDateString('el-GR')
        : '—';
    return `
        <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">ΑΜΚΑ</span><span class="mono">${p.patient_amka}</span></div>
            <div class="detail-item"><span class="detail-label">Πατρώνυμο</span>${p.father_name}</div>
            <div class="detail-item"><span class="detail-label">Ημ. Γέννησης</span>${dob}</div>
            <div class="detail-item"><span class="detail-label">Ηλικία</span>${p.age ?? '—'}</div>
            <div class="detail-item"><span class="detail-label">Φύλο</span>${p.sex}</div>
            <div class="detail-item"><span class="detail-label">Ομάδα Αίματος</span>${p.blood_type || '—'}</div>
            <div class="detail-item"><span class="detail-label">Βάρος</span>${p.weight ? p.weight + ' kg' : '—'}</div>
            <div class="detail-item"><span class="detail-label">Ύψος</span>${p.height ? p.height + ' cm' : '—'}</div>
            <div class="detail-item"><span class="detail-label">Υπηκοότητα</span>${p.nationality}</div>
            <div class="detail-item"><span class="detail-label">Επάγγελμα</span>${p.profession || '—'}</div>
            <div class="detail-item"><span class="detail-label">Email</span>${p.email || '—'}</div>
            <div class="detail-item"><span class="detail-label">Τηλέφωνα</span>${p.phones || '—'}</div>
            <div class="detail-item"><span class="detail-label">Διεύθυνση</span>${p.address || '—'}</div>
            <div class="detail-item"><span class="detail-label">Ασφαλιστικοί</span>${p.insurance_providers || '—'}</div>
            <div class="detail-item"><span class="detail-label">Οικείοι</span>${p.contact_persons || '—'}</div>
        </div>
    `;
}

async function switchPatientTab(tab, patientId, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById('patient-tab-content');
    content.innerHTML = '<div class="loading">Φόρτωση...</div>';

    if (tab === 'info') {
        const p = await api.get(`/patients/${patientId}`);
        content.innerHTML = patientInfoGrid(p);
        return;
    }

    const data = await api.get(`/patients/${patientId}/${tab}`);

    if (tab === 'allergies') {
        content.innerHTML = data.length ? `
            <div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px 0">
                ${data.map(a => `
                    <span style="background:#fee2e2;color:#991b1b;padding:4px 12px;
                                 border-radius:99px;font-size:13px">
                        ⚠ ${a.name}
                    </span>
                `).join('')}
            </div>
        ` : '<div class="empty">Δεν υπάρχουν αλλεργίες</div>';
    }

    else if (tab === 'prescriptions') {
        content.innerHTML = data.length ? `
            <table class="table">
                <thead><tr>
                    <th>Φάρμακο</th><th>Δόση</th><th>Συχνότητα</th>
                    <th>Ημ. Συνταγής</th><th>Λήξη</th><th>Γιατρός</th>
                </tr></thead>
                <tbody>
                    ${data.map(pr => `<tr>
                        <td><strong>${pr.medication}</strong></td>
                        <td>${pr.dose}</td>
                        <td>${pr.freq}</td>
                        <td>${new Date(pr.pres_day).toLocaleDateString('el-GR')}</td>
                        <td>${new Date(pr.exp_date).toLocaleDateString('el-GR')}</td>
                        <td>${pr.doctor_last_name} ${pr.doctor_first_name}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        ` : '<div class="empty">Δεν υπάρχουν συνταγές</div>';
    }

    else if (tab === 'lab-exams') {
        content.innerHTML = data.length ? `
            <table class="table">
                <thead><tr>
                    <th>Τύπος</th><th>Ημερομηνία</th><th>Αποτέλεσμα</th>
                    <th>Κόστος</th><th>Γιατρός</th>
                </tr></thead>
                <tbody>
                    ${data.map(e => `<tr>
                        <td><strong>${e.type}</strong></td>
                        <td>${new Date(e.date).toLocaleDateString('el-GR')}</td>
                        <td>${e.numeric_result ? e.numeric_result + ' ' + (e.unit || '') : e.text_result || '—'}</td>
                        <td>${Number(e.cost).toLocaleString('el-GR', {style:'currency',currency:'EUR'})}</td>
                        <td>${e.doctor_last_name} ${e.doctor_first_name}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        ` : '<div class="empty">Δεν υπάρχουν εξετάσεις</div>';
    }

    else if (tab === 'surgeries') {
        content.innerHTML = data.length ? `
            <table class="table">
                <thead><tr>
                    <th>Διαδικασία</th><th>Ημερομηνία</th><th>Διάρκεια</th>
                    <th>Κόστος</th><th>Χειρουργός</th>
                </tr></thead>
                <tbody>
                    ${data.map(s => `<tr>
                        <td><strong>${s.procedure_name}</strong></td>
                        <td>${new Date(s.start_time).toLocaleDateString('el-GR')}</td>
                        <td>${s.duration} λεπτά</td>
                        <td>${Number(s.cost).toLocaleString('el-GR', {style:'currency',currency:'EUR'})}</td>
                        <td>${s.surgeon_last_name} ${s.surgeon_first_name}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        ` : '<div class="empty">Δεν υπάρχουν χειρουργεία</div>';
    }

    else if (tab === 'med-procs') {
        content.innerHTML = data.length ? `
            <table class="table">
                <thead><tr>
                    <th>Διαδικασία</th><th>Κατηγορία</th><th>Ημερομηνία</th>
                    <th>Κόστος</th><th>Τμήμα</th>
                </tr></thead>
                <tbody>
                    ${data.map(mp => `<tr>
                        <td><strong>${mp.procedure_name}</strong></td>
                        <td>${mp.category}</td>
                        <td>${mp.date ? new Date(mp.date).toLocaleDateString('el-GR') : '—'}</td>
                        <td>${Number(mp.cost).toLocaleString('el-GR', {style:'currency',currency:'EUR'})}</td>
                        <td>${mp.department}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        ` : '<div class="empty">Δεν υπάρχουν ιατρικές πράξεις</div>';
    }
}

// =============================================
// MODAL — CREATE / EDIT
// =============================================

async function newPatient() {
    document.getElementById('modal-title').textContent = 'Νέος Ασθενής';
    document.getElementById('modal-body').innerHTML = '<div class="loading">Φόρτωση...</div>';
    openModal();
    document.getElementById('modal-body').innerHTML = await patientForm({});
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="savePatient(null)">Αποθήκευση</button>
    `;
}

async function editPatient(id) {
    document.getElementById('modal-title').textContent = 'Επεξεργασία Ασθενή';
    document.getElementById('modal-body').innerHTML = '<div class="loading">Φόρτωση...</div>';
    openModal();
    try {
        const p = await api.get(`/patients/${id}`);
        document.getElementById('modal-body').innerHTML = await patientForm(p);
        document.getElementById('modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
            <button class="btn btn-primary" onclick="savePatient(${id})">Αποθήκευση</button>
        `;
    } catch (err) {
        alert('Σφάλμα φόρτωσης ασθενή');
        closeModal();
    }
}

async function patientForm(p) {
    const allInsurance = await api.get('/insurance');
    let selectedInsurance = [];
    let contacts = [];
    if (p.id) {
        selectedInsurance = await api.get(`/patients/${p.id}/insurance`);
        contacts = await api.get(`/patients/${p.id}/contacts`);
    }
    const selectedIds = selectedInsurance.map(i => i.id);

    // date_of_birth: format YYYY-MM-DD for input[type=date]
    const dobValue = p.date_of_birth
        ? new Date(p.date_of_birth).toISOString().split('T')[0]
        : '';

    return `
        <div class="form-grid">
            <div class="form-group">
                <label>ΑΜΚΑ *</label>
                <input id="f-amka" type="text" class="form-input"
                    value="${p.patient_amka || ''}" maxlength="11">
            </div>
            <div class="form-group">
                <label>Όνομα *</label>
                <input id="f-first" type="text" class="form-input" value="${p.first_name || ''}">
            </div>
            <div class="form-group">
                <label>Επώνυμο *</label>
                <input id="f-last" type="text" class="form-input" value="${p.last_name || ''}">
            </div>
            <div class="form-group">
                <label>Πατρώνυμο *</label>
                <input id="f-father" type="text" class="form-input" value="${p.father_name || ''}">
            </div>
            <div class="form-group">
                <label>Ημερομηνία Γέννησης *</label>
                <input id="f-dob" type="date" class="form-input" value="${dobValue}">
            </div>
            <div class="form-group">
                <label>Φύλο *</label>
                <select id="f-sex" class="form-input">
                    <option value="Male"   ${p.sex === 'Male'   ? 'selected' : ''}>Άνδρας</option>
                    <option value="Female" ${p.sex === 'Female' ? 'selected' : ''}>Γυναίκα</option>
                    <option value="Other"  ${p.sex === 'Other'  ? 'selected' : ''}>Άλλο</option>
                </select>
            </div>
            <div class="form-group">
                <label>Ομάδα Αίματος</label>
                <select id="f-blood" class="form-input">
                    <option value="">—</option>
                    ${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b =>
                        `<option value="${b}" ${p.blood_type === b ? 'selected' : ''}>${b}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Υπηκοότητα *</label>
                <input id="f-nat" type="text" class="form-input" value="${p.nationality || ''}">
            </div>
            <div class="form-group">
                <label>Βάρος (kg)</label>
                <input id="f-weight" type="number" class="form-input"
                    value="${p.weight || ''}" step="0.01">
            </div>
            <div class="form-group">
                <label>Ύψος (cm)</label>
                <input id="f-height" type="number" class="form-input"
                    value="${p.height || ''}" step="0.01">
            </div>
            <div class="form-group">
                <label>Email</label>
                <input id="f-email" type="email" class="form-input" value="${p.email || ''}">
            </div>
            <div class="form-group">
                <label>Επάγγελμα</label>
                <input id="f-prof" type="text" class="form-input" value="${p.profession || ''}">
            </div>
            <div class="form-group form-full">
                <label>Διεύθυνση</label>
                <input id="f-addr" type="text" class="form-input" value="${p.address || ''}">
            </div>
            <div class="form-group form-full">
                <label>Τηλέφωνα (χωρισμένα με κόμμα)</label>
                <input id="f-phones" type="text" class="form-input" value="${p.phones || ''}">
            </div>

            <!-- ΑΣΦΑΛΙΣΤΙΚΟΙ ΦΟΡΕΙΣ -->
            <div class="form-group form-full">
                <label>Ασφαλιστικοί Φορείς</label>
                <div class="checkbox-group">
                    ${allInsurance.map(i => `
                        <label class="checkbox-item">
                            <input type="checkbox"
                                class="insurance-check"
                                value="${i.id}"
                                ${selectedIds.includes(i.id) ? 'checked' : ''}>
                            <span>${i.name} <small>(${i.type})</small></span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <!-- ΟΙΚΕΙΟΙ -->
            <div class="form-group form-full">
                <label>Οικείοι</label>
                <div id="contacts-list">
                    ${contacts.map((c, idx) => contactRow(c, idx)).join('')}
                </div>
                <button type="button" class="btn btn-outline btn-sm"
                    style="margin-top:8px" onclick="addContactRow()">
                    + Προσθήκη Οικείου
                </button>
            </div>
        </div>
    `;
}

function contactRow(c = {}, idx = Date.now()) {
    return `
        <div class="contact-row" id="contact-${idx}">
            <input type="hidden" class="c-id" value="${c.id || ''}">
            <input type="text" class="form-input c-name"
                placeholder="Όνομα" value="${c.name || ''}">
            <select class="form-input c-relation">
                ${['Spouse','Parent','Child','Sibling','Friend','Other'].map(r =>
                    `<option value="${r}" ${c.relation === r ? 'selected' : ''}>${r}</option>`
                ).join('')}
            </select>
            <input type="text" class="form-input c-phones"
                placeholder="Τηλέφωνα (κόμμα)" value="${c.phones || ''}">
            <button type="button" class="btn btn-danger btn-sm"
                onclick="removeContactRow('contact-${idx}')">✕</button>
        </div>
    `;
}

function addContactRow() {
    const list = document.getElementById('contacts-list');
    const idx  = Date.now();
    const div  = document.createElement('div');
    div.innerHTML = contactRow({}, idx);
    list.appendChild(div.firstElementChild);
}

function removeContactRow(id) {
    document.getElementById(id)?.remove();
}

async function savePatient(id) {
    const data = {
        patient_amka:  document.getElementById('f-amka').value,
        first_name:    document.getElementById('f-first').value,
        last_name:     document.getElementById('f-last').value,
        father_name:   document.getElementById('f-father').value,
        date_of_birth: document.getElementById('f-dob').value || null,
        sex:           document.getElementById('f-sex').value,
        blood_type:    document.getElementById('f-blood').value || null,
        nationality:   document.getElementById('f-nat').value,
        weight:        parseFloat(document.getElementById('f-weight').value) || null,
        height:        parseFloat(document.getElementById('f-height').value) || null,
        email:         document.getElementById('f-email').value || null,
        profession:    document.getElementById('f-prof').value || null,
        address:       document.getElementById('f-addr').value || null,
        phones:        document.getElementById('f-phones').value
                         .split(',').map(t => t.trim()).filter(t => t)
    };

    try {
        let patientId = id;

        if (id) {
            await api.put(`/patients/${id}`, data);
        } else {
            const result = await api.post('/patients', data);
            patientId = result.id;
        }

        if (patientId) {
            const checked = [...document.querySelectorAll('.insurance-check:checked')]
                .map(el => parseInt(el.value));
            const existing    = await api.get(`/patients/${patientId}/insurance`);
            const existingIds = existing.map(i => i.id);

            for (const iid of checked)
                if (!existingIds.includes(iid))
                    await api.post(`/patients/${patientId}/insurance`, { insurance_provider_id: iid });

            for (const iid of existingIds)
                if (!checked.includes(iid))
                    await api.delete(`/patients/${patientId}/insurance/${iid}`);

            const contactRows = document.querySelectorAll('.contact-row');
            for (const row of contactRows) {
                const name     = row.querySelector('.c-name').value.trim();
                const relation = row.querySelector('.c-relation').value;
                const phones   = row.querySelector('.c-phones').value
                                    .split(',').map(t => t.trim()).filter(t => t);
                const cid      = row.querySelector('.c-id').value;
                if (!name) continue;
                if (!cid) {
                    const newId = Math.random().toString(36).substr(2, 8).toUpperCase();
                    await api.post(`/patients/${patientId}/contacts`, { id: newId, name, relation, phones });
                }
            }
        }

        closeModal();
        loadPatients();
    } catch (err) {
        alert('Σφάλμα αποθήκευσης: ' + err.message);
    }
}

async function deletePatient(id) {
    if (!confirm('Διαγραφή ασθενή;')) return;
    try {
        await api.delete(`/patients/${id}`);
        loadPatients();
    } catch (err) {
        alert('Σφάλμα διαγραφής: ' + err.message);
    }
}

function openModal()  { document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }

loadPatients();
