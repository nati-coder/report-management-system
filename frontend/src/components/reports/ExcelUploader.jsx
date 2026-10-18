import { useRef, useState } from 'react';
import Button from '../common/Button.jsx';
import { importExcel } from '../../services/reportService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';

/** Offline Excel ingestion: expects woredaId, teamId, reportVersionId context. */
export default function ExcelUploader({ woredaId, teamId, reportVersionId, onDone }) {
  const ref = useRef();
  const { success, error } = useNotify();
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState([]);

  const upload = async () => {
    const file = ref.current.files[0];
    if (!file) return error('Choose an .xlsx file first');
    const fd = new FormData();
    fd.append('woreda_id', woredaId); fd.append('team_id', teamId); fd.append('report_version_id', reportVersionId);
    fd.append('file', file);
    setBusy(true); setProblems([]);
    try {
      const r = await importExcel(fd);
      success(`Imported ${r.planRows} plan rows and ${r.monthlyRows} monthly rows`);
      onDone?.(r);
    } catch (e) {
      error(errorMessage(e));
      setProblems(e.response?.data?.details || []);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <input ref={ref} type="file" accept=".xlsx,.xls" className="text-sm" />
      <Button loading={busy} onClick={upload}>Upload & import</Button>
      {problems.length > 0 && (
        <ul className="max-h-48 list-disc overflow-auto rounded-lg bg-red-50 p-3 pl-6 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {problems.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      )}
    </div>
  );
}
