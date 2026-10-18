import { useEffect, useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import PasswordStrength from '../common/PasswordStrength.jsx';
import * as userService from '../../services/userService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { isStrongPassword } from '../../utils/passwordPolicy.js';

/** Admin sets a specific new password for a user (no generated/alerted password). */
export default function ResetPasswordModal({ user, onClose, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const { success, error } = useNotify();

  useEffect(() => { if (user) { setPassword(''); setConfirm(''); } }, [user]);

  const strong = isStrongPassword(password);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = strong && matches;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await userService.resetPassword(user.id, password);
      success(`Password updated for ${user.name}`);
      onDone?.();
      onClose();
    } catch (err) { error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!user} onClose={onClose} title={`Reset password: ${user?.name ?? ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!canSubmit} form="reset-password-form" type="submit">Save new password</Button></>}>
      <form id="reset-password-form" onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">New password</label>
          <input type="password" autoFocus required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordStrength password={password} />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input type="password" required className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {confirm.length > 0 && !matches && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Passwords don't match</p>}
        </div>
      </form>
    </Modal>
  );
}
