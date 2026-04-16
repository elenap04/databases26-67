const QUERIES = [
    { id: 'Q01', description: 'Συνολικά έσοδα ανά τμήμα και έτος', params: [] },
    { id: 'Q02', description: 'Ιατροί ανά ειδικότητα με εφημερίες και επεμβάσεις',
      params: [{ key: 'specialization', label: 'Ειδικότητα', type: 'text', placeholder: 'π.χ. Cardiology' }] },
    { id: 'Q03', description: 'Ασθενείς με >3 νοσηλείες στο ίδιο τμήμα', params: [] },
    { id: 'Q04', description: 'Μέσος όρος αξιολογήσεων συγκεκριμένου ιατρού',
      params: [{ key: 'doctor_id', label: 'ID Ιατρού', type: 'number', placeholder: '1' }] },
    { id: 'Q05', description: 'Νέοι ιατροί (<35) με τις περισσότερες χειρουργικές επεμβάσεις', params: [] },
    { id: 'Q06', description: 'Ιστορικό νοσηλειών συγκεκριμένου ασθενή',
      params: [{ key: 'patient_id', label: 'ID Ασθενή', type: 'number', placeholder: '1' }] },
    { id: 'Q07', description: 'Δραστικές ουσίες: αλλεργίες και φάρμακα', params: [] },
    { id: 'Q08', description: 'Προσωπικό χωρίς εφημερία σε ημερομηνία και τμήμα',
      params: [
        { key: 'dept_id',   label: 'ID Τμήματος', type: 'number', placeholder: '1' },
        { key: 'date',      label: 'Ημερομηνία',  type: 'date' }
      ] },
    { id: 'Q09', description: 'Ασθενείς με ίδιο αριθμό νοσηλείας ημερών',
      params: [{ key: 'year', label: 'Έτος', type: 'number', placeholder: '2025' }] },
    { id: 'Q10', description: 'Top-3 ζεύγη δραστικών ουσιών που συνταγογραφήθηκαν μαζί', params: [] },
    { id: 'Q11', description: 'Ιατροί με ≥5 λιγότερες επεμβάσεις από τον πρώτο', params: [] },
    { id: 'Q12', description: 'Προσωπικό ανά τμήμα και βάρδια για εβδομάδα',
      params: [{ key: 'week_start', label: 'Έναρξη Εβδομάδας (Δευτέρα)', type: 'date' }] },
    { id: 'Q13', description: 'Ιεραρχία εποπτείας ιατρών', params: [] },
    { id: 'Q14', description: 'ICD-10 κατηγορίες με ίδιο αριθμό εισαγωγών σε συνεχόμενα έτη', params: [] },
    { id: 'Q15', description: 'Κατανομή triage ανά επίπεδο επείγοντος', params: [] }
];

let activeQuery = null;

function init() {
    const list = document.getElementById('query-list');
    list.innerHTML = QUERIES.map(q => `
        <button class="query-item" id="qbtn-${q.id}" onclick="selectQuery('${q.id}')">
            <span class="query-id">${q.id}</span>
            <span class="query-desc">${q.description}</span>
        </button>
    `).join('');
}

function selectQuery(id) {
    activeQuery = QUERIES.find(q => q.id === id);
    if (!activeQuery) return;

    document.querySelectorAll('.query-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`qbtn-${id}`).classList.add('active');

    document.getElementById('query-title').textContent = activeQuery.id;
    document.getElementById('query-desc').textContent  = activeQuery.description;
    document.getElementById('query-panel').style.display = 'block';
    document.getElementById('results-panel').style.display = 'none';

    const paramsDiv = document.getElementById('query-params');
    if (activeQuery.params.length === 0) {
        paramsDiv.innerHTML = '<div style="color:var(--text-secondary);font-size:13px">Δεν απαιτούνται παράμετροι.</div>';
    } else {
        paramsDiv.innerHTML = `
            <div class="form-grid">
                ${activeQuery.params.map(p => `
                    <div class="form-group">
                        <label>${p.label}</label>
                        <input id="param-${p.key}" type="${p.type}" class="form-input"
                            placeholder="${p.placeholder || ''}" value="${p.default || ''}">
                    </div>
                `).join('')}
            </div>
        `;
    }
}

async function runQuery() {
    if (!activeQuery) return;

    const params = {};
    for (const p of activeQuery.params) {
        const val = document.getElementById(`param-${p.key}`)?.value;
        if (val) params[p.key] = p.type === 'number' ? parseInt(val) : val;
    }

    document.getElementById('query-results').innerHTML = '<div class="loading">Εκτέλεση...</div>';
    document.getElementById('results-panel').style.display = 'block';
    document.getElementById('results-count').textContent = '';

    try {
        const data = await api.post(`/queries/${activeQuery.id}`, params);
        const results = data.results || [];

        document.getElementById('results-count').textContent = `${results.length} αποτελέσματα`;

        if (results.length === 0) {
            document.getElementById('query-results').innerHTML =
                '<div class="empty">Δεν βρέθηκαν αποτελέσματα</div>';
            return;
        }

        const cols = Object.keys(results[0]);
        document.getElementById('query-results').innerHTML = `
            <table class="table">
                <thead>
                    <tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${results.map(row => `
                        <tr>${cols.map(c => `<td>${row[c] ?? '—'}</td>`).join('')}</tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        document.getElementById('query-results').innerHTML =
            `<div class="empty" style="color:var(--rose)">Σφάλμα: ${err.message}</div>`;
    }
}

// CSS για query list
const style = document.createElement('style');
style.textContent = `
.query-item {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: var(--radius-sm);
    text-align: left;
    transition: background .15s;
    margin-bottom: 2px;
}
.query-item:hover { background: var(--bg); }
.query-item.active { background: #dbeafe; }
.query-id {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--blue);
    background: #eff6ff;
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
    margin-top: 1px;
}
.query-desc {
    font-size: 12px;
    color: var(--text-primary);
    line-height: 1.4;
}
.query-item.active .query-desc { color: var(--blue); }
`;
document.head.appendChild(style);

init();
