"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const livros_1 = __importDefault(require("./routes/livros"));
const emprestimos_1 = __importDefault(require("./routes/emprestimos"));
const usuarios_1 = __importDefault(require("./routes/usuarios"));
const comunicados_1 = __importDefault(require("./routes/comunicados"));
const avaliacoes_1 = __importDefault(require("./routes/avaliacoes"));
const desejos_1 = __importDefault(require("./routes/desejos"));
const connection_1 = require("./db/connection");
const schema_1 = require("./db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const suspensoes_1 = __importDefault(require("./routes/suspensoes"));
const marlene_1 = __importDefault(require("./routes/marlene"));
const scan_livro_1 = __importDefault(require("./routes/scan-livro"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const auth_1 = require("./middleware/auth");
const node_cron_1 = __importDefault(require("node-cron"));
const cron_1 = require("./cron");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({ exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit'] }));
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
        await connection_1.pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS recuperacao_codigo TEXT');
        await connection_1.pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS recuperacao_expira_em TIMESTAMP');
        await connection_1.pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS push_token TEXT');
        await connection_1.pool.query('ALTER TABLE livros ADD COLUMN IF NOT EXISTS prateleira TEXT');
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
        await connection_1.pool.query('CREATE INDEX IF NOT EXISTS idx_livros_titulo ON livros (titulo)');
        await connection_1.pool.query('CREATE INDEX IF NOT EXISTS idx_livros_autor ON livros (autor)');
        await connection_1.pool.query('CREATE INDEX IF NOT EXISTS idx_livros_genero ON livros (genero)');
        await connection_1.pool.query('CREATE INDEX IF NOT EXISTS idx_livros_disponiveis ON livros (disponiveis)');
        await connection_1.pool.query('CREATE INDEX IF NOT EXISTS idx_usuarios_perfil ON usuarios (perfil)');
        await connection_1.pool.query('CREATE INDEX IF NOT EXISTS idx_usuarios_turma ON usuarios (turma)');
        await connection_1.pool.query('CREATE INDEX IF NOT EXISTS idx_usuarios_matricula ON usuarios (matricula)');
        await connection_1.pool.query('CREATE INDEX IF NOT EXISTS idx_emprestimos_usuario_id ON emprestimos (usuario_id)');
        await connection_1.pool.query('CREATE INDEX IF NOT EXISTS idx_emprestimos_livro_id ON emprestimos (livro_id)');
        await connection_1.pool.query('CREATE INDEX IF NOT EXISTS idx_emprestimos_status ON emprestimos (status)');
        await connection_1.pool.query('CREATE INDEX IF NOT EXISTS idx_emprestimos_data_devolucao ON emprestimos (data_devolucao)');
        await connection_1.pool.query('CREATE INDEX IF NOT EXISTS idx_emprestimos_data_reserva ON emprestimos (data_reserva)');
        await connection_1.pool.query('CREATE INDEX IF NOT EXISTS idx_emprestimos_retirada_qr_codigo ON emprestimos (retirada_qr_codigo)');
        console.log('[migrations] OK');
    }
    catch (e) {
        console.error('[migrations] Erro:', e);
        throw e;
    }
}
app.get('/health', (_req, res) => { res.json({ ok: true }); });
app.get('/', (_req, res) => { res.json({ status: 'API Biblioteca funcionando!' }); });
app.patch('/emprestimos/retirada-qr-test', (req, res) => {
    res.json({ ok: true, path: req.path, method: req.method });
});
// ── DASHBOARD ──
app.use('/dashboard', auth_1.autenticar, dashboard_1.default);
// ── USUÁRIOS — rotas públicas e protegidas ──
app.use('/usuarios', (req, res, next) => {
    const rotasPublicas = ['/login', '/cadastro', '/recuperar-senha', '/redefinir-senha', '/deletar-conta'];
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
// ── DASHBOARD ADMIN ──
app.use('/dashboard', auth_1.autenticarBibliotecario, dashboard_1.default);
// ── EMPRÉSTIMOS ──
app.use('/emprestimos', auth_1.autenticar, (req, res, next) => {
    console.log('[emprestimos] method:', req.method, 'path:', req.path);
    const rotasBiblio = ['retirada-qr', 'devolver', 'retirar'];
    const ehRotaBiblio = req.method === 'PATCH' && rotasBiblio.some(r => req.path.includes(r));
    if (ehRotaBiblio && !['bibliotecario', 'coordenacao'].includes(req.usuarioAutenticado?.perfil ?? '')) {
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
// ── Rota admin: disparo manual da verificação de prazos ──────────────────────
app.post('/emprestimos/verificar-prazos', auth_1.autenticarBibliotecario, async (_req, res) => {
    await (0, cron_1.verificarPrazosEmprestimos)();
    res.json({ ok: true, mensagem: 'Verificação de prazos executada.' });
});
// ── Lembretes de prazo — roda todo dia às 8h (horário de Brasília) ───────────
node_cron_1.default.schedule('0 8 * * *', cron_1.verificarPrazosEmprestimos, { timezone: 'America/Sao_Paulo' });
// ── Exclusão de conta (Google Play Data Safety) ──────────────────────────────
const EXCLUIR_CONTA_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Excluir Conta — Biblioteca BMSQ</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      background: #fdfaf4;
      color: #1a1208;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border: 1px solid #d9cfbe;
      border-radius: 16px;
      padding: 40px 36px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 4px 24px rgba(26,18,8,0.07);
    }
    .header h1 { font-size: 17px; color: #1a1208; line-height: 1.3; }
    .header p { font-size: 12px; color: #8a7d68; margin-top: 2px; }
    hr { border: none; border-top: 1px solid #d9cfbe; margin: 20px 0; }
    .aviso {
      background: #fff0f0;
      border: 1px solid #e74c3c;
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 13px;
      color: #7a0000;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .aviso strong { color: #c0392b; }
    label { display: block; font-size: 13px; font-weight: bold; color: #1a1208; margin-bottom: 6px; }
    input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #d9cfbe;
      border-radius: 10px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      color: #1a1208;
      background: #fdfaf4;
      outline: none;
      transition: border-color 0.2s;
      margin-bottom: 16px;
    }
    input:focus { border-color: #e74c3c; }
    button {
      width: 100%;
      padding: 12px;
      background: #c0392b;
      color: #fff;
      border: none;
      border-radius: 10px;
      font-family: Arial, sans-serif;
      font-size: 15px;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s;
      margin-top: 4px;
    }
    button:hover { background: #a93226; }
    button:disabled { background: #8a7d68; color: #d9cfbe; cursor: not-allowed; }
    #msg { margin-top: 16px; font-size: 13px; text-align: center; min-height: 20px; }
    .msg-erro { color: #c0392b; }
    .msg-ok { color: #1a7a4a; font-size: 15px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Biblioteca Marlene de Souza Queiroz<br>/ E. E. Cel. José Venâncio de Souza</h1>
      <p>Sistema de Gestão de Acervo</p>
    </div>
    <hr />
    <div id="conteudo">
      <div class="aviso">
        <strong>⚠ Atenção: esta ação é irreversível.</strong><br />
        Ao excluir sua conta, todos os seus dados — incluindo histórico de empréstimos, desejos e avaliações — serão permanentemente removidos e não poderão ser recuperados.
      </div>
      <form id="form">
        <label for="email">E-mail</label>
        <input type="email" id="email" placeholder="seu@email.com" required />
        <label for="senha">Senha</label>
        <input type="password" id="senha" placeholder="Sua senha" required />
        <button type="submit" id="btn">Excluir minha conta definitivamente</button>
      </form>
      <div id="msg"></div>
    </div>
  </div>
  <script>
    const form = document.getElementById('form');
    const btn = document.getElementById('btn');
    const msg = document.getElementById('msg');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'Aguarde...';
      msg.textContent = '';
      msg.className = '';

      const email = document.getElementById('email').value.trim();
      const senha = document.getElementById('senha').value;

      try {
        const res = await fetch('/excluir-conta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, senha }),
        });
        const data = await res.json();

        if (!res.ok) {
          msg.textContent = data.erro || 'Erro ao excluir a conta.';
          msg.className = 'msg-erro';
          btn.disabled = false;
          btn.textContent = 'Excluir minha conta definitivamente';
          return;
        }

        form.style.display = 'none';
        msg.textContent = 'Sua conta foi excluída com sucesso. Todos os seus dados foram removidos permanentemente.';
        msg.className = 'msg-ok';
      } catch {
        msg.textContent = 'Erro de conexão. Tente novamente.';
        msg.className = 'msg-erro';
        btn.disabled = false;
        btn.textContent = 'Excluir minha conta definitivamente';
      }
    });
  </script>
</body>
</html>`;
app.get('/excluir-conta', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(EXCLUIR_CONTA_HTML);
});
app.post('/excluir-conta', async (req, res) => {
    try {
        const { email, senha } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ erro: 'E-mail e senha são obrigatórios' });
        }
        const emailNormalizado = email.toLowerCase().trim();
        const resultado = await connection_1.db.select().from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, emailNormalizado));
        if (resultado.length === 0) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
        }
        const usuario = resultado[0];
        const senhaCorreta = await bcryptjs_1.default.compare(senha, usuario.senha);
        if (!senhaCorreta) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
        }
        await connection_1.pool.query('DELETE FROM suspensoes WHERE usuario_id = $1', [usuario.id]);
        await connection_1.pool.query('DELETE FROM emprestimos WHERE usuario_id = $1', [usuario.id]);
        await connection_1.pool.query('DELETE FROM avaliacoes WHERE usuario_id = $1', [usuario.id]);
        await connection_1.pool.query('DELETE FROM desejos WHERE usuario_id = $1', [usuario.id]);
        await connection_1.db.delete(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.id, usuario.id));
        res.json({ ok: true });
    }
    catch (err) {
        console.error('[excluir-conta] erro:', err);
        res.status(500).json({ erro: 'Erro ao excluir conta' });
    }
});
const PORT = process.env.PORT || 3000;
runMigrations()
    .then(() => {
    app.listen(PORT, () => {
        console.log('Servidor rodando na porta ' + PORT);
    });
    // Pinga o Neon a cada 4 min em horário escolar (seg–sex, 7h–18h, Brasília)
    // para evitar cold start do Neon sem consumir compute fora do horário de uso
    setInterval(() => {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const weekday = now.getDay(); // 0=dom, 6=sab
        const hour = now.getHours();
        if (weekday >= 1 && weekday <= 5 && hour >= 7 && hour < 18) {
            connection_1.pool.query('SELECT 1').catch((e) => console.error('[keepalive]', e.message));
        }
    }, 4 * 60 * 1000);
})
    .catch((err) => {
    console.error('Falha nas migrations — servidor não iniciado:', err);
    process.exit(1);
});
