const TRIAGE_LABELS = {
    1: 'Άμεσο',
    2: 'Επείγον',
    3: 'Επιτακτικό',
    4: 'Λιγότερο Επείγον',
    5: 'Μη Επείγον'
};


 
// Clock
function updateClock() {
    const now  = new Date();
    const time = now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = now.toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('sidebar-time').textContent = time;
    document.getElementById('sidebar-date').textContent = date;
}
setInterval(updateClock, 1000);
updateClock();
 
async function loadDashboard() {
    try {
        const data = await api.get('/dashboard');
 
        // Stats
        document.getElementById('total-patients').textContent   = data.patients.total_patients ?? '—';
        document.getElementById('total-doctors').textContent    = data.staff.total_doctors ?? '—';
        document.getElementById('total-nurses').textContent     = data.staff.total_nurses ?? '—';
        document.getElementById('total-admin').textContent      = data.staff.total_admin ?? '—';
        document.getElementById('active-hosp').textContent      = data.hospitalizations.active ?? '—';
        document.getElementById('triage-waiting').textContent   = data.triage.waiting ?? '—';
        document.getElementById('surgeries-today').textContent  = data.surgeries.surgeries_today ?? '—';
        document.getElementById('monthly-revenue').textContent  =
            data.revenue.monthly
                ? Number(data.revenue.monthly).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })
                : '—';
 
        // Beds status
        const beds = data.beds;
        const total = beds.total_beds || 1;
        document.getElementById('beds-status').innerHTML = `
            <div class="beds-bars">
                <div class="bed-row">
                    <span class="bed-label">Διαθέσιμες</span>
                    <div class="bed-bar-wrap">
                        <div class="bed-bar available" style="width:${(beds.available_beds/total*100).toFixed(1)}%"></div>
                    </div>
                    <span class="bed-count">${beds.available_beds}</span>
                </div>
                <div class="bed-row">
                    <span class="bed-label">Κατειλημμένες</span>
                    <div class="bed-bar-wrap">
                        <div class="bed-bar occupied" style="width:${(beds.occupied_beds/total*100).toFixed(1)}%"></div>
                    </div>
                    <span class="bed-count">${beds.occupied_beds}</span>
                </div>
                <div class="bed-row">
                    <span class="bed-label">Συντήρηση</span>
                    <div class="bed-bar-wrap">
                        <div class="bed-bar maintenance" style="width:${(beds.maintenance_beds/total*100).toFixed(1)}%"></div>
                    </div>
                    <span class="bed-count">${beds.maintenance_beds}</span>
                </div>
                <div class="bed-row" style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
                    <span class="bed-label" style="font-weight:600">Σύνολο</span>
                    <div class="bed-bar-wrap"></div>
                    <span class="bed-count" style="font-weight:600">${beds.total_beds}</span>
                </div>
            </div>
        `;
 
  // Triage levels
const levels = data.triage.by_level;
if (!levels || levels.length === 0) {
    document.getElementById('triage-levels').innerHTML = 
        '<div class="empty">Δεν υπάρχουν ασθενείς σε αναμονή</div>';
} else {
    // Ομαδοποίησε ανά επίπεδο
    const grouped = {};
    levels.forEach(t => {
        if (!grouped[t.urg_level]) grouped[t.urg_level] = [];
        grouped[t.urg_level].push(t);
    });

    const LABELS = {
        1: 'Άμεσο', 2: 'Επείγον', 3: 'Επιτακτικό',
        4: 'Λιγότερο Επείγον', 5: 'Μη Επείγον'
    };

document.getElementById('triage-levels').innerHTML = `
    <div style="max-height:220px;overflow-y:auto">
        <div class="triage-levels">
            ${Object.entries(grouped).map(([level, patients]) => `
                <div style="margin-bottom:12px">
                    <div class="triage-row" style="margin-bottom:6px">
                        <div class="triage-badge level-${level}">${level}</div>
                        <span class="triage-desc"><strong>${LABELS[level]}</strong></span>
                        <span class="triage-count" style="margin-left:0;margin-right:50px">
                          ${patients.length}
                       </span>
                    </div>
                   ${patients.map(p => `
    <div style="font-size:12px;color:var(--text-secondary);
                padding:3px 0 3px 40px;border-left:2px solid var(--border);
                margin-left:14px">
        ${p.last_name} ${p.first_name}
    </div>
`).join('')}
                </div>
            `).join('')}
        </div>
    </div>
`;
}
 
        // Current shifts
        const shifts = data.current_shifts;
        if (!shifts || shifts.length === 0) {
            document.getElementById('current-shifts').innerHTML = '<div class="empty">Δεν υπάρχουν ενεργές βάρδιες</div>';
        } else {
            document.getElementById('current-shifts').innerHTML = `
                <div class="shift-list">
                    ${shifts.map(s => `
                        <div class="shift-row">
                            <div>
                                <div class="shift-dept">${s.department}</div>
                                <div class="shift-type">${s.type}</div>
                            </div>
                            <div class="shift-counts">
                                <span class="shift-count-badge badge-doc">🩺 ${s.doctors_count}</span>
                                <span class="shift-count-badge badge-nurse">💊 ${s.nurses_count}</span>
                                <span class="shift-count-badge badge-admin">📋 ${s.admin_count}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
 
        // Departments table
        const tbody = document.getElementById('dept-tbody');
        if (!data.departments || data.departments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">Δεν βρέθηκαν τμήματα</td></tr>';
        } else {
            tbody.innerHTML = data.departments.map(d => {
                const occupancy = d.total_beds > 0
                    ? ((d.occupied_beds / d.total_beds) * 100).toFixed(0)
                    : 0;
                const cls = occupancy < 50 ? 'occupancy-low'
                          : occupancy < 80 ? 'occupancy-medium'
                          : 'occupancy-high';
                return `
                    <tr>
                        <td><strong>${d.department}</strong></td>
                        <td>${d.total_beds}</td>
                        <td style="color:var(--green)">${d.available_beds}</td>
                        <td style="color:var(--rose)">${d.occupied_beds}</td>
                        <td>${d.active_hospitalizations}</td>
                        <td>
                            <div class="occupancy-bar-wrap">
                                <div class="occupancy-bar ${cls}" style="width:${occupancy}%"></div>
                            </div>
                            <span class="occupancy-text">${occupancy}%</span>
                        </td>
                    </tr>
                `;
            }).join('');
        }
 
    } catch (err) {
        console.error('Dashboard load error:', err);
    }
}
 
loadDashboard();
// Auto-refresh κάθε 60 δευτερόλεπτα
setInterval(loadDashboard, 60000);