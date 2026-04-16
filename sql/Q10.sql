WITH simultaneous_substance_pairs AS (
    SELECT DISTINCT
        p1.hospitalization_id,
        c1.active_substance_id AS substance_id_1,
        c2.active_substance_id AS substance_id_2
    FROM prescription p1
    JOIN prescription p2
        ON  p1.hospitalization_id = p2.hospitalization_id
        AND p1.id                 < p2.id
        AND p1.pres_day          <= p2.exp_date
        AND p2.pres_day          <= p1.exp_date
    JOIN contains c1
        ON c1.medication_id = p1.medication_id
    JOIN contains c2
        ON c2.medication_id = p2.medication_id
    WHERE c1.active_substance_id < c2.active_substance_id
),
pair_counts AS (
    SELECT
        substance_id_1,
        substance_id_2,
        COUNT(*) AS pair_count
    FROM simultaneous_substance_pairs
    GROUP BY
        substance_id_1,
        substance_id_2
)
SELECT
    a1.name AS substance_1,
    a2.name AS substance_2,
    pc.pair_count
FROM pair_counts pc
JOIN active_substance a1
    ON a1.id = pc.substance_id_1
JOIN active_substance a2
    ON a2.id = pc.substance_id_2
ORDER BY
    pc.pair_count DESC,
    a1.name ASC,
    a2.name ASC
LIMIT 3;
