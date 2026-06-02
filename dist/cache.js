"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardCache = exports.comunicadosCache = exports.emprestimosCache = exports.livrosCache = void 0;
exports.flushAllCaches = flushAllCaches;
const node_cache_1 = __importDefault(require("node-cache"));
exports.livrosCache = new node_cache_1.default({ stdTTL: 300, checkperiod: 60 });
exports.emprestimosCache = new node_cache_1.default({ stdTTL: 60, checkperiod: 30 });
exports.comunicadosCache = new node_cache_1.default({ stdTTL: 60, checkperiod: 30 });
exports.dashboardCache = new node_cache_1.default({ stdTTL: 30, checkperiod: 15 });
function flushAllCaches() {
    exports.livrosCache.flushAll();
    exports.emprestimosCache.flushAll();
    exports.comunicadosCache.flushAll();
    exports.dashboardCache.flushAll();
}
