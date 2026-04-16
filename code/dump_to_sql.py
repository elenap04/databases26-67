#!/usr/bin/env python3
"""
Ygeiopolis Hospital DB — Data Loader + SQL Dumper
==================================================

Usage:
    python dump_to_sql.py --password YOUR_PASS
"""

import mysql.connector
import csv, os, sys, argparse, time
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')

BATCH_SIZE = 5000
DB_NAME    = os.getenv('DB_NAME', 'Ygeiopolis_db')

# SQL file writer (global handle set in main) 
_sql_out = None

def _sql_write(stmt: str):
    """Write one statement to the output SQL file."""
    if _sql_out is None:
        return
    s = stmt.strip()
    if not s:
        return
    if not s.endswith(';'):
        s += ';'
    _sql_out.write(s + '\n')

def _fmt(v):
    """Format a Python value as a SQL literal."""
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return '1' if v else '0'
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace('\\', '\\\\').replace("'", "\\'") + "'"

def _executemany_and_log(cursor, sql_template, rows):
    """Run executemany on the DB and write individual INSERTs to the SQL file."""
    if not rows:
        return
    # Write to SQL file
    if _sql_out is not None:
        base = sql_template.strip().rstrip(';')
        # Strip the VALUES (%s,...) placeholder — rebuild per row
        up = base.upper()
        val_pos = up.rfind('VALUES')
        base_prefix = base[:val_pos].strip()
        for row in rows:
            vals = ', '.join(_fmt(v) for v in row)
            _sql_out.write(f'{base_prefix} VALUES ({vals});\n')
    # Execute on DB
    cursor.executemany(sql_template, rows)

# Connection 

def get_connection(host, user, password, database=None, port=3306):
    config = {
        'host': host, 'user': user, 'password': password, 'port': port,
        'charset': 'utf8mb4', 'collation': 'utf8mb4_unicode_ci',
        'use_unicode': True, 'autocommit': False,
    }
    if database:
        config['database'] = database
    return mysql.connector.connect(**config)


# Helpers 

def _run(cursor, stmts):
    for stmt in stmts:
        stmt = stmt.strip()
        if not stmt:
            continue
        _sql_write(stmt)          # ← log to file
        try:
            cursor.execute(stmt)
        except mysql.connector.Error as e:
            if e.errno not in (1062, 1146):
                print(f"  WARNING: {e.msg[:140]}")


def execute_sql_file(cursor, filepath):
    print(f"  Loading {os.path.basename(filepath)}...")
    start = time.time()
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    statements, current, delimiter = [], [], ';'
    for line in content.split('\n'):
        stripped = line.strip()
        if not stripped or stripped.startswith('--'):
            continue
        if stripped.upper().startswith('DELIMITER'):
            parts = stripped.split()
            if len(parts) >= 2:
                delimiter = parts[1]
            continue
        current.append(line)
        if stripped.endswith(delimiter):
            stmt = '\n'.join(current)
            stmt = stmt[:-len(delimiter)] if delimiter != ';' else stmt.rstrip(';')
            stmt = stmt.strip()
            if stmt and not stmt.upper().startswith('USE '):
                statements.append(stmt)
            current = []

    if current:
        stmt = '\n'.join(current).strip().rstrip(';').strip()
        if stmt and not stmt.upper().startswith('USE '):
            statements.append(stmt)

    executed = 0
    for stmt in statements:
        if not stmt:
            continue
        _sql_write(stmt)          # ← log to file
        try:
            cursor.execute(stmt)
            try:
                while cursor.nextset():
                    try: cursor.fetchall()
                    except: pass
            except: pass
            executed += 1
        except mysql.connector.Error as e:
            if e.errno in (1146, 1062):
                continue
            print(f"  WARNING: {e.msg[:120]}")

    print(f"  Done ({executed} statements, {time.time()-start:.1f}s)")


# CSV Loaders 

def load_csv_ken(cursor, filepath):
    print("  Loading KEN codes...")
    batch = []
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            code = row['code'].strip()[:10]
            if not code:
                continue
            batch.append((code, float(row['base_cost']), int(row['mdh']), float(row['daily_extra_charge'])))
            if len(batch) >= BATCH_SIZE:
                _executemany_and_log(cursor,
                "INSERT IGNORE INTO `KEN` (`code`,`base_cost`,`mdh`,`daily_extra_charge`) VALUES (%s,%s,%s,%s)",
                batch)
                batch = []
    if batch:
        _executemany_and_log(cursor,
        "INSERT IGNORE INTO `KEN` (`code`,`base_cost`,`mdh`,`daily_extra_charge`) VALUES (%s,%s,%s,%s)",
        batch)


def load_csv_substances(cursor, filepath):
    print("  Loading active substances...")
    substances = set()
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            n = row['name'].strip()
            if n:
                substances.add(n)
    batch = [(n[:500],) for n in substances]
    for i in range(0, len(batch), BATCH_SIZE):
        _executemany_and_log(cursor,
        "INSERT IGNORE INTO `active_substance` (`name`) VALUES (%s)",
        batch[i:i+BATCH_SIZE])
    print(f"  {len(substances)} substances loaded")


def load_csv_medications(cursor, filepath):
    print("  Loading medications...")
    batch, seen = [], set()
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            name    = row['name'].strip()[:300]
            country = row['auth_country'].strip()[:45]
            holder  = row['mark_auth_holder'].strip()[:300]
            email   = row['email'].strip()[:100]
            master  = row['master_file_loc'].strip()[:300]
            key = (name, country)
            if key in seen or not email or '@' not in email or '.' not in email:
                continue
            seen.add(key)
            batch.append((name, country, holder, email, master))
            if len(batch) >= BATCH_SIZE:
                _executemany_and_log(cursor,
                "INSERT IGNORE INTO `medication` (`name`,`auth_country`,`mark_auth_holder`,`email`,`master_file_loc`) VALUES (%s,%s,%s,%s,%s)",
                batch)
                batch = []
    if batch:
        _executemany_and_log(cursor,
        "INSERT IGNORE INTO `medication` (`name`,`auth_country`,`mark_auth_holder`,`email`,`master_file_loc`) VALUES (%s,%s,%s,%s,%s)",
        batch)


def load_csv_contains(cursor, filepath):
    print("  Loading contains mappings...")
    cursor.execute("SELECT id, name FROM active_substance")
    sub_map = {n: i for i, n in cursor.fetchall()}
    cursor.execute("SELECT id, name FROM medication")
    med_map = {n: i for i, n in cursor.fetchall()}

    batch, seen = [], set()
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            prod = row['product_name'].strip()[:300]
            sub  = row['substance_name'].strip()[:500]
            mid  = med_map.get(prod)
            sid  = sub_map.get(sub)
            if not mid or not sid:
                continue
            key = (sid, mid)
            if key in seen:
                continue
            seen.add(key)
            batch.append((sid, mid))
            if len(batch) >= BATCH_SIZE:
                _executemany_and_log(cursor,
                "INSERT IGNORE INTO `contains` (`active_substance_id`,`medication_id`) VALUES (%s,%s)",
                batch)
                batch = []
    if batch:
        _executemany_and_log(cursor,
        "INSERT IGNORE INTO `contains` (`active_substance_id`,`medication_id`) VALUES (%s,%s)",
        batch)


# Step 1: Staff, Departments, Beds 

def load_reference_and_staff(cursor):
    print("  Loading staff, departments, beds...")
    start = time.time()

    _run(cursor, [
        "INSERT IGNORE INTO `doc_grade` (`id`,`name`) VALUES (1,'Resident'),(2,'Junior Attending'),(3,'Senior Attending'),(4,'Director')",
        "INSERT IGNORE INTO `nurse_grade` (`id`,`name`) VALUES (1,'Nursing Assistant'),(2,'Nurse'),(3,'Head Nurse')",
        """INSERT IGNORE INTO `doc_spec` (`id`,`name`) VALUES
        (1,'Cardiology'),(2,'General Surgery'),(3,'Internal Medicine'),(4,'Neurology'),
        (5,'Orthopedics'),(6,'Pediatrics'),(7,'ICU/Critical Care'),
        (8,'Oncology'),(9,'Radiology'),(10,'Pulmonology'),(11,'Emergency Medicine'),
        (12,'Gastroenterology'),(13,'Urology'),(14,'Dermatology'),(15,'Psychiatry')""",
        """INSERT IGNORE INTO `insurance_provider` (`id`,`name`,`type`) VALUES
        (1,'EFKA','Public'),(2,'Private Insurance A','Private'),
        (3,'Private Insurance B','Private'),(4,'OAEE','Public'),(5,'Uninsured','Public')""",
        """INSERT IGNORE INTO `clinical_room` (`id`,`type`) VALUES
        (1,'Examination Room'),(2,'Imaging Room'),(3,'Procedure Room'),
        (4,'Laboratory'),(5,'Treatment Room'),(6,'Consultation Room'),(7,'Recovery Room')""",
        """INSERT IGNORE INTO `operating_room` (`id`,`type`,`status`) VALUES
        (1,'General OR','Available'),(2,'Cardiac OR','Available'),
        (3,'Orthopedic OR','Available'),(4,'Neurosurgery OR','Available'),
        (5,'Laparoscopic OR','Available'),(6,'Emergency OR','Available'),
        (7,'General OR','Available'),(8,'Cardiac OR','Available'),
        (9,'Orthopedic OR','Available'),(10,'Neurosurgery OR','Available')""",
    ])

    # Directors (grade 4) — ids 1-15 + 200 (Emergency)
    dir_data = [
        (1,'10000000001','Nikolaos','Papadopoulos','1968-03-15','n.papadopoulos@ygeiopolis.gr',4,1),
        (2,'10000000002','Maria','Konstantinou','1971-06-20','m.konstantinou@ygeiopolis.gr',4,2),
        (3,'10000000003','Georgios','Dimitriou','1973-01-10','g.dimitriou@ygeiopolis.gr',4,3),
        (4,'10000000004','Eleni','Papageorgiou','1974-09-01','e.papageorgiou@ygeiopolis.gr',4,4),
        (5,'10000000005','Christos','Makris','1976-04-01','c.makris@ygeiopolis.gr',4,5),
        (6,'10000000006','Anna','Karagianni','1976-08-20','a.karagianni@ygeiopolis.gr',4,6),
        (7,'10000000007','Panagiotis','Alexiou','1977-02-15','p.alexiou@ygeiopolis.gr',4,7),
        (8,'10000000008','Sophia','Vasileiou','1978-07-01','s.vasileiou@ygeiopolis.gr',4,8),
        (9,'10000000009','Dimitrios','Nikolaou','1979-01-10','d.nikolaou@ygeiopolis.gr',4,9),
        (10,'10000000010','Ioanna','Georgiou','1979-05-20','i.georgiou@ygeiopolis.gr',4,10),
        (11,'10000000011','Stelios','Kanakis','1967-04-01','s.kanakis@ygeiopolis.gr',4,11),
        (12,'10000000012','Fani','Saridou','1969-09-15','f.saridou@ygeiopolis.gr',4,12),
        (13,'10000000013','Kostas','Lekkas','1971-03-10','k.lekkas@ygeiopolis.gr',4,13),
        (14,'10000000014','Rena','Pavlou','1972-07-25','r.pavlou@ygeiopolis.gr',4,14),
        (15,'10000000015','Tasos','Komianos','1970-01-15','t.komianos@ygeiopolis.gr',4,15),
        (200,'10000000200','Ioannis','Papadimitriou','1970-01-01','i.papadimitriou.er@ygeiopolis.gr',4,11),
    ]
    staff_stmts, doc_stmts = [], []
    for did, amka, fn, ln, dob, email, grade, spec in dir_data:
        staff_stmts.append(
            f"INSERT IGNORE INTO `staff` (`id`,`staff_amka`,`first_name`,`last_name`,`date_of_birth`,`email`,`hire_date`,`staff_type`) "
            f"VALUES ({did},'{amka}','{fn}','{ln}','{dob}','{email}','2000-01-01','Doctor')")
        doc_stmts.append(
            f"INSERT IGNORE INTO `doctor` (`id`,`license_no`,`supervisor_id`,`doc_grade_id`,`doc_spec_id`) "
            f"VALUES ({did},'LIC-{did:03d}',NULL,{grade},{spec})")
    _run(cursor, staff_stmts)
    _run(cursor, doc_stmts)

    # Senior Attending (grade 3) — ids 16-20 (fills gap between directors and seniors)
    extra_senior_data = [
        (16,'Nikos','Apostolou','1980-05-10',1,1),
        (17,'Zafira','Drakaki','1981-08-22',2,2),
        (18,'Kostas','Petrakis','1982-11-03',3,3),
        (19,'Aliki','Stavrou','1983-02-14',4,4),
        (20,'Makis','Louloudis','1981-07-07',5,5),
    ]
    es, ed = [], []
    for did, fn, ln, dob, sup, spec in extra_senior_data:
        es.append(f"INSERT IGNORE INTO `staff` (`id`,`staff_amka`,`first_name`,`last_name`,`date_of_birth`,`email`,`hire_date`,`staff_type`) VALUES ({did},'1600{did:07d}','{fn}','{ln}','{dob}','x{did}@ygeiopolis.gr','2008-01-01','Doctor')")
        ed.append(f"INSERT IGNORE INTO `doctor` (`id`,`license_no`,`supervisor_id`,`doc_grade_id`,`doc_spec_id`) VALUES ({did},'SEN-X{did:03d}',{sup},3,{spec})")
    _run(cursor, es)
    _run(cursor, ed)

    # Senior Attending (grade 3) — ids 21-40
    senior_data = [
        ('Alexandros','Petridis','1982-03-01',1), ('Vasiliki','Lamprinou','1983-06-15',2),
        ('Manolis','Galanis','1984-09-01',3),     ('Elena','Tzimou','1984-01-15',4),
        ('Petros','Mavros','1985-06-01',5),        ('Chrysa','Koutsi','1986-03-10',6),
        ('Vasilis','Stamatis','1986-08-20',7),     ('Iro','Papadaki','1987-01-05',8),
        ('Thanasis','Lyris','1987-06-15',9),       ('Dimitra','Vrettos','1988-02-01',10),
        ('Spyros','Nikos','1988-07-10',11),        ('Fotini','Karali','1989-01-20',12),
        ('Manolis','Remos','1989-06-01',13),       ('Stella','Papou','1990-03-15',14),
        ('Andreas','Chatzis','1990-08-01',15),     ('Niki','Dimos','1990-01-10',1),
        ('Lefteris','Koumis','1991-06-20',2),      ('Popi','Alexis','1991-01-05',3),
        ('Takis','Manos','1991-06-15',4),          ('Zoe','Karas','1991-01-01',5),
    ]
    ss, ds = [], []
    for i, (fn, ln, dob, sup) in enumerate(senior_data):
        sid  = 21 + i
        spec = ((sid - 1) % 15) + 1
        ss.append(f"INSERT IGNORE INTO `staff` (`id`,`staff_amka`,`first_name`,`last_name`,`date_of_birth`,`email`,`hire_date`,`staff_type`) VALUES ({sid},'2000{sid:07d}','{fn}','{ln}','{dob}','s{sid}@ygeiopolis.gr','2010-01-01','Doctor')")
        ds.append(f"INSERT IGNORE INTO `doctor` (`id`,`license_no`,`supervisor_id`,`doc_grade_id`,`doc_spec_id`) VALUES ({sid},'SEN-{sid:03d}',{sup},3,{spec})")
    _run(cursor, ss)
    _run(cursor, ds)

    # Junior Attending (grade 2) — ids 41-60
    junior_data = [
        ('Ilias','Floris','1992-03-01',21),    ('Maro','Simos','1993-09-15',22),
        ('Dimos','Fekas','1994-03-01',23),      ('Rena','Tolis','1995-09-01',24),
        ('Fanis','Makris','1996-03-15',25),     ('Thanos','Zikos','1996-09-01',26),
        ('Evita','Lekkas','1997-01-10',27),     ('Nektarios','Panos','1997-06-01',28),
        ('Giota','Sarris','1998-09-01',29),     ('Yannis','Beis','1998-01-15',30),
        ('Stelios','Trovas','1988-04-01',31),   ('Agni','Pallis','1989-10-01',32),
        ('Kostas','Bardis','1990-04-01',33),    ('Maria','Sfakianos','1990-10-01',34),
        ('Giorgos','Koukos','1991-04-01',35),   ('Anna','Drakos','1991-10-01',36),
        ('Petros','Zafeiris','1992-02-01',37),  ('Chrysa','Lianos','1992-07-01',38),
        ('Vasilis','Drakakis','1993-10-01',39), ('Fotini','Alexiou','1993-03-01',40),
    ]
    js, jd = [], []
    for i, (fn, ln, dob, sup) in enumerate(junior_data):
        sid  = 41 + i
        spec = ((sid - 1) % 15) + 1
        js.append(f"INSERT IGNORE INTO `staff` (`id`,`staff_amka`,`first_name`,`last_name`,`date_of_birth`,`email`,`hire_date`,`staff_type`) VALUES ({sid},'3000{sid:07d}','{fn}','{ln}','{dob}','j{sid}@ygeiopolis.gr','2018-01-01','Doctor')")
        jd.append(f"INSERT IGNORE INTO `doctor` (`id`,`license_no`,`supervisor_id`,`doc_grade_id`,`doc_spec_id`) VALUES ({sid},'JUN-{sid:03d}',{sup},2,{spec})")
    _run(cursor, js)
    _run(cursor, jd)

    # Residents (grade 1) — ids 61-80, born 1995-1998 (age < 35 for Q5)
    res_data = [
        ('Markos','Efthimiou','1995-09-01',41),    ('Nina','Christodoulou','1996-01-15',42),
        ('Orestis','Kampas','1996-03-01',43),       ('Rea','Michailidou','1997-06-01',44),
        ('Stathis','Papagiannakis','1997-09-01',45),('Thaleia','Karvounis','1998-10-01',46),
        ('Vaggelis','Moutsios','1995-09-15',47),    ('Xenia','Papadimitriou','1996-01-01',48),
        ('Yiannis','Liakos','1996-04-01',49),       ('Zina','Papakosta','1997-07-01',50),
        ('Aggeliki','Raptou','1998-10-15',51),      ('Babis','Sideris','1995-10-01',52),
        ('Calliope','Tsakali','1996-02-01',53),     ('Demos','Hatzis','1997-05-01',54),
        ('Eleftheria','Ioannou','1997-08-01',55),   ('Fotis','Zacharias','1998-11-01',56),
        ('Gina','Anastasiou','1995-10-15',57),      ('Harris','Baltas','1996-02-15',58),
        ('Irini','Gatsi','1996-05-15',59),          ('Jason','Delis','1997-08-15',60),
    ]
    rs, rd = [], []
    for i, (fn, ln, dob, sup) in enumerate(res_data):
        sid  = 61 + i
        spec = ((sid - 1) % 15) + 1
        rs.append(f"INSERT IGNORE INTO `staff` (`id`,`staff_amka`,`first_name`,`last_name`,`date_of_birth`,`email`,`hire_date`,`staff_type`) VALUES ({sid},'4000{sid:07d}','{fn}','{ln}','{dob}','r{sid}@ygeiopolis.gr','2023-01-01','Doctor')")
        rd.append(f"INSERT IGNORE INTO `doctor` (`id`,`license_no`,`supervisor_id`,`doc_grade_id`,`doc_spec_id`) VALUES ({sid},'RES-{sid:03d}',{sup},1,{spec})")
    _run(cursor, rs)
    _run(cursor, rd)

    # Departments
    _run(cursor, ["""INSERT IGNORE INTO `department` (`id`,`name`,`description`,`beds_no`,`floor`,`building`,`doctor_id`) VALUES
        (1,'Cardiology','Heart and vascular care',30,2,'Building A',1),
        (2,'General Surgery','General surgery',25,3,'Building A',2),
        (3,'Internal Medicine','General internal medicine',20,1,'Building B',3),
        (4,'Neurology','Nervous system disorders',18,2,'Building B',4),
        (5,'Orthopedics','Bone and joint care',20,4,'Building A',5),
        (6,'Pediatrics','Children care',15,1,'Building C',6),
        (7,'ICU','Intensive care unit',12,0,'Building A',7),
        (8,'Oncology','Cancer care',20,3,'Building C',8),
        (9,'Radiology','Imaging and diagnostics',5,2,'Building B',9),
        (10,'Pulmonology','Respiratory care',18,2,'Building C',10),
        (11,'Emergency Department','ER and triage',40,1,'Building A',200),
        (12,'Gastroenterology','Digestive system',16,2,'Building B',11),
        (13,'Urology','Urinary tract',14,3,'Building C',12),
        (14,'Dermatology','Skin disorders',10,1,'Building C',13),
        (15,'Psychiatry','Mental health',20,4,'Building B',14)"""])

    # doc_belongs
    spec_map_extra = {16: 1, 17: 2, 18: 3, 19: 4, 20: 5}
    db_stmts = []
    for did in list(range(1, 81)) + [200]:
        if did == 200:
            dept = 11
        elif did in spec_map_extra:
            dept = spec_map_extra[did]
        else:
            dept = ((did - 1) % 15) + 1
        db_stmts.append(f"INSERT IGNORE INTO `doc_belongs` (`department_id`,`doctor_id`) VALUES ({dept},{did})")
    _run(cursor, db_stmts)

    # Beds
    beds_config = {1:8, 2:7, 3:6, 4:6, 5:7, 6:5, 7:5, 8:6, 9:4, 10:5, 11:8, 12:5, 13:5, 14:4, 15:6}
    bed_stmts = []
    for dept, cnt in beds_config.items():
        for bno in range(1, cnt + 1):
            btype = 'ICU' if bno == 1 and dept in (1, 7, 11) else ('Single' if bno <= 2 else 'Multi')
            bed_stmts.append(f"INSERT IGNORE INTO `bed` (`no`,`dept_id`,`type`,`status`) VALUES ({bno},{dept},'{btype}','Available')")
    _run(cursor, bed_stmts)

    # Nurses — 60 total, 4 per department (ids 81-140)
    nurse_fnames = ['Vasiliki','Panagiotis','Despoina','Kostas','Chrysanthi','Stefanos',
                    'Eirini','Michalis','Olga','Andreas','Niki','Tasos','Fani','Lena','Maria',
                    'Stelios','Elena','Nikos','Popi','Antonis','Rena','Makis','Katerina','Takis',
                    'Xanthi','Yiorgos','Zoe','Aggeliki','Pavlos','Dimitra','Fotini','Christos',
                    'Irini','Sotiria','Apostolos','Dimosthenis','Argyro','Konstantina','Theodoros',
                    'Georgia','Panagiotis','Alexia','Stavros','Marianna','Giorgos','Kyriaki',
                    'Alexandros','Paraskevi','Ioannis','Anastasia','Kalliopi','Vasileios',
                    'Evgenia','Spyros','Theokleia']
    nurse_lnames = ['Alexiou','Tsoukalas','Vlachou','Samaras','Liousi','Panou','Fragkou',
                    'Zisis','Terzidou','Kourtis','Papanikolaou','Mitropoulos','Stavridou',
                    'Karatzas','Adamidou','Lamprou','Tsangaraki','Arvanitis','Deligianni',
                    'Mavrommatis','Karagianni','Sotiropoulos','Papadimitriou','Karabinis',
                    'Zervou','Simos','Voulgaris','Belesis','Hatzinikoli','Giannakis','Raptou',
                    'Kontou','Makri','Oikonomou','Papandreou','Karalis','Moustakou',
                    'Angelopoulos','Davaki','Liakopoulos','Stamatiou','Tsagarakis',
                    'Vasilopoulos','Economou','Mavridis','Christodoulou','Stefanou',
                    'Konstantinidis','Vlachopoulou','Manolis','Diamantidou','Papadakis',
                    'Alexopoulou','Tsakiris','Psomas']
    ns, nd = [], []
    for i in range(60):
        nid   = 81 + i
        dept  = (i % 15) + 1
        grade = 3 if i % 15 == 0 else (1 if i % 8 == 0 else 2)
        fn    = nurse_fnames[i % len(nurse_fnames)]
        ln    = nurse_lnames[i % len(nurse_lnames)]
        dob   = f'19{85 - i % 15:02d}-{(i % 12) + 1:02d}-15'
        ns.append(f"INSERT IGNORE INTO `staff` (`id`,`staff_amka`,`first_name`,`last_name`,`date_of_birth`,`email`,`hire_date`,`staff_type`) VALUES ({nid},'5{nid:010d}','{fn}','{ln}','{dob}','n{nid}@ygeiopolis.gr','2015-01-01','Nurse')")
        nd.append(f"INSERT IGNORE INTO `nurse` (`id`,`nurse_grade_id`,`department_id`) VALUES ({nid},{grade},{dept})")
    _run(cursor, ns)
    _run(cursor, nd)

    # Admin staff — 30 total, 2 per department (ids 141-170)
    admin_roles  = ['Secretary','Receptionist','HR Manager','Billing Clerk','Coordinator']
    admin_first  = ['Theodoros','Fotini','Nikos','Artemis','Kostas','Ioanna','Makis','Rena',
                    'Stelios','Niki','Tasos','Eleni','Petros','Kalliopi','Giorgos','Dimitra',
                    'Apostolis','Chrysa','Manolis','Vasileia','Spyros','Aggeliki','Lefteris',
                    'Despoina','Yannis','Katerina','Michalis','Sophia','Panagiotis','Lena']
    admin_last   = ['Manos','Raptou','Karapetis','Dalakoura','Papakostas','Stavros',
                    'Petropoulos','Giannakou','Alexakis','Liaropoulos','Bouras','Skordas',
                    'Anagnostopoulos','Stavropoulou','Paraskevopoulos','Kontou','Mavridis',
                    'Kalogridou','Tsagarakis','Papadimitriou','Nikolaidis','Christodoulou',
                    'Katsaros','Georgiadi','Alexopoulos','Vasileiou','Papadakis',
                    'Fountoulaki','Antoniadis','Karagianni']
    ads, add_ = [], []
    for i in range(30):
        aid  = 141 + i
        dept = (i % 15) + 1
        role = admin_roles[i % len(admin_roles)]
        dob  = f'19{75 - i % 10:02d}-{(i % 12) + 1:02d}-20'
        fn   = admin_first[i % len(admin_first)]
        ln   = admin_last[i % len(admin_last)]
        ads.append(f"INSERT IGNORE INTO `staff` (`id`,`staff_amka`,`first_name`,`last_name`,`date_of_birth`,`email`,`hire_date`,`staff_type`) VALUES ({aid},'6{aid:010d}','{fn}','{ln}','{dob}','a{aid}@ygeiopolis.gr','2015-01-01','Administration')")
        add_.append(f"INSERT IGNORE INTO `admin_staff` (`id`,`role`,`office`,`department_id`) VALUES ({aid},'{role}','Office {aid}',{dept})")
    _run(cursor, ads)
    _run(cursor, add_)

    # Telephones
    tel = [f"INSERT IGNORE INTO `staff_tel` (`tel_no`,`staff_id`) VALUES ('69{i:09d}',{i})" for i in range(1, 201)]
    tel.append("INSERT IGNORE INTO `staff_tel` (`tel_no`,`staff_id`) VALUES ('6970000200',200)")
    _run(cursor, tel)

    print(f"  Done ({time.time()-start:.1f}s)")


# Step 2: Patients 

def load_patients(cursor):
    print("  Loading 200 patients...")
    start = time.time()

    first_m = ['Alexandros','Dimitris','Kostas','Nikos','Giorgos','Tasos','Manolis',
               'Petros','Vasilis','Stavros','Michalis','Antonis','Yannis','Spyros',
               'Lefteris','Aris','Makis','Fotis','Takis','Stelios']
    first_f = ['Maria','Elena','Sofia','Eleni','Katerina','Dimitra','Vasiliki',
               'Ioanna','Fotini','Chrysa','Rena','Niki','Vaso','Lena','Popi',
               'Fani','Despoina','Olga','Aggeliki','Irini']
    lasts   = ['Papadopoulos','Georgiou','Nikolaou','Alexiou','Petridis','Stavros',
               'Makris','Dimos','Koumis','Sarris','Beis','Trovas','Pallis','Bardis',
               'Zikos','Lekkas','Panos','Floris','Simos','Fekas','Tolis','Christodoulou',
               'Papageorgiou','Alexopoulos','Athanasiadis','Konstantinou','Dimitriou']
    profs   = ['Engineer','Teacher','Doctor','Lawyer','Accountant','Programmer',
               'Retired','Student','Manager']
    bloods  = ['A+','A-','B+','B-','AB+','AB-','O+','O-']
    cities  = ['Athens','Thessaloniki','Patras','Heraklion','Larissa','Volos']
    fathers = ['Ioannis','Georgios','Nikolaos','Dimitrios','Christos','Petros']

    ps = []
    for i in range(200):
        pid  = i + 1
        sex  = 'Male' if i % 2 == 0 else 'Female'
        fn   = first_m[i % len(first_m)] if sex == 'Male' else first_f[i % len(first_f)]
        ln   = lasts[i % len(lasts)]
        dad  = fathers[i % len(fathers)]
        year = 1940 + (i * 397 % 65)
        dob  = f'{year}-{(i%12)+1:02d}-{(i%28)+1:02d}'
        ps.append(
            f"INSERT IGNORE INTO `patient` (`id`,`patient_amka`,`first_name`,`last_name`,`father_name`,"
            f"`date_of_birth`,`sex`,`weight`,`height`,`address`,`email`,`profession`,`nationality`,`blood_type`) "
            f"VALUES ({pid},'9{pid:010d}','{fn}','{ln}','{dad}','{dob}','{sex}',"
            f"{55+(i*37%45)},{155+(i*13%40)},'Street {pid}, {cities[i%len(cities)]}','p{pid}@mail.gr',"
            f"'{profs[i%len(profs)]}','Greek','{bloods[i%len(bloods)]}')")

    _run(cursor, ps)
    _run(cursor, [f"INSERT IGNORE INTO `patient_tel` (`patient_id`,`tel_no`) VALUES ({i+1},'69{i+1:09d}')" for i in range(200)])
    _run(cursor, [f"INSERT IGNORE INTO `has_insurance` (`patient_id`,`insurance_provider_id`) VALUES ({i+1},{(i%5)+1})" for i in range(200)])
    print(f"  Done ({time.time()-start:.1f}s)")


# load photos

def load_images(cursor):
    print("  Loading images...")

    BED_URL      = "https://images.unsplash.com/photo-1710074213379-2a9c2653046a"
    DEPT_URL     = "https://plus.unsplash.com/premium_photo-1681400562562-86277737af9d"
    OR_URL       = "https://plus.unsplash.com/premium_photo-1661889752049-44bb9f857e67"
    PATIENT_URL  = "https://plus.unsplash.com/premium_photo-1769839239459-25501472f308"
    STAFF_URL    = "https://plus.unsplash.com/premium_photo-1681996428751-93e0294fe98d"
    CLIN_URL     = "https://images.unsplash.com/photo-1516549655169-df83a0774514"

    # dept_img (15 departments)
    _run(cursor, [
        f"INSERT IGNORE INTO `dept_img` (`dept_id`,`image_url`,`description`) "
        f"VALUES ({i},'{DEPT_URL}?id={i}','Department image')"
        for i in range(1, 16)
    ])

    # bed_img — μία εικόνα ανά κλίνη
    beds_config = {1:8, 2:7, 3:6, 4:6, 5:7, 6:5, 7:5, 8:6, 9:4, 10:5, 11:8, 12:5, 13:5, 14:4, 15:6}
    bed_imgs = []
    for dept, cnt in beds_config.items():
        for bno in range(1, cnt + 1):
            bed_imgs.append(
                f"INSERT IGNORE INTO `bed_img` (`bed_no`,`dept_id`,`image_url`,`description`) "
                f"VALUES ({bno},{dept},'{BED_URL}?dept={dept}&bed={bno}','Bed image')")
    _run(cursor, bed_imgs)

    # op_room_img (10 operating rooms)
    _run(cursor, [
        f"INSERT IGNORE INTO `op_room_img` (`op_room_id`,`image_url`,`description`) "
        f"VALUES ({i},'{OR_URL}?id={i}','Operating room image')"
        for i in range(1, 11)
    ])

    # clinical_room_img (7 clinical rooms)
    _run(cursor, [
        f"INSERT IGNORE INTO `clinical_room_img` (`clin_room_id`,`image_url`,`description`) "
        f"VALUES ({i},'{CLIN_URL}?id={i}','Clinical room image')"
        for i in range(1, 8)
    ])

    # patient_img (200 patients)
    _run(cursor, [
        f"INSERT IGNORE INTO `patient_img` (`patient_id`,`image_url`,`description`) "
        f"VALUES ({i},'{PATIENT_URL}?id={i}','Patient photo')"
        for i in range(1, 201)
    ])

    # staff_img (200 staff + id 200)
    staff_ids = list(range(1, 171)) + [200]
    _run(cursor, [
        f"INSERT IGNORE INTO `staff_img` (`staff_id`,`image_url`,`description`) "
        f"VALUES ({i},'{STAFF_URL}?id={i}','Staff photo')"
        for i in staff_ids
    ])

    print("  Done")

#  Step 3: Hospitalizations 

def load_hospitalizations(cursor, ken_rows):
    print("  Loading 500 hospitalizations...")
    start = time.time()

    er_nurses   = [91, 106, 136]
    beds_config = {1:8, 2:7, 3:6, 4:6, 5:7, 6:5, 7:5, 8:6, 9:4, 10:5, 11:8, 12:5, 13:5, 14:4, 15:6}

    # Build sequential bed slots to guarantee no overlap per (bed_no, dept_id)
    slots = []
    for dept in range(1, 11):
        for bno in range(2, beds_config[dept] + 1):
            slots.append((dept, bno))
    n_slots = len(slots)

    icd_codes = ['I20','J18','I46','K35','I48','G40','S72','M17','C34','A41',
                 'G35','N18','M16','I25','J45','K57','C50','L50','G45','D50',
                 'J06','K59','M23','I10','G20','K40','G43','M54','I21','J96',
                 'C18','T79','L40','S82','I49','M54','G43','I48','K35','I20']
    icd_dis   = ['I20','J18','I46','K35.8','I48','G40.9','S72.0','M17.1','C34.9','A41.9',
                 'G35','N18.5','M16.1','I25.1','J45.9','K57.3','C50.9','L50.0','G45.9','D50.0',
                 'J06.9','K59.0','M23.2','I10','G20','K40.9','G43.0','M54.5','I21.9','J96.0',
                 'C18.9','T79.0','L40.0','S82.0','I49','M54.5','G43.0','I48.0','K35.8','I20']

    slot_cursor = {s: datetime(2023, 1, 1) for s in slots}
    triage_s, hosp_s, diag_s, ken_s, eval_s = [], [], [], [], []
    slot_idx = 0
    base     = datetime(2023, 1, 1)

    for i in range(500):
        tid = i + 1
        hid = i + 1
        pid = (i % 200) + 1

        slot      = slots[slot_idx % n_slots]
        dept, bno = slot
        slot_idx += 1

        earliest = slot_cursor[slot]
        arr_dt   = max(base + timedelta(days=i//2, hours=8+(i%14)), earliest + timedelta(hours=1))
        srv_dt   = arr_dt + timedelta(minutes=20 + (i % 40))
        adm_dt   = srv_dt + timedelta(hours=1)

        stay = 3 + (i * 7 % 20)
        if i >= 475 and i % 5 == 0:
            dis_dt = None
        else:
            dis_dt = adm_dt + timedelta(days=stay)
            slot_cursor[slot] = dis_dt

        arr_s = arr_dt.strftime('%Y-%m-%d %H:%M:%S')
        srv_s = srv_dt.strftime('%Y-%m-%d %H:%M:%S')
        adm_s = adm_dt.strftime('%Y-%m-%d %H:%M:%S')
        nurse = er_nurses[i % len(er_nurses)]
        urg   = (i % 5) + 1
        icd_a = icd_codes[i % len(icd_codes)]
        icd_d = icd_dis[i % len(icd_dis)]

        triage_s.append(
            f"INSERT IGNORE INTO `triage_entry` (`id`,`urg_level`,`arrival_time`,`department_id`,`nurse_id`,`patient_id`,`service_time`) "
            f"VALUES ({tid},{urg},'{arr_s}',11,{nurse},{pid},'{srv_s}')")

        if dis_dt:
            dis_s = dis_dt.strftime('%Y-%m-%d %H:%M:%S')
            cost  = 2000 + (i * 137 % 50000)
            hosp_s.append(
                f"INSERT IGNORE INTO `hospitalization` (`id`,`admission_date`,`discharge_date`,`total_cost`,`triage_entry_id`,`patient_id`,`bed_no`,`bed_dept_id`) "
                f"VALUES ({hid},'{adm_s}','{dis_s}',{cost},{tid},{pid},{bno},{dept})")
            diag_s.append(f"INSERT IGNORE INTO `discharge_diag` (`hospitalization_id`,`hosp_entry_code`) VALUES ({hid},'{icd_d}')")
            if ken_rows:
                ken_s.append(f"INSERT IGNORE INTO `assigned_ken` (`hospitalization_id`,`KEN_code`) VALUES ({hid},'{ken_rows[i % len(ken_rows)]}')")
            s = [((i*3+1)%5)+1, ((i*2+3)%5)+1, ((i+2)%5)+1, ((i+4)%5)+1, ((i*2+1)%5)+1]
            eval_s.append(
                f"INSERT IGNORE INTO `evaluation` (`qual_med_care`,`qual_nurse_care`,`cleanness`,`food`,`tot_experience`,`hospitalization_id`) "
                f"VALUES ({s[0]},{s[1]},{s[2]},{s[3]},{s[4]},{hid})")
        else:
            hosp_s.append(
                f"INSERT IGNORE INTO `hospitalization` (`id`,`admission_date`,`discharge_date`,`total_cost`,`triage_entry_id`,`patient_id`,`bed_no`,`bed_dept_id`) "
                f"VALUES ({hid},'{adm_s}',NULL,NULL,{tid},{pid},{bno},{dept})")

        diag_s.append(f"INSERT IGNORE INTO `admission_diag` (`hospitalization_id`,`hosp_entry_code`) VALUES ({hid},'{icd_a}')")

    _run(cursor, triage_s)
    _run(cursor, hosp_s)
    _run(cursor, diag_s)
    _run(cursor, ken_s)
    _run(cursor, eval_s)
    print(f"  Done ({time.time()-start:.1f}s)")


# Step 4: Q-specific data 

def load_q_specific_data(cursor, ken_rows):
    """
    Extra hospitalizations for:
      Q3  — patients 1-5, 4 hosps each in dept 1
      Q9  — 6 pairs of patients with exactly 17 days in 2025
      Q14 — 6 ICD codes x 5 hosps x 2 years (2024, 2025)
    """
    print("  Loading Q-specific hospitalizations...")
    start = time.time()

    er_nurses = [91, 106, 136]
    qs, q14_triage, q14_hosp, q14_diag, q14_ken, q14_eval = [], [], [], [], [], []

    tid = 601
    hid = 601


# Q3: patients 1-5, 4 hosps each in depts 1,2


    q3_stmts = []
    q3_cases = [
    # (pid, dept, bed, dates list)
        (13, 2, 6, ['2021-01-01', '2021-02-01']),
        (12, 2, 7, ['2021-01-01', '2021-02-01']),
        (10, 2, 6, ['2021-03-01', '2021-04-01']),
        (1, 1, 6, ['2021-01-01', '2021-02-01', '2021-03-01']),
        (2, 1, 6, ['2021-04-01', '2021-05-01', '2021-06-01']), 
        (2,  1, 8, ['2021-01-01', '2021-02-01', '2021-03-01']),
    ]

    base_tid = 9003
    base_hid = 9003
    er_nurse = 91

    for pid, dept, bno, dates in q3_cases:
        for d in dates:
            arr = f'{d} 08:00:00'
            srv = f'{d} 08:30:00'
            adm = f'{d} 09:30:00'
            dis_dt = datetime.strptime(d, '%Y-%m-%d') + timedelta(days=8)
            dis = dis_dt.strftime('%Y-%m-%d 09:30:00')
            q3_stmts += [
                f"INSERT IGNORE INTO `triage_entry` (`id`,`urg_level`,`arrival_time`,`department_id`,`nurse_id`,`patient_id`,`service_time`) VALUES ({base_tid},2,'{arr}',11,{er_nurse},{pid},'{srv}')",
                f"INSERT IGNORE INTO `hospitalization` (`id`,`admission_date`,`discharge_date`,`total_cost`,`triage_entry_id`,`patient_id`,`bed_no`,`bed_dept_id`) VALUES ({base_hid},'{adm}','{dis}',3500,{base_tid},{pid},{bno},{dept})",
                f"INSERT IGNORE INTO `admission_diag` (`hospitalization_id`,`hosp_entry_code`) VALUES ({base_hid},'I20')",
                f"INSERT IGNORE INTO `discharge_diag` (`hospitalization_id`,`hosp_entry_code`) VALUES ({base_hid},'I20')",
                f"INSERT IGNORE INTO `evaluation` (`qual_med_care`,`qual_nurse_care`,`cleanness`,`food`,`tot_experience`,`hospitalization_id`) VALUES (4,4,4,4,4,{base_hid})",
            ]
            if ken_rows:
                q3_stmts.append(f"INSERT IGNORE INTO `assigned_ken` (`hospitalization_id`,`KEN_code`) VALUES ({base_hid},'{ken_rows[base_hid % len(ken_rows)]}')")
            base_tid += 1
            base_hid += 1

    _run(cursor, q3_stmts)

    # Q9: 6 pairs of patients with exactly 17 days in 2025
    slot_q9 = datetime(2025, 3, 1)
    for k in range(6):
        pid = 10 + k
        for _ in range(2):
            arr_dt = slot_q9 + timedelta(hours=8)
            srv_dt = arr_dt + timedelta(minutes=20)
            adm_dt = srv_dt + timedelta(hours=1)
            dis_dt = adm_dt + timedelta(days=17)
            nurse  = er_nurses[tid % 3]
            s = [3,4,3,4,3]
            qs += [
                f"INSERT IGNORE INTO `triage_entry` (`id`,`urg_level`,`arrival_time`,`department_id`,`nurse_id`,`patient_id`,`service_time`) VALUES ({tid},2,'{arr_dt.strftime('%Y-%m-%d %H:%M:%S')}',11,{nurse},{pid},'{srv_dt.strftime('%Y-%m-%d %H:%M:%S')}')",
                f"INSERT IGNORE INTO `hospitalization` (`id`,`admission_date`,`discharge_date`,`total_cost`,`triage_entry_id`,`patient_id`,`bed_no`,`bed_dept_id`) VALUES ({hid},'{adm_dt.strftime('%Y-%m-%d %H:%M:%S')}','{dis_dt.strftime('%Y-%m-%d %H:%M:%S')}',5000,{tid},{pid},3,2)",
                f"INSERT IGNORE INTO `admission_diag` (`hospitalization_id`,`hosp_entry_code`) VALUES ({hid},'J18')",
                f"INSERT IGNORE INTO `discharge_diag` (`hospitalization_id`,`hosp_entry_code`) VALUES ({hid},'J18')",
                f"INSERT IGNORE INTO `evaluation` (`qual_med_care`,`qual_nurse_care`,`cleanness`,`food`,`tot_experience`,`hospitalization_id`) VALUES ({s[0]},{s[1]},{s[2]},{s[3]},{s[4]},{hid})",
            ]
            if ken_rows:
                qs.append(f"INSERT IGNORE INTO `assigned_ken` (`hospitalization_id`,`KEN_code`) VALUES ({hid},'{ken_rows[hid%len(ken_rows)]}')")
            slot_q9 = dis_dt + timedelta(days=1)
            tid += 1; hid += 1

    # Q14: 6 ICD codes x 5 hosps x 2 years
    """target_codes = ['I20','I46','K35','I48','G40','J18']
    dis_map      = {'I20':'I20','I46':'I46','K35':'K35.8','I48':'I48','G40':'G40.9','J18':'J18'}
    for code in target_codes:
        for year in [2024, 2025]:
            slot_dt = datetime(year, 3, 1)
            for j in range(5):
                pid    = (tid % 150) + 50
                arr_dt = slot_dt
                srv_dt = arr_dt + timedelta(minutes=30)
                adm_dt = srv_dt + timedelta(hours=1)
                dis_dt = adm_dt + timedelta(days=25)
                nurse  = er_nurses[tid % 3]
                s = [(j+2)%5+1,(j+3)%5+1,(j+4)%5+1,(j+1)%5+1,j%5+1]
                q14_triage.append(f"INSERT IGNORE INTO `triage_entry` (`id`,`urg_level`,`arrival_time`,`department_id`,`nurse_id`,`patient_id`,`service_time`) VALUES ({tid},2,'{arr_dt.strftime('%Y-%m-%d %H:%M:%S')}',11,{nurse},{pid},'{srv_dt.strftime('%Y-%m-%d %H:%M:%S')}')")
                q14_hosp.append(f"INSERT IGNORE INTO `hospitalization` (`id`,`admission_date`,`discharge_date`,`total_cost`,`triage_entry_id`,`patient_id`,`bed_no`,`bed_dept_id`) VALUES ({hid},'{adm_dt.strftime('%Y-%m-%d %H:%M:%S')}','{dis_dt.strftime('%Y-%m-%d %H:%M:%S')}',4500,{tid},{pid},4,3)")
                q14_diag += [
                    f"INSERT IGNORE INTO `admission_diag` (`hospitalization_id`,`hosp_entry_code`) VALUES ({hid},'{code}')",
                    f"INSERT IGNORE INTO `discharge_diag` (`hospitalization_id`,`hosp_entry_code`) VALUES ({hid},'{dis_map[code]}')",
                ]
                q14_eval.append(f"INSERT IGNORE INTO `evaluation` (`qual_med_care`,`qual_nurse_care`,`cleanness`,`food`,`tot_experience`,`hospitalization_id`) VALUES ({s[0]},{s[1]},{s[2]},{s[3]},{s[4]},{hid})")
                if ken_rows:
                    q14_ken.append(f"INSERT IGNORE INTO `assigned_ken` (`hospitalization_id`,`KEN_code`) VALUES ({hid},'{ken_rows[hid%len(ken_rows)]}')")
                slot_dt = dis_dt + timedelta(days=2)
                tid += 1; hid += 1"""
    # Q14: 6 ICD codes x 5 hosps x 2 years
    target_codes = ['I20','I46','K35','I48','G40','J18']
    dis_map      = {'I20':'I20','I46':'I46','K35':'K35.8','I48':'I48','G40':'G40.9','J18':'J18'}
    cutoff       = datetime(2026, 4, 14)
    for code in target_codes:
        for year in [2024, 2025, 2026]:    
            slot_dt = datetime(year, 1, 1)
            for j in range(5):
                pid    = (tid % 150) + 50
                arr_dt = slot_dt
                srv_dt = arr_dt + timedelta(minutes=30)
                adm_dt = srv_dt + timedelta(hours=1)
                dis_dt = adm_dt + timedelta(days=25)
                if dis_dt > cutoff:
                    break
                nurse  = er_nurses[tid % 3]
                s = [(j+2)%5+1,(j+3)%5+1,(j+4)%5+1,(j+1)%5+1,j%5+1]
                q14_triage.append(f"INSERT IGNORE INTO `triage_entry` (`id`,`urg_level`,`arrival_time`,`department_id`,`nurse_id`,`patient_id`,`service_time`) VALUES ({tid},2,'{arr_dt.strftime('%Y-%m-%d %H:%M:%S')}',11,{nurse},{pid},'{srv_dt.strftime('%Y-%m-%d %H:%M:%S')}')")
                q14_hosp.append(f"INSERT IGNORE INTO `hospitalization` (`id`,`admission_date`,`discharge_date`,`total_cost`,`triage_entry_id`,`patient_id`,`bed_no`,`bed_dept_id`) VALUES ({hid},'{adm_dt.strftime('%Y-%m-%d %H:%M:%S')}','{dis_dt.strftime('%Y-%m-%d %H:%M:%S')}',4500,{tid},{pid},4,3)")
                q14_diag += [
                    f"INSERT IGNORE INTO `admission_diag` (`hospitalization_id`,`hosp_entry_code`) VALUES ({hid},'{code}')",
                    f"INSERT IGNORE INTO `discharge_diag` (`hospitalization_id`,`hosp_entry_code`) VALUES ({hid},'{dis_map[code]}')",
                ]
                q14_eval.append(f"INSERT IGNORE INTO `evaluation` (`qual_med_care`,`qual_nurse_care`,`cleanness`,`food`,`tot_experience`,`hospitalization_id`) VALUES ({s[0]},{s[1]},{s[2]},{s[3]},{s[4]},{hid})")
                if ken_rows:
                    q14_ken.append(f"INSERT IGNORE INTO `assigned_ken` (`hospitalization_id`,`KEN_code`) VALUES ({hid},'{ken_rows[hid%len(ken_rows)]}')")
                slot_dt = dis_dt + timedelta(days=2)
                tid += 1; hid += 1
    _run(cursor, qs)
    _run(cursor, q14_triage)
    _run(cursor, q14_hosp)
    _run(cursor, q14_diag)
    _run(cursor, q14_ken)
    _run(cursor, q14_eval)
    print(f"  Done ({time.time()-start:.1f}s)")


#  Step 5: Shifts 

def load_shifts(cursor):
    print("  Loading shifts...")
    start = time.time()

    days  = ['2025-01-06','2025-01-08','2025-01-10','2025-01-12','2025-01-14']
    types = [('Morning','07:00:00','15:00:00'),
             ('Afternoon','15:00:00','23:00:00'),
             ('Night','23:00:00','07:00:00')]

    shift_rows = []
    shift_map  = {}
    shid = 1

    for day_idx, day in enumerate(days):
        next_day = days[day_idx+1] if day_idx+1 < len(days) else '2025-01-16'
        for dept in range(1, 16):
            for ttype, tstart, tend in types:
                s_dt = f"{day} {tstart}"
                e_dt = f"{next_day} {tend}" if ttype == 'Night' else f"{day} {tend}"
                shift_rows.append(f"({shid},{dept},'{s_dt}','{e_dt}','{ttype}')")
                shift_map[(dept, day_idx, ttype)] = shid
                shid += 1

    for i in range(0, len(shift_rows), 30):
        _run(cursor, [
            "INSERT IGNORE INTO `shift` (`id`,`dept_id`,`start_time`,`end_time`,`type`) VALUES "
            + ','.join(shift_rows[i:i+30])
        ])

    # Load dept→staff maps from DB to ensure correct department assignment
    cursor.execute("SELECT department_id, doctor_id FROM doc_belongs ORDER BY department_id, doctor_id")
    dept_docs = {d: [] for d in range(1, 16)}
    for dept_id, doc_id in cursor.fetchall():
        if dept_id in dept_docs:
            dept_docs[dept_id].append(doc_id)

    cursor.execute("SELECT department_id, id FROM nurse ORDER BY department_id, id")
    dept_nurses = {d: [] for d in range(1, 16)}
    for dept_id, nid in cursor.fetchall():
        if dept_id in dept_nurses:
            dept_nurses[dept_id].append(nid)

    cursor.execute("SELECT department_id, id FROM admin_staff ORDER BY department_id, id")
    dept_admins = {d: [] for d in range(1, 16)}
    for dept_id, aid in cursor.fetchall():
        if dept_id in dept_admins:
            dept_admins[dept_id].append(aid)

    doc_stmts, nurse_stmts, admin_stmts = [], [], []
    type_order = ['Morning', 'Afternoon', 'Night']

    for dept in range(1, 16):
        docs   = dept_docs[dept]
        nurses = dept_nurses[dept]
        admins = dept_admins[dept]

        for day_idx in range(5):
            used_docs, used_nurses, used_admins = set(), set(), set()

            for ttype in type_order:
                sid = shift_map.get((dept, day_idx, ttype))
                if not sid:
                    continue

                # Prioritize Senior Attending (ids 16-40) to satisfy resident supervision rule
                avail_d  = [d for d in docs if d not in used_docs]
                seniors  = [d for d in avail_d if 16 <= d <= 40]
                others   = [d for d in avail_d if d not in seniors]
                assigned = (seniors + others)[:3]
                for d in assigned:
                    used_docs.add(d)
                    doc_stmts.append(f"INSERT IGNORE INTO `doctor_shift` (`doctor_id`,`shift_id`) VALUES ({d},{sid})")

                avail_n  = [n for n in nurses if n not in used_nurses]
                for n in avail_n[:6]:
                    used_nurses.add(n)
                    nurse_stmts.append(f"INSERT IGNORE INTO `nurse_shift` (`nurse_id`,`shift_id`) VALUES ({n},{sid})")

                if ttype in ('Morning', 'Afternoon'):
                    avail_a = [a for a in admins if a not in used_admins]
                    for a in avail_a[:2]:
                        used_admins.add(a)
                        admin_stmts.append(f"INSERT IGNORE INTO `admin_shift` (`admin_staff_id`,`shift_id`) VALUES ({a},{sid})")

    _run(cursor, doc_stmts)
    _run(cursor, nurse_stmts)
    _run(cursor, admin_stmts)
    print(f"  Done ({time.time()-start:.1f}s)")


# Step 6: Clinical data 

def load_clinical_data(cursor, med_ids, mp_a, mp_b):
    print("  Loading surgeries, procedures, exams, prescriptions...")
    start = time.time()

    cursor.execute("""
        SELECT id, patient_id, admission_date, discharge_date, bed_dept_id
        FROM hospitalization WHERE discharge_date IS NOT NULL ORDER BY id
    """)
    discharged = []
    for hid, pid, adm, dis, dept in cursor.fetchall():
        if isinstance(adm, str): adm = datetime.strptime(adm[:19], '%Y-%m-%d %H:%M:%S')
        if isinstance(dis, str): dis = datetime.strptime(dis[:19], '%Y-%m-%d %H:%M:%S')
        discharged.append((hid, pid, adm, dis, dept))

    # Ensure all operating rooms are available before inserting surgeries
    _run(cursor, ["UPDATE `operating_room` SET `status`='Available' WHERE `status` != 'Under Maintenance'"])

    # Surgeries (25 main, each with OR and doctor overlap checks)
    surg_stmts   = []
    used_or      = {}
    used_doc_surg = {}

    for i in range(25):
        h = discharged[i * 28 % len(discharged)]
        hid, pid, adm, dis, dept = h
        surg_dt = adm + timedelta(days=1, hours=8 + (i % 6))
        if surg_dt >= dis:
            surg_dt = adm + timedelta(hours=5)
        dur    = 60 + (i * 17 % 150)
        end_dt = surg_dt + timedelta(minutes=dur)
        doc_id  = 21 + (i % 20)
        room_id = (i % 10) + 1

        used_or.setdefault(room_id, [])
        for ps, pe in used_or[room_id]:
            if not (end_dt <= ps or surg_dt >= pe):
                surg_dt = pe + timedelta(minutes=30)
                end_dt  = surg_dt + timedelta(minutes=dur)
        used_or[room_id].append((surg_dt, end_dt))

        used_doc_surg.setdefault(doc_id, [])
        for ps, pe in used_doc_surg[doc_id]:
            if not (end_dt <= ps or surg_dt >= pe):
                surg_dt = pe + timedelta(minutes=60)
                end_dt  = surg_dt + timedelta(minutes=dur)
        used_doc_surg[doc_id].append((surg_dt, end_dt))

        code = mp_a[i % len(mp_a)]
        cost = 1500 + dur * 12
        surg_stmts.append(
            f"INSERT IGNORE INTO `surgery` (`category`,`duration`,`cost`,`hospitalization_id`,`operating_room_id`,`doctor_id`,`patient_id`,`mp_entryA_code`,`start_time`,`is_finalized`) "
            f"VALUES ('Surgical',{dur},{cost},{hid},{room_id},{doc_id},{pid},'{code}','{surg_dt.strftime('%Y-%m-%d %H:%M:%S')}',1)")
    _run(cursor, surg_stmts)

    # Extra surgeries for Q11: doctor 21 gets 9 more using Q14 hosps (days=25 window)

    cursor.execute("""
        SELECT id, patient_id, admission_date, discharge_date FROM hospitalization
        WHERE YEAR(admission_date) = 2026
        AND discharge_date IS NOT NULL
        ORDER BY id
        LIMIT 12
    """)
    extra_hosp_rows = cursor.fetchall()

    extra_surg_stmts = []
    extra_or, extra_doc = {}, {}
    primary_doc = 21

    for i, row in enumerate(extra_hosp_rows[:9]):
        hid_e = row[0]
        pid_e = row[1]
        adm_e = row[2] if isinstance(row[2], datetime) else datetime.strptime(str(row[2])[:19], '%Y-%m-%d %H:%M:%S')
        dis_e = row[3] if isinstance(row[3], datetime) else datetime.strptime(str(row[3])[:19], '%Y-%m-%d %H:%M:%S')

        room_id = 7 + (i % 4)
        dur     = 90 + (i * 11 % 60)
        surg_dt = adm_e + timedelta(days=2, hours=i * 4)
        end_dt  = surg_dt + timedelta(minutes=dur)

        if end_dt >= dis_e:
            surg_dt = adm_e + timedelta(days=1, hours=8)
            end_dt  = surg_dt + timedelta(minutes=dur)
        if end_dt >= dis_e:
            continue

        extra_or.setdefault(room_id, [])
        for ps, pe in extra_or[room_id]:
            if not (end_dt <= ps or surg_dt >= pe):
                surg_dt = pe + timedelta(minutes=30)
                end_dt  = surg_dt + timedelta(minutes=dur)
        extra_or[room_id].append((surg_dt, end_dt))

        extra_doc.setdefault(primary_doc, [])
        for ps, pe in extra_doc[primary_doc]:
            if not (end_dt <= ps or surg_dt >= pe):
                surg_dt = pe + timedelta(minutes=60)
                end_dt  = surg_dt + timedelta(minutes=dur)
        if end_dt >= dis_e:
            continue
        extra_doc[primary_doc].append((surg_dt, end_dt))

        code = mp_a[i % len(mp_a)]
        extra_surg_stmts.append(
            f"INSERT IGNORE INTO `surgery` (`category`,`duration`,`cost`,`hospitalization_id`,`operating_room_id`,`doctor_id`,`patient_id`,`mp_entryA_code`,`start_time`,`is_finalized`) "
            f"VALUES ('Surgical',{dur},{2000+dur*15},{hid_e},{room_id},{primary_doc},{pid_e},'{code}','{surg_dt.strftime('%Y-%m-%d %H:%M:%S')}',1)")
    _run(cursor, extra_surg_stmts)

    # Surgery assistants (nurse per surgery, with overlap check)
    cursor.execute("SELECT id, doctor_id, start_time, duration FROM surgery ORDER BY id")
    surgs      = cursor.fetchall()
    help_s     = []
    nurse_busy = {}

    for i, (sid, pdoc, surg_start, surg_dur) in enumerate(surgs):
        if isinstance(surg_start, str):
            surg_start = datetime.strptime(surg_start[:19], '%Y-%m-%d %H:%M:%S')
        surg_end = surg_start + timedelta(minutes=int(surg_dur))

        assigned_nurse = None
        for nid in range(81, 141):
            busy = nurse_busy.get(nid, [])
            if all(surg_end <= ps or surg_start >= pe for ps, pe in busy):
                assigned_nurse = nid
                nurse_busy.setdefault(nid, []).append((surg_start, surg_end))
                break

        if assigned_nurse:
            help_s.append(f"INSERT IGNORE INTO `help` (`surgery_id`,`staff_id`) VALUES ({sid},{assigned_nurse})")

        doc_asst = (i % 15) + 1
        if doc_asst != pdoc:
            help_s.append(f"INSERT IGNORE INTO `help` (`surgery_id`,`staff_id`) VALUES ({sid},{doc_asst})")
    _run(cursor, help_s)

    # Medical procedures (180)
    safe_nurses_proc = [81,83,84,86,87,88,89,90,92,93,94,95,96,97,98]
    proc_s = []
    for i in range(180):
        h = discharged[i % len(discharged)]
        hid, pid, adm, dis, dept = h
        proc_dt = adm + timedelta(days=1, hours=9 + (i % 8))
        if proc_dt >= dis:
            proc_dt = adm + timedelta(hours=4)
        code = mp_a[(i + 5) % len(mp_a)]
        cat  = 'Diagnostic' if i % 2 == 0 else 'Therapeutic'
        dur  = 20 + (i * 7 % 90)
        cost = 80 + (i * 23 % 500)
        clin = (i % 7) + 1
        proc_s.append(
            f"INSERT IGNORE INTO `med_proc` (`patient_id`,`category`,`duration`,`cost`,`date`,`clinical_room_id`,`hospitalization_id`,`mp_entryA_code`) "
            f"VALUES ({pid},'{cat}',{dur},{cost},'{proc_dt.strftime('%Y-%m-%d %H:%M:%S')}',{clin},{hid},'{code}')")
    _run(cursor, proc_s)

    cursor.execute("SELECT id FROM med_proc ORDER BY id")
    examstaff_s = []
    for i, (mpid,) in enumerate(cursor.fetchall()):
        examstaff_s.append(f"INSERT IGNORE INTO `exam_doc` (`med_proc_id`,`doctor_id`) VALUES ({mpid},{(i%20)+1})")
        examstaff_s.append(f"INSERT IGNORE INTO `exam_nurse` (`med_proc_id`,`nurse_id`) VALUES ({mpid},{safe_nurses_proc[i%len(safe_nurses_proc)]})")
    _run(cursor, examstaff_s)

    # Lab exams (220, unique per patient/type/date/hosp)
    lab_types  = ['Blood Test','Imaging','ECG','Urine Test','Biopsy','MRI','CT Scan','X-Ray','Serology','Culture']
    lab_s      = []
    seen_lab   = set()
    lab_count  = 0
    attempt    = 0

    while lab_count < 220 and attempt < 2000:
        i = attempt
        attempt += 1
        h = discharged[i % len(discharged)]
        hid, pid, adm, dis, dept = h
        day_off  = 1 + (i // len(discharged))
        hour_off = 8 + (i % 10)
        exam_dt  = adm + timedelta(days=day_off, hours=hour_off)
        if exam_dt >= dis:
            exam_dt = adm + timedelta(hours=3 + (i % 5))
        ltype = lab_types[i % len(lab_types)]
        key   = (pid, ltype, exam_dt.strftime('%Y-%m-%d %H:%M'), hid)
        if key in seen_lab:
            continue
        seen_lab.add(key)
        code = mp_b[i % len(mp_b)]
        doc  = (i % 20) + 1
        clin = (i % 7) + 1
        cost = 40 + (i * 17 % 300)
        if i % 2 == 0:
            lab_s.append(
                f"INSERT IGNORE INTO `lab_exam` (`patient_id`,`type`,`date`,`numeric_result`,`text_result`,`cost`,`clinical_room_id`,`hospitalization_id`,`doctor_id`,`mp_entryB_code`,`unit`) "
                f"VALUES ({pid},'{ltype}','{exam_dt.strftime('%Y-%m-%d %H:%M:%S')}',{100+i*3},NULL,{cost},{clin},{hid},{doc},'{code}','mg/dL')")
        else:
            lab_s.append(
                f"INSERT IGNORE INTO `lab_exam` (`patient_id`,`type`,`date`,`numeric_result`,`text_result`,`cost`,`clinical_room_id`,`hospitalization_id`,`doctor_id`,`mp_entryB_code`,`unit`) "
                f"VALUES ({pid},'{ltype}','{exam_dt.strftime('%Y-%m-%d %H:%M:%S')}',NULL,'Normal findings',{cost},{clin},{hid},{doc},'{code}',NULL)")
        lab_count += 1
    _run(cursor, lab_s)

    # Prescriptions (target 300)
    if not med_ids:
        print("  No medications found, skipping prescriptions")
    else:
        cursor.execute("SELECT id FROM active_substance LIMIT 30")
        sub_ids = [r[0] for r in cursor.fetchall()]
        if sub_ids:
            _run(cursor, [
                f"INSERT IGNORE INTO `is_allergic` (`patient_id`,`active_substance_id`) VALUES ({pid},{sub_ids[(pid//3)%len(sub_ids)]})"
                for pid in range(1, 61, 3)
            ])

        cursor.execute("SELECT patient_id, active_substance_id FROM is_allergic")
        allergies = {(r[0], r[1]) for r in cursor.fetchall()}
        cursor.execute("SELECT medication_id, active_substance_id FROM `contains`")
        med_subs = {}
        for mid, sid in cursor.fetchall():
            med_subs.setdefault(mid, set()).add(sid)

        def is_safe(pid, mid):
            return not any((pid, s) in allergies for s in med_subs.get(mid, set()))

        pres_s   = []
        inserted = 0
        for h_idx, h in enumerate(discharged):
            if inserted >= 300:
                break
            hid, pid, adm, dis, dept = h
            doc = (h_idx % 20) + 1
            for day_offset in range(1, 4):
                if inserted >= 300:
                    break
                if adm + timedelta(days=day_offset) >= dis:
                    break
                pres_day = (adm + timedelta(days=day_offset)).strftime('%Y-%m-%d')
                exp_date = (adm + timedelta(days=30)).strftime('%Y-%m-%d')
                count = 0
                for med_off in range(len(med_ids)):
                    if count >= 2 or inserted >= 300:
                        break
                    mid = med_ids[(h_idx * 7 + day_offset * 3 + med_off) % len(med_ids)]
                    if not is_safe(pid, mid):
                        continue
                    dose = f'{50+count*25+h_idx*3}mg'
                    freq = f'{1+count%3} times/day'
                    pres_s.append(
                        f"INSERT IGNORE INTO `prescription` (`dose`,`freq`,`pres_day`,`exp_date`,`patient_id`,`doctor_id`,`medication_id`,`hospitalization_id`) "
                        f"VALUES ('{dose}','{freq}','{pres_day}','{exp_date}',{pid},{doc},{mid},{hid})")
                    count    += 1
                    inserted += 1
        _run(cursor, pres_s)

    # Staff absences
    _run(cursor, [
        "INSERT IGNORE INTO `staff_absence` (`start_time`,`end_time`,`staff_id`,`reason`) VALUES ('2024-12-01 00:00:00','2024-12-07 00:00:00',36,'Sick Leave')",
        "INSERT IGNORE INTO `staff_absence` (`start_time`,`end_time`,`staff_id`,`reason`) VALUES ('2025-01-15 00:00:00','2025-01-22 00:00:00',82,'Annual Leave')",
        "INSERT IGNORE INTO `staff_absence` (`start_time`,`end_time`,`staff_id`,`reason`) VALUES ('2024-11-20 00:00:00','2024-11-25 00:00:00',85,'Sick Leave')",
        "INSERT IGNORE INTO `staff_absence` (`start_time`,`end_time`,`staff_id`,`reason`) VALUES ('2025-01-01 00:00:00','2025-01-10 00:00:00',141,'Annual Leave')",
        "INSERT IGNORE INTO `staff_absence` (`start_time`,`end_time`,`staff_id`,`reason`) VALUES ('2024-11-10 00:00:00','2024-11-15 00:00:00',31,'Sick Leave')",
        "INSERT IGNORE INTO `staff_absence` (`start_time`,`end_time`,`staff_id`,`reason`) VALUES ('2024-12-20 00:00:00','2024-12-28 00:00:00',90,'Annual Leave')",
        "INSERT IGNORE INTO `staff_absence` (`start_time`,`end_time`,`staff_id`,`reason`) VALUES ('2025-01-05 00:00:00','2025-01-08 00:00:00',103,'Sick Leave')",
        "INSERT IGNORE INTO `staff_absence` (`start_time`,`end_time`,`staff_id`,`reason`) VALUES ('2024-11-25 00:00:00','2024-12-01 00:00:00',117,'Annual Leave')",
        "INSERT IGNORE INTO `staff_absence` (`start_time`,`end_time`,`staff_id`,`reason`) VALUES ('2025-02-01 00:00:00','2025-02-10 00:00:00',45,'Sick Leave')",
        "INSERT IGNORE INTO `staff_absence` (`start_time`,`end_time`,`staff_id`,`reason`) VALUES ('2024-10-01 00:00:00',NULL,150,'Permanent Leave')",
    ])

    print(f"  Done ({time.time()-start:.1f}s)")


# Main 

def main():
    global _sql_out

    parser = argparse.ArgumentParser(description='Ygeiopolis Hospital DB Loader + SQL Dumper')
    parser.add_argument('--host',     default=os.getenv('DB_HOST',     'localhost'))
    parser.add_argument('--user',     default=os.getenv('DB_USER',     'root'))
    parser.add_argument('--password', default=os.getenv('DB_PASSWORD', ''))
    parser.add_argument('--port',     type=int, default=int(os.getenv('DB_PORT', 3306)))
    parser.add_argument('--data-dir', default=os.getenv('DATA_DIR',    './data'))
    parser.add_argument('--skip-csv', action='store_true')
    parser.add_argument('--output',   default='../sql/load.sql',
                        help='Path for the generated SQL file (default: ../sql/load.sql)')
    args = parser.parse_args()

    data_dir = Path(args.data_dir)

    required_sql = ['hosp_entry_icd10.sql', 'mp_entryA.sql', 'mp_entryB.sql']
    required_csv = ['ken_codes.csv', 'active_substances.csv', 'medications.csv', 'contains_mapping.csv']
    missing = [f for f in required_sql + ([] if args.skip_csv else required_csv)
               if not (data_dir / f).exists()]
    if missing:
        print(f"Error: missing files in {data_dir}: {', '.join(missing)}")
        sys.exit(1)

    # Open SQL output file
    out_path = Path(args.output)
    _sql_out = open(out_path, 'w', encoding='utf-8')
    _sql_out.write(f"-- Ygeiopolis DB — generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    _sql_out.write(f"-- Load with: mysql -u root -p {DB_NAME} < {out_path.name}\n\n")
    _sql_out.write("SET NAMES utf8mb4;\n")
    _sql_out.write("SET FOREIGN_KEY_CHECKS=0;\n")
    _sql_out.write("SET UNIQUE_CHECKS=0;\n")
    _sql_out.write("SET autocommit=0;\n\n")

    conn   = get_connection(args.host, args.user, args.password, DB_NAME, args.port)
    cursor = conn.cursor(buffered=True)
    total  = time.time()

    print(f"\nYgeiopolis DB Loader — {DB_NAME}")
    print(f"SQL output  → {out_path}")
    print("=" * 50)

    def _commit(label):
        conn.commit()
        if _sql_out:
            _sql_out.write(f'\nCOMMIT; -- {label}\n\n')

    try:
        if not args.skip_csv:
            print("\n[1/10] KEN codes")
            if _sql_out: _sql_out.write("-- 1/10 KEN codes\n")
            load_csv_ken(cursor, str(data_dir / 'ken_codes.csv'))
            _commit("KEN codes")

        print("\n[2/10] ICD-10 codes")
        if _sql_out: _sql_out.write("-- 2/10 ICD-10 codes\n")
        execute_sql_file(cursor, str(data_dir / 'hosp_entry_icd10.sql'))
        _commit("ICD-10 codes")

        print("\n[3/10] mp_entryA (procedures)")
        if _sql_out: _sql_out.write("-- 3/10 mp_entryA\n")
        execute_sql_file(cursor, str(data_dir / 'mp_entryA.sql'))
        _commit("mp_entryA")

        print("\n[4/10] mp_entryB (lab exams)")
        if _sql_out: _sql_out.write("-- 4/10 mp_entryB\n")
        execute_sql_file(cursor, str(data_dir / 'mp_entryB.sql'))
        _commit("mp_entryB")

        print("\n[5/10] Staff, departments, beds")
        if _sql_out: _sql_out.write("-- 5/10 Staff, departments, beds\n")
        load_reference_and_staff(cursor)
        _commit("staff")

        print("\n[6/10] Patients")
        if _sql_out: _sql_out.write("-- 6/10 Patients\n")
        load_patients(cursor)
        _commit("patients")

        print("\n[Images] Loading images")
        if _sql_out: _sql_out.write("-- Images\n")
        load_images(cursor)
        _commit("images")

        cursor.execute("SELECT code FROM `KEN` ORDER BY code")
        ken_rows = [r[0] for r in cursor.fetchall()]

        print("\n[7/10] Hospitalizations")
        if _sql_out: _sql_out.write("-- 7/10 Hospitalizations\n")
        load_hospitalizations(cursor, ken_rows)
        _commit("hospitalizations")

        print("\n[8/10] Q-specific data")
        if _sql_out: _sql_out.write("-- 8/10 Q-specific data\n")
        load_q_specific_data(cursor, ken_rows)
        _commit("Q-specific")

        print("\n[9/10] Shifts")
        if _sql_out: _sql_out.write("-- 9/10 Shifts\n")
        load_shifts(cursor)
        _commit("shifts")

        if not args.skip_csv:
            print("\n[CSV] Active substances")
            if _sql_out: _sql_out.write("-- CSV: active_substance\n")
            load_csv_substances(cursor, str(data_dir / 'active_substances.csv'))
            _commit("active_substance")
            print("[CSV] Medications")
            if _sql_out: _sql_out.write("-- CSV: medication\n")
            load_csv_medications(cursor, str(data_dir / 'medications.csv'))
            _commit("medication")
            print("[CSV] Contains mappings")
            if _sql_out: _sql_out.write("-- CSV: contains\n")
            load_csv_contains(cursor, str(data_dir / 'contains_mapping.csv'))
            _commit("contains")

        cursor.execute("SELECT code FROM mp_entryA LIMIT 30")
        mp_a = [r[0] for r in cursor.fetchall()]
        cursor.execute("SELECT code FROM mp_entryB LIMIT 30")
        mp_b = [r[0] for r in cursor.fetchall()]
        cursor.execute("SELECT id FROM medication LIMIT 150")
        med_ids = [r[0] for r in cursor.fetchall()]

        print("\n[10/10] Surgeries, procedures, exams, prescriptions")
        if _sql_out: _sql_out.write("-- 10/10 Clinical data\n")
        load_clinical_data(cursor, med_ids, mp_a, mp_b)
        _commit("clinical data")

        # Verification
        print("\n" + "=" * 50)
        print("Verification")
        print("=" * 50)
        checks = [
            ('doctor',          80,  'Doctors'),
            ('patient',         200, 'Patients'),
            ('hospitalization', 500, 'Hospitalizations'),
            ('department',      15,  'Departments'),
            ('prescription',    300, 'Prescriptions'),
            ('operating_room',  10,  'Operating rooms'),
            ('med_proc',        150, 'Medical procedures'),
            ('lab_exam',        200, 'Lab exams'),
            ('surgery',         10,  'Surgeries'),
            ('shift',           1,   'Shifts'),
            ('evaluation',      1,   'Evaluations'),
        ]
        all_ok = True
        for tbl, target, label in checks:
            cursor.execute(f"SELECT COUNT(*) FROM `{tbl}`")
            cnt = cursor.fetchone()[0]
            status = 'OK' if cnt >= target else 'MISSING'
            if cnt < target:
                all_ok = False
            print(f"  {status:<8} {label:<22} {cnt:>6}  (target >= {target})")

        elapsed = time.time() - total
        print(f"\nTotal time: {elapsed:.1f}s")
        print("All targets met." if all_ok else "Some targets not met — check warnings above.")

    except Exception as e:
        import traceback
        print(f"\nFatal error: {e}")
        traceback.print_exc()
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
        if _sql_out:
            _sql_out.write("\nSET FOREIGN_KEY_CHECKS=1;\n")
            _sql_out.write("SET UNIQUE_CHECKS=1;\n")
            _sql_out.close()
            print(f"\nSQL file: {out_path} ({out_path.stat().st_size // 1024} KB)")


if __name__ == '__main__':
    main()
