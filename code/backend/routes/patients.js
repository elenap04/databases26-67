const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/patients — όλοι οι ασθενείς
router.get('/', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                p.id,
                p.patient_amka,
                p.first_name,
                p.last_name,
                p.father_name,
                p.date_of_birth,
                TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age,
                p.sex,
                p.weight,
                p.height,
                p.address,
                p.email,
                p.profession,
                p.nationality,
                p.blood_type,
                GROUP_CONCAT(DISTINCT pt.tel_no SEPARATOR ', ') AS phones,
                GROUP_CONCAT(DISTINCT ip.name  SEPARATOR ', ') AS insurance_providers
            FROM patient p
            LEFT JOIN patient_tel pt       ON pt.patient_id = p.id
            LEFT JOIN has_insurance hi     ON hi.patient_id = p.id
            LEFT JOIN insurance_provider ip ON ip.id = hi.insurance_provider_id
            GROUP BY p.id
            ORDER BY p.last_name, p.first_name
        `);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/patients/:id — συγκεκριμένος ασθενής
router.get('/:id', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                p.*,
                TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age,
                GROUP_CONCAT(DISTINCT pt.tel_no SEPARATOR ', ')  AS phones,
                GROUP_CONCAT(DISTINCT ip.name   SEPARATOR ', ')  AS insurance_providers,
                GROUP_CONCAT(DISTINCT CONCAT(cp.name, ' (', cp.relation, ')') SEPARATOR ', ') AS contact_persons
            FROM patient p
            LEFT JOIN patient_tel pt        ON pt.patient_id = p.id
            LEFT JOIN has_insurance hi      ON hi.patient_id = p.id
            LEFT JOIN insurance_provider ip ON ip.id = hi.insurance_provider_id
            LEFT JOIN contact_person cp     ON cp.patient_id = p.id
            WHERE p.id = ?
            GROUP BY p.id
        `, [req.params.id]);

        if (rows.length === 0)
            return res.status(404).json({ error: 'Patient not found' });

        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// POST /api/patients — νέος ασθενής
router.post('/', async (req, res, next) => {
    const {
        patient_amka, first_name, last_name, father_name,
        date_of_birth, sex, weight, height, address, email,
        profession, nationality, blood_type, phones
    } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.query(`
            INSERT INTO patient
                (patient_amka, first_name, last_name, father_name,
                 date_of_birth, sex, weight, height, address, email,
                 profession, nationality, blood_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [patient_amka, first_name, last_name, father_name,
            date_of_birth, sex, weight, height, address, email,
            profession, nationality, blood_type]);

        const patientId = result.insertId;

        if (phones && phones.length > 0) {
            for (const tel of phones) {
                await conn.query(
                    'INSERT INTO patient_tel (patient_id, tel_no) VALUES (?, ?)',
                    [patientId, tel]
                );
            }
        }

        await conn.commit();
        res.status(201).json({ id: patientId, message: 'Patient created successfully' });
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
});

// PUT /api/patients/:id — ενημέρωση ασθενή
router.put('/:id', async (req, res, next) => {
    const {
        first_name, last_name, father_name,
        date_of_birth, sex, weight, height, address, email,
        profession, nationality, blood_type, phones
    } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(`
            UPDATE patient SET
                first_name    = ?, last_name     = ?, father_name  = ?,
                date_of_birth = ?, sex           = ?, weight       = ?,
                height        = ?, address       = ?, email        = ?,
                profession    = ?, nationality   = ?, blood_type   = ?
            WHERE id = ?
        `, [first_name, last_name, father_name,
            date_of_birth, sex, weight, height, address, email,
            profession, nationality, blood_type,
            req.params.id]);

        if (phones) {
            await conn.query('DELETE FROM patient_tel WHERE patient_id = ?', [req.params.id]);
            for (const tel of phones) {
                await conn.query(
                    'INSERT INTO patient_tel (patient_id, tel_no) VALUES (?, ?)',
                    [req.params.id, tel]
                );
            }
        }

        await conn.commit();
        res.json({ message: 'Patient updated successfully' });
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
});

// DELETE /api/patients/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await pool.query('DELETE FROM patient WHERE id = ?', [req.params.id]);
        res.json({ message: 'Patient deleted successfully' });
    } catch (err) {
        next(err);
    }
});

// GET /api/patients/:id/insurance
router.get('/:id/insurance', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT ip.id, ip.name, ip.type
            FROM has_insurance hi
            JOIN insurance_provider ip ON ip.id = hi.insurance_provider_id
            WHERE hi.patient_id = ?
        `, [req.params.id]);
        res.json(rows);
    } catch (err) { next(err); }
});

// POST /api/patients/:id/insurance
router.post('/:id/insurance', async (req, res, next) => {
    const { insurance_provider_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO has_insurance (patient_id, insurance_provider_id) VALUES (?, ?)',
            [req.params.id, insurance_provider_id]
        );
        res.status(201).json({ message: 'Insurance added' });
    } catch (err) { next(err); }
});

// DELETE /api/patients/:id/insurance/:provider_id
router.delete('/:id/insurance/:provider_id', async (req, res, next) => {
    try {
        await pool.query(
            'DELETE FROM has_insurance WHERE patient_id = ? AND insurance_provider_id = ?',
            [req.params.id, req.params.provider_id]
        );
        res.json({ message: 'Insurance removed' });
    } catch (err) { next(err); }
});

// GET /api/patients/:id/contacts
router.get('/:id/contacts', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                cp.id, cp.name, cp.relation,
                GROUP_CONCAT(cpt.tel_no SEPARATOR ', ') AS phones
            FROM contact_person cp
            LEFT JOIN contact_person_tel cpt
                ON cpt.contact_person_id = cp.id
                AND cpt.contact_person_patient_id = cp.patient_id
            WHERE cp.patient_id = ?
            GROUP BY cp.id, cp.name, cp.relation
        `, [req.params.id]);
        res.json(rows);
    } catch (err) { next(err); }
});

// POST /api/patients/:id/contacts
router.post('/:id/contacts', async (req, res, next) => {
    const { id, name, relation, phones } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(
            'INSERT INTO contact_person (id, name, relation, patient_id) VALUES (?, ?, ?, ?)',
            [id, name, relation, req.params.id]
        );
        if (phones && phones.length > 0) {
            for (const tel of phones) {
                await conn.query(
                    'INSERT INTO contact_person_tel (tel_no, contact_person_id, contact_person_patient_id) VALUES (?, ?, ?)',
                    [tel, id, req.params.id]
                );
            }
        }
        await conn.commit();
        res.status(201).json({ message: 'Contact added' });
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
});

// DELETE /api/patients/:id/contacts/:contact_id
router.delete('/:id/contacts/:contact_id', async (req, res, next) => {
    try {
        await pool.query(
            'DELETE FROM contact_person WHERE id = ? AND patient_id = ?',
            [req.params.contact_id, req.params.id]
        );
        res.json({ message: 'Contact removed' });
    } catch (err) { next(err); }
});

// GET /api/patients/:id/lab-exams
router.get('/:id/lab-exams', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                le.id,
                le.type,
                le.date,
                le.numeric_result,
                le.text_result,
                le.unit,
                le.cost,
                s.first_name    AS doctor_first_name,
                s.last_name     AS doctor_last_name,
                h.admission_date,
                d.name          AS department
            FROM lab_exam le
            LEFT JOIN hospitalization h ON h.id = le.hospitalization_id
            JOIN staff s                ON s.id = le.doctor_id
            LEFT JOIN department d      ON d.id = h.bed_dept_id
            WHERE le.patient_id = ? OR h.patient_id = ?
            ORDER BY le.date DESC
        `, [req.params.id, req.params.id]);
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/patients/:id/surgeries
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
                s.first_name    AS surgeon_first_name,
                s.last_name     AS surgeon_last_name,
                d.name          AS department
            FROM surgery su
            LEFT JOIN hospitalization h ON h.id  = su.hospitalization_id
            JOIN mp_entryA mp           ON mp.code = su.mp_entryA_code
            JOIN staff s               ON s.id   = su.doctor_id
            LEFT JOIN department d     ON d.id   = h.bed_dept_id
            WHERE su.patient_id = ?
            ORDER BY su.start_time DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/patients/:id/med-procs
router.get('/:id/med-procs', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                mp.id,
                mp.category,
                mp.duration,
                mp.cost,
                mp.date,
                mpa.description AS procedure_name,
                COALESCE(d.name, '—') AS department
            FROM med_proc mp
            JOIN mp_entryA mpa           ON mpa.code = mp.mp_entryA_code
            LEFT JOIN hospitalization h  ON h.id     = mp.hospitalization_id
            LEFT JOIN department d       ON d.id     = h.bed_dept_id
            WHERE mp.patient_id = ?
            ORDER BY mp.date DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/patients/:id/prescriptions
router.get('/:id/prescriptions', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
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
            JOIN medication m ON m.id = pr.medication_id
            JOIN staff s      ON s.id = pr.doctor_id
            WHERE pr.patient_id = ?
            ORDER BY pr.pres_day DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/patients/:id/allergies
router.get('/:id/allergies', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT asub.id, asub.name
            FROM is_allergic ia
            JOIN active_substance asub ON asub.id = ia.active_substance_id
            WHERE ia.patient_id = ?
            ORDER BY asub.name
        `, [req.params.id]);
        res.json(rows);
    } catch (err) { next(err); }
});

module.exports = router;
