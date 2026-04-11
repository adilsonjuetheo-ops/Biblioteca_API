"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const livros_1 = __importDefault(require("./routes/livros"));
const emprestimos_1 = __importDefault(require("./routes/emprestimos"));
const usuarios_1 = __importDefault(require("./routes/usuarios"));
const comunicados_1 = __importDefault(require("./routes/comunicados"));
const avaliacoes_1 = __importDefault(require("./routes/avaliacoes"));
const desejos_1 = __importDefault(require("./routes/desejos"));
const connection_1 = require("./db/connection");
const suspensoes_1 = __importDefault(require("./routes/suspensoes"));
const marlene_1 = __importDefault(require("./routes/marlene"));
const scan_livro_1 = __importDefault(require("./routes/scan-livro"));
const auth_1 = require("./middleware/auth");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
async function runMigrations() {
    try {
        await connection_1.pool.query('CREATE TABLE IF NOT EXISTS avaliacoes (' +
            'id SERIAL PRIMARY KEY, ' +
            'usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE, ' +
            'livro_id INTEGER REFERENCES livros(id) ON DELETE CASCADE, ' +
            'nota INTEGER, ' +
            'texto TEXT, ' +
            'criado_em TIMESTAMP DEFAULT NOW()' +
            ')');
        await connection_1.pool.query('CREATE TABLE IF NOT EXISTS desejos (' +
            'id SERIAL PRIMARY KEY, ' +
            'usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE, ' +
            'livro_id INTEGER REFERENCES livros(id) ON DELETE CASCADE, ' +
            'criado_em TIMESTAMP DEFAULT NOW(), ' +
            'UNIQUE (usuario_id, livro_id)' +
            ')');
        await connection_1.pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_ate TIMESTAMP');
        await connection_1.pool.query('CREATE TABLE IF NOT EXISTS suspensoes (' +
            'id SERIAL PRIMARY KEY, ' +
            'usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE, ' +
            'emprestimo_id INTEGER REFERENCES emprestimos(id) ON DELETE CASCADE, ' +
            'dias INTEGER NOT NULL, ' +
            'motivo TEXT, ' +
            'expira_em TIMESTAMP NOT NULL, ' +
            'criado_em TIMESTAMP DEFAULT NOW()' +
            ')');
        for (const [col, type] of Object.entries({
            retirada_qr_codigo: 'TEXT',
            retirada_qr_payload: 'TEXT',
            retirada_qr_gerado_em: 'TIMESTAMP',
            retirada_qr_expira_em: 'TIMESTAMP',
            retirada_qr_usado_em: 'TIMESTAMP',
            retirada_qr_invalidado_em: 'TIMESTAMP',
        })) {
            await connection_1.pool.query('ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS ' + col + ' ' + type);
        }
        console.log('[migrations] OK');
    }
    catch (e) {
        console.error('[migrations] Erro:', e);
        throw e;
    }
}
app.get('/', (_req, res) => { res.json({ status: 'API Biblioteca funcionando!' }); });
// ── USUÁRIOS — rotas públicas e protegidas ──
app.use('/usuarios', (req, res, next) => {
    const rotasPublicas = ['/login', '/cadastro', '/recuperar-senha', '/redefinir-senha'];
    const ehPublica = rotasPublicas.some(r => req.path.startsWith(r))
        || (req.method === 'POST' && req.path === '/');
    if (ehPublica)
        return next();
    if (req.method === 'GET' || req.method === 'DELETE') {
        return (0, auth_1.autenticarBibliotecario)(req, res, next);
    }
    next();
}, usuarios_1.default);
// ── LIVROS ──
app.use('/livros', auth_1.autenticar, (req, res, next) => {
    if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
        return (0, auth_1.autenticarBibliotecario)(req, res, next);
    }
    next();
}, livros_1.default);
// ── EMPRÉSTIMOS ──
app.use('/emprestimos', auth_1.autenticar, (req, res, next) => {
    const rotasBiblio = ['retirada-qr', 'devolver', 'retirar'];
    const ehRotaBiblio = req.method === 'PATCH' && rotasBiblio.some(r => req.path.includes(r));
    if (ehRotaBiblio && req.usuarioAutenticado?.perfil !== 'bibliotecario') {
        return res.status(403).json({ erro: 'Acesso restrito ao bibliotecário' });
    }
    next();
}, emprestimos_1.default);
// ── COMUNICADOS ──
app.use('/comunicados', auth_1.autenticar, (req, res, next) => {
    if (['POST', 'DELETE'].includes(req.method)) {
        return (0, auth_1.autenticarBibliotecario)(req, res, next);
    }
    next();
}, comunicados_1.default);
// ── AVALIAÇÕES ──
app.use('/avaliacoes', auth_1.autenticar, avaliacoes_1.default);
// ── DESEJOS ──
app.use('/desejos', auth_1.autenticar, desejos_1.default);
// ── SUSPENSÕES ──
app.use('/suspensoes', auth_1.autenticar, (req, res, next) => {
    if (req.path.startsWith('/verificar'))
        return next();
    return (0, auth_1.autenticarBibliotecario)(req, res, next);
}, suspensoes_1.default);
// ── IA ──
app.use('/api/marlene', auth_1.autenticar, marlene_1.default);
app.use('/api/scan-livro', auth_1.autenticarBibliotecario, scan_livro_1.default);
const PORT = process.env.PORT || 3000;
runMigrations()
    .then(() => {
    app.listen(PORT, () => {
        console.log('Servidor rodando na porta ' + PORT);
    });
})
    .catch((err) => {
    console.error('Falha nas migrations — servidor não iniciado:', err);
    process.exit(1);
});
