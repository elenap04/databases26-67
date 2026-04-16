const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/dashboard 
router.get('/', async (req, res, next) => {
    try {
        // Στατιστικά προσωπικού
        const [staff_stats] = await pool.query(`
            SELECT
                COUNT(*)                                    AS total_staff,
                SUM(CASE WHEN staff_type = 'Doctor'         THEN 1 ELSE 0 END) AS total_doctors,
                SUM(CASE WHEN staff_type = 'Nurse'          THEN 1 ELSE 0 END) AS total_nurses,
                SUM(CASE WHEN staff_type = 'Administration' THEN 1 ELSE 0 END) AS total_admin
            FROM staff
        `);

        // Στατιστικά ασθενών
        const [patient_stats] = await pool.query(`
            SELECT
                COUNT(*)    AS total_patients
            FROM patient
        `);

        // Ενεργές νοσηλείες
        const [active_hosp] = await pool.query(`
            SELECT COUNT(*) AS active_hospitalizations
            FROM hospitalization
            WHERE discharge_date IS NULL
        `);

        // Στατιστικά κλινών
        const [bed_stats] = await pool.query(`
            SELECT
                COUNT(*)                                                    AS total_beds,
                SUM(CASE WHEN status = 'Available'        THEN 1 ELSE 0 END) AS available_beds,
                SUM(CASE WHEN status = 'Occupied'         THEN 1 ELSE 0 END) AS occupied_beds,
                SUM(CASE WHEN status = 'Under Maintenance' THEN 1 ELSE 0 END) AS maintenance_beds
            FROM bed
        `);

        // Χειρουργεία σήμερα
        const [surgeries_today] = await pool.query(`
            SELECT COUNT(*) AS surgeries_today
            FROM surgery
            WHERE DATE(start_time) = CURDATE()
        `);

        // Ασθενείς στην ουρά triage
        const [triage_queue] = await pool.query(`
            SELECT COUNT(*) AS triage_waiting
            FROM triage_entry
            WHERE service_time IS NULL
        `);
        

        // Έσοδα τρέχοντος μήνα
        const [monthly_revenue] = await pool.query(`
            SELECT COALESCE(SUM(total_cost), 0) AS monthly_revenue
            FROM hospitalization
            WHERE discharge_date IS NOT NULL
              AND YEAR(discharge_date)  = YEAR(CURDATE())
              AND MONTH(discharge_date) = MONTH(CURDATE())
        `);

        // Έσοδα τρέχοντος έτους
        const [yearly_revenue] = await pool.query(`
            SELECT COALESCE(SUM(total_cost), 0) AS yearly_revenue
            FROM hospitalization
            WHERE discharge_date IS NOT NULL
              AND YEAR(discharge_date) = YEAR(CURDATE())
        `);

        // Κατάσταση ανά τμήμα
        const [dept_stats] = await pool.query(`
            SELECT
                d.id,
                d.name                                          AS department,
                COUNT(DISTINCT b.no)                            AS total_beds,
                SUM(CASE WHEN b.status = 'Available'  THEN 1 ELSE 0 END) AS available_beds,
                SUM(CASE WHEN b.status = 'Occupied'   THEN 1 ELSE 0 END) AS occupied_beds,
                COUNT(DISTINCT h.id)                            AS active_hospitalizations
            FROM department d
            LEFT JOIN bed b
                ON  b.dept_id = d.id
            LEFT JOIN hospitalization h
                ON  h.bed_dept_id    = d.id
                AND h.discharge_date IS NULL
            GROUP BY d.id, d.name
            ORDER BY d.name
        `);

        // Τρέχουσες βάρδιες
        const [current_shifts] = await pool.query(`
            SELECT
                sh.id,
                sh.type,
                sh.start_time,
                sh.end_time,
                d.name  AS department,
                COUNT(DISTINCT dsh.doctor_id)   AS doctors_count,
                COUNT(DISTINCT ns.nurse_id)     AS nurses_count,
                COUNT(DISTINCT ads.admin_staff_id) AS admin_count
            FROM shift sh
            JOIN department d       ON d.id   = sh.dept_id
            LEFT JOIN doctor_shift dsh ON dsh.shift_id = sh.id
            LEFT JOIN nurse_shift ns   ON ns.shift_id  = sh.id
            LEFT JOIN admin_shift ads  ON ads.shift_id = sh.id
            WHERE NOW() BETWEEN sh.start_time AND sh.end_time
              AND sh.is_finalized = 1
            GROUP BY sh.id, sh.type, sh.start_time, sh.end_time, d.name
            ORDER BY d.name
        `);

const [triage_by_level] = await pool.query(`
    SELECT
        t.urg_level     AS urg_level,
        p.first_name    AS first_name,
        p.last_name     AS last_name,
        t.arrival_time  AS arrival_time
    FROM triage_entry t
    JOIN patient p ON p.id = t.patient_id
    WHERE t.service_time IS NULL
    ORDER BY t.urg_level ASC, t.arrival_time ASC
`);

        res.json({
            staff:      staff_stats[0],
            patients:   patient_stats[0],
            beds:       bed_stats[0],
            hospitalizations: {
                active: active_hosp[0].active_hospitalizations
            },
            surgeries:  surgeries_today[0],
            triage: {
                waiting:    triage_queue[0].triage_waiting,
                by_level:   triage_by_level
            },
            revenue: {
                monthly:    monthly_revenue[0].monthly_revenue,
                yearly:     yearly_revenue[0].yearly_revenue
            },
            departments:    dept_stats,
            current_shifts
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
