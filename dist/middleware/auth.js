"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gerarToken = gerarToken;
exports.autenticar = autenticar;
exports.autenticarBibliotecario = autenticarBibliotecario;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'biblioteca_secret_key';
function gerarToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}
function autenticar(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ erro: 'Token de autenticação não fornecido' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.usuarioAutenticado = decoded;
        next();
    }
    catch (err) {
        return res.status(401).json({ erro: 'Token inválido ou expirado' });
    }
}
function autenticarBibliotecario(req, res, next) {
    autenticar(req, res, () => {
        if (req.usuarioAutenticado?.perfil !== 'bibliotecario') {
            return res.status(403).json({ erro: 'Acesso restrito ao bibliotecário' });
        }
        next();
    });
}
