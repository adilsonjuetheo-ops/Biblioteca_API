import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import livrosRouter from './routes/livros';
import emprestimosRouter from './routes/emprestimos';
import usuariosRouter from './routes/usuarios';
import comunicadosRouter from './routes/comunicados';
import avaliacoesRouter from './routes/avaliacoes';
import desejosRouter from './routes/desejos';
import { pool, db } from './db/connection';
import { usuarios } from './db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import suspensoesRouter from './routes/suspensoes';
import marleneRouter from './routes/marlene';
import scanLivroRouter from './routes/scan-livro';
import dashboardRouter from './routes/dashboard';
import { autenticar, autenticarBibliotecario } from './middleware/auth';
import cron from 'node-cron';
import { verificarPrazosEmprestimos } from './cron';

dotenv.config();

const app = express();
app.use(compression());
app.use(cors({ exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

async function runMigrations() {
  try {
    await pool.query(
      'CREATE TABLE IF NOT EXISTS avaliacoes (' +
      'id SERIAL PRIMARY KEY, ' +
      'usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE, ' +
      'livro_id INTEGER REFERENCES livros(id) ON DELETE CASCADE, ' +
      'nota INTEGER, ' +
      'texto TEXT, ' +
      'criado_em TIMESTAMP DEFAULT NOW()' +
      ')'
    );
    await pool.query(
      'CREATE TABLE IF NOT EXISTS desejos (' +
      'id SERIAL PRIMARY KEY, ' +
      'usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE, ' +
      'livro_id INTEGER REFERENCES livros(id) ON DELETE CASCADE, ' +
      'criado_em TIMESTAMP DEFAULT NOW(), ' +
      'UNIQUE (usuario_id, livro_id)' +
      ')'
    );
    await pool.query(
      'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_ate TIMESTAMP'
    );
    await pool.query(
      'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS recuperacao_codigo TEXT'
    );
    await pool.query(
      'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS recuperacao_expira_em TIMESTAMP'
    );
    await pool.query(
      'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS push_token TEXT'
    );
    await pool.query(
      'ALTER TABLE livros ADD COLUMN IF NOT EXISTS prateleira TEXT'
    );
    await pool.query(
      'CREATE TABLE IF NOT EXISTS suspensoes (' +
      'id SERIAL PRIMARY KEY, ' +
      'usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE, ' +
      'emprestimo_id INTEGER REFERENCES emprestimos(id) ON DELETE CASCADE, ' +
      'dias INTEGER NOT NULL, ' +
      'motivo TEXT, ' +
      'expira_em TIMESTAMP NOT NULL, ' +
      'criado_em TIMESTAMP DEFAULT NOW()' +
      ')'
    );
    for (const [col, type] of Object.entries({
      retirada_qr_codigo: 'TEXT',
      retirada_qr_payload: 'TEXT',
      retirada_qr_gerado_em: 'TIMESTAMP',
      retirada_qr_expira_em: 'TIMESTAMP',
      retirada_qr_usado_em: 'TIMESTAMP',
      retirada_qr_invalidado_em: 'TIMESTAMP',
    })) {
      await pool.query('ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS ' + col + ' ' + type);
    }
    await pool.query('CREATE INDEX IF NOT EXISTS idx_livros_titulo ON livros (titulo)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_livros_autor ON livros (autor)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_livros_genero ON livros (genero)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_livros_disponiveis ON livros (disponiveis)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_usuarios_perfil ON usuarios (perfil)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_usuarios_turma ON usuarios (turma)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_usuarios_matricula ON usuarios (matricula)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_emprestimos_usuario_id ON emprestimos (usuario_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_emprestimos_livro_id ON emprestimos (livro_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_emprestimos_status ON emprestimos (status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_emprestimos_data_devolucao ON emprestimos (data_devolucao)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_emprestimos_data_reserva ON emprestimos (data_reserva)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_emprestimos_retirada_qr_codigo ON emprestimos (retirada_qr_codigo)');
    console.log('[migrations] OK');
  } catch (e) {
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
app.use('/dashboard', autenticar, dashboardRouter);

// ── USUÁRIOS — rotas públicas e protegidas ──
app.use('/usuarios', (req: Request, res: Response, next: NextFunction) => {
  const rotasPublicas = ['/login', '/cadastro', '/recuperar-senha', '/redefinir-senha', '/deletar-conta'];
  const ehPublica = rotasPublicas.some(r => req.path.startsWith(r))
    || (req.method === 'POST' && req.path === '/');
  if (ehPublica) return next();
  if (req.method === 'GET' || req.method === 'DELETE') {
    return autenticarBibliotecario(req, res, next);
  }
  next();
}, usuariosRouter);

// ── LIVROS ──
app.use('/livros', autenticar, (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return autenticarBibliotecario(req, res, next);
  }
  next();
}, livrosRouter);

// ── DASHBOARD ADMIN ──
app.use('/dashboard', autenticarBibliotecario, dashboardRouter);

// ── EMPRÉSTIMOS ──
app.use('/emprestimos', autenticar, (req: Request, res: Response, next: NextFunction) => {
  console.log('[emprestimos] method:', req.method, 'path:', req.path);
  const rotasBiblio = ['retirada-qr', 'devolver', 'retirar'];
  const ehRotaBiblio = req.method === 'PATCH' && rotasBiblio.some(r => req.path.includes(r));
  if (ehRotaBiblio && !['bibliotecario', 'coordenacao'].includes(req.usuarioAutenticado?.perfil ?? '')) {
    return res.status(403).json({ erro: 'Acesso restrito ao bibliotecário' });
  }
  next();
}, emprestimosRouter);

// ── COMUNICADOS ──
app.use('/comunicados', autenticar, (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'DELETE'].includes(req.method)) {
    return autenticarBibliotecario(req, res, next);
  }
  next();
}, comunicadosRouter);

// ── AVALIAÇÕES ──
app.use('/avaliacoes', autenticar, avaliacoesRouter);

// ── DESEJOS ──
app.use('/desejos', autenticar, desejosRouter);

// ── SUSPENSÕES ──
app.use('/suspensoes', autenticar, (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/verificar')) return next();
  return autenticarBibliotecario(req, res, next);
}, suspensoesRouter);

// ── IA ──
app.use('/api/marlene', autenticar, marleneRouter);
app.use('/api/scan-livro', autenticarBibliotecario, scanLivroRouter);

// ── Rota admin: disparo manual da verificação de prazos ──────────────────────
app.post('/emprestimos/verificar-prazos', autenticarBibliotecario, async (_req, res) => {
  await verificarPrazosEmprestimos();
  res.json({ ok: true, mensagem: 'Verificação de prazos executada.' });
});

// ── Lembretes de prazo — roda todo dia às 8h (horário de Brasília) ───────────
cron.schedule('0 8 * * *', verificarPrazosEmprestimos, { timezone: 'America/Sao_Paulo' });

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
    const emailNormalizado = (email as string).toLowerCase().trim();
    const resultado = await db.select().from(usuarios).where(eq(usuarios.email, emailNormalizado));
    if (resultado.length === 0) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }
    const usuario = resultado[0];
    const senhaCorreta = await bcrypt.compare(senha as string, usuario.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }
    await pool.query('DELETE FROM suspensoes WHERE usuario_id = $1', [usuario.id]);
    await pool.query('DELETE FROM emprestimos WHERE usuario_id = $1', [usuario.id]);
    await pool.query('DELETE FROM avaliacoes WHERE usuario_id = $1', [usuario.id]);
    await pool.query('DELETE FROM desejos WHERE usuario_id = $1', [usuario.id]);
    await db.delete(usuarios).where(eq(usuarios.id, usuario.id));
    res.json({ ok: true });
  } catch (err) {
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
        pool.query('SELECT 1').catch((e: Error) => console.error('[keepalive]', e.message));
      }
    }, 4 * 60 * 1000);
  })
  .catch((err) => {
    console.error('Falha nas migrations — servidor não iniciado:', err);
    process.exit(1);
  });
