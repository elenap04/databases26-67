WITH icd_per_year AS (
    SELECT
        LEFT(ad.hosp_entry_code, 3) AS icd_category,
        YEAR(h.admission_date) AS hosp_year,
        COUNT(DISTINCT ad.hospitalization_id) AS admission_count
    FROM admission_diag ad
    JOIN hospitalization h
        ON h.id = ad.hospitalization_id
    GROUP BY
        LEFT(ad.hosp_entry_code, 3),
        YEAR(h.admission_date)
    HAVING COUNT(DISTINCT ad.hospitalization_id) >= 5
)
SELECT
    y1.icd_category,
    y1.hosp_year AS year_1,
    y2.hosp_year AS year_2,
    y1.admission_count AS admission_count
FROM icd_per_year y1
JOIN icd_per_year y2
    ON y1.icd_category = y2.icd_category
   AND y2.hosp_year = y1.hosp_year + 1
   AND y1.admission_count = y2.admission_count
ORDER BY
    y1.icd_category,
    y1.hosp_year;