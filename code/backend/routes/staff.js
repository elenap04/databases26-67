const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/staff — όλο το προσωπικό
router.get('/', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                s.id,
                s.staff_amka,
                s.first_name,
                s.last_name,
                s.date_of_birth,
                TIMESTAMPDIFF(YEAR, s.date_of_birth, CURDATE()) AS age,
                s.email,
                s.hire_date,
                s.staff_type,
                GROUP_CONCAT(DISTINCT st.tel_no SEPARATOR ', ') AS phones,
                COALESCE(
                    (SELECT db.department_id FROM doc_belongs db WHERE db.doctor_id = s.id LIMIT 1),
                    n.department_id,
                    a.department_id
                ) AS department_id
            FROM staff s
            LEFT JOIN staff_tel   st ON st.staff_id = s.id
            LEFT JOIN nurse        n ON n.id = s.id
            LEFT JOIN admin_staff  a ON a.id = s.id
            GROUP BY s.id, n.department_id, a.department_id
            ORDER BY s.last_name, s.first_name
        `);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/staff/:id
router.get('/:id', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                s.*,
                TIMESTAMPDIFF(YEAR, s.date_of_birth, CURDATE()) AS age,
                GROUP_CONCAT(DISTINCT st.tel_no SEPARATOR ', ') AS phones
            FROM staff s
            LEFT JOIN staff_tel st ON st.staff_id = s.id
            WHERE s.id = ?
            GROUP BY s.id
        `, [req.params.id]);

        if (rows.length === 0)
            return res.status(404).json({ error: 'Staff member not found' });

        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// POST /api/staff — νέο μέλος προσωπικού
router.post('/', async (req, res, next) => {
    const {
        staff_amka, first_name, last_name,
        date_of_birth, email, hire_date, staff_type, phones
    } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.query(`
            INSERT INTO staff
                (staff_amka, first_name, last_name,
                 date_of_birth, email, hire_date, staff_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [staff_amka, first_name, last_name,
            date_of_birth, email, hire_date, staff_type]);

        const staffId = result.insertId;

        if (phones && phones.length > 0) {
            for (const tel of phones) {
                await conn.query(
                    'INSERT INTO staff_tel (staff_id, tel_no) VALUES (?, ?)',
                    [staffId, tel]
                );
            }
        }

        await conn.commit();
        res.status(201).json({ id: staffId, message: 'Staff member created successfully' });
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
});

// PUT /api/staff/:id
router.put('/:id', async (req, res, next) => {
    const {
        first_name, last_name,
        date_of_birth, email, staff_type, phones
    } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(`
            UPDATE staff SET
                first_name    = ?, last_name     = ?,
                date_of_birth = ?, email         = ?,
                staff_type    = ?
            WHERE id = ?
        `, [first_name, last_name,
            date_of_birth, email, staff_type,
            req.params.id]);

        if (phones) {
            await conn.query('DELETE FROM staff_tel WHERE staff_id = ?', [req.params.id]);
            for (const tel of phones) {
                await conn.query(
                    'INSERT INTO staff_tel (staff_id, tel_no) VALUES (?, ?)',
                    [req.params.id, tel]
                );
            }
        }

        await conn.commit();
        res.json({ message: 'Staff member updated successfully' });
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
});

// DELETE /api/staff/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await pool.query('DELETE FROM staff WHERE id = ?', [req.params.id]);
        res.json({ message: 'Staff member deleted successfully' });
    } catch (err) {
        if (err.sqlState === '45000')
            return res.status(400).json({ error: err.message });
        next(err);
    }
});

// GET /api/staff/:id/absences
router.get('/:id/absences', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT * FROM staff_absence
            WHERE staff_id = ?
            ORDER BY start_time DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err) { next(err); }
});

// POST /api/staff/:id/absences
router.post('/:id/absences', async (req, res, next) => {
    const { start_time, end_time, reason } = req.body;
    try {
        const [result] = await pool.query(`
            INSERT INTO staff_absence (staff_id, start_time, end_time, reason)
            VALUES (?, ?, ?, ?)
        `, [req.params.id, start_time, end_time, reason]);
        res.status(201).json({ id: result.insertId, message: 'Absence recorded successfully' });
    } catch (err) { next(err); }
});

module.exports = router;
