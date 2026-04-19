SET @doctor_id = 1;

WITH doctor_hospitalizations AS (
    SELECT sur.hospitalization_id
    FROM surgery sur FORCE INDEX (idx_surgery_doctor_hosp)
    WHERE sur.doctor_id = @doctor_id

    UNION

    SELECT le.hospitalization_id
    FROM lab_exam le FORCE INDEX (idx_lab_exam_doctor_hosp)
    WHERE le.doctor_id = @doctor_id

    UNION

    SELECT mp.hospitalization_id
    FROM exam_doc ed FORCE INDEX (idx_exam_doc_doctor_medproc)
    JOIN med_proc mp ON mp.id = ed.med_proc_id
    WHERE ed.doctor_id = @doctor_id
),
doctor_eval_stats AS (
    SELECT
        COUNT(DISTINCT e.id) AS evaluations_count,
        ROUND(AVG(e.qual_med_care), 2) AS avg_medical_care_quality,
        ROUND(AVG(e.tot_experience), 2) AS avg_total_experience
    FROM doctor_hospitalizations dh
    JOIN evaluation e ON e.hospitalization_id = dh.hospitalization_id
)
SELECT
    d.id AS doctor_id,
    s.first_name,
    s.last_name,
    COALESCE(des.evaluations_count, 0) AS evaluations_count,
    des.avg_medical_care_quality,
    des.avg_total_experience
FROM doctor d
JOIN staff s ON s.id = d.id
LEFT JOIN doctor_eval_stats des ON TRUE
WHERE d.id = @doctor_id;