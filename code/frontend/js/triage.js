let allTriage  = [];
let currentTab = 'waiting';
let currentPage = 1;
const PAGE_SIZE = 10;

const URG_LABELS = {
    1: 'Άμεσο',
    2: 'Επείγον',
    3: 'Επιτακτικό',
    4: 'Λιγότερο Επείγον',
    5: 'Μη Επείγον'
};

const URG_COLORS = {
    1: '#dc2626',
    2: '#ea580c',
    3: '#d97706',
    4: '#65a30d',
    5: '#16a34a'
};

async function loadTriage() {
    try {
        allTriage = await api.get('/triage');
        filterAndRender();
    } catch (err) {
        document.getElementById('triage-tbody').innerHTML =
            '<tr><td colspan="8" class="empty">Σφάλμα φόρτωσης</td></tr>';
    }
}

function switchTab(tab) {
    currentTab  = tab;
    currentPage = 1;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    const titles = {
        waiting: 'Σε Αναμονή',
        served:  'Εξυπηρετημένοι',
        all:     'Όλες οι Εγγραφές'
    };
    document.getElementById('tab-title').textContent = titles[tab];
    filterAndRender();
}

function filterAndRender() {
    const q = document.getElementById('search-input').value.toLowerCase();
    let filtered = allTriage;

    if (currentTab === 'waiting') filtered = filtered.filter(t => !t.service_time);
    if (currentTab === 'served')  filtered = filtered.filter(t =>  t.service_time);

    if (q) {
        filtered = filtered.filter(t =>
            t.patient_first_name.toLowerCase().includes(q) ||
            t.patient_last_name.toLowerCase().includes(q)  ||
            t.patient_amka.includes(q)
        );
    }

    // Ταξινόμηση: αναμονή πρώτα κατά επίπεδο επείγοντος
    if (currentTab === 'waiting') {
        filtered.sort((a, b) => a.urg_level - b.urg_level);
    }

    renderTable(filtered);
}

function searchTriage() { currentPage = 1; filterAndRender(); }

function renderTable(entries) {
    const tbody = document.getElementById('triage-tbody');
    const start = (currentPage - 1) * PAGE_SIZE;
    const page  = entries.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">Δεν βρέθηκαν εγγραφές</td></tr>';
        renderPagination(0);
        return;
    }

    tbody.innerHTML = page.map(t => `
        <tr>
            <td><span class="mono">#${t.id}</span></td>
            <td>
                <strong>${t.patient_last_name} ${t.patient_first_name}</strong><br>
                <small style="color:var(--text-secondary)">${t.patient_amka}</small>
            </td>
            <td>
                <span class="triage-badge level-${t.urg_level}" style="display:inline-flex">
                    ${t.urg_level}
                </span>
                <span style="font-size:12px;color:var(--text-secondary);margin-left:6px">
                    ${URG_LABELS[t.urg_level]}
                </span>
            </td>
            <td>${new Date(t.arrival_time).toLocaleString('el-GR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
            <td>${t.service_time
                ? new Date(t.service_time).toLocaleString('el-GR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
                : '<span style="color:var(--amber);font-weight:500">⏳ Αναμονή</span>'}</td>
            <td>${t.nurse_last_name} ${t.nurse_first_name}</td>
            <td>${t.department}</td>
            <td>
                <div class="action-btns">
                    ${!t.service_time
                        ? `<button class="btn btn-sm btn-primary" onclick="serveEntry(${t.id})">Εξυπηρέτηση</button>`
                        : '<span style="color:var(--green);font-size:12px">✓ Εξυπηρετήθηκε</span>'}
                </div>
            </td>
        </tr>
    `).join('');

    renderPagination(entries.length);
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
// NEW TRIAGE
// =============================================

async function newTriage() {
    const nurses = await api.get('/nurses');
    const depts  = await api.get('/departments');

    // Φόρτωσε ασθενείς για search
    const patients = await api.get('/patients');

    document.getElementById('modal-title').textContent = 'Νέα Εγγραφή Triage';
    document.getElementById('modal-body').innerHTML = `
        <div class="form-grid">

            <!-- ΑΣΘΕΝΗΣ — search -->
            <div class="form-group form-full">
                <label>Ασθενής *</label>
                <input id="patient-search" type="text" class="form-input"
                    placeholder="Αναζήτηση ονόματος ή ΑΜΚΑ..." oninput="searchTriagePatient()">
                <div id="patient-results" style="display:none;max-height:150px;overflow-y:auto;
                    border:1px solid var(--border);border-radius:var(--radius-sm);
                    margin-top:4px;background:var(--surface)"></div>
                <div id="patient-selected" style="margin-top:6px;font-size:13px;color:var(--blue)"></div>
                <input type="hidden" id="f-patient">
            </div>

            <div class="form-group form-full">
                <label>Νοσηλευτής *</label>
                <select id="f-nurse" class="form-input">
                    ${nurses.map(n =>
                        `<option value="${n.id}">${n.last_name} ${n.first_name}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group form-full">
                <label>Τμήμα Επειγόντων *</label>
                <div style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);
                    border-radius:var(--radius-sm);font-size:13px;color:var(--text-secondary)">
                    Emergency Department
                </div>
                <input type="hidden" id="f-dept" 
                    value="${depts.find(d => d.name === 'Emergency Department')?.id || ''}">
            </div>
            <div class="form-group form-full">
                <label>Επίπεδο Επείγοντος *</label>
                <select id="f-level" class="form-input">
                    <option value="1">1 — Άμεσο</option>
                    <option value="2">2 — Επείγον</option>
                    <option value="3">3 — Επιτακτικό</option>
                    <option value="4">4 — Λιγότερο Επείγον</option>
                    <option value="5">5 — Μη Επείγον</option>
                </select>
            </div>
            <div class="form-group">
                <label>Ώρα Άφιξης *</label>
                <input id="f-arrival" type="datetime-local" class="form-input">
            </div>
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="saveTriage()">Αποθήκευση</button>
    `;
    openModal();

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('f-arrival').value = now.toISOString().slice(0, 16);

    // Αποθήκευσε ασθενείς για search
    window._triagePatients = patients;
}

function searchTriagePatient() {
    const q       = document.getElementById('patient-search').value.toLowerCase();
    const results = document.getElementById('patient-results');
    if (!q) { results.style.display = 'none'; return; }

    const filtered = (window._triagePatients || []).filter(p =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q)  ||
        p.patient_amka.includes(q)
    ).slice(0, 10);

    if (!filtered.length) { results.style.display = 'none'; return; }
    results.style.display = 'block';
    results.innerHTML = filtered.map(p => `
        <div onclick="selectTriagePatient(${p.id}, '${p.last_name} ${p.first_name}', '${p.patient_amka}')"
            style="padding:8px 12px;cursor:pointer;font-size:13px;
                   border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'"
            onmouseout="this.style.background=''">
            <strong>${p.last_name} ${p.first_name}</strong>
            <span style="color:var(--text-secondary);margin-left:8px">${p.patient_amka}</span>
        </div>
    `).join('');
}

function selectTriagePatient(id, name, amka) {
    document.getElementById('f-patient').value = id;
    document.getElementById('patient-search').value = '';
    document.getElementById('patient-results').style.display = 'none';
    document.getElementById('patient-selected').innerHTML = `
        ✓ <strong>${name}</strong>
        <span style="color:var(--text-secondary)">${amka}</span>
        <button onclick="clearTriagePatient()"
            style="background:none;border:none;cursor:pointer;
                   color:var(--text-secondary);margin-left:6px">✕</button>
    `;
}

function clearTriagePatient() {
    document.getElementById('f-patient').value = '';
    document.getElementById('patient-selected').innerHTML = '';
}

async function saveTriage() {
    const patientVal = document.getElementById('f-patient').value;
    if (!patientVal) {
        alert('Παρακαλώ επιλέξτε ασθενή');
        return;
    }

    const data = {
        patient_id:    parseInt(patientVal),
        nurse_id:      parseInt(document.getElementById('f-nurse').value),
        department_id: parseInt(document.getElementById('f-dept').value),
        urg_level:     parseInt(document.getElementById('f-level').value),
        arrival_time:  document.getElementById('f-arrival').value.replace('T', ' '),
        service_time:   null
    };

    try {
        await api.post('/triage', data);
        document.getElementById('modal').classList.remove('open');
        loadTriage();
    } catch (err) {
        alert('Σφάλμα: ' + err.message);
    }
}

// =============================================
// SERVE
// =============================================

function serveEntry(id) {
    document.getElementById('modal-title').textContent = 'Εξυπηρέτηση Ασθενή';
    document.getElementById('modal-body').innerHTML = `
        <div class="form-grid">
            <div class="form-group form-full">
                <label>Ώρα Εξυπηρέτησης *</label>
                <input id="f-service-time" type="datetime-local" class="form-input">
            </div>
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Άκυρο</button>
        <button class="btn btn-primary" onclick="confirmServe(${id})">Επιβεβαίωση</button>
    `;

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('f-service-time').value = now.toISOString().slice(0, 16);

    openModal();
}

async function confirmServe(id) {
    const service_time = document.getElementById('f-service-time').value;
    try {
        await api.put(`/triage/${id}/serve`, { service_time });
        document.getElementById('modal').classList.remove('open');
        loadTriage();
    } catch (err) {
        alert('Σφάλμα: ' + err.message);
    }
}

function openModal()  { document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }

loadTriage();
