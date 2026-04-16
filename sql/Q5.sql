WITH doctor_surgery_counts AS (
    SELECT
        d.id        AS doctor_id,
        s.first_name,
        s.last_name,
        TIMESTAMPDIFF(YEAR, s.date_of_birth, CURDATE()) AS age,
        COUNT(*)    AS surgery_count
    FROM doctor d
    JOIN staff s    ON s.id = d.id
    JOIN surgery su ON su.doctor_id = d.id
    WHERE TIMESTAMPDIFF(YEAR, s.date_of_birth, CURDATE()) < 35
    GROUP BY d.id, s.first_name, s.last_name, s.date_of_birth
)
SELECT
    doctor_id,
    first_name,
    last_name,
    age,
    surgery_count
FROM doctor_surgery_counts
WHERE surgery_count = (
    SELECT MAX(surgery_count)
    FROM doctor_surgery_counts
)
ORDER BY last_name ASC, first_name ASC;