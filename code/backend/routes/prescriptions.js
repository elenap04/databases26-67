const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/prescriptions — όλες οι συνταγές
router.get('/', async (req, res, next) => {
    try {
        const { patient_id, doctor_id } = req.query;
        let where  = [];
        let params = [];
        if (patient_id) { where.push('pr.patient_id = ?'); params.push(patient_id); }
        if (doctor_id)  { where.push('pr.doctor_id = ?');  params.push(doctor_id); }
        const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

        const [rows] = await pool.query(`
            SELECT
                pr.id,
                pr.dose,
                pr.freq,
                pr.pres_day,
                pr.exp_date,
                pr.patient_id,
                pr.doctor_id,
                pr.hospitalization_id,
                m.id            AS medication_id,
                m.name          AS medication,
                p.first_name    AS patient_first_name,
                p.last_name     AS patient_last_name,
                p.patient_amka,
                s.first_name    AS doctor_first_name,
                s.last_name     AS doctor_last_name,
                h.admission_date,
                d.name          AS department
            FROM prescription pr
            JOIN medication m      ON m.id = pr.medication_id
            JOIN patient p         ON p.id = pr.patient_id
            JOIN staff s           ON s.id = pr.doctor_id
            JOIN hospitalization h ON h.id = pr.hospitalization_id
            JOIN department d      ON d.id = h.bed_dept_id
            ${whereClause}
            ORDER BY pr.pres_day DESC
        `, params);
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/prescriptions/:id
router.get('/:id', async (req, res, next) => {
    try {
        const [[row]] = await pool.query(`
            SELECT
                pr.*,
                m.name          AS medication,
                p.first_name    AS patient_first_name,
                p.last_name     AS patient_last_name,
                p.patient_amka,
                s.first_name    AS doctor_first_name,
                s.last_name     AS doctor_last_name,
                h.admission_date,
                d.name          AS department
            FROM prescription pr
            JOIN medication m      ON m.id = pr.medication_id
            JOIN patient p         ON p.id = pr.patient_id
            JOIN staff s           ON s.id = pr.doctor_id
            JOIN hospitalization h ON h.id = pr.hospitalization_id
            JOIN department d      ON d.id = h.bed_dept_id
            WHERE pr.id = ?
        `, [req.params.id]);
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(row);
    } catch (err) { next(err); }
});

// POST /api/prescriptions
router.post('/', async (req, res, next) => {
    const { patient_id, doctor_id, medication_id, hospitalization_id,
            dose, freq, pres_day, exp_date } = req.body;
    try {
        const [result] = await pool.query(`
            INSERT INTO prescription
                (dose, freq, pres_day, exp_date, patient_id, doctor_id, medication_id, hospitalization_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [dose, freq, pres_day, exp_date,
            parseInt(patient_id), parseInt(doctor_id),
            parseInt(medication_id), parseInt(hospitalization_id)]);
        res.status(201).json({ id: result.insertId });
    } catch (err) { next(err); }
});

// PUT /api/prescriptions/:id
router.put('/:id', async (req, res, next) => {
    const { dose, freq, pres_day, exp_date, medication_id } = req.body;
    try {
        await pool.query(`
            UPDATE prescription SET dose=?, freq=?, pres_day=?, exp_date=?, medication_id=?
            WHERE id=?
        `, [dose, freq, pres_day, exp_date, parseInt(medication_id), req.params.id]);
        res.json({ message: 'Updated' });
    } catch (err) { next(err); }
});

// DELETE /api/prescriptions/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await pool.query('DELETE FROM prescription WHERE id = ?', [req.params.id]);
        res.json({ message: 'Deleted' });
    } catch (err) { next(err); }
});

// GET /api/prescriptions/meta/medications — αναζήτηση φαρμάκων
router.get('/meta/medications', async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, auth_country FROM medication ORDER BY name'
        );
        res.json(rows);
    } catch (err) { next(err); }
});

module.exports = router;
