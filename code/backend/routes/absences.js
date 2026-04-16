const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/absences
router.get('/', async (req, res, next) => {
    try {
        const { staff_id } = req.query;
        const [rows] = await pool.query(`
            SELECT
                sa.id,
                sa.start_time,
                sa.end_time,
                sa.reason,
                sa.staff_id,
                s.first_name,
                s.last_name,
                s.staff_type,
                s.staff_amka
            FROM staff_absence sa
            JOIN staff s ON s.id = sa.staff_id
            ${staff_id ? 'WHERE sa.staff_id = ?' : ''}
            ORDER BY sa.start_time DESC
        `, staff_id ? [staff_id] : []);
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/absences/:id
router.get('/:id', async (req, res, next) => {
    try {
        const [[row]] = await pool.query(`
            SELECT
                sa.*,
                s.first_name, s.last_name, s.staff_type, s.staff_amka
            FROM staff_absence sa
            JOIN staff s ON s.id = sa.staff_id
            WHERE sa.id = ?
        `, [req.params.id]);
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(row);
    } catch (err) { next(err); }
});

// POST /api/absences
router.post('/', async (req, res, next) => {
    const { staff_id, start_time, end_time, reason } = req.body;
    try {
        const [result] = await pool.query(`
            INSERT INTO staff_absence (staff_id, start_time, end_time, reason)
            VALUES (?, ?, ?, ?)
        `, [parseInt(staff_id), start_time, end_time || null, reason]);
        res.status(201).json({ id: result.insertId });
    } catch (err) { next(err); }
});

// PUT /api/absences/:id
router.put('/:id', async (req, res, next) => {
    const { start_time, end_time, reason } = req.body;
    try {
        await pool.query(`
            UPDATE staff_absence SET start_time=?, end_time=?, reason=?
            WHERE id=?
        `, [start_time, end_time || null, reason, req.params.id]);
        res.json({ message: 'Updated' });
    } catch (err) { next(err); }
});

// DELETE /api/absences/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await pool.query('DELETE FROM staff_absence WHERE id = ?', [req.params.id]);
        res.json({ message: 'Deleted' });
    } catch (err) { next(err); }
});

module.exports = router;
