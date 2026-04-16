const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/shifts
router.get('/', async (req, res, next) => {
    try {
        const { dept_id } = req.query;
        const [rows] = await pool.query(`
            SELECT
                s.id,
                s.start_time,
                s.end_time,
                s.type,
                s.is_finalized,
                d.id    AS dept_id,
                d.name  AS department,
                COUNT(DISTINCT ds.doctor_id)       AS doctors_count,
                COUNT(DISTINCT ns.nurse_id)        AS nurses_count,
                COUNT(DISTINCT ads.admin_staff_id) AS admin_count
            FROM shift s
            JOIN department d        ON d.id  = s.dept_id
            LEFT JOIN doctor_shift ds  ON ds.shift_id  = s.id
            LEFT JOIN nurse_shift ns   ON ns.shift_id   = s.id
            LEFT JOIN admin_shift ads  ON ads.shift_id  = s.id
            ${dept_id ? 'WHERE s.dept_id = ?' : ''}
            GROUP BY s.id, s.start_time, s.end_time, s.type, s.is_finalized, d.id, d.name
            ORDER BY s.start_time DESC
        `, dept_id ? [dept_id] : []);
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/shifts/:id
router.get('/:id', async (req, res, next) => {
    try {
        const [[shift]] = await pool.query(`
            SELECT s.*, d.name AS department
            FROM shift s
            JOIN department d ON d.id = s.dept_id
            WHERE s.id = ?
        `, [req.params.id]);
        if (!shift) return res.status(404).json({ error: 'Not found' });

        const [doctors] = await pool.query(`
            SELECT st.id, st.first_name, st.last_name, ds2.name AS specialization, dg.name AS grade
            FROM doctor_shift ds
            JOIN staff st    ON st.id = ds.doctor_id
            JOIN doctor d    ON d.id  = ds.doctor_id
            JOIN doc_spec ds2 ON ds2.id = d.doc_spec_id
            JOIN doc_grade dg  ON dg.id = d.doc_grade_id
            WHERE ds.shift_id = ?
        `, [req.params.id]);

        const [nurses] = await pool.query(`
            SELECT st.id, st.first_name, st.last_name, ng.name AS grade
            FROM nurse_shift ns
            JOIN staff st     ON st.id = ns.nurse_id
            JOIN nurse n      ON n.id  = ns.nurse_id
            JOIN nurse_grade ng ON ng.id = n.nurse_grade_id
            WHERE ns.shift_id = ?
        `, [req.params.id]);

        const [admins] = await pool.query(`
            SELECT st.id, st.first_name, st.last_name, a.role
            FROM admin_shift ads
            JOIN staff st      ON st.id = ads.admin_staff_id
            JOIN admin_staff a ON a.id  = ads.admin_staff_id
            WHERE ads.shift_id = ?
        `, [req.params.id]);

        res.json({ ...shift, doctors, nurses, admins });
    } catch (err) { next(err); }
});

// POST /api/shifts
router.post('/', async (req, res, next) => {
    const { dept_id, start_time, end_time, type } = req.body;
    try {
        const [result] = await pool.query(`
            INSERT INTO shift (dept_id, start_time, end_time, type)
            VALUES (?, ?, ?, ?)
        `, [parseInt(dept_id), start_time, end_time, type]);
        res.status(201).json({ id: result.insertId });
    } catch (err) { next(err); }
});

// POST /api/shifts/:id/staff
router.post('/:id/staff', async (req, res, next) => {
    const { staff_id, staff_type } = req.body;
    try {
        if (staff_type === 'doctor')
            await pool.query(`INSERT IGNORE INTO doctor_shift (doctor_id, shift_id) VALUES (?, ?)`, [staff_id, req.params.id]);
        else if (staff_type === 'nurse')
            await pool.query(`INSERT IGNORE INTO nurse_shift (nurse_id, shift_id) VALUES (?, ?)`, [staff_id, req.params.id]);
        else if (staff_type === 'admin')
            await pool.query(`INSERT IGNORE INTO admin_shift (admin_staff_id, shift_id) VALUES (?, ?)`, [staff_id, req.params.id]);
        res.json({ message: 'Staff added' });
    } catch (err) { next(err); }
});

// DELETE /api/shifts/:id/staff
router.delete('/:id/staff', async (req, res, next) => {
    const { staff_id, staff_type } = req.body;
    try {
        if (staff_type === 'doctor')
            await pool.query(`DELETE FROM doctor_shift WHERE doctor_id = ? AND shift_id = ?`, [staff_id, req.params.id]);
        else if (staff_type === 'nurse')
            await pool.query(`DELETE FROM nurse_shift WHERE nurse_id = ? AND shift_id = ?`, [staff_id, req.params.id]);
        else if (staff_type === 'admin')
            await pool.query(`DELETE FROM admin_shift WHERE admin_staff_id = ? AND shift_id = ?`, [staff_id, req.params.id]);
        res.json({ message: 'Staff removed' });
    } catch (err) { next(err); }
});

// PUT /api/shifts/:id/finalize
router.put('/:id/finalize', async (req, res, next) => {
    try {
        await pool.query(`UPDATE shift SET is_finalized = 1 WHERE id = ?`, [req.params.id]);
        res.json({ message: 'Shift finalized' });
    } catch (err) { next(err); }
});

// DELETE /api/shifts/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const [[shift]] = await pool.query(`SELECT is_finalized FROM shift WHERE id = ?`, [req.params.id]);
        if (!shift) return res.status(404).json({ error: 'Not found' });
        if (shift.is_finalized) return res.status(400).json({ error: 'Δεν μπορεί να διαγραφεί οριστικοποιημένη βάρδια' });
        await pool.query(`DELETE FROM shift WHERE id = ?`, [req.params.id]);
        res.json({ message: 'Shift deleted' });
    } catch (err) { next(err); }
});

module.exports = router;
