let allStaff    = [];
let currentTab  = 'all';
let currentPage = 1;
const PAGE_SIZE = 10;

async function loadStaff() {
    try {
        allStaff = await api.get('/staff');
        filterAndRender();
    } catch (err) {
        document.getElementById('staff-tbody').innerHTML =
            '<tr><td colspan="7" class="empty">Σφάλμα φόρτωσης</td></tr>';
    }
}

function switchTab(tab) {
    currentTab  = tab;
    currentPage = 1;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    const titles = {
        all:            'Όλο το Προσωπικό',
        Doctor:         'Ιατροί',
        Nurse:          'Νοσηλευτές',
        Administration: 'Διοικητικοί'
    };
    document.getElementById('tab-title').textContent = titles[tab];
    filterAndRender();
}

function filterAndRender() {
    const q = document.getElementById('search-input').value.toLowerCase();
    let filtered = currentTab === 'all'
        ? allStaff
        : allStaff.filter(s => s.staff_type === currentTab);

    if (q) {
        filtered = filtered.filter(s =>
            s.first_name.toLowerCase().includes(q) ||
            s.last_name.toLowerCase().includes(q)  ||
            s.staff_amka.includes(q)               ||
            (s.email || '').toLowerCase().includes(q)
        );
    }
    renderTable(filtered);
}

function searchStaff() {
    currentPage = 1;
    filterAndRender();
}

function renderTable(staff) {
    const tbody = document.getElementById('staff-tbody');
    const start = (currentPage - 1) * PAGE_SIZE;
    const page  = staff.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">Δεν βρέθηκε προσωπικό</td></tr>';
        renderPagination(0);
        return;
    }

    const typeLabels = { Doctor: '🩺 Ιατρός', Nurse: '💊 Νοσηλευτής', Administration: '📋 Διοικητικός' };
    const typeBadge  = { Doctor: 'badge-doc', Nurse: 'badge-nurse', Administration: 'badge-admin' };

    tbody.innerHTML = page.map(s => `
        <tr>
            <td><span class="mono">${s.staff_amka}</span></td>
            <td><strong>${s.last_name} ${s.first_name}</strong></td>
            <td>
                <span class="shift-count-badge ${typeBadge[s.staff_type]}">
                    ${typeLabels[s.staff_type]}
                </span>
            </td>
            <td>${s.age ?? '—'}</td>
            <td>${s.email}</td>
            <td>${new Date(s.hire_date).toLocaleDateString('el-GR')}</td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-outline" onclick="viewStaff(${s.id})">Προβολή</button>
                    <button class="btn btn-sm btn-danger"  onclick="editStaff(${s.id})">Επεξεργασία</button>
                </div>
            </td>
        </tr>
    `).join('');

    renderPagination(staff.length);
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
    filterAndRender();
}

// =============================================
// VIEW
// =============================================

async function viewStaff(id) {
    try {
        const s = await api.get(`/staff/${id}`);
        let extraHtml = '';

        if (s.staff_type === 'Doctor') {
            const d = await api.get(`/doctors/${id}`);
            extraHtml = `
                <div class="detail-item"><span class="detail-label">Άδεια Ιατρικού Συλλόγου</span>
                    <span class="mono">${d.license_no || '—'}</span></div>
                <div class="detail-item"><span class="detail-label">Βαθμίδα</span>${d.grade || '—'}</div>
                <div class="detail-item"><span class="detail-label">Ειδικότητα</span>${d.specialization || '—'}</div>
                <div class="detail-item"><span class="detail-label">Επόπτης</span>
                    ${d.supervisor_first_name ? `${d.supervisor_last_name} ${d.supervisor_first_name}` : '—'}</div>
                <div class="detail-item form-full"><span class="detail-label">Τμήματα</span>${d.departments || '—'}</div>
            `;
        } else if (s.staff_type === 'Nurse') {
            const n = await api.get(`/nurses/${id}`);
            extraHtml = `
                <div class="detail-item"><span class="detail-label">Βαθμίδα</span>${n.grade || '—'}</div>
                <div class="detail-item"><span class="detail-label">Τμήμα</span>${n.department || '—'}</div>
            `;
        } else if (s.staff_type === 'Administration') {
            const a = await api.get(`/admin/${id}`);
            extraHtml = `
                <div class="detail-item"><span class="detail-label">Ρόλος</span>${a.role || '—'}</div>
                <div class="detail-item"><span class="detail-label">Γραφείο</span>${a.office || '—'}</div>
                <div class="detail-item"><span class="detail-label">Τμήμα</span>${a.department || '—'}</div>
            `;
        }

        const dob = s.date_of_birth
            ? new Date(s.date_of_birth).toLocaleDateString('el-GR')
            : '—';

        document.getElementById('modal-title').textContent = `${s.last_name} ${s.first_name}`;
        document.getElementById('modal-body').innerHTML = `
            <div class="detail-grid">
                <div class="detail-item"><span class="detail-label">ΑΜΚΑ</span>
                    <span class="mono">${s.staff_amka}</span></div>
                <div class="detail-item"><span class="detail-label">Τύπος</span>${s.staff_type}</div>
                <div class="detail-item"><span class="detail-label">Ημ. Γέννησης</span>${dob}</div>
                <div class="detail-item"><span class="detail-label">Ηλικία</span>${s.age ?? '—'}</div>
                <div class="detail-item"><span class="detail-label">Email</span>${s.email}</div>
                <div class="detail-item"><span class="detail-label">Τηλέφωνα</span>${s.phones || '—'}</div>
                <div class="detail-item"><span class="detail-label">Ημ. Πρόσληψης</span>
                    ${new Date(s.hire_date).toLocaleDateString('el-GR')}</div>
                ${extraHtml}
            </div>
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="closeModal()">Κλείσιμο</button>
            <button class="btn btn-primary" onclick="editStaff(${id})">Επεξεργασία</button>
        `;
        openModal();
    } catch (err) {
        alert('Σφάλμα φόρτωσης: ' + err.message);
    }
}

// =============================================
// NEW STAFF
// =============================================

async function newStaff() {
    document.getElementById('modal-title').textContent = 'Νέο Μέλος Προσωπικού';
    document.getElementById('modal-body').innerHTML = '<div class="loading">Φόρτωση...</div>';
    openModal();
    document.getElementById('modal-body').innerHTML = staffBaseForm({});
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="saveAllStaff()">Αποθήκευση</button>
    `;
    await renderSpecificFields();
}

function staffBaseForm(s) {
    const dobValue = s.date_of_birth
        ? new Date(s.date_of_birth).toISOString().split('T')[0]
        : '';
    return `
        <div class="form-grid">
            <div class="form-group">
                <label>ΑΜΚΑ *</label>
                <input id="f-amka" type="text" class="form-input" value="${s.staff_amka || ''}" maxlength="11">
            </div>
            <div class="form-group">
                <label>Όνομα *</label>
                <input id="f-first" type="text" class="form-input" value="${s.first_name || ''}">
            </div>
            <div class="form-group">
                <label>Επώνυμο *</label>
                <input id="f-last" type="text" class="form-input" value="${s.last_name || ''}">
            </div>
            <div class="form-group">
                <label>Ημερομηνία Γέννησης *</label>
                <input id="f-dob" type="date" class="form-input" value="${dobValue}">
            </div>
            <div class="form-group">
                <label>Email *</label>
                <input id="f-email" type="email" class="form-input" value="${s.email || ''}">
            </div>
            <div class="form-group">
                <label>Ημ. Πρόσληψης *</label>
                <input id="f-hire" type="date" class="form-input"
                    value="${s.hire_date ? s.hire_date.split('T')[0] : ''}">
            </div>
            <div class="form-group form-full">
                <label>Τύπος Προσωπικού *</label>
                <select id="f-type" class="form-input" onchange="renderSpecificFields()">
                    <option value="Doctor">Ιατρός</option>
                    <option value="Nurse">Νοσηλευτής</option>
                    <option value="Administration">Διοικητικός</option>
                </select>
            </div>
            <div class="form-group form-full">
                <label>Τηλέφωνα (χωρισμένα με κόμμα)</label>
                <input id="f-phones" type="text" class="form-input" value="${s.phones || ''}">
            </div>
            <!-- Δυναμικά fields ανά τύπο -->
            <div id="specific-fields" class="form-full" style="display:contents"></div>
        </div>
    `;
}

async function renderSpecificFields() {
    const type      = document.getElementById('f-type').value;
    const container = document.getElementById('specific-fields');
    container.innerHTML = '<div class="loading">Φόρτωση...</div>';

    const deps = await api.get('/departments');

    if (type === 'Doctor') {
        const grades = await api.get('/doctors/grades');
        const specs  = await api.get('/doctors/specializations');
        let doctors  = [];
        try { doctors = await api.get('/doctors'); } catch(e) {}

        container.innerHTML = `
            <div class="form-group form-full">
                <label>Αριθμός Άδειας *</label>
                <input id="f-license" type="text" class="form-input" placeholder="π.χ. ΙΑΤ-12345">
            </div>
            <div class="form-group">
                <label>Βαθμίδα *</label>
                <select id="f-grade" class="form-input">
                    ${grades.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Ειδικότητα *</label>
                <select id="f-spec" class="form-input">
                    ${specs.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group form-full">
                <label>Επόπτης</label>
                <select id="f-supervisor" class="form-input">
                    <option value="">— Χωρίς Επόπτη —</option>
                    ${doctors.map(d => `<option value="${d.id}">${d.last_name} ${d.first_name} (${d.grade})</option>`).join('')}
                </select>
            </div>
            <div class="form-group form-full">
                <label>Τμήματα</label>
                <div class="checkbox-group">
                    ${deps.map(d => `
                        <label class="checkbox-item">
                            <input type="checkbox" class="dept-check" value="${d.id}">
                            <span>${d.name}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    } else if (type === 'Nurse') {
        const grades = await api.get('/nurses/grades');
        container.innerHTML = `
            <div class="form-group">
                <label>Βαθμίδα *</label>
                <select id="f-grade" class="form-input">
                    ${grades.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Τμήμα *</label>
                <select id="f-dept" class="form-input">
                    ${deps.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                </select>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="form-group">
                <label>Ρόλος *</label>
                <input id="f-role" type="text" class="form-input" placeholder="π.χ. Γραμματέας">
            </div>
            <div class="form-group">
                <label>Γραφείο *</label>
                <input id="f-office" type="text" class="form-input" placeholder="π.χ. A101">
            </div>
            <div class="form-group form-full">
                <label>Τμήμα *</label>
                <select id="f-dept" class="form-input">
                    ${deps.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                </select>
            </div>
        `;
    }
}

async function saveAllStaff() {
    const type = document.getElementById('f-type').value;

    try {
        const result = await api.post('/staff', {
            staff_amka:    document.getElementById('f-amka').value,
            first_name:    document.getElementById('f-first').value,
            last_name:     document.getElementById('f-last').value,
            date_of_birth: document.getElementById('f-dob').value || null,
            email:         document.getElementById('f-email').value,
            hire_date:     document.getElementById('f-hire').value,
            staff_type:    type,
            phones:        document.getElementById('f-phones').value
                               .split(',').map(t => t.trim()).filter(t => t)
        });
        const staffId = result.id;

        if (type === 'Doctor') {
            const deptIds = [...document.querySelectorAll('.dept-check:checked')]
                .map(el => parseInt(el.value));
            await api.post('/doctors', {
                staff_id:       staffId,
                license_no:     document.getElementById('f-license').value,
                doc_grade_id:   parseInt(document.getElementById('f-grade').value),
                doc_spec_id:    parseInt(document.getElementById('f-spec').value),
                supervisor_id:  document.getElementById('f-supervisor').value || null,
                department_ids: deptIds
            });
        } else if (type === 'Nurse') {
            await api.post('/nurses', {
                staff_id:       staffId,
                nurse_grade_id: parseInt(document.getElementById('f-grade').value),
                department_id:  parseInt(document.getElementById('f-dept').value)
            });
        } else {
            await api.post('/admin', {
                staff_id:      staffId,
                role:          document.getElementById('f-role').value,
                office:        document.getElementById('f-office').value,
                department_id: parseInt(document.getElementById('f-dept').value)
            });
        }

        document.getElementById('modal').classList.remove('open');
        loadStaff();
    } catch (err) {
        alert('Σφάλμα: ' + err.message);
    }
}

// =============================================
// EDIT STAFF
// =============================================

async function editStaff(id) {
    try {
        const s = await api.get(`/staff/${id}`);
        document.getElementById('modal-title').textContent = 'Επεξεργασία Προσωπικού';
        document.getElementById('modal-body').innerHTML = '<div class="loading">Φόρτωση...</div>';
        openModal();

        let specificHtml = '';

        if (s.staff_type === 'Doctor') {
            const d       = await api.get(`/doctors/${id}`);
            const grades  = await api.get('/doctors/grades');
            const specs   = await api.get('/doctors/specializations');
            const deps    = await api.get('/departments');
            let doctors   = [];
            try { doctors = await api.get('/doctors'); } catch(e) {}

            const selectedDepts = d.departments ? d.departments.split(', ') : [];

            specificHtml = `
                <div class="form-group form-full">
                    <label>Άδεια Ιατρικού Συλλόγου *</label>
                    <input id="f-license" type="text" class="form-input" value="${d.license_no || ''}">
                </div>
                <div class="form-group">
                    <label>Βαθμίδα *</label>
                    <select id="f-grade" class="form-input">
                        ${grades.map(g => `
                            <option value="${g.id}" ${g.name === d.grade ? 'selected' : ''}>
                                ${g.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Ειδικότητα *</label>
                    <select id="f-spec" class="form-input">
                        ${specs.map(sp => `
                            <option value="${sp.id}" ${sp.name === d.specialization ? 'selected' : ''}>
                                ${sp.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group form-full">
                    <label>Επόπτης</label>
                    <select id="f-supervisor" class="form-input">
                        <option value="">— Χωρίς Επόπτη —</option>
                        ${doctors
                            .filter(doc => doc.id !== id)
                            .map(doc => `
                                <option value="${doc.id}"
                                    ${doc.id === d.supervisor_id ? 'selected' : ''}>
                                    ${doc.last_name} ${doc.first_name} (${doc.grade})
                                </option>
                            `).join('')}
                    </select>
                </div>
                <div class="form-group form-full">
                    <label>Τμήματα</label>
                    <div class="checkbox-group">
                        ${deps.map(dep => `
                            <label class="checkbox-item">
                                <input type="checkbox" class="dept-check" value="${dep.id}"
                                    ${selectedDepts.includes(dep.name) ? 'checked' : ''}>
                                <span>${dep.name}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (s.staff_type === 'Nurse') {
            const n      = await api.get(`/nurses/${id}`);
            const grades = await api.get('/nurses/grades');
            const deps   = await api.get('/departments');

            specificHtml = `
                <div class="form-group">
                    <label>Βαθμίδα *</label>
                    <select id="f-grade" class="form-input">
                        ${grades.map(g => `
                            <option value="${g.id}" ${g.name === n.grade ? 'selected' : ''}>
                                ${g.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Τμήμα *</label>
                    <select id="f-dept" class="form-input">
                        ${deps.map(dep => `
                            <option value="${dep.id}"
                                ${dep.id === n.department_id ? 'selected' : ''}>
                                ${dep.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        } else {
            const a    = await api.get(`/admin/${id}`);
            const deps = await api.get('/departments');

            specificHtml = `
                <div class="form-group">
                    <label>Ρόλος *</label>
                    <input id="f-role" type="text" class="form-input" value="${a.role || ''}">
                </div>
                <div class="form-group">
                    <label>Γραφείο *</label>
                    <input id="f-office" type="text" class="form-input" value="${a.office || ''}">
                </div>
                <div class="form-group form-full">
                    <label>Τμήμα *</label>
                    <select id="f-dept" class="form-input">
                        ${deps.map(dep => `
                            <option value="${dep.id}"
                                ${dep.id === a.department_id ? 'selected' : ''}>
                                ${dep.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        }

        const dobValue = s.date_of_birth
            ? new Date(s.date_of_birth).toISOString().split('T')[0]
            : '';

        document.getElementById('modal-body').innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Όνομα *</label>
                    <input id="f-first" type="text" class="form-input" value="${s.first_name}">
                </div>
                <div class="form-group">
                    <label>Επώνυμο *</label>
                    <input id="f-last" type="text" class="form-input" value="${s.last_name}">
                </div>
                <div class="form-group">
                    <label>Ημερομηνία Γέννησης *</label>
                    <input id="f-dob" type="date" class="form-input" value="${dobValue}">
                </div>
                <div class="form-group">
                    <label>Email *</label>
                    <input id="f-email" type="email" class="form-input" value="${s.email}">
                </div>
                <div class="form-group form-full">
                    <label>Τηλέφωνα (χωρισμένα με κόμμα)</label>
                    <input id="f-phones" type="text" class="form-input" value="${s.phones || ''}">
                </div>
                ${specificHtml}
            </div>
        `;

        document.getElementById('modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
            <button class="btn btn-primary" onclick="updateStaff(${id}, '${s.staff_type}')">
                Αποθήκευση
            </button>
        `;
    } catch (err) {
        alert('Σφάλμα φόρτωσης: ' + err.message);
        closeModal();
    }
}

async function updateStaff(id, type) {
    try {
        await api.put(`/staff/${id}`, {
            first_name:    document.getElementById('f-first').value,
            last_name:     document.getElementById('f-last').value,
            date_of_birth: document.getElementById('f-dob').value || null,
            email:         document.getElementById('f-email').value,
            staff_type:    type,
            phones:        document.getElementById('f-phones').value
                               .split(',').map(t => t.trim()).filter(t => t)
        });

        if (type === 'Doctor') {
            const deptIds = [...document.querySelectorAll('.dept-check:checked')]
                .map(el => parseInt(el.value));
            await api.put(`/doctors/${id}`, {
                license_no:     document.getElementById('f-license').value,
                doc_grade_id:   parseInt(document.getElementById('f-grade').value),
                doc_spec_id:    parseInt(document.getElementById('f-spec').value),
                supervisor_id:  document.getElementById('f-supervisor').value || null,
                department_ids: deptIds
            });
        } else if (type === 'Nurse') {
            await api.put(`/nurses/${id}`, {
                nurse_grade_id: parseInt(document.getElementById('f-grade').value),
                department_id:  parseInt(document.getElementById('f-dept').value)
            });
        } else {
            await api.put(`/admin/${id}`, {
                role:          document.getElementById('f-role').value,
                office:        document.getElementById('f-office').value,
                department_id: parseInt(document.getElementById('f-dept').value)
            });
        }

        document.getElementById('modal').classList.remove('open');
        await loadStaff();
    } catch (err) {
        alert('Σφάλμα αποθήκευσης: ' + err.message);
    }
}

function openModal()  { document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }

loadStaff();
