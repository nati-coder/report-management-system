import { useState } from 'react';
import Header from '../../components/layout/Header.jsx';
import Table from '../../components/common/Table.jsx';
import Loader from '../../components/common/Loader.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button from '../../components/common/Button.jsx';
import CreateUserModal from '../../components/users/CreateUserModal.jsx';
import ResetPasswordModal from '../../components/users/ResetPasswordModal.jsx';
import useFetch from '../../hooks/useFetch.js';
import * as userService from '../../services/userService.js';
import * as referenceService from '../../services/referenceService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { ROLE_LABEL } from '../../utils/roleHelpers.js';

export default function UserListPage() {
  const { data: users, loading, error, reload } = useFetch(() => userService.list({ limit: 200 }), []);
  const { data: referenceData } = useFetch(() => referenceService.all(), []);
  const { success, error: notifyError } = useNotify();
  const [creating, setCreating] = useState(false);
  const [resettingUser, setResettingUser] = useState(null);

  const toggleActive = async (u) => {
    try { await userService.update(u.id, { is_active: !u.is_active }); success(`${u.name} ${u.is_active ? 'deactivated' : 'activated'}`); reload(); }
    catch (e) { notifyError(errorMessage(e)); }
  };

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (u) => ROLE_LABEL[u.role]?.en || u.role },
    { key: 'place', header: 'Zone / Woreda', render: (u) => u.woreda_id || u.zone_id || '—' },
    { key: 'is_active', header: 'Status', render: (u) => <Badge tone={u.is_active ? 'green' : 'gray'}>{u.is_active ? 'active' : 'inactive'}</Badge> },
    { key: 'actions', header: '', render: (u) => (
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setResettingUser(u)}>Reset password</Button>
        <Button variant={u.is_active ? 'danger' : 'secondary'} onClick={() => toggleActive(u)}>{u.is_active ? 'Deactivate' : 'Activate'}</Button>
      </div>
    ) },
  ];

  return (
    <>
      <Header title="Users" actions={<Button onClick={() => setCreating(true)}>New user</Button>} />
      {loading ? <Loader /> : error ? <p className="text-red-600">{error}</p> : <Table columns={columns} rows={users} />}
      <CreateUserModal open={creating} onClose={() => setCreating(false)} referenceData={referenceData} onCreated={reload} />
      <ResetPasswordModal user={resettingUser} onClose={() => setResettingUser(null)} onDone={reload} />
    </>
  );
}
