const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/hospitalizations — όλες οι νοσηλείες
router.get('/', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                h.id,
                h.admission_date,
                h.discharge_date,
                h.total_cost,
                h.bed_no,
                h.bed_dept_id,
                p.id            AS patient_id,
                p.first_name    AS patient_first_name,
                p.last_name     AS patient_last_name,
                p.patient_amka,
                d.name          AS department,
                e.id            AS evaluation_id  -- ← πρόσθεσε αυτό
            FROM hospitalization h
            JOIN patient p    ON p.id = h.patient_id
            JOIN department d ON d.id = h.bed_dept_id
            LEFT JOIN evaluation e ON e.hospitalization_id = h.id  -- ← και αυτό
            ORDER BY h.admission_date DESC
        `);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/hospitalizations/:id — συγκεκριμένη νοσηλεία
router.get('/:id', async (req, res, next) => {
    try {
        const [hosp] = await pool.query(`
            SELECT
                h.id,
                h.admission_date,
                h.discharge_date,
                h.total_cost,
                h.bed_no,
                h.bed_dept_id,
                p.id            AS patient_id,
                p.first_name    AS patient_first_name,
                p.last_name     AS patient_last_name,
                p.patient_amka,
                d.name          AS department
            FROM hospitalization h
            JOIN patient p    ON p.id = h.patient_id
            JOIN department d ON d.id = h.bed_dept_id
            WHERE h.id = ?
        `, [req.params.id]);

        if (hosp.length === 0)
            return res.status(404).json({ error: 'Hospitalization not found' });

        // Διαγνώσεις εισαγωγής
        const [admission_diags] = await pool.query(`
            SELECT
                ad.hosp_entry_code,
                he.description
            FROM admission_diag ad
            JOIN hosp_entry he ON he.code = ad.hosp_entry_code
            WHERE ad.hospitalization_id = ?
        `, [req.params.id]);

        // Διαγνώσεις εξόδου
        const [discharge_diags] = await pool.query(`
            SELECT
                dd.hosp_entry_code,
                he.description
            FROM discharge_diag dd
            JOIN hosp_entry he ON he.code = dd.hosp_entry_code
            WHERE dd.hospitalization_id = ?
        `, [req.params.id]);

        // ΚΕΝ
        const [ken] = await pool.query(`
            SELECT
                k.code,
                k.base_cost,
                k.mdh,
                k.daily_extra_charge
            FROM assigned_ken ak
            JOIN KEN k ON k.code = ak.KEN_code
            WHERE ak.hospitalization_id = ?
        `, [req.params.id]);

        // Χειρουργεία
        const [surgeries] = await pool.query(`
            SELECT
                su.id,
                su.start_time,
                su.duration,
                su.cost,
                mp.description  AS procedure_name,
                s.first_name    AS surgeon_first_name,
                s.last_name     AS surgeon_last_name
            FROM surgery su
            JOIN mp_entryA mp ON mp.code = su.mp_entryA_code
            JOIN staff s      ON s.id    = su.doctor_id
            WHERE su.hospitalization_id = ?
        `, [req.params.id]);

        // Εργαστηριακές εξετάσεις
        const [lab_exams] = await pool.query(`
            SELECT
                le.id,
                le.type,
                le.date,
                le.numeric_result,
                le.text_result,
                le.unit,
                le.cost,
                s.first_name    AS doctor_first_name,
                s.last_name     AS doctor_last_name
            FROM lab_exam le
            JOIN staff s ON s.id = le.doctor_id
            WHERE le.hospitalization_id = ?
        `, [req.params.id]);

        // Ιατρικές πράξεις
        const [med_procs] = await pool.query(`
            SELECT
                mp.id,
                mp.category,
                mp.duration,
                mp.cost,
                mpa.description AS procedure_name
            FROM med_proc mp
            JOIN mp_entryA mpa ON mpa.code = mp.mp_entryA_code
            WHERE mp.hospitalization_id = ?
        `, [req.params.id]);

        // Συνταγές
        const [prescriptions] = await pool.query(`
            SELECT
                pr.id,
                pr.dose,
                pr.freq,
                pr.pres_day,
                pr.exp_date,
                m.name          AS medication,
                s.first_name    AS doctor_first_name,
                s.last_name     AS doctor_last_name
            FROM prescription pr
            JOIN medication m ON m.id  = pr.medication_id
            JOIN staff s      ON s.id  = pr.doctor_id
            WHERE pr.hospitalization_id = ?
        `, [req.params.id]);

        // Αξιολόγηση
        const [evaluation] = await pool.query(`
            SELECT *
            FROM evaluation
            WHERE hospitalization_id = ?
        `, [req.params.id]);

        res.json({
            ...hosp[0],
            admission_diagnoses:  admission_diags,
            discharge_diagnoses:  discharge_diags,
            ken,
            surgeries,
            lab_exams,
            med_procs,
            prescriptions,
            evaluation:           evaluation[0] || null
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/hospitalizations — νέα νοσηλεία
router.post('/', async (req, res, next) => {
    const {
        admission_date, 
        patient_id,
        triage_entry_id, 
        bed_no, 
        bed_dept_id,
        admission_diag_codes, 
        ken_codes
    } = req.body;

    // Μετατροπή σε integers με fallback
    const patientId   = parseInt(patient_id);
    const triageId    = parseInt(triage_entry_id);
    const bedNo       = parseInt(bed_no);
    const bedDeptId   = parseInt(bed_dept_id);

    console.log('Values:', { admission_date, patientId, triageId, bedNo, bedDeptId });

    if (isNaN(patientId) || isNaN(triageId) || isNaN(bedNo) || isNaN(bedDeptId)) {
        return res.status(400).json({ 
            error: `Invalid numeric values: patient_id=${patient_id}, triage_entry_id=${triage_entry_id}, bed_no=${bed_no}, bed_dept_id=${bed_dept_id}` 
        });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.query(`
            INSERT INTO hospitalization
                (admission_date, patient_id, triage_entry_id, bed_no, bed_dept_id)
            VALUES (?, ?, ?, ?, ?)
        `, [admission_date, patientId, triageId, bedNo, bedDeptId]);

        const hospId = result.insertId;

        // Διαγνώσεις εισαγωγής
        if (admission_diag_codes && admission_diag_codes.length > 0) {
            for (const code of admission_diag_codes) {
                await conn.query(`
                    INSERT INTO admission_diag (hospitalization_id, hosp_entry_code)
                    VALUES (?, ?)
                `, [hospId, code]);
            }
        }

        // ΚΕΝ
        if (ken_codes && ken_codes.length > 0) {
            for (const code of ken_codes) {
                await conn.query(`
                    INSERT INTO assigned_ken (hospitalization_id, KEN_code)
                    VALUES (?, ?)
                `, [hospId, code]);
            }
        }

        await conn.commit();
        res.status(201).json({ id: hospId, message: 'Hospitalization created successfully' });
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
});

// PUT /api/hospitalizations/:id/discharge — έξοδος ασθενή
router.put('/:id/discharge', async (req, res, next) => {
    const { discharge_date, discharge_diag_codes, ken_codes } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Εισαγωγή KEN ΠΡΩΤΑ — πριν το discharge
        if (ken_codes && ken_codes.length > 0) {
            for (const code of ken_codes) {
                await conn.query(`
                    INSERT IGNORE INTO assigned_ken (hospitalization_id, KEN_code)
                    VALUES (?, ?)
                `, [req.params.id, code]);
            }
        }

        // 2. Διαγνώσεις εξόδου
        if (discharge_diag_codes && discharge_diag_codes.length > 0) {
            for (const code of discharge_diag_codes) {
                await conn.query(`
                    INSERT INTO discharge_diag (hospitalization_id, hosp_entry_code)
                    VALUES (?, ?)
                `, [req.params.id, code]);
            }
        }

        // 3. Discharge — το trigger υπολογίζει total_cost ΤΕΛΕΥΤΑΙΟ
        await conn.query(`
            UPDATE hospitalization SET discharge_date = ? WHERE id = ?
        `, [discharge_date, req.params.id]);

        await conn.commit();
        res.json({ message: 'Patient discharged successfully' });
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
});

// POST /api/hospitalizations/:id/evaluation — αξιολόγηση νοσηλείας
router.post('/:id/evaluation', async (req, res, next) => {
    const {
        qual_med_care, qual_nurse_care,
        cleanness, food, tot_experience
    } = req.body;

    try {
        const [result] = await pool.query(`
            INSERT INTO evaluation
                (hospitalization_id, qual_med_care, qual_nurse_care,
                 cleanness, food, tot_experience)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [req.params.id, qual_med_care, qual_nurse_care,
            cleanness, food, tot_experience]);

        res.status(201).json({ id: result.insertId, message: 'Evaluation submitted successfully' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;