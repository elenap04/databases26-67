const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/departments — όλα τα τμήματα
router.get('/', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                d.id,
                d.name,
                d.description,
                d.beds_no,
                d.floor,
                d.building,
                doc.id          AS director_id,
                s.first_name    AS director_first_name,
                s.last_name     AS director_last_name
            FROM department d
            JOIN doctor doc ON doc.id = d.doctor_id
            JOIN staff s    ON s.id   = doc.id
            ORDER BY d.name
        `);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/departments/:id — συγκεκριμένο τμήμα
router.get('/:id', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                d.id,
                d.name,
                d.description,
                d.beds_no,
                d.floor,
                d.building,
                doc.id          AS director_id,
                s.first_name    AS director_first_name,
                s.last_name     AS director_last_name
            FROM department d
            JOIN doctor doc ON doc.id = d.doctor_id
            JOIN staff s    ON s.id   = doc.id
            WHERE d.id = ?
        `, [req.params.id]);

        if (rows.length === 0)
            return res.status(404).json({ error: 'Department not found' });

        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// GET /api/departments/:id/beds — κλίνες τμήματος
router.get('/:id/beds', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                b.no,
                b.type,
                b.status
            FROM bed b
            WHERE b.dept_id = ?
            ORDER BY b.no
        `, [req.params.id]);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/departments/:id/doctors — ιατροί τμήματος
router.get('/:id/doctors', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                d.id,
                s.first_name,
                s.last_name,
                ds.name     AS specialization,
                dg.name     AS grade
            FROM doc_belongs db
            JOIN doctor d       ON d.id  = db.doctor_id
            JOIN staff s        ON s.id  = d.id
            JOIN doc_spec ds    ON ds.id = d.doc_spec_id
            JOIN doc_grade dg   ON dg.id = d.doc_grade_id
            WHERE db.department_id = ?
            ORDER BY s.last_name, s.first_name
        `, [req.params.id]);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/departments/:id/nurses — νοσηλευτές τμήματος
router.get('/:id/nurses', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                n.id,
                s.first_name,
                s.last_name,
                ng.name     AS grade
            FROM nurse n
            JOIN staff s        ON s.id  = n.id
            JOIN nurse_grade ng ON ng.id = n.nurse_grade_id
            WHERE n.department_id = ?
            ORDER BY s.last_name, s.first_name
        `, [req.params.id]);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/departments/:id/shifts — βάρδιες τμήματος
router.get('/:id/shifts', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                sh.id,
                sh.start_time,
                sh.end_time,
                sh.type,
                sh.is_finalized
            FROM shift sh
            WHERE sh.dept_id = ?
            ORDER BY sh.start_time DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// POST /api/departments — νέο τμήμα
router.post('/', async (req, res, next) => {
    const {
        name, description, beds_no,
        floor, building, doctor_id
    } = req.body;

    try {
        const [result] = await pool.query(`
            INSERT INTO department
                (name, description, beds_no, floor, building, doctor_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [name, description, beds_no, floor, building, doctor_id]);

        res.status(201).json({ id: result.insertId, message: 'Department created successfully' });
    } catch (err) {
        next(err);
    }
});

// PUT /api/departments/:id — ενημέρωση τμήματος
router.put('/:id', async (req, res, next) => {
    const {
        name, description, beds_no,
        floor, building, doctor_id
    } = req.body;

    try {
        await pool.query(`
            UPDATE department SET
                name        = ?,
                description = ?,
                beds_no     = ?,
                floor       = ?,
                building    = ?,
                doctor_id   = ?
            WHERE id = ?
        `, [name, description, beds_no, floor,
            building, doctor_id, req.params.id]);

        res.json({ message: 'Department updated successfully' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;