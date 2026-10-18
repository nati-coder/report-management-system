/**
 * The zone plan overview: one row per approved report format (= one team's report), each with the zone plan
 * and the plan of every woreda that has one. Pure — the controller fetches the rows, this shapes them.
 *
 *   formats    approved report formats the caller may see (already scoped to department / team)
 *   plans      the zone's annual woreda plans for the year (any format)
 *   zonePlans  the zone's zone_plans rows for the year (any format)
 *
 * Returns [{ format_id, version, template_title, team_id, team_name, department_id,
 *            zone_plan: { data, updated_at } | null,
 *            plans: { [woreda_id]: { id, status, data, rejection_reason, updated_at } } }]
 * sorted by team, then template. Woredas without a plan are simply absent from `plans`.
 */
export function buildOverview({ formats, plans, zonePlans }) {
    const plansByFormat = new Map();
    for (const p of plans) {
        if (!plansByFormat.has(p.format_id)) plansByFormat.set(p.format_id, []);
        plansByFormat.get(p.format_id).push(p);
    }
    const zoneByFormat = new Map(zonePlans.map((z) => [z.format_id, z]));

    return formats
        .map((f) => {
            const z = zoneByFormat.get(f.id);
            return {
                format_id: f.id,
                version: f.version,
                template_title: f.template_title,
                team_id: f.team_id,
                team_name: f.team_name,
                department_id: f.department_id,
                zone_plan: z ? { data: z.data, updated_at: z.updated_at } : null,
                plans: Object.fromEntries((plansByFormat.get(f.id) || []).map((p) => [p.woreda_id, {
                    id: p.id, status: p.status, data: p.data, rejection_reason: p.rejection_reason ?? null, updated_at: p.updated_at,
                }])),
            };
        })
        .sort((a, b) => (a.team_name || '').localeCompare(b.team_name || '') || (a.template_title || '').localeCompare(b.template_title || '') || a.version - b.version);
}
