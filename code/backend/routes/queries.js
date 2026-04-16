const express = require('express');
const router  = express.Router();
const pool    = require('../db');

const QUERIES = {

    Q01: {
        description: 'Συνολικά έσοδα ανά τμήμα και έτος',
        params: [],
        sql: `SELECT d.id AS department_id, d.name AS department_name, YEAR(h.admission_date) AS hosp_year, ak.KEN_code AS ken_code, COALESCE(ip.name, 'Uninsured') AS insurance_provider, COUNT(*) AS hospitalizations_count, SUM(k.base_cost) AS total_basic_revenue, SUM(CASE WHEN DATEDIFF(h.discharge_date, h.admission_date) > k.mdh THEN (DATEDIFF(h.discharge_date, h.admission_date) - k.mdh) * k.daily_extra_charge ELSE 0 END) AS total_extra_revenue, SUM(k.base_cost + CASE WHEN DATEDIFF(h.discharge_date, h.admission_date) > k.mdh THEN (DATEDIFF(h.discharge_date, h.admission_date) - k.mdh) * k.daily_extra_charge ELSE 0 END) AS total_revenue FROM hospitalization h JOIN bed b ON b.no = h.bed_no AND b.dept_id = h.bed_dept_id JOIN department d ON d.id = b.dept_id JOIN assigned_ken ak ON ak.hospitalization_id = h.id JOIN KEN k ON k.code = ak.KEN_code JOIN patient p ON p.id = h.patient_id LEFT JOIN has_insurance hi ON hi.patient_id = p.id LEFT JOIN insurance_provider ip ON ip.id = hi.insurance_provider_id WHERE h.discharge_date IS NOT NULL GROUP BY d.id, d.name, YEAR(h.admission_date), ak.KEN_code, COALESCE(ip.name, 'Uninsured') ORDER BY hosp_year, department_name, ken_code`
    },

    Q02: {
        description: 'Ιατροί ανά ειδικότητα με εφημερίες και επεμβάσεις',
        params: [{ name: 'specialization', label: 'Ειδικότητα', type: 'text', default: 'Cardiology' }],
        sql: null  // defined below as function
    },

    Q03: {
        description: 'Ασθενείς με >3 νοσηλείες στο ίδιο τμήμα',
        params: [],
        sql: `SELECT p.id AS patient_id, p.first_name, p.last_name, d.id AS department_id, d.name AS department_name, COUNT(*) AS hospitalizations_count, SUM(h.total_cost) AS total_hospitalization_cost FROM hospitalization h JOIN patient p ON p.id = h.patient_id JOIN department d ON d.id = h.bed_dept_id WHERE h.total_cost IS NOT NULL GROUP BY p.id, p.first_name, p.last_name, d.id, d.name HAVING COUNT(*) > 3 ORDER BY hospitalizations_count DESC, total_hospitalization_cost DESC, p.last_name ASC, p.first_name ASC`
    },

    Q04: {
        description: 'Μέσος όρος αξιολογήσεων συγκεκριμένου ιατρού',
        params: [{ name: 'doctor_id', label: 'ID Ιατρού', type: 'number', default: 1 }],
        sql: null
    },

    Q05: {
        description: 'Νέοι ιατροί (<35) με τις περισσότερες χειρουργικές επεμβάσεις',
        params: [],
        sql: `WITH doctor_surgery_counts AS (SELECT d.id AS doctor_id, s.first_name, s.last_name, TIMESTAMPDIFF(YEAR, s.date_of_birth, CURDATE()) AS age, COUNT(*) AS surgery_count FROM doctor d JOIN staff s ON s.id = d.id JOIN surgery su ON su.doctor_id = d.id WHERE TIMESTAMPDIFF(YEAR, s.date_of_birth, CURDATE()) < 35 GROUP BY d.id, s.first_name, s.last_name, s.date_of_birth) SELECT doctor_id, first_name, last_name, age, surgery_count FROM doctor_surgery_counts WHERE surgery_count = (SELECT MAX(surgery_count) FROM doctor_surgery_counts) ORDER BY last_name ASC, first_name ASC`
    },

    Q06: {
        description: 'Ιστορικό νοσηλειών συγκεκριμένου ασθενή',
        params: [{ name: 'patient_id', label: 'ID Ασθενή', type: 'number', default: 10 }],
        sql: null
    },

    Q07: {
        description: 'Δραστικές ουσίες: αλλεργικοί ασθενείς και φάρμακα',
        params: [],
        sql: `WITH allergic_counts AS (SELECT active_substance_id, COUNT(*) AS allergic_patients_count FROM is_allergic GROUP BY active_substance_id), medication_counts AS (SELECT active_substance_id, COUNT(*) AS medications_count FROM contains GROUP BY active_substance_id) SELECT a.id AS substance_id, a.name AS substance_name, COALESCE(ac.allergic_patients_count, 0) AS allergic_patients_count, COALESCE(mc.medications_count, 0) AS medications_count FROM active_substance a LEFT JOIN allergic_counts ac ON ac.active_substance_id = a.id LEFT JOIN medication_counts mc ON mc.active_substance_id = a.id ORDER BY allergic_patients_count DESC, medications_count DESC, a.name ASC`
    },

    Q08: {
        description: 'Προσωπικό χωρίς εφημερία σε συγκεκριμένη ημερομηνία και τμήμα',
        params: [
            { name: 'dept_id', label: 'ID Τμήματος', type: 'number', default: 1 },
            { name: 'date',    label: 'Ημερομηνία',  type: 'date',   default: '2025-01-06' }
        ],
        sql: null
    },

    Q09: {
        description: 'Ασθενείς με ίδιο αριθμό νοσηλείας ημερών (>15) στο ίδιο έτος',
        params: [{ name: 'year', label: 'Έτος', type: 'number', default: 2025 }],
        sql: null
    },

    Q10: {
        description: 'Top-3 ζεύγη δραστικών ουσιών που συνταγογραφήθηκαν μαζί',
        params: [],
        sql: `WITH simultaneous_substance_pairs AS (SELECT DISTINCT p1.hospitalization_id, c1.active_substance_id AS substance_id_1, c2.active_substance_id AS substance_id_2 FROM prescription p1 JOIN prescription p2 ON p1.hospitalization_id = p2.hospitalization_id AND p1.id < p2.id AND p1.pres_day <= p2.exp_date AND p2.pres_day <= p1.exp_date JOIN contains c1 ON c1.medication_id = p1.medication_id JOIN contains c2 ON c2.medication_id = p2.medication_id WHERE c1.active_substance_id < c2.active_substance_id), pair_counts AS (SELECT substance_id_1, substance_id_2, COUNT(*) AS pair_count FROM simultaneous_substance_pairs GROUP BY substance_id_1, substance_id_2) SELECT a1.name AS substance_1, a2.name AS substance_2, pc.pair_count FROM pair_counts pc JOIN active_substance a1 ON a1.id = pc.substance_id_1 JOIN active_substance a2 ON a2.id = pc.substance_id_2 ORDER BY pc.pair_count DESC, a1.name ASC, a2.name ASC LIMIT 3`
    },

    Q11: {
        description: 'Ιατροί με τουλάχιστον 5 λιγότερες επεμβάσεις από τον πρώτο',
        params: [],
        sql: `WITH surgeries_all_time AS (SELECT doctor_id, COUNT(*) AS surgery_count FROM surgery GROUP BY doctor_id), max_surgeries AS (SELECT IFNULL(MAX(surgery_count), 0) AS max_count FROM surgeries_all_time) SELECT d.id AS doctor_id, s.first_name, s.last_name, IFNULL(sat.surgery_count, 0) AS doctor_surgeries, m.max_count AS surgery_max FROM doctor d JOIN staff s ON s.id = d.id CROSS JOIN max_surgeries m LEFT JOIN surgeries_all_time sat ON sat.doctor_id = d.id WHERE IFNULL(sat.surgery_count, 0) + 5 < m.max_count ORDER BY doctor_surgeries DESC, s.last_name ASC`
    },

    Q12: {
        description: 'Προσωπικό ανά τμήμα και βάρδια για συγκεκριμένη εβδομάδα',
        params: [{ name: 'week_start', label: 'Έναρξη εβδομάδας', type: 'date', default: '2025-01-06' }],
        sql: null
    },

    Q13: {
        description: 'Ιεραρχία εποπτείας ιατρών (Recursive CTE)',
        params: [],
        sql: `WITH RECURSIVE supervision_hierarchy AS (SELECT d.id AS doctor_id, d.supervisor_id, 1 AS hierarchy_level FROM doctor d WHERE d.supervisor_id IS NOT NULL UNION ALL SELECT sh.doctor_id, d.supervisor_id, sh.hierarchy_level + 1 FROM supervision_hierarchy sh JOIN doctor d ON d.id = sh.supervisor_id WHERE d.supervisor_id IS NOT NULL) SELECT doc.id AS doctor_id, s_doc.first_name AS doctor_first_name, s_doc.last_name AS doctor_last_name, sh.hierarchy_level, sup.id AS supervisor_id, s_sup.first_name AS supervisor_first_name, s_sup.last_name AS supervisor_last_name, dg.name AS supervisor_grade FROM supervision_hierarchy sh JOIN doctor doc ON doc.id = sh.doctor_id JOIN staff s_doc ON s_doc.id = doc.id JOIN doctor sup ON sup.id = sh.supervisor_id JOIN staff s_sup ON s_sup.id = sup.id JOIN doc_grade dg ON dg.id = sup.doc_grade_id ORDER BY doc.id ASC, sh.hierarchy_level ASC`
    },

    Q14: {
        description: 'ICD-10 κατηγορίες με ίδιο αριθμό εισαγωγών σε δύο συνεχόμενα έτη',
        params: [],
        sql: `WITH icd_per_year AS (SELECT LEFT(ad.hosp_entry_code, 3) AS icd_category, YEAR(h.admission_date) AS hosp_year, COUNT(DISTINCT ad.hospitalization_id) AS admission_count FROM admission_diag ad JOIN hospitalization h ON h.id = ad.hospitalization_id GROUP BY LEFT(ad.hosp_entry_code, 3), YEAR(h.admission_date) HAVING COUNT(DISTINCT ad.hospitalization_id) >= 3) SELECT y1.icd_category, y1.hosp_year AS year_1, y2.hosp_year AS year_2, y1.admission_count FROM icd_per_year y1 JOIN icd_per_year y2 ON y1.icd_category = y2.icd_category AND y2.hosp_year = y1.hosp_year + 1 AND y1.admission_count = y2.admission_count ORDER BY y1.icd_category, y1.hosp_year`
    },

    Q15: {
        description: 'Κατανομή triage ανά επίπεδο επείγοντος',
        params: [],
        sql: `WITH triage_base AS (SELECT t.id, t.urg_level, t.arrival_time, t.service_time, TIMESTAMPDIFF(MINUTE, t.arrival_time, t.service_time) AS wait_minutes, CASE WHEN h.id IS NOT NULL THEN 1 ELSE 0 END AS is_hospitalized, h.bed_dept_id AS referred_dept_id FROM triage_entry t LEFT JOIN hospitalization h ON h.triage_entry_id = t.id WHERE t.service_time IS NOT NULL), triage_stats AS (SELECT urg_level, COUNT(*) AS total_count, ROUND(AVG(wait_minutes), 2) AS avg_wait_minutes, SUM(is_hospitalized) AS hospitalized_count FROM triage_base GROUP BY urg_level), dept_distribution AS (SELECT tb.urg_level, d.name AS department, COUNT(*) AS dept_count FROM triage_base tb JOIN department d ON d.id = tb.referred_dept_id WHERE tb.is_hospitalized = 1 GROUP BY tb.urg_level, d.name) SELECT ts.urg_level, ts.total_count, ts.avg_wait_minutes, ts.hospitalized_count, ROUND(ts.hospitalized_count * 100.0 / NULLIF(ts.total_count, 0), 2) AS hospitalization_pct, dd.department, dd.dept_count, ROUND(dd.dept_count * 100.0 / NULLIF(ts.hospitalized_count, 0), 2) AS dept_pct FROM triage_stats ts LEFT JOIN dept_distribution dd ON dd.urg_level = ts.urg_level ORDER BY ts.urg_level ASC, dd.dept_count DESC, dd.department ASC`
    }
};

// Queries με παραμέτρους — ορίζονται ως functions μετά το object
QUERIES.Q02.sql = (p) => `WITH doctors_with_shift AS (SELECT DISTINCT dsh.doctor_id FROM doctor_shift dsh JOIN shift sh ON sh.id = dsh.shift_id WHERE YEAR(sh.start_time) = YEAR(CURDATE())), surgeries_this_year AS (SELECT sur.doctor_id, COUNT(*) AS surgeries_as_primary FROM surgery sur WHERE YEAR(sur.start_time) = YEAR(CURDATE()) GROUP BY sur.doctor_id) SELECT s.id AS doctor_id, s.first_name, s.last_name, ds.name AS specialization, dg.name AS grade, CASE WHEN dws.doctor_id IS NOT NULL THEN 'Yes' ELSE 'No' END AS had_shift_this_year, COALESCE(sty.surgeries_as_primary, 0) AS surgeries_as_primary FROM doctor d JOIN staff s ON s.id = d.id JOIN doc_spec ds ON ds.id = d.doc_spec_id JOIN doc_grade dg ON dg.id = d.doc_grade_id LEFT JOIN doctors_with_shift dws ON dws.doctor_id = d.id LEFT JOIN surgeries_this_year sty ON sty.doctor_id = d.id WHERE ds.name = '${p.specialization}' COLLATE utf8mb4_unicode_ci ORDER BY surgeries_as_primary DESC, s.last_name ASC, s.first_name ASC`;

QUERIES.Q04.sql = (p) => `WITH doctor_hospitalizations AS (SELECT sur.hospitalization_id FROM surgery sur WHERE sur.doctor_id = ${parseInt(p.doctor_id)} UNION SELECT le.hospitalization_id FROM lab_exam le WHERE le.doctor_id = ${parseInt(p.doctor_id)} UNION SELECT mp.hospitalization_id FROM exam_doc ed JOIN med_proc mp ON mp.id = ed.med_proc_id WHERE ed.doctor_id = ${parseInt(p.doctor_id)}), doctor_eval_stats AS (SELECT COUNT(DISTINCT e.id) AS evaluations_count, ROUND(AVG(e.qual_med_care), 2) AS avg_medical_care_quality, ROUND(AVG(e.tot_experience), 2) AS avg_total_experience FROM doctor_hospitalizations dh JOIN evaluation e ON e.hospitalization_id = dh.hospitalization_id) SELECT d.id AS doctor_id, s.first_name, s.last_name, COALESCE(des.evaluations_count, 0) AS evaluations_count, des.avg_medical_care_quality, des.avg_total_experience FROM doctor d JOIN staff s ON s.id = d.id LEFT JOIN doctor_eval_stats des ON TRUE WHERE d.id = ${parseInt(p.doctor_id)}`;

QUERIES.Q06.sql = (p) => `SELECT h.id AS hospitalization_id, h.admission_date, h.discharge_date, d.name AS department, ad.admission_diagnoses, dd.discharge_diagnoses, h.total_cost, ROUND((COALESCE(e.qual_med_care,0)+COALESCE(e.qual_nurse_care,0)+COALESCE(e.cleanness,0)+COALESCE(e.food,0)+COALESCE(e.tot_experience,0))/5,2) AS avg_evaluation FROM hospitalization h JOIN department d ON d.id = h.bed_dept_id LEFT JOIN (SELECT ad.hospitalization_id, GROUP_CONCAT(DISTINCT CONCAT(ad.hosp_entry_code,' - ',he.description) ORDER BY ad.hosp_entry_code SEPARATOR ', ') AS admission_diagnoses FROM admission_diag ad JOIN hosp_entry he ON he.code = ad.hosp_entry_code GROUP BY ad.hospitalization_id) ad ON ad.hospitalization_id = h.id LEFT JOIN (SELECT dd.hospitalization_id, GROUP_CONCAT(DISTINCT CONCAT(dd.hosp_entry_code,' - ',he.description) ORDER BY dd.hosp_entry_code SEPARATOR ', ') AS discharge_diagnoses FROM discharge_diag dd JOIN hosp_entry he ON he.code = dd.hosp_entry_code GROUP BY dd.hospitalization_id) dd ON dd.hospitalization_id = h.id LEFT JOIN evaluation e ON e.hospitalization_id = h.id WHERE h.patient_id = ${parseInt(p.patient_id)} ORDER BY h.admission_date DESC`;

QUERIES.Q08.sql = (p) => `WITH eligible_staff AS (SELECT d.id AS staff_id FROM doctor d JOIN doc_belongs db ON db.doctor_id = d.id WHERE db.department_id = ${parseInt(p.dept_id)} UNION SELECT n.id FROM nurse n WHERE n.department_id = ${parseInt(p.dept_id)} UNION SELECT a.id FROM admin_staff a WHERE a.department_id = ${parseInt(p.dept_id)}), staff_with_shift AS (SELECT ds.doctor_id AS staff_id FROM doctor_shift ds JOIN shift sh ON sh.id = ds.shift_id WHERE sh.dept_id = ${parseInt(p.dept_id)} AND sh.start_time >= '${p.date}' AND sh.start_time < DATE_ADD('${p.date}', INTERVAL 1 DAY) UNION SELECT ns.nurse_id FROM nurse_shift ns JOIN shift sh ON sh.id = ns.shift_id WHERE sh.dept_id = ${parseInt(p.dept_id)} AND sh.start_time >= '${p.date}' AND sh.start_time < DATE_ADD('${p.date}', INTERVAL 1 DAY) UNION SELECT ads.admin_staff_id FROM admin_shift ads JOIN shift sh ON sh.id = ads.shift_id WHERE sh.dept_id = ${parseInt(p.dept_id)} AND sh.start_time >= '${p.date}' AND sh.start_time < DATE_ADD('${p.date}', INTERVAL 1 DAY)) SELECT s.id AS staff_id, s.first_name, s.last_name, s.staff_type FROM eligible_staff es JOIN staff s ON s.id = es.staff_id LEFT JOIN staff_with_shift sws ON sws.staff_id = es.staff_id WHERE sws.staff_id IS NULL ORDER BY s.staff_type ASC, s.last_name ASC, s.first_name ASC`;

QUERIES.Q09.sql = (p) => `WITH patient_year_days AS (SELECT h.patient_id, SUM(DATEDIFF(h.discharge_date, h.admission_date)) AS total_days FROM hospitalization h WHERE h.discharge_date IS NOT NULL AND h.admission_date >= MAKEDATE(${parseInt(p.year)},1) AND h.admission_date < MAKEDATE(${parseInt(p.year)+1},1) GROUP BY h.patient_id HAVING SUM(DATEDIFF(h.discharge_date, h.admission_date)) > 15), matching_totals AS (SELECT total_days FROM patient_year_days GROUP BY total_days HAVING COUNT(*) > 1) SELECT p.id AS patient_id, p.first_name, p.last_name, pyd.total_days FROM patient_year_days pyd JOIN matching_totals mt ON mt.total_days = pyd.total_days JOIN patient p ON p.id = pyd.patient_id ORDER BY pyd.total_days DESC, p.last_name ASC, p.first_name ASC`;

QUERIES.Q12.sql = (p) => `WITH all_assignments AS (SELECT ds.shift_id, d.id AS staff_id, 'Doctor' AS staff_category, ds.doctor_id AS specific_id FROM doctor_shift ds JOIN doctor d ON ds.doctor_id = d.id UNION ALL SELECT ns.shift_id, n.id, 'Nurse', ns.nurse_id FROM nurse_shift ns JOIN nurse n ON ns.nurse_id = n.id UNION ALL SELECT ads.shift_id, a.id, 'Administration', ads.admin_staff_id FROM admin_shift ads JOIN admin_staff a ON ads.admin_staff_id = a.id) SELECT dept.name AS department, s.type AS shift_type, assign.staff_category, CASE WHEN assign.staff_category = 'Doctor' THEN (SELECT spec.name FROM doc_spec spec JOIN doctor doc ON doc.doc_spec_id = spec.id WHERE doc.id = assign.specific_id) WHEN assign.staff_category = 'Nurse' THEN (SELECT ng.name FROM nurse_grade ng JOIN nurse nur ON nur.nurse_grade_id = ng.id WHERE nur.id = assign.specific_id) WHEN assign.staff_category = 'Administration' THEN (SELECT adm.role FROM admin_staff adm WHERE adm.id = assign.specific_id) END AS subcategory, COUNT(assign.staff_id) AS assigned_staff_count FROM all_assignments assign JOIN shift s ON assign.shift_id = s.id JOIN department dept ON s.dept_id = dept.id WHERE s.start_time >= '${p.week_start} 00:00:00' AND s.start_time <= DATE_ADD('${p.week_start}', INTERVAL 6 DAY) GROUP BY dept.name, s.type, assign.staff_category, subcategory ORDER BY department ASC, shift_type ASC, staff_category ASC`;

// ── Routes ──────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
    const list = Object.entries(QUERIES).map(([id, q]) => ({
        id,
        description: q.description,
        params: q.params || []
    }));
    res.json({ queries: list });
});

router.post('/:id', async (req, res, next) => {
    const queryId = req.params.id.toUpperCase();
    const query   = QUERIES[queryId];

    if (!query)
        return res.status(404).json({ error: `Query ${queryId} not found` });

    try {
        const params = req.body || {};
        const sql = typeof query.sql === 'function' ? query.sql(params) : query.sql;
        const [results] = await pool.query(sql);
        res.json({ query: queryId, results });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
