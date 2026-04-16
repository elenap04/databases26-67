USE Ygeiopolis_db;
SELECT
    p.id AS patient_id,
    p.first_name,
    p.last_name,
    d.id AS department_id,
    d.name AS department_name,
    COUNT(*) AS hospitalizations_count,
    SUM(h.total_cost) AS total_hospitalization_cost
FROM hospitalization h
JOIN patient p
    ON p.id = h.patient_id
JOIN department d
    ON d.id = h.bed_dept_id
WHERE h.discharge_date IS NOT NULL
GROUP BY
    p.id,
    p.first_name,
    p.last_name,
    d.id,
    d.name
HAVING COUNT(*) > 3
ORDER BY
    hospitalizations_count DESC,
    total_hospitalization_cost DESC,
    p.last_name ASC,
    p.first_name ASC;