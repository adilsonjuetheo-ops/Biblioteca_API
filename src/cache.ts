import NodeCache from 'node-cache';

export const livrosCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
