WITH RECURSIVE supervision_hierarchy AS (
    SELECT
        d.id AS doctor_id,
        d.supervisor_id,
        CASE 
            WHEN d.supervisor_id IS NULL THEN 0 
            ELSE 1 
        END AS hierarchy_level
    FROM doctor d

    UNION ALL

    SELECT
        sh.doctor_id,
        d.supervisor_id,
        sh.hierarchy_level + 1
    FROM supervision_hierarchy sh
    JOIN doctor d 
        ON d.id = sh.supervisor_id
    WHERE sh.supervisor_id IS NOT NULL
)

SELECT
    doc.id           AS doctor_id,
    s_doc.first_name AS doctor_first_name,
    s_doc.last_name  AS doctor_last_name,
    sh.hierarchy_level,
    sup.id           AS supervisor_id,
    s_sup.first_name AS supervisor_first_name,
    s_sup.last_name  AS supervisor_last_name,
    dg.name          AS supervisor_grade

FROM supervision_hierarchy sh
JOIN doctor doc  ON doc.id   = sh.doctor_id
JOIN staff  s_doc ON s_doc.id = doc.id
LEFT JOIN doctor sup  ON sup.id  = sh.supervisor_id
LEFT JOIN staff  s_sup ON s_sup.id = sup.id
LEFT JOIN doc_grade dg ON dg.id  = sup.doc_grade_id

WHERE 
    sh.supervisor_id IS NOT NULL
    OR sh.hierarchy_level = 0

ORDER BY
    doc.id ASC,
    sh.hierarchy_level ASC;