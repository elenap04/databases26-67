WITH allergic_counts AS (
    SELECT
        active_substance_id,
        COUNT(*) AS allergic_patients_count
    FROM is_allergic
    GROUP BY active_substance_id
),
medication_counts AS (
    SELECT
        active_substance_id,
        COUNT(*) AS medications_count
    FROM contains
    GROUP BY active_substance_id
)
SELECT
    a.id AS substance_id,
    a.name AS substance_name,
    COALESCE(ac.allergic_patients_count, 0) AS allergic_patients_count,
    COALESCE(mc.medications_count, 0) AS medications_count
FROM active_substance a
LEFT JOIN allergic_counts ac
    ON ac.active_substance_id = a.id
LEFT JOIN medication_counts mc
    ON mc.active_substance_id = a.id
ORDER BY
    allergic_patients_count DESC,
    medications_count DESC,
    a.name ASC;
