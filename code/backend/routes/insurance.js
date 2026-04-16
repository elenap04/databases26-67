const express = require('express');
const router  = express.Router();
const pool    = require('../db');

router.get('/', async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM insurance_provider ORDER BY name'
        );
        res.json(rows);
    } catch (err) { next(err); }
});

module.exports = router;