USE Ygeiopolis_db;

WITH surgeries_this_year AS (
    SELECT doctor_id, COUNT(*) AS surgery_count
    FROM surgery
    WHERE YEAR(start_time) = YEAR(CURDATE())
    GROUP BY doctor_id
),
max_surgeries AS (
    SELECT IFNULL(MAX(surgery_count), 0) AS max_count
    FROM surgeries_this_year
)
SELECT
    d.id AS doctor_id,
    s.first_name,
    s.last_name,
    IFNULL(sty.surgery_count, 0) AS doctor_surgeries,
    m.max_count AS surgery_max
FROM doctor d
JOIN staff s ON s.id = d.id
CROSS JOIN max_surgeries m
LEFT JOIN surgeries_this_year sty ON sty.doctor_id = d.id
WHERE IFNULL(sty.surgery_count, 0) + 5 < m.max_count
ORDER BY doctor_surgeries DESC, s.last_name ASC;