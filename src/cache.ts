import NodeCache from 'node-cache';

export const livrosCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
export const emprestimosCache = new NodeCache({ stdTTL: 60, checkperiod: 30 });
export const comunicadosCache = new NodeCache({ stdTTL: 60, checkperiod: 30 });
export const dashboardCache = new NodeCache({ stdTTL: 30, checkperiod: 15 });

export function flushAllCaches() {
  livrosCache.flushAll();
  emprestimosCache.flushAll();
  comunicadosCache.flushAll();
  dashboardCache.flushAll();
}
