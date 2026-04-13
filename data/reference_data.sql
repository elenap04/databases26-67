-- ============================================================
-- reference_data.sql
-- ============================================================

SET NAMES utf8mb4;
USE `Ygeiopolis_db`;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Βαθμίδες Ιατρών
TRUNCATE TABLE `doc_grade`;
INSERT INTO `doc_grade` (`id`, `name`) VALUES 
(1, 'Resident'), 
(2, 'Junior Attending'), 
(3, 'Senior Attending'), 
(4, 'Director');

-- 2. Ειδικότητες Ιατρών 
TRUNCATE TABLE `doc_spec`;
INSERT INTO `doc_spec` (`id`, `name`) VALUES 
(1,  'Cardiology'),
(2,  'Surgery'),
(3,  'Internal Medicine'),
(4,  'Neurology'),
(5,  'Orthopedics'),
(6,  'Pediatrics'),
(7,  'ICU/Critical Care'),
(8,  'Oncology'),
(9,  'Radiology'),
(10, 'Pulmonology'),
(11, 'Emergency Medicine'),
(12, 'Gastroenterology'),
(13, 'Urology'),
(14, 'Dermatology'),
(15, 'Psychiatry');

-- 3. Βαθμίδες Νοσηλευτών
TRUNCATE TABLE `nurse_grade`;
INSERT INTO `nurse_grade` (`id`, `name`) VALUES 
(1, 'Nursing Assistant'), 
(2, 'Nurse'), 
(3, 'Head Nurse');

-- 4. Ασφαλιστικοί Φορείς
TRUNCATE TABLE `insurance_provider`;
INSERT INTO `insurance_provider` (`id`, `name`, `type`) VALUES 
(1, 'EFKA',                'Public'), 
(2, 'Private Insurance A', 'Private'),
(3, 'Private Insurance B', 'Private'),
(4, 'OAEE',               'Public'),
(5, 'Uninsured',           'Public');

-- 5. Κλινικοί Χώροι
TRUNCATE TABLE `clinical_room`;
INSERT INTO `clinical_room` (`id`, `type`) VALUES 
(1, 'Examination Room'),
(2, 'Imaging Room'),
(3, 'Procedure Room'),
(4, 'Laboratory'),
(5, 'Treatment Room'),
(6, 'Consultation Room'),
(7, 'Recovery Room');

-- 6. Χειρουργεία 
TRUNCATE TABLE `operating_room`;
INSERT INTO `operating_room` (`id`, `type`, `status`) VALUES 
(1,  'General OR',      'Available'),
(2,  'Cardiac OR',      'Available'),
(3,  'Orthopedic OR',   'Available'),
(4,  'Neurosurgery OR', 'Available'),
(5,  'Laparoscopic OR', 'Available'),
(6,  'Emergency OR',    'Available'),
(7,  'General OR',      'Available'),
(8,  'Cardiac OR',      'Available'),
(9,  'Orthopedic OR',   'Available'),
(10, 'Neurosurgery OR', 'Available');

SET FOREIGN_KEY_CHECKS = 1;
SELECT 'Reference data loaded successfully' AS status;