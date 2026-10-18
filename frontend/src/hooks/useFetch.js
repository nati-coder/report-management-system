import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../services/api.js';

/** const { data, loading, error, reload } = useFetch(() => svc.list(params), [JSON.stringify(params)]) */
export default function useFetch(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const reload = useCallback(() => {
    setLoading(true);
    run().then((d) => { setData(d); setError(null); }).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false));
  }, [run]);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}
