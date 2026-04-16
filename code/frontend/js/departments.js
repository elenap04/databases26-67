let allDepts = [];

async function loadDepts() {
    try {
        allDepts = await api.get('/departments');
        renderTable(allDepts);
    } catch (err) {
        document.getElementById('dept-tbody').innerHTML =
            '<tr><td colspan="5" class="empty">Σφάλμα φόρτωσης</td></tr>';
    }
}

function searchDepts() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const filtered = allDepts.filter(d =>
        d.name.toLowerCase().includes(q) ||
        (d.building && d.building.toLowerCase().includes(q)) ||
        (d.director_last_name && d.director_last_name.toLowerCase().includes(q))
    );
    renderTable(filtered);
}

function renderTable(depts) {
    const tbody = document.getElementById('dept-tbody');
    if (depts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">Δεν βρέθηκαν τμήματα</td></tr>';
        return;
    }
    tbody.innerHTML = depts.map(d => `
        <tr>
            <td><strong>${d.name}</strong>${d.description ? `<br><small style="color:var(--text-secondary)">${d.description}</small>` : ''}</td>
            <td>${d.building} / ${d.floor}ος</td>
            <td><span class="mono">${d.beds_no}</span></td>
            <td>${d.director_last_name ? `${d.director_last_name} ${d.director_first_name}` : '—'}</td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-outline" onclick="viewDept(${d.id})">Προβολή</button>
                    <button class="btn btn-sm btn-primary" onclick="editDept(${d.id})">Επεξεργασία</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// =============================================
// VIEW
// =============================================

async function viewDept(id) {
    try {
        const d       = await api.get(`/departments/${id}`);
        const doctors = await api.get(`/departments/${id}/doctors`);
        const nurses  = await api.get(`/departments/${id}/nurses`);
        const beds    = await api.get(`/departments/${id}/beds`);

        const availBeds = beds.filter(b => b.status === 'Available').length;
        const occBeds   = beds.filter(b => b.status === 'Occupied').length;
        const maintBeds = beds.filter(b => b.status === 'Under Maintenance').length;

        document.getElementById('modal-title').textContent = d.name;
        document.getElementById('modal-body').innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Κτήριο</span>${d.building}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Όροφος</span>${d.floor}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Σύνολο Κλινών</span>
                    <span class="mono">${d.beds_no}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Διευθυντής</span>
                    ${d.director_last_name ? `${d.director_last_name} ${d.director_first_name}` : '—'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Περιγραφή</span>
                    ${d.description || '—'}
                </div>
            </div>

            <div style="margin-top:20px">
                <div class="card-title" style="margin-bottom:10px">Κατάσταση Κλινών</div>
                <div style="display:flex;gap:12px">
                    <span style="color:var(--green)">✓ Διαθέσιμες: ${availBeds}</span>
                    <span style="color:var(--rose)">✗ Κατειλημμένες: ${occBeds}</span>
                    <span style="color:var(--amber)">⚠ Συντήρηση: ${maintBeds}</span>
                </div>
            </div>

            <div style="margin-top:20px">
                <div class="card-title" style="margin-bottom:10px">Ιατροί (${doctors.length})</div>
                ${doctors.length === 0 ? '<div class="empty">Κανένας</div>' :
                    doctors.map(doc => `
                        <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
                            <strong>${doc.last_name} ${doc.first_name}</strong>
                            <span style="color:var(--text-secondary);margin-left:8px">${doc.specialization} · ${doc.grade}</span>
                        </div>
                    `).join('')}
            </div>

            <div style="margin-top:20px">
                <div class="card-title" style="margin-bottom:10px">Νοσηλευτές (${nurses.length})</div>
                ${nurses.length === 0 ? '<div class="empty">Κανένας</div>' :
                    nurses.map(n => `
                        <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
                            <strong>${n.last_name} ${n.first_name}</strong>
                            <span style="color:var(--text-secondary);margin-left:8px">${n.grade}</span>
                        </div>
                    `).join('')}
            </div>
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="closeModal()">Κλείσιμο</button>
            <button class="btn btn-primary" onclick="editDept(${id})">Επεξεργασία</button>
        `;
        openModal();
    } catch (err) {
        alert('Σφάλμα φόρτωσης: ' + err.message);
    }
}

// =============================================
// FORM
// =============================================

async function deptForm(d = {}) {
    const doctors = await api.get('/doctors');
    return `
        <div class="form-grid">
            <div class="form-group form-full">
                <label>Όνομα *</label>
                <input id="f-name" type="text" class="form-input" value="${d.name || ''}">
            </div>
            <div class="form-group form-full">
                <label>Περιγραφή</label>
                <input id="f-desc" type="text" class="form-input" value="${d.description || ''}">
            </div>
            <div class="form-group">
                <label>Αριθμός Κλινών *</label>
                <input id="f-beds" type="number" class="form-input" value="${d.beds_no || ''}" min="1">
            </div>
            <div class="form-group">
                <label>Όροφος *</label>
                <input id="f-floor" type="number" class="form-input" value="${d.floor ?? ''}" min="-3" max="20">
            </div>
            <div class="form-group form-full">
                <label>Κτήριο *</label>
                <input id="f-building" type="text" class="form-input" value="${d.building || ''}">
            </div>
            <div class="form-group form-full">
                <label>Διευθυντής *</label>
                <select id="f-director" class="form-input">
                    ${doctors.map(doc => `
                        <option value="${doc.id}" ${doc.id === d.director_id ? 'selected' : ''}>
                            ${doc.last_name} ${doc.first_name} (${doc.grade})
                        </option>
                    `).join('')}
                </select>
            </div>
        </div>
    `;
}

async function newDepartment() {
    document.getElementById('modal-title').textContent = 'Νέο Τμήμα';
    document.getElementById('modal-body').innerHTML = '<div class="loading">Φόρτωση...</div>';
    openModal();
    document.getElementById('modal-body').innerHTML = await deptForm();
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="saveDept(null)">Αποθήκευση</button>
    `;
}

async function editDept(id) {
    document.getElementById('modal-title').textContent = 'Επεξεργασία Τμήματος';
    document.getElementById('modal-body').innerHTML = '<div class="loading">Φόρτωση...</div>';
    openModal();
    const d = await api.get(`/departments/${id}`);
    document.getElementById('modal-body').innerHTML = await deptForm(d);
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="saveDept(${id})">Αποθήκευση</button>
    `;
}

async function saveDept(id) {
    const data = {
        name:       document.getElementById('f-name').value,
        description:document.getElementById('f-desc').value || null,
        beds_no:    parseInt(document.getElementById('f-beds').value),
        floor:      parseInt(document.getElementById('f-floor').value),
        building:   document.getElementById('f-building').value,
        doctor_id:  parseInt(document.getElementById('f-director').value)
    };
    try {
        if (id) {
            await api.put(`/departments/${id}`, data);
        } else {
            await api.post('/departments', data);
        }
        document.getElementById('modal').classList.remove('open');
        loadDepts();
    } catch (err) {
        alert('Σφάλμα: ' + err.message);
    }
}

function openModal()  { document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }

loadDepts();
