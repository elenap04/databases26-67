const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/triage — όλες οι triage entries
router.get('/', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                t.id,
                t.arrival_time,
                t.service_time,
                t.urg_level,
                p.id            AS patient_id,
                p.first_name    AS patient_first_name,
                p.last_name     AS patient_last_name,
                p.patient_amka,
                n.id            AS nurse_id,
                s.first_name    AS nurse_first_name,
                s.last_name     AS nurse_last_name,
                d.name          AS department
            FROM triage_entry t
            JOIN patient p      ON p.id = t.patient_id
            JOIN nurse n        ON n.id = t.nurse_id
            JOIN staff s        ON s.id = n.id
            JOIN department d   ON d.id = t.department_id
            ORDER BY t.arrival_time DESC
        `);
        res.json(rows);
    } catch (err) { next(err); }
});

// POST /api/triage — νέα triage entry
router.post('/', async (req, res, next) => {
    const { patient_id, nurse_id, department_id, arrival_time, service_time, urg_level } = req.body;
    try {
        const [result] = await pool.query(`
            INSERT INTO triage_entry
                (patient_id, nurse_id, department_id, arrival_time, service_time, urg_level)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [patient_id, nurse_id, department_id, arrival_time, service_time || null, urg_level]);
        res.status(201).json({ id: result.insertId, message: 'Triage entry created' });
    } catch (err) { next(err); }
});

// PUT /api/triage/:id/serve — εξυπηρέτηση triage
router.put('/:id/serve', async (req, res, next) => {
    const { service_time } = req.body;
    try {
        await pool.query(`
            UPDATE triage_entry SET service_time = ? WHERE id = ?
        `, [service_time, req.params.id]);
        res.json({ message: 'Triage entry served' });
    } catch (err) { next(err); }
});

module.exports = router;