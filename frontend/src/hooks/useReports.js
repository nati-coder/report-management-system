import useFetch from './useFetch.js';
import * as svc from '../services/reportService.js';
export default function useReports(params = {}) {
  return useFetch(() => svc.list(params), [JSON.stringify(params)]);
}
