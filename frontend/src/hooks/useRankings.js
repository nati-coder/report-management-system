import useFetch from './useFetch.js';
import * as svc from '../services/rankingService.js';
export const useTeamRankings = (params) => useFetch(() => svc.teamRankings(params), [JSON.stringify(params)]);
export const useWoredaRankings = (params) => useFetch(() => svc.woredaRankings(params), [JSON.stringify(params)]);
