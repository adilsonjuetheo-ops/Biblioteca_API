"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.livrosCache = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
exports.livrosCache = new node_cache_1.default({ stdTTL: 300, checkperiod: 60 });
