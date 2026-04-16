USE Ygeiopolis_db;

SET @specialization = 'Cardiology';

WITH doctors_with_shift AS (
    SELECT DISTINCT dsh.doctor_id
    FROM doctor_shift dsh
    JOIN shift sh
      ON sh.id = dsh.shift_id
    WHERE YEAR(sh.start_time) = YEAR(CURDATE())

),
surgeries_this_year AS (
    SELECT
        sur.doctor_id,
        COUNT(*) AS surgeries_as_primary
    FROM surgery sur
    WHERE YEAR(sh.start_time) = YEAR(CURDATE())
    GROUP BY sur.doctor_id
)
SELECT
    s.id AS doctor_id,
    s.first_name,
    s.last_name,
    ds.name AS specialization,
    dg.name AS grade,
    CASE
        WHEN dws.doctor_id IS NOT NULL THEN 'Yes'
        ELSE 'No'
    END AS had_shift_this_year,
    COALESCE(sty.surgeries_as_primary, 0) AS surgeries_as_primary
FROM doctor d
JOIN staff s
  ON s.id = d.id
JOIN doc_spec ds
  ON ds.id = d.doc_spec_id
JOIN doc_grade dg
  ON dg.id = d.doc_grade_id
LEFT JOIN doctors_with_shift dws
  ON dws.doctor_id = d.id
LEFT JOIN surgeries_this_year sty
  ON sty.doctor_id = d.id

WHERE ds.name = @specialization COLLATE utf8mb4_unicode_ci
ORDER BY
    surgeries_as_primary DESC,
    s.last_name ASC,
    s.first_name ASC;