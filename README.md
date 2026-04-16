# Ygeiopolis — Σύστημα Διαχείρισης Νοσοκομείου

Εξαμηνιαία Εργασία Βάσεων Δεδομένων, ΕΜΠ ΣΗΜΜΥ 2025-2026.

---

## Τεχνολογίες

- **DBMS:** MySQL 8.0
- **Backend:** Node.js + Express (REST API, port 3000)
- **Frontend:** Vanilla HTML / CSS / JavaScript (port 8080)
- **Data loader:** Python 3

---

## Δομή Φακέλων

```
ygeiopolis/
├── backend/
│   ├── .env
│   ├── server.js
│   ├── db.js
│   └── routes/
├── frontend/
│   ├── .env
│   ├── server.js
│   ├── js/
│   └── css/
├── sql/
│   ├── install.sql
│   ├── load_final.py
│   ├── .env
│   ├── data/
│   │   ├── hosp_entry_icd10.sql
│   │   ├── mp_entryA.sql
│   │   ├── mp_entryB.sql
│   │   ├── ken_codes.csv
│   │   ├── active_substances.csv
│   │   ├── medications.csv
│   │   └── contains_mapping.csv
│   ├── Q01.sql ... Q15.sql
│   └── Q01_out.txt ... Q15_out.txt
├── diagrams/
│   ├── er.pdf
│   └── relational.pdf
└── docs/
    └── report.pdf
```

---

## Εγκατάσταση και Εκτέλεση

### Προαπαιτούμενα

**Windows & Linux:**
- MySQL 8.0
- Node.js 18+
- Python 3.10+

---

### Βήμα 1 — Δημιουργία Βάσης Δεδομένων

Συνδεθείτε στη MySQL και εκτελέστε το install script:

**Windows (MySQL Command Line Client):**
```sql
SOURCE C:/path/to/ygeiopolis/sql/install.sql;
```

**Linux:**
```bash
mysql -u root -p < sql/install.sql
```

---

### Βήμα 2 — Ρύθμιση Environment Variables

Δημιουργήστε τα παρακάτω `.env` αρχεία:

**`sql/.env`**
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_PORT=3306
DB_NAME=Ygeiopolis_db
DATA_DIR=./data
```

**`backend/.env`**
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=Ygeiopolis_db
DB_PORT=3306
PORT=3000
```

**`frontend/.env`**
```env
PORT=8080
API_URL=http://localhost:3000
```

---

### Βήμα 3 — Φόρτωση Δεδομένων

```bash
cd sql
pip install mysql-connector-python python-dotenv
python load_final.py --password yourpassword
```

---

### Βήμα 4 — Εκκίνηση Backend

```bash
cd backend
npm install
node server.js
```

Το API είναι διαθέσιμο στο `http://localhost:3000`.

---

### Βήμα 5 — Εκκίνηση Frontend

```bash
cd frontend
node server.js
```

Η εφαρμογή είναι διαθέσιμη στο `http://localhost:8080`.

---
