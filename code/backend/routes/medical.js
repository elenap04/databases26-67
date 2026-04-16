const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// =============================================
// META
// =============================================

router.get('/meta/mp-entries-a', async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT code, description FROM mp_entryA ORDER BY description');
        res.json(rows);
    } catch (err) { next(err); }
});

router.get('/meta/mp-entries-b', async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT code, description FROM mp_entryB ORDER BY code');
        res.json(rows);
    } catch (err) { next(err); }
});

router.get('/meta/clinical-rooms', async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT id, type FROM clinical_room ORDER BY id');
        res.json(rows);
    } catch (err) { next(err); }
});

// =============================================
// MED PROCS
// =============================================

router.get('/procs', async (req, res, next) => {
    try {
        const { hosp_id } = req.query;
        const [rows] = await pool.query(`
            SELECT
                mp.id,
                mp.category,
                mp.duration,
                mp.cost,
                mp.date,
                mp.hospitalization_id,
                mp.patient_id,
                mpa.description     AS procedure_name,
                mpa.code            AS mp_code,
                COALESCE(p.first_name, ph.first_name)   AS patient_first_name,
                COALESCE(p.last_name,  ph.last_name)    AS patient_last_name,
                COALESCE(d.name, '—')                   AS department,
                cr.type             AS clinical_room_type,
                cr.id               AS clinical_room_id,
                GROUP_CONCAT(DISTINCT CONCAT(st.last_name,  ' ', st.first_name)  SEPARATOR ', ') AS doctors,
                GROUP_CONCAT(DISTINCT CONCAT(stn.last_name, ' ', stn.first_name) SEPARATOR ', ') AS nurses
            FROM med_proc mp
            JOIN mp_entryA mpa      ON mpa.code = mp.mp_entryA_code
            JOIN clinical_room cr   ON cr.id    = mp.clinical_room_id
            LEFT JOIN patient p     ON p.id     = mp.patient_id
            LEFT JOIN hospitalization h  ON h.id = mp.hospitalization_id
            LEFT JOIN patient ph    ON ph.id    = h.patient_id
            LEFT JOIN department d  ON d.id     = h.bed_dept_id
            LEFT JOIN exam_doc ed   ON ed.med_proc_id = mp.id
            LEFT JOIN staff st      ON st.id    = ed.doctor_id
            LEFT JOIN exam_nurse en ON en.med_proc_id = mp.id
            LEFT JOIN staff stn     ON stn.id   = en.nurse_id
            ${hosp_id ? 'WHERE mp.hospitalization_id = ?' : ''}
            GROUP BY mp.id
            ORDER BY mp.date DESC
        `, hosp_id ? [hosp_id] : []);
        res.json(rows);
    } catch (err) { next(err); }
});

router.get('/procs/:id', async (req, res, next) => {
    try {
        const [[proc]] = await pool.query(`
            SELECT
                mp.*,
                mpa.description     AS procedure_name,
                COALESCE(p.first_name, ph.first_name)   AS patient_first_name,
                COALESCE(p.last_name,  ph.last_name)    AS patient_last_name,
                COALESCE(d.name, '—')                   AS department,
                cr.type             AS clinical_room_type
            FROM med_proc mp
            JOIN mp_entryA mpa      ON mpa.code = mp.mp_entryA_code
            JOIN clinical_room cr   ON cr.id    = mp.clinical_room_id
            LEFT JOIN patient p     ON p.id     = mp.patient_id
            LEFT JOIN hospitalization h  ON h.id = mp.hospitalization_id
            LEFT JOIN patient ph    ON ph.id    = h.patient_id
            LEFT JOIN department d  ON d.id     = h.bed_dept_id
            WHERE mp.id = ?
        `, [req.params.id]);

        if (!proc) return res.status(404).json({ error: 'Not found' });

        const [doctors] = await pool.query(`
            SELECT st.id, st.first_name, st.last_name
            FROM exam_doc ed JOIN staff st ON st.id = ed.doctor_id
            WHERE ed.med_proc_id = ?
        `, [req.params.id]);

        const [nurses] = await pool.query(`
            SELECT st.id, st.first_name, st.last_name
            FROM exam_nurse en JOIN staff st ON st.id = en.nurse_id
            WHERE en.med_proc_id = ?
        `, [req.params.id]);

        res.json({ ...proc, doctors, nurses });
    } catch (err) { next(err); }
});

router.post('/procs', async (req, res, next) => {
    const { hospitalization_id, patient_id, mp_entryA_code, clinical_room_id,
            category, duration, cost, date, doctor_ids, nurse_ids } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.query(`
            INSERT INTO med_proc
                (category, duration, cost, date, clinical_room_id, hospitalization_id, mp_entryA_code, patient_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            category,
            duration || null,
            parseFloat(cost),
            date,
            parseInt(clinical_room_id),
            hospitalization_id ? parseInt(hospitalization_id) : null,
            mp_entryA_code,
            patient_id ? parseInt(patient_id) : null
        ]);

        const procId = result.insertId;

        if (doctor_ids?.length)
            for (const id of doctor_ids)
                await conn.query('INSERT INTO exam_doc (med_proc_id, doctor_id) VALUES (?, ?)', [procId, id]);

        if (nurse_ids?.length)
            for (const id of nurse_ids)
                await conn.query('INSERT INTO exam_nurse (med_proc_id, nurse_id) VALUES (?, ?)', [procId, id]);

        await conn.commit();
        res.status(201).json({ id: procId });
    } catch (err) { await conn.rollback(); next(err); }
    finally { conn.release(); }
});

router.put('/procs/:id', async (req, res, next) => {
    const { mp_entryA_code, clinical_room_id, category, duration, cost, date, doctor_ids, nurse_ids } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(`
            UPDATE med_proc
            SET category=?, duration=?, cost=?, date=?, clinical_room_id=?, mp_entryA_code=?
            WHERE id=?
        `, [category, duration || null, parseFloat(cost), date,
            parseInt(clinical_room_id), mp_entryA_code, req.params.id]);

        await conn.query('DELETE FROM exam_doc   WHERE med_proc_id = ?', [req.params.id]);
        await conn.query('DELETE FROM exam_nurse WHERE med_proc_id = ?', [req.params.id]);

        if (doctor_ids?.length)
            for (const id of doctor_ids)
                await conn.query('INSERT INTO exam_doc (med_proc_id, doctor_id) VALUES (?, ?)', [req.params.id, id]);
        if (nurse_ids?.length)
            for (const id of nurse_ids)
                await conn.query('INSERT INTO exam_nurse (med_proc_id, nurse_id) VALUES (?, ?)', [req.params.id, id]);

        await conn.commit();
        res.json({ message: 'Updated' });
    } catch (err) { await conn.rollback(); next(err); }
    finally { conn.release(); }
});

router.delete('/procs/:id', async (req, res, next) => {
    try {
        await pool.query('DELETE FROM med_proc WHERE id = ?', [req.params.id]);
        res.json({ message: 'Deleted' });
    } catch (err) { next(err); }
});

// =============================================
// LAB EXAMS
// =============================================

router.get('/lab-exams', async (req, res, next) => {
    try {
        const { hosp_id } = req.query;
        const [rows] = await pool.query(`
            SELECT
                le.id,
                le.type,
                le.date,
                le.numeric_result,
                le.text_result,
                le.unit,
                le.cost,
                le.mp_entryB_code,
                le.hospitalization_id,
                le.patient_id,
                mpb.description      AS mp_entry_desc,
                COALESCE(p.first_name, ph.first_name)  AS patient_first_name,
                COALESCE(p.last_name,  ph.last_name)   AS patient_last_name,
                COALESCE(d.name,'—')                   AS department,
                cr.type              AS clinical_room_type,
                cr.id                AS clinical_room_id,
                st.id                AS doctor_id,
                st.first_name        AS doctor_first_name,
                st.last_name         AS doctor_last_name
            FROM lab_exam le
            JOIN clinical_room cr    ON cr.id   = le.clinical_room_id
            JOIN staff st            ON st.id   = le.doctor_id
            JOIN mp_entryB mpb       ON mpb.code = le.mp_entryB_code
            LEFT JOIN patient p      ON p.id    = le.patient_id
            LEFT JOIN hospitalization h  ON h.id = le.hospitalization_id
            LEFT JOIN patient ph     ON ph.id   = h.patient_id
            LEFT JOIN department d   ON d.id    = h.bed_dept_id
            ${hosp_id ? 'WHERE le.hospitalization_id = ?' : ''}
            ORDER BY le.date DESC
        `, hosp_id ? [hosp_id] : []);
        res.json(rows);
    } catch (err) { next(err); }
});

router.get('/lab-exams/:id', async (req, res, next) => {
    try {
        const [[exam]] = await pool.query(`
            SELECT
                le.*,
                mpb.description      AS mp_entry_desc,
                COALESCE(p.first_name, ph.first_name)  AS patient_first_name,
                COALESCE(p.last_name,  ph.last_name)   AS patient_last_name,
                COALESCE(d.name,'—')                   AS department,
                cr.type              AS clinical_room_type,
                st.first_name        AS doctor_first_name,
                st.last_name         AS doctor_last_name
            FROM lab_exam le
            JOIN clinical_room cr    ON cr.id   = le.clinical_room_id
            JOIN staff st            ON st.id   = le.doctor_id
            JOIN mp_entryB mpb       ON mpb.code = le.mp_entryB_code
            LEFT JOIN patient p      ON p.id    = le.patient_id
            LEFT JOIN hospitalization h  ON h.id = le.hospitalization_id
            LEFT JOIN patient ph     ON ph.id   = h.patient_id
            LEFT JOIN department d   ON d.id    = h.bed_dept_id
            WHERE le.id = ?
        `, [req.params.id]);
        if (!exam) return res.status(404).json({ error: 'Not found' });
        res.json(exam);
    } catch (err) { next(err); }
});

router.post('/lab-exams', async (req, res, next) => {
    const { hospitalization_id, patient_id, clinical_room_id, doctor_id,
            mp_entryB_code, type, date, numeric_result, text_result, unit, cost } = req.body;
    try {
        const [result] = await pool.query(`
            INSERT INTO lab_exam
                (type, date, numeric_result, text_result, unit, cost,
                 clinical_room_id, hospitalization_id, patient_id, doctor_id, mp_entryB_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            type, date,
            numeric_result || null,
            text_result    || null,
            unit           || null,
            parseFloat(cost),
            parseInt(clinical_room_id),
            hospitalization_id ? parseInt(hospitalization_id) : null,
            patient_id         ? parseInt(patient_id)         : null,
            parseInt(doctor_id),
            mp_entryB_code
        ]);
        res.status(201).json({ id: result.insertId });
    } catch (err) { next(err); }
});

router.put('/lab-exams/:id', async (req, res, next) => {
    const { clinical_room_id, doctor_id, mp_entryB_code,
            type, date, numeric_result, text_result, unit, cost } = req.body;
    try {
        await pool.query(`
            UPDATE lab_exam SET
                type=?, date=?, numeric_result=?, text_result=?, unit=?, cost=?,
                clinical_room_id=?, doctor_id=?, mp_entryB_code=?
            WHERE id=?
        `, [
            type, date,
            numeric_result || null,
            text_result    || null,
            unit           || null,
            parseFloat(cost),
            parseInt(clinical_room_id),
            parseInt(doctor_id),
            mp_entryB_code,
            req.params.id
        ]);
        res.json({ message: 'Updated' });
    } catch (err) { next(err); }
});

router.delete('/lab-exams/:id', async (req, res, next) => {
    try {
        await pool.query('DELETE FROM lab_exam WHERE id = ?', [req.params.id]);
        res.json({ message: 'Deleted' });
    } catch (err) { next(err); }
});

module.exports = router;
