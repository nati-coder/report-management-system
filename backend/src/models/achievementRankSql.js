/**
 * Achievement ranking, straight from the plan and the reports — nothing is stored, so a ranking is always current.
 *
 * ACHIEVEMENT OF AN ITEM (a woreda, a team, one item of its report format, over the chosen months)
 *     reported / planned * 100      reported and planned both added up over the months (a rate — "%" — is averaged instead)
 *   - the items counted are the ones typed by hand (not an item that is "sum of sub-items": that would count the same
 *     people twice); to count every measured item, delete the `sum_of_subitems` line in `items`;
 *   - the plan is the woreda's MONTHLY plan (cascaded / accepted); the reports are the monthly reports that reached the zone;
 *   - a planned item that was not reported counts as 0 %; an item with a target of 0 is left out (no division by zero);
 *   - optional cap ($6): an item above target counts as at most `cap` percent.
 * ACHIEVEMENT OF A TEAM IN A WOREDA = SUM(items' percentages) / COUNT(items)                       -> team_ach
 * Every ranking below is again a mean of these, never a sum, and ranked with DENSE_RANK() (ties share a rank).
 *
 * Parameters (the same for all three): $1 year · $2 months int[] · $3 zone_id · $4 department_id · $5 team_id (or NULL) · $6 cap (or NULL)
 */
const BASE = `
WITH RECURSIVE fmt_nodes AS (
  SELECT f.id AS format_id, n AS node
  FROM report_formats f
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(f.schema_definition -> 'nodes', '[]'::jsonb)) AS n
  WHERE f.status = 'approved'
  UNION ALL
  SELECT fn.format_id, c
  FROM fmt_nodes fn
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(fn.node -> 'children', '[]'::jsonb)) AS c
),
items AS (   -- the values a format asks for: measured items that are typed, not calculated
  SELECT format_id,
         node ->> 'code' AS code,
         lower(btrim(node ->> 'measurement')) IN ('%', 'percent', 'percentage') AS is_percent
  FROM fmt_nodes
  WHERE btrim(COALESCE(node ->> 'measurement', '')) <> ''
    AND COALESCE(node ->> 'sum_of_subitems', 'false') <> 'true'
),
tgt AS (     -- planned, per woreda / team / item, over the months
  SELECT p.woreda_id, p.team_id, p.format_id, kv.key AS code,
         SUM(kv.value::numeric) AS t_sum, AVG(kv.value::numeric) AS t_avg
  FROM plans p
  JOIN woredas w ON w.woreda_id = p.woreda_id AND w.zone_id = $3
  JOIN teams   t ON t.id = p.team_id AND t.department_id = $4
  CROSS JOIN LATERAL jsonb_each_text(COALESCE(p.data, '{}'::jsonb)) AS kv(key, value)
  WHERE p.year = $1::int AND p.month = ANY($2::int[]) AND p.quarter IS NULL
    AND p.status IN ('submitted', 'approved')
    AND ($5::int IS NULL OR p.team_id = $5::int)
    AND kv.value ~ '^-?[0-9]+(\\.[0-9]+)?$'
  GROUP BY p.woreda_id, p.team_id, p.format_id, kv.key
),
rep AS (     -- reported, the same way
  SELECT r.woreda_id, r.team_id, r.format_id, kv.key AS code,
         SUM(kv.value::numeric) AS v_sum, AVG(kv.value::numeric) AS v_avg
  FROM reports r
  JOIN woredas w ON w.woreda_id = r.woreda_id AND w.zone_id = $3
  JOIN teams   t ON t.id = r.team_id AND t.department_id = $4
  CROSS JOIN LATERAL jsonb_each_text(COALESCE(r.data, '{}'::jsonb)) AS kv(key, value)
  WHERE r.type = 'monthly' AND r.year = $1::int AND r.month = ANY($2::int[])
    AND r.status IN ('submitted', 'reviewing', 'approved')
    AND r.format_id IS NOT NULL
    AND ($5::int IS NULL OR r.team_id = $5::int)
    AND kv.value ~ '^-?[0-9]+(\\.[0-9]+)?$'
  GROUP BY r.woreda_id, r.team_id, r.format_id, kv.key
),
item_raw AS (
  SELECT t.woreda_id, t.team_id,
         CASE WHEN i.is_percent THEN COALESCE(rp.v_avg, 0) / NULLIF(t.t_avg, 0)
              ELSE COALESCE(rp.v_sum, 0) / NULLIF(t.t_sum, 0) END * 100 AS pct
  FROM tgt t
  JOIN items i ON i.format_id = t.format_id AND i.code = t.code
  LEFT JOIN rep rp ON rp.woreda_id = t.woreda_id AND rp.team_id = t.team_id
                  AND rp.format_id = t.format_id AND rp.code = t.code
),
item_ach AS (  -- (LEAST ignores NULL, so a NULL percentage is kept as NULL explicitly)
  SELECT woreda_id, team_id,
         CASE WHEN pct IS NULL THEN NULL ELSE LEAST(pct, COALESCE($6::numeric, pct)) END AS pct
  FROM item_raw
),
team_ach AS ( -- team in a woreda: SUM / COUNT of its items
  SELECT woreda_id, team_id,
         SUM(pct) / NULLIF(COUNT(pct), 0) AS achievement,
         COUNT(pct)::int AS items
  FROM item_ach
  GROUP BY woreda_id, team_id
)`;

/** 1. OVERALL WOREDA RANK (department level): each woreda = mean of the achievements of its teams. */
export const OVERALL_WOREDA_SQL = `${BASE},
agg AS (
  SELECT w.woreda_id, w.name AS woreda_name, w.name_amharic,
         ROUND(SUM(ta.achievement) / NULLIF(COUNT(ta.achievement), 0), 2) AS achievement,
         COUNT(ta.achievement)::int AS teams_counted,
         (SELECT COUNT(*) FROM teams WHERE department_id = $4)::int AS teams_total,
         COALESCE(jsonb_agg(jsonb_build_object('team_id', t.id, 'team_name', t.name, 'achievement', ROUND(ta.achievement, 2), 'items', ta.items)
                            ORDER BY t.name) FILTER (WHERE ta.achievement IS NOT NULL), '[]'::jsonb) AS teams
  FROM woredas w
  LEFT JOIN team_ach ta ON ta.woreda_id = w.woreda_id
  LEFT JOIN teams t ON t.id = ta.team_id
  WHERE w.zone_id = $3
  GROUP BY w.woreda_id, w.name, w.name_amharic
)
SELECT CASE WHEN achievement IS NULL THEN NULL
            ELSE DENSE_RANK() OVER (ORDER BY achievement DESC NULLS LAST) END::int AS rank,
       woreda_id, woreda_name, name_amharic, achievement, teams_counted, teams_total, teams
FROM agg
ORDER BY rank NULLS LAST, woreda_name`;

/** 2. WOREDA RANK BY TEAM: woredas compared on one team's achievement (every team of the department when $5 is NULL, each ranked on its own). */
export const WOREDA_BY_TEAM_SQL = `${BASE},
agg AS (
  SELECT t.id AS team_id, t.name AS team_name, w.woreda_id, w.name AS woreda_name, w.name_amharic,
         ROUND(ta.achievement, 2) AS achievement, ta.items
  FROM woredas w
  CROSS JOIN teams t
  LEFT JOIN team_ach ta ON ta.woreda_id = w.woreda_id AND ta.team_id = t.id
  WHERE w.zone_id = $3 AND t.department_id = $4 AND ($5::int IS NULL OR t.id = $5::int)
)
SELECT CASE WHEN achievement IS NULL THEN NULL
            ELSE DENSE_RANK() OVER (PARTITION BY team_id ORDER BY achievement DESC NULLS LAST) END::int AS rank,
       team_id, team_name, woreda_id, woreda_name, name_amharic, achievement, COALESCE(items, 0) AS items
FROM agg
ORDER BY team_name, rank NULLS LAST, woreda_name`;

/** 3. ZONAL TEAM RANK: each team = mean of its achievements across the woredas of the zone. */
export const ZONAL_TEAM_SQL = `${BASE},
agg AS (
  SELECT t.id AS team_id, t.name AS team_name,
         ROUND(SUM(ta.achievement) / NULLIF(COUNT(ta.achievement), 0), 2) AS achievement,
         COUNT(ta.achievement)::int AS woredas_counted,
         (SELECT COUNT(*) FROM woredas WHERE zone_id = $3)::int AS woredas_total,
         COALESCE(jsonb_agg(jsonb_build_object('woreda_id', w.woreda_id, 'woreda_name', w.name, 'achievement', ROUND(ta.achievement, 2), 'items', ta.items)
                            ORDER BY w.name) FILTER (WHERE ta.achievement IS NOT NULL), '[]'::jsonb) AS woredas
  FROM teams t
  LEFT JOIN team_ach ta ON ta.team_id = t.id
  LEFT JOIN woredas w ON w.woreda_id = ta.woreda_id
  WHERE t.department_id = $4
  GROUP BY t.id, t.name
)
SELECT CASE WHEN achievement IS NULL THEN NULL
            ELSE DENSE_RANK() OVER (ORDER BY achievement DESC NULLS LAST) END::int AS rank,
       team_id, team_name, achievement, woredas_counted, woredas_total, woredas
FROM agg
ORDER BY rank NULLS LAST, team_name`;

