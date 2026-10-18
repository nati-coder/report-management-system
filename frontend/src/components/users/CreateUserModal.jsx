import { useMemo, useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import PasswordStrength from '../common/PasswordStrength.jsx';
import * as userService from '../../services/userService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { ROLES, ROLE_LABEL } from '../../utils/roleHelpers.js';
import { localName } from '../../utils/formatters.js';
import { isStrongPassword } from '../../utils/passwordPolicy.js';

const EMPTY = { name: '', email: '', password: '', role: '', zone_id: '', woreda_id: '', department_id: '', team_id: '' };

/** Random password that always satisfies the strong-password policy (upper, lower, special, 8+ chars). */
function genPassword(length = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*-_=+';
  const all = upper + lower + digits + special;
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// Roles placed at a specific woreda (woreda is required for these; zone is derived from it).
const WOREDA_TIER_ROLES = [ROLES.WOREDA_DEPT_HEAD, ROLES.WOREDA_TEAM_LEADER, ROLES.WOREDA_EXPERT, ROLES.WOREDA_PLAN_EXPERT];

/** Admin-only: create a user, picking zone/woreda or department/team based on the chosen role. */
export default function CreateUserModal({ open, onClose, referenceData, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const { success, error } = useNotify();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const needsWoreda = WOREDA_TIER_ROLES.includes(form.role);
  const needsZone = !!form.role && form.role !== ROLES.ADMIN;
  const woredasInZone = useMemo(
    () => (referenceData?.woredas || []).filter((w) => !form.zone_id || w.zone_id === form.zone_id),
    [referenceData, form.zone_id]
  );
  const teamsInDept = useMemo(
    () => (referenceData?.teams || []).filter((t) => !form.department_id || t.department_id === Number(form.department_id)),
    [referenceData, form.department_id]
  );

  const close = () => { setForm(EMPTY); onClose(); };
  const canSubmit = !!form.name && !!form.email && isStrongPassword(form.password) && !!form.role
    && (!needsZone || !!form.zone_id) && (!needsWoreda || !!form.woreda_id);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        name: form.name, email: form.email, password: form.password, role: form.role,
        zone_id: form.zone_id || null,
        woreda_id: form.woreda_id || null,
        department_id: form.department_id ? Number(form.department_id) : null,
        team_id: form.team_id ? Number(form.team_id) : null,
      };
      await userService.create(body);
      success(`${form.name} created`);
      onCreated?.();
      close();
    } catch (err) { error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={close} title="New user"
      footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button loading={busy} disabled={!canSubmit} form="create-user-form" type="submit">Create user</Button></>}>
      <form id="create-user-form" onSubmit={submit} className="space-y-4">
        <div><label className="label">Full name</label><input required className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div><label className="label">Email</label><input type="email" required className="input" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div>
          <label className="label">Temporary password</label>
          <div className="flex gap-2">
            <input required minLength={8} className="input" value={form.password} onChange={(e) => set('password', e.target.value)} />
            <Button type="button" variant="secondary" onClick={() => set('password', genPassword())}>Generate</Button>
          </div>
          <PasswordStrength password={form.password} />
        </div>
        <div>
          <label className="label">Role</label>
          <select required className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
            <option value="">Select…</option>
            {Object.values(ROLES).filter((r) => r !== ROLES.ADMIN).map((r) => <option key={r} value={r}>{ROLE_LABEL[r].en}</option>)}
          </select>
        </div>
        {needsZone && (
          <>
            <div><label className="label">Zone</label>
              <select required className="input" value={form.zone_id} onChange={(e) => set('zone_id', e.target.value)}>
                <option value="">Select…</option>
                {(referenceData?.zones || []).map((z) => <option key={z.zone_id} value={z.zone_id}>{localName(z)}</option>)}
              </select></div>
            <div><label className="label">Woreda{!needsWoreda && ' (optional)'}</label>
              <select required={needsWoreda} className="input" value={form.woreda_id} onChange={(e) => set('woreda_id', e.target.value)} disabled={!form.zone_id}>
                <option value="">{form.zone_id ? 'Select…' : 'Select a zone first'}</option>
                {woredasInZone.map((w) => <option key={w.woreda_id} value={w.woreda_id}>{localName(w)}</option>)}
              </select></div>
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Department (optional)</label>
            <select className="input" value={form.department_id} onChange={(e) => set('department_id', e.target.value)}>
              <option value="">—</option>
              {(referenceData?.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
          <div><label className="label">Team (optional)</label>
            <select className="input" value={form.team_id} onChange={(e) => set('team_id', e.target.value)} disabled={!form.department_id}>
              <option value="">—</option>
              {teamsInDept.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></div>
        </div>
      </form>
    </Modal>
  );
}
