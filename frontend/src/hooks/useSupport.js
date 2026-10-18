import useFetch from './useFetch.js';
import * as svc from '../services/supportService.js';
export default function useSupport(params = {}) {
  return useFetch(() => svc.list(params), [JSON.stringify(params)]);
}
