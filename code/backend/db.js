const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME     || 'Ygeiopolis_db',
    waitForConnections: true,
    connectionLimit:    10
});

module.exports = pool;