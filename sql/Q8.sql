SET @dept_id = 1;
SET @date = '2025-01-01';

WITH eligible_staff AS (

    SELECT d.id AS staff_id
    FROM doctor d
    JOIN doc_belongs db
        ON db.doctor_id = d.id
    WHERE db.department_id = @dept_id

    UNION

    SELECT n.id AS staff_id
    FROM nurse n
    WHERE n.department_id = @dept_id

    UNION

    SELECT a.id AS staff_id
    FROM admin_staff a
    WHERE a.department_id = @dept_id
),
staff_with_shift AS (
    SELECT ds.doctor_id AS staff_id
    FROM doctor_shift ds
    JOIN shift sh
        ON sh.id = ds.shift_id
    WHERE sh.dept_id = @dept_id
      AND sh.start_time >= @date
      AND sh.start_time < DATE_ADD(@date, INTERVAL 1 DAY)

    UNION

    SELECT ns.nurse_id AS staff_id
    FROM nurse_shift ns
    JOIN shift sh
        ON sh.id = ns.shift_id
    WHERE sh.dept_id = @dept_id
      AND sh.start_time >= @date
      AND sh.start_time < DATE_ADD(@date, INTERVAL 1 DAY)

    UNION

    SELECT ads.admin_staff_id AS staff_id
    FROM admin_shift ads
    JOIN shift sh
        ON sh.id = ads.shift_id
    WHERE sh.dept_id = @dept_id
      AND sh.start_time >= @date
      AND sh.start_time < DATE_ADD(@date, INTERVAL 1 DAY)
)
SELECT
    s.id AS staff_id,
    s.first_name,
    s.last_name,
    s.staff_type
FROM eligible_staff es
JOIN staff s
    ON s.id = es.staff_id
LEFT JOIN staff_with_shift sws
    ON sws.staff_id = es.staff_id
WHERE sws.staff_id IS NULL
ORDER BY
    s.staff_type ASC,
    s.last_name ASC,
    s.first_name ASC;