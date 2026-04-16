const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/surgeries/meta/mp-entries — ΠΡΩΤΑ οι static routes
router.get('/meta/mp-entries', async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT code, description FROM mp_entryA ORDER BY description');
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/surgeries/meta/operating-rooms
router.get('/meta/operating-rooms', async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, type, status FROM operating_room WHERE status = 'Available' ORDER BY id"
        );
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/surgeries
router.get('/', async (req, res, next) => {
    try {
        const { dept_id, type } = req.query;
        let where  = [];
        let params = [];

        if (dept_id) { where.push('h.bed_dept_id = ?'); params.push(dept_id); }
        if (type === 'emergency') where.push("dept.name = 'Emergency Department'");
        else if (type === 'regular') where.push("dept.name <> 'Emergency Department'");

        const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

        const [rows] = await pool.query(`
            SELECT
                su.id,
                su.start_time,
                su.duration,
                su.cost,
                su.category,
                su.is_finalized,
                su.patient_id,
                su.hospitalization_id,
                mp.description               AS procedure_name,
                mp.code                      AS mp_code,
                st.first_name                AS surgeon_first_name,
                st.last_name                 AS surgeon_last_name,
                st.id                        AS surgeon_id,
                p.first_name                 AS patient_first_name,
                p.last_name                  AS patient_last_name,
                COALESCE(
                    dept.name,
                    (SELECT dep2.name FROM doc_belongs db2
                     JOIN department dep2 ON dep2.id = db2.department_id
                     WHERE db2.doctor_id = su.doctor_id LIMIT 1)
                )                            AS department,
                COALESCE(dept.id,
                    (SELECT dep2.id FROM doc_belongs db2
                     JOIN department dep2 ON dep2.id = db2.department_id
                     WHERE db2.doctor_id = su.doctor_id LIMIT 1)
                )                            AS dept_id,
                or2.id                       AS operating_room_id,
                or2.type                     AS operating_room_type,
                COUNT(DISTINCT hlp.staff_id) AS assistants_count
            FROM surgery su
            JOIN patient p            ON p.id    = su.patient_id
            JOIN mp_entryA mp         ON mp.code = su.mp_entryA_code
            JOIN staff st             ON st.id   = su.doctor_id
            JOIN operating_room or2   ON or2.id  = su.operating_room_id
            LEFT JOIN hospitalization h   ON h.id   = su.hospitalization_id
            LEFT JOIN department dept     ON dept.id = h.bed_dept_id
            LEFT JOIN help hlp            ON hlp.surgery_id = su.id
            ${whereClause}
            GROUP BY su.id
            ORDER BY su.start_time DESC
        `, params);
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/surgeries/:id
router.get('/:id', async (req, res, next) => {
    try {
        const [[surgery]] = await pool.query(`
            SELECT
                su.*,
                mp.description      AS procedure_name,
                st.first_name       AS surgeon_first_name,
                st.last_name        AS surgeon_last_name,
                p.first_name        AS patient_first_name,
                p.last_name         AS patient_last_name,
                or2.type            AS operating_room_type,
                COALESCE(
                    dept.name,
                    (SELECT dep2.name FROM doc_belongs db2
                     JOIN department dep2 ON dep2.id = db2.department_id
                     WHERE db2.doctor_id = su.doctor_id LIMIT 1)
                )                   AS department
            FROM surgery su
            JOIN patient p            ON p.id    = su.patient_id
            JOIN mp_entryA mp         ON mp.code = su.mp_entryA_code
            JOIN staff st             ON st.id   = su.doctor_id
            JOIN operating_room or2   ON or2.id  = su.operating_room_id
            LEFT JOIN hospitalization h  ON h.id   = su.hospitalization_id
            LEFT JOIN department dept    ON dept.id = h.bed_dept_id
            WHERE su.id = ?
        `, [req.params.id]);

        if (!surgery) return res.status(404).json({ error: 'Surgery not found' });

        const [assistants] = await pool.query(`
            SELECT st.id, st.first_name, st.last_name, st.staff_type
            FROM help h
            JOIN staff st ON st.id = h.staff_id
            WHERE h.surgery_id = ?
        `, [req.params.id]);

        res.json({ ...surgery, assistants });
    } catch (err) { next(err); }
});

// POST /api/surgeries
router.post('/', async (req, res, next) => {
    const {
        hospitalization_id, operating_room_id, doctor_id,
        patient_id, mp_entryA_code, start_time, duration, cost,
        assistant_ids
    } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.query(`
            INSERT INTO surgery
                (category, hospitalization_id, operating_room_id,
                 doctor_id, patient_id, mp_entryA_code, start_time, duration, cost)
            VALUES ('Surgical', ?, ?, ?, ?, ?, ?, ?, ?)
        `, [hospitalization_id || null, operating_room_id, doctor_id,
            patient_id, mp_entryA_code, start_time,
            parseInt(duration), parseFloat(cost)]);

        const surgeryId = result.insertId;

        if (assistant_ids && assistant_ids.length > 0) {
            for (const staffId of assistant_ids) {
                await conn.query(
                    'INSERT INTO help (surgery_id, staff_id) VALUES (?, ?)',
                    [surgeryId, staffId]
                );
            }
        }

        await conn.commit();
        res.status(201).json({ id: surgeryId, message: 'Surgery created' });
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
});

// PUT /api/surgeries/:id/finalize
router.put('/:id/finalize', async (req, res, next) => {
    try {
        const [[s]] = await pool.query(
            'SELECT hospitalization_id FROM surgery WHERE id = ?', [req.params.id]
        );
        if (!s) return res.status(404).json({ error: 'Not found' });
        if (!s.hospitalization_id) {
            return res.status(400).json({
                error: 'Δεν μπορεί να οριστικοποιηθεί χειρουργείο χωρίς νοσηλεία'
            });
        }
        await pool.query('UPDATE surgery SET is_finalized = 1 WHERE id = ?', [req.params.id]);
        res.json({ message: 'Surgery finalized' });
    } catch (err) { next(err); }
});

module.exports = router;
