import { useEffect, useState } from 'react';
import Header from '../../components/layout/Header.jsx';
import Card from '../../components/common/Card.jsx';
import Loader from '../../components/common/Loader.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button from '../../components/common/Button.jsx';
import ZoneTargetsTable, { PLAN_STATUS } from '../../components/plans/ZoneTargetsTable.jsx';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as planService from '../../services/planService.js';
import * as reportFormatService from '../../services/reportFormatService.js';
import * as referenceService from '../../services/referenceService.js';
import { errorMessage } from '../../services/api.js';
import { ROLES } from '../../utils/roleHelpers.js';

/**
 * Zone plan overview — the whole zone on one page.
 *   Zone Dept Head / Zone Plan Expert : every team of their department, in every woreda
 *   Zone Expert / Zone Team Leader     : their own team, in every woreda
 * Top: a matrix (team × woreda) of plan status. Below: the selected team's targets, zone and every woreda side by side.
 */
export default function PlansOverviewPage() {
    const { user } = useAuth();
    const isAdmin = user.role === ROLES.ADMIN;
    const ownTeamOnly = [ROLES.ZONAL_EXPERT, ROLES.ZONAL_TEAM_LEADER].includes(user.role);

    const { data: ref } = useFetch(() => (isAdmin ? referenceService.all() : Promise.resolve(null)), []);
    const [zoneId, setZoneId] = useState('');
    const [year, setYear] = useState('');
    const ready = !isAdmin || !!zoneId;
    const { data, loading, error } = useFetch(
        () => (ready ? planService.overview({ ...(year ? { year } : {}), ...(isAdmin ? { zone_id: zoneId } : {}) }) : Promise.resolve(null)), [year, zoneId]);

    const [selectedId, setSelectedId] = useState(null);
    const [format, setFormat] = useState(null);
    const [formatError, setFormatError] = useState('');
    const team = (data?.teams || []).find((t) => t.format_id === selectedId) || null;

    useEffect(() => { // open the first team straight away
        if (data?.teams?.length && !data.teams.some((t) => t.format_id === selectedId)) setSelectedId(data.teams[0].format_id);
    }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setFormat(null); setFormatError('');
        if (!team) return undefined;
        let live = true;
        reportFormatService.get(team.format_id).then((f) => live && setFormat(f))
            .catch((e) => live && setFormatError(`${errorMessage(e)} (${e.response?.status ? `HTTP ${e.response.status}` : 'no response from the server'})`));
        return () => { live = false; };
    }, [team?.format_id]); // eslint-disable-line react-hooks/exhaustive-deps

    const woredas = data?.woredas || [];

    return (
        <>
            <Header
                title="Zone Plan Overview"
                subtitle={ownTeamOnly ? "Your team's annual plan in every woreda of the zone." : "Every team's annual plan in every woreda of the zone."}
            />

            <div className="mb-4 flex flex-wrap items-end gap-3">
                {isAdmin && (
                    <div><label className="label">Zone</label>
                        <select className="input" value={zoneId} onChange={(e) => { setZoneId(e.target.value); setYear(''); setSelectedId(null); }}>
                            <option value="">Select…</option>
                            {(ref?.zones || []).map((z) => <option key={z.zone_id} value={z.zone_id}>{z.name}</option>)}
                        </select>
                    </div>
                )}
                {!!data?.years?.length && (
                    <div><label className="label">Plan year</label>
                        <select className="input" value={year || data.year} onChange={(e) => { setYear(e.target.value); setSelectedId(null); }}>
                            {data.years.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {!ready ? <Card><p className="text-sm text-slate-500 dark:text-slate-400">Choose a zone to see its plans.</p></Card>
                : loading && !data ? <Loader />
                    : error ? <p className="text-red-600">{error}</p>
                        : !data?.teams?.length ? (
                            <Card><p className="text-sm text-slate-500 dark:text-slate-400">
                                {ownTeamOnly ? 'There is no approved report format for your team' : 'There are no approved report formats'}{data?.year ? ` for ${data.year}` : ''} yet, so there is nothing to plan.
                            </p></Card>
                        ) : (
                            <div className="space-y-6">
                                <Card title={`${data.year} plan status`}>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                <tr>
                                                    <th className="py-2 pr-3 font-medium">Team / report</th>
                                                    <th className="px-3 py-2 font-medium">Zone plan</th>
                                                    {woredas.map((w) => <th key={w.woreda_id} className="whitespace-nowrap px-3 py-2 font-medium">{w.name}</th>)}
                                                    <th className="px-3 py-2 font-medium">Accepted</th>
                                                    <th />
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {data.teams.map((t) => {
                                                    const accepted = woredas.filter((w) => t.plans[w.woreda_id]?.status === 'approved').length;
                                                    return (
                                                        <tr key={t.format_id} onClick={() => setSelectedId(t.format_id)}
                                                            className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 ${t.format_id === selectedId ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''}`}>
                                                            <td className="py-2 pr-3 font-medium">{t.team_name || 'No team'} <span className="font-normal text-slate-500 dark:text-slate-400">· {t.template_title} (v{t.version})</span></td>
                                                            <td className="px-3 py-2">{t.zone_plan ? <Badge tone="green">set</Badge> : <Badge>not set</Badge>}</td>
                                                            {woredas.map((w) => {
                                                                const p = t.plans[w.woreda_id];
                                                                return <td key={w.woreda_id} className="px-3 py-2">{p ? <Badge tone={PLAN_STATUS[p.status]?.[1]}>{PLAN_STATUS[p.status]?.[0] || p.status}</Badge> : <span className="text-slate-400">—</span>}</td>;
                                                            })}
                                                            <td className="px-3 py-2 tabular-nums">{accepted} / {woredas.length}</td>
                                                            <td className="py-2 pl-3 text-right"><Button type="button" variant={t.format_id === selectedId ? 'primary' : 'secondary'} onClick={(e) => { e.stopPropagation(); setSelectedId(t.format_id); }}>{t.format_id === selectedId ? 'Viewing' : 'View'}</Button></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>

                                {team && (
                                    <Card title={`${team.team_name || 'No team'} — ${team.template_title} (v${team.version}), ${data.year}`}>
                                        {!team.zone_plan && <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">The zone plan has not been set yet.</p>}
                                        {formatError ? <p className="text-sm text-red-600">Could not load this report format: {formatError}</p>
                                            : !format ? <Loader />
                                                : <ZoneTargetsTable format={format} zoneData={team.zone_plan?.data} woredas={woredas} plans={team.plans} />}
                                    </Card>
                                )}
                            </div>
                        )}
        </>
    );
}
