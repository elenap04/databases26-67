USE Ygeiopolis_db;

SELECT 
    d.id   AS department_id, 
    d.name AS department_name, 
    YEAR(h.admission_date) AS hosp_year, 
    ak.KEN_code            AS ken_code, 
    COALESCE(ip.name, 'Uninsured') AS insurance_provider,
    COUNT(*) AS hospitalizations_count,
    SUM(k.base_cost / COALESCE(ic.insurance_count, 1)) AS total_basic_revenue,
    SUM(
        CASE 
            WHEN DATEDIFF(h.discharge_date, h.admission_date) > k.mdh 
            THEN (DATEDIFF(h.discharge_date, h.admission_date) - k.mdh) * k.daily_extra_charge / COALESCE(ic.insurance_count, 1)
            ELSE 0 
        END
    ) AS total_extra_revenue,
    SUM(
        (k.base_cost + 
        CASE 
            WHEN DATEDIFF(h.discharge_date, h.admission_date) > k.mdh 
            THEN (DATEDIFF(h.discharge_date, h.admission_date) - k.mdh) * k.daily_extra_charge
            ELSE 0 
        END) / COALESCE(ic.insurance_count, 1)
    ) AS total_revenue
FROM hospitalization h
JOIN bed b ON b.no = h.bed_no AND b.dept_id = h.bed_dept_id
JOIN department d ON d.id = b.dept_id
JOIN assigned_ken ak ON ak.hospitalization_id = h.id
JOIN KEN k ON k.code = ak.KEN_code
JOIN patient p ON p.id = h.patient_id
LEFT JOIN has_insurance hi ON hi.patient_id = p.id
LEFT JOIN insurance_provider ip ON ip.id = hi.insurance_provider_id
LEFT JOIN (
    SELECT patient_id, COUNT(*) AS insurance_count
    FROM has_insurance
    GROUP BY patient_id
) ic ON ic.patient_id = p.id
WHERE h.discharge_date IS NOT NULL
GROUP BY 
    d.id, 
    d.name, 
    YEAR(h.admission_date), 
    ak.KEN_code, 
    COALESCE(ip.name, 'Uninsured')
ORDER BY 
    hosp_year, 
    department_name, 
    ken_code;