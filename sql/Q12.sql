SET @week_start = '2025-01-06 00:00:00';

WITH all_assignments AS (
    SELECT 
        ds.shift_id, 
        d.id AS staff_id, 
        'Doctor' AS staff_category,
        ds.doctor_id AS specific_id, 
        spec.name AS subcategory
    FROM doctor_shift ds
    JOIN doctor d ON ds.doctor_id = d.id
    JOIN doc_spec spec ON d.doc_spec_id = spec.id
    
    UNION ALL
    
    SELECT 
        ns.shift_id, 
        n.id AS staff_id, 
        'Nurse' AS staff_category,
        ns.nurse_id AS specific_id, 
        ng.name AS subcategory
    FROM nurse_shift ns
    JOIN nurse n ON ns.nurse_id = n.id
    JOIN nurse_grade ng ON n.nurse_grade_id = ng.id
    
    UNION ALL
    
    SELECT 
        ads.shift_id, 
        a.id AS staff_id, 
        'Administration' AS staff_category,
        ads.admin_staff_id AS specific_id, 
        a.role AS subcategory
    FROM admin_shift ads
    JOIN admin_staff a ON ads.admin_staff_id = a.id
)

SELECT 
    dept.name    AS department,
    s.start_time AS shift_start,
    s.end_time   AS shift_end,
    s.type       AS shift_type,
    assign.staff_category,
    assign.subcategory,
    COUNT(assign.staff_id) AS assigned_staff_count

FROM all_assignments assign
JOIN shift s ON assign.shift_id = s.id
JOIN department dept ON s.dept_id = dept.id

WHERE 
    s.start_time >= @week_start
    AND s.start_time < DATE_ADD(@week_start, INTERVAL 7 DAY)

GROUP BY 
    dept.name, 
    s.id, 
    s.start_time, 
    s.end_time, 
    s.type,
    assign.staff_category, 
    assign.subcategory

ORDER BY 
    department, 
    shift_start, 
    shift_type, 
    staff_category;