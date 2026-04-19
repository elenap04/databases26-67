SET @patient_id = 10;

SELECT
    h.id AS hospitalization_id,
    h.admission_date,
    h.discharge_date,
    d.name AS department,
    ad.admission_diagnoses,
    dd.discharge_diagnoses,
    h.total_cost,
    CASE
        WHEN e.id IS NULL THEN NULL
        ELSE ROUND((e.qual_med_care + e.qual_nurse_care + e.cleanness + e.food + e.tot_experience) / 5, 2)
    END AS avg_evaluation
FROM hospitalization h FORCE INDEX (fk_hospitalization_patient1_idx)
JOIN department d ON d.id = h.bed_dept_id
LEFT JOIN (
    SELECT
        ad.hospitalization_id,
        GROUP_CONCAT(
            DISTINCT CONCAT(ad.hosp_entry_code, ' - ', he.description)
            ORDER BY ad.hosp_entry_code
            SEPARATOR ', '
        ) AS admission_diagnoses
    FROM admission_diag ad
    JOIN hosp_entry he ON he.code = ad.hosp_entry_code
    GROUP BY ad.hospitalization_id
) ad ON ad.hospitalization_id = h.id
LEFT JOIN (
    SELECT
        dd.hospitalization_id,
        GROUP_CONCAT(
            DISTINCT CONCAT(dd.hosp_entry_code, ' - ', he.description)
            ORDER BY dd.hosp_entry_code
            SEPARATOR ', '
        ) AS discharge_diagnoses
    FROM discharge_diag dd
    JOIN hosp_entry he ON he.code = dd.hosp_entry_code
    GROUP BY dd.hospitalization_id
) dd ON dd.hospitalization_id = h.id
LEFT JOIN evaluation e ON e.hospitalization_id = h.id
WHERE h.patient_id = @patient_id
ORDER BY h.admission_date DESC;