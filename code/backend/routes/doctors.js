const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/doctors
router.get('/', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                d.id,
                s.first_name,
                s.last_name,
                s.date_of_birth,
                TIMESTAMPDIFF(YEAR, s.date_of_birth, CURDATE()) AS age,
                s.email,
                s.hire_date,
                d.license_no,
                ds.name         AS specialization,
                dg.name         AS grade,
                sup.first_name  AS supervisor_first_name,
                sup.last_name   AS supervisor_last_name,
                GROUP_CONCAT(DISTINCT dept.name SEPARATOR ', ') AS departments
            FROM doctor d
            JOIN staff s        ON s.id   = d.id
            JOIN doc_spec ds    ON ds.id  = d.doc_spec_id
            JOIN doc_grade dg   ON dg.id  = d.doc_grade_id
            LEFT JOIN staff sup ON sup.id = d.supervisor_id
            LEFT JOIN doc_belongs db  ON db.doctor_id  = d.id
            LEFT JOIN department dept ON dept.id        = db.department_id
            GROUP BY d.id
            ORDER BY s.last_name, s.first_name
        `);
        res.json(rows);
    } catch (err) { next(err); }
});

router.get('/grades', async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT * FROM doc_grade');
        res.json(rows);
    } catch (err) { next(err); }
});

router.get('/specializations', async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT * FROM doc_spec ORDER BY name');
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/doctors/:id
router.get('/:id', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                d.id,
                s.first_name,
                s.last_name,
                s.date_of_birth,
                TIMESTAMPDIFF(YEAR, s.date_of_birth, CURDATE()) AS age,
                s.email,
                s.hire_date,
                s.staff_amka,
                d.license_no,
                ds.name         AS specialization,
                dg.name         AS grade,
                d.supervisor_id,
                sup.first_name  AS supervisor_first_name,
                sup.last_name   AS supervisor_last_name,
                GROUP_CONCAT(DISTINCT dept.name SEPARATOR ', ') AS departments,
                GROUP_CONCAT(DISTINCT st.tel_no SEPARATOR ', ') AS phones
            FROM doctor d
            JOIN staff s        ON s.id   = d.id
            JOIN doc_spec ds    ON ds.id  = d.doc_spec_id
            JOIN doc_grade dg   ON dg.id  = d.doc_grade_id
            LEFT JOIN staff sup ON sup.id = d.supervisor_id
            LEFT JOIN doc_belongs db  ON db.doctor_id  = d.id
            LEFT JOIN department dept ON dept.id        = db.department_id
            LEFT JOIN staff_tel st    ON st.staff_id    = d.id
            WHERE d.id = ?
            GROUP BY d.id
        `, [req.params.id]);

        if (rows.length === 0)
            return res.status(404).json({ error: 'Doctor not found' });

        res.json(rows[0]);
    } catch (err) { next(err); }
});

// POST /api/doctors
router.post('/', async (req, res, next) => {
    const { staff_id, license_no, supervisor_id, doc_grade_id, doc_spec_id, department_ids } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(`
            INSERT INTO doctor (id, license_no, supervisor_id, doc_grade_id, doc_spec_id)
            VALUES (?, ?, ?, ?, ?)
        `, [staff_id, license_no, supervisor_id || null, doc_grade_id, doc_spec_id]);

        if (department_ids && department_ids.length > 0) {
            for (const dept_id of department_ids) {
                await conn.query(
                    'INSERT INTO doc_belongs (department_id, doctor_id) VALUES (?, ?)',
                    [dept_id, staff_id]
                );
            }
        }

        await conn.commit();
        res.status(201).json({ id: staff_id, message: 'Doctor created successfully' });
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
});

// PUT /api/doctors/:id
router.put('/:id', async (req, res, next) => {
    const { license_no, supervisor_id, doc_grade_id, doc_spec_id, department_ids } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(`
            UPDATE doctor SET
                license_no    = ?,
                supervisor_id = ?,
                doc_grade_id  = ?,
                doc_spec_id   = ?
            WHERE id = ?
        `, [license_no, supervisor_id || null, doc_grade_id, doc_spec_id, req.params.id]);

        if (department_ids) {
            await conn.query('DELETE FROM doc_belongs WHERE doctor_id = ?', [req.params.id]);
            for (const dept_id of department_ids) {
                await conn.query(
                    'INSERT INTO doc_belongs (department_id, doctor_id) VALUES (?, ?)',
                    [dept_id, req.params.id]
                );
            }
        }

        await conn.commit();
        res.json({ message: 'Doctor updated successfully' });
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
});

// GET /api/doctors/:id/surgeries
router.get('/:id/surgeries', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                su.id,
                su.start_time,
                su.duration,
                su.cost,
                su.category,
                mp.description  AS procedure_name,
                or2.type        AS room_type,
                p.first_name    AS patient_first_name,
                p.last_name     AS patient_last_name
            FROM surgery su
            JOIN mp_entryA mp       ON mp.code  = su.mp_entryA_code
            JOIN operating_room or2 ON or2.id   = su.operating_room_id
            JOIN patient p          ON p.id     = su.patient_id
            WHERE su.doctor_id = ?
            ORDER BY su.start_time DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/doctors/:id/shifts
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
            FROM doctor_shift ds
            JOIN shift sh     ON sh.id = ds.shift_id
            JOIN department d ON d.id  = sh.dept_id
            WHERE ds.doctor_id = ?
            ORDER BY sh.start_time DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err) { next(err); }
});

module.exports = router;
