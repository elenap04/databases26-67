const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/admin
router.get('/', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                a.id,
                s.first_name,
                s.last_name,
                s.date_of_birth,
                TIMESTAMPDIFF(YEAR, s.date_of_birth, CURDATE()) AS age,
                s.email,
                s.hire_date,
                s.staff_amka,
                a.role,
                a.office,
                d.id            AS department_id,
                d.name          AS department,
                GROUP_CONCAT(DISTINCT st.tel_no SEPARATOR ', ') AS phones
            FROM admin_staff a
            JOIN staff s      ON s.id = a.id
            JOIN department d ON d.id = a.department_id
            LEFT JOIN staff_tel st ON st.staff_id = a.id
            GROUP BY a.id
            ORDER BY s.last_name, s.first_name
        `);
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/admin/:id
router.get('/:id', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                a.id,
                s.first_name,
                s.last_name,
                s.date_of_birth,
                TIMESTAMPDIFF(YEAR, s.date_of_birth, CURDATE()) AS age,
                s.email,
                s.hire_date,
                s.staff_amka,
                a.role,
                a.office,
                d.id            AS department_id,
                d.name          AS department,
                GROUP_CONCAT(DISTINCT st.tel_no SEPARATOR ', ') AS phones
            FROM admin_staff a
            JOIN staff s      ON s.id = a.id
            JOIN department d ON d.id = a.department_id
            LEFT JOIN staff_tel st ON st.staff_id = a.id
            WHERE a.id = ?
            GROUP BY a.id
        `, [req.params.id]);

        if (rows.length === 0)
            return res.status(404).json({ error: 'Admin staff member not found' });

        res.json(rows[0]);
    } catch (err) { next(err); }
});

// POST /api/admin
router.post('/', async (req, res, next) => {
    const { staff_id, role, office, department_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO admin_staff (id, role, office, department_id) VALUES (?, ?, ?, ?)',
            [staff_id, role, office, department_id]
        );
        res.status(201).json({ id: staff_id, message: 'Admin staff member created successfully' });
    } catch (err) { next(err); }
});

// PUT /api/admin/:id
router.put('/:id', async (req, res, next) => {
    const { role, office, department_id } = req.body;
    try {
        const [result] = await pool.query(
            'UPDATE admin_staff SET role = ?, office = ?, department_id = ? WHERE id = ?',
            [role, office, department_id, req.params.id]
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'Admin staff member not found' });
        res.json({ message: 'Admin staff member updated successfully' });
    } catch (err) { next(err); }
});

// GET /api/admin/:id/shifts
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
            FROM admin_shift as2
            JOIN shift sh     ON sh.id = as2.shift_id
            JOIN department d ON d.id  = sh.dept_id
            WHERE as2.admin_staff_id = ?
            ORDER BY sh.start_time DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err) { next(err); }
});

module.exports = router;
