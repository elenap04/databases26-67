SET @year = 2025;

WITH patient_year_days AS (
    SELECT
        h.patient_id,
        SUM(DATEDIFF(h.discharge_date, h.admission_date)) AS total_days
    FROM hospitalization h
    WHERE h.discharge_date IS NOT NULL
      AND h.admission_date >= MAKEDATE(@year, 1)
      AND h.admission_date <  MAKEDATE(@year + 1, 1)
    GROUP BY h.patient_id
    HAVING SUM(DATEDIFF(h.discharge_date, h.admission_date)) > 15
),
matching_totals AS (
    SELECT total_days
    FROM patient_year_days
    GROUP BY total_days
    HAVING COUNT(*) > 1
)
SELECT
    p.id AS patient_id,
    p.first_name,
    p.last_name,
    pyd.total_days
FROM patient_year_days pyd
JOIN matching_totals mt
    ON mt.total_days = pyd.total_days
JOIN patient p
    ON p.id = pyd.patient_id
ORDER BY
    pyd.total_days DESC,
    p.last_name ASC,
    p.first_name ASC;