const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// Routes
app.use('/api/patients',         require('./routes/patients'));
app.use('/api/staff',            require('./routes/staff'));
app.use('/api/doctors',          require('./routes/doctors'));
app.use('/api/nurses',           require('./routes/nurses'));
app.use('/api/admin',           require('./routes/admin_staff'));
app.use('/api/departments',      require('./routes/departments'));
app.use('/api/shifts',           require('./routes/shifts'));
app.use('/api/hospitalizations', require('./routes/hospitalizations'));
app.use('/api/queries',          require('./routes/queries'));
app.use('/api/dashboard',        require('./routes/dashboard'));
app.use('/api/insurance', require('./routes/insurance'));
app.use('/api/triage', require('./routes/triage'));
app.use('/api/hosp-entries', require('./routes/hosp-entries'));
app.use('/api/ken', require('./routes/ken'));
app.use('/api/surgeries', require('./routes/surgeries'));
app.use('/api/medical', require('./routes/medical'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/absences',      require('./routes/absences'));





// Error handler
app.use(require('./middleware/errorHandler'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));