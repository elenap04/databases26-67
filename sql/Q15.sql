WITH triage_base AS (
    SELECT
        t.id,
        t.urg_level,
        t.arrival_time,
        t.service_time,
        TIMESTAMPDIFF(MINUTE, t.arrival_time, t.service_time) AS wait_minutes,
        CASE WHEN h.id IS NOT NULL THEN 1 ELSE 0 END AS is_hospitalized,
        h.bed_dept_id AS referred_dept_id
    FROM triage_entry t
    LEFT JOIN hospitalization h
        ON h.triage_entry_id = t.id
    WHERE t.service_time IS NOT NULL
),
triage_stats AS (
    SELECT
        urg_level,
        COUNT(*) AS total_count,
        ROUND(AVG(wait_minutes), 2) AS avg_wait_minutes,
        SUM(is_hospitalized) AS hospitalized_count
    FROM triage_base
    GROUP BY urg_level
),
dept_distribution AS (
    SELECT
        tb.urg_level,
        d.name AS department,
        COUNT(*) AS dept_count
    FROM triage_base tb
    JOIN department d
        ON d.id = tb.referred_dept_id
    WHERE tb.is_hospitalized = 1
    GROUP BY
        tb.urg_level,
        d.name
)
SELECT
    ts.urg_level,
    ts.total_count,
    ts.avg_wait_minutes,
    ts.hospitalized_count,
    ROUND(ts.hospitalized_count * 100.0 / NULLIF(ts.total_count, 0), 2) AS hospitalization_pct,
    dd.department,
    dd.dept_count,
    ROUND(dd.dept_count * 100.0 / NULLIF(ts.hospitalized_count, 0), 2) AS dept_pct
FROM triage_stats ts
LEFT JOIN dept_distribution dd
    ON dd.urg_level = ts.urg_level
ORDER BY
    ts.urg_level ASC,
    dd.dept_count DESC,
    dd.department ASC;