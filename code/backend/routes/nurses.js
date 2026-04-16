const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/nurses
router.get('/', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                n.id,
                s.first_name,
                s.last_name,
                s.date_of_birth,
                TIMESTAMPDIFF(YEAR, s.date_of_birth, CURDATE()) AS age,
                s.email,
                s.hire_date,
                s.staff_amka,
                ng.name         AS grade,
                d.name          AS department,
                GROUP_CONCAT(DISTINCT st.tel_no SEPARATOR ', ') AS phones
            FROM nurse n
            JOIN staff s        ON s.id  = n.id
            JOIN nurse_grade ng ON ng.id = n.nurse_grade_id
            JOIN department d   ON d.id  = n.department_id
            LEFT JOIN staff_tel st ON st.staff_id = n.id
            GROUP BY n.id
            ORDER BY s.last_name, s.first_name
        `);
        res.json(rows);
    } catch (err) { next(err); }
});

router.get('/grades', async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT * FROM nurse_grade');
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/nurses/:id
router.get('/:id', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                n.id,
                s.first_name,
                s.last_name,
                s.date_of_birth,
                TIMESTAMPDIFF(YEAR, s.date_of_birth, CURDATE()) AS age,
                s.email,
                s.hire_date,
                s.staff_amka,
                ng.name         AS grade,
                d.id            AS department_id,
                d.name          AS department,
                GROUP_CONCAT(DISTINCT st.tel_no SEPARATOR ', ') AS phones
            FROM nurse n
            JOIN staff s        ON s.id  = n.id
            JOIN nurse_grade ng ON ng.id = n.nurse_grade_id
            JOIN department d   ON d.id  = n.department_id
            LEFT JOIN staff_tel st ON st.staff_id = n.id
            WHERE n.id = ?
            GROUP BY n.id
        `, [req.params.id]);

        if (rows.length === 0)
            return res.status(404).json({ error: 'Nurse not found' });

        res.json(rows[0]);
    } catch (err) { next(err); }
});

// POST /api/nurses
router.post('/', async (req, res, next) => {
    const { staff_id, nurse_grade_id, department_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO nurse (id, nurse_grade_id, department_id) VALUES (?, ?, ?)',
            [staff_id, nurse_grade_id, department_id]
        );
        res.status(201).json({ id: staff_id, message: 'Nurse created successfully' });
    } catch (err) { next(err); }
});

// PUT /api/nurses/:id
router.put('/:id', async (req, res, next) => {
    const { nurse_grade_id, department_id } = req.body;
    try {
        await pool.query(
            'UPDATE nurse SET nurse_grade_id = ?, department_id = ? WHERE id = ?',
            [nurse_grade_id, department_id, req.params.id]
        );
        res.json({ message: 'Nurse updated successfully' });
    } catch (err) { next(err); }
});

// GET /api/nurses/:id/shifts
router.get('/:id/shifts', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                sh.id,
                sh.start_time,
                sh.end_time,
                sh.type,
                sh.is_finalized,
                d.name AS department
            FROM nurse_shift ns
            JOIN shift sh     ON sh.id = ns.shift_id
            JOIN department d ON d.id  = sh.dept_id
            WHERE ns.nurse_id = ?
            ORDER BY sh.start_time DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/nurses/:id/triage
router.get('/:id/triage', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                t.id,
                t.arrival_time,
                t.service_time,
                t.urg_level,
                p.first_name    AS patient_first_name,
                p.last_name     AS patient_last_name,
                p.patient_amka
            FROM triage_entry t
            JOIN patient p ON p.id = t.patient_id
            WHERE t.nurse_id = ?
            ORDER BY t.arrival_time DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err) { next(err); }
});

module.exports = router;
