import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import livrosRouter from './routes/livros';
import emprestimosRouter from './routes/emprestimos';
import usuariosRouter from './routes/usuarios';
import comunicadosRouter from './routes/comunicados';
import avaliacoesRouter from './routes/avaliacoes';
import desejosRouter from './routes/desejos';
import { pool } from './db/connection';
import suspensoesRouter from './routes/suspensoes';
import marleneRouter from './routes/marlene';
import scanLivroRouter from './routes/scan-livro';
import dashboardRouter from './routes/dashboard';
import { autenticar, autenticarBibliotecario } from './middleware/auth';

dotenv.config();

const app = express();
app.use(cors());
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

app.get('/', (_req, res) => { res.json({ status: 'API Biblioteca funcionando!' }); });
app.patch('/emprestimos/retirada-qr-test', (req, res) => {
  res.json({ ok: true, path: req.path, method: req.method });
});

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
