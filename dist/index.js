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
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
        // BUG CORRIGIDO: nomes das colunas QR corrigidos de retiradaq_r_* para retirada_qr_*
        // As queries em emprestimos.ts usam retirada_qr_* — os nomes precisam bater
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
        // BUG CORRIGIDO: em vez de engolir o erro, lançamos para impedir o servidor de subir
        // com banco incompleto
        throw e;
    }
}
app.get('/', (_req, res) => { res.json({ status: 'API Biblioteca funcionando!' }); });
app.use('/livros', livros_1.default);
app.use('/emprestimos', emprestimos_1.default);
app.use('/usuarios', usuarios_1.default);
app.use('/comunicados', comunicados_1.default);
app.use('/avaliacoes', avaliacoes_1.default);
app.use('/desejos', desejos_1.default);
app.use('/suspensoes', suspensoes_1.default);
app.use('/api/marlene', marlene_1.default);
const PORT = process.env.PORT || 3000;
// BUG CORRIGIDO: migrations rodam ANTES do servidor subir
// Antes: app.listen primeiro, runMigrations depois — requisições chegavam com banco incompleto
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
