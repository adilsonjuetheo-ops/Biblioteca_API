import express from 'express';
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
    console.log('[migrations] OK');
  } catch (e) {
    console.error('[migrations] Erro:', e);
    throw e;
  }
}

app.get('/', (_req, res) => { res.json({ status: 'API Biblioteca funcionando!' }); });

// ── ROTAS PÚBLICAS ──
app.use('/usuarios', usuariosRouter);

// ── LIVROS ──
// GET /livros → todos autenticados
// POST, PATCH, DELETE /livros → só bibliotecário
app.get('/livros', autenticar, (req, res, next) => livrosRouter(req, res, next));
app.post('/livros', autenticarBibliotecario, (req, res, next) => livrosRouter(req, res, next));
app.patch('/livros/:id', autenticarBibliotecario, (req, res, next) => livrosRouter(req, res, next));
app.delete('/livros/:id', autenticarBibliotecario, (req, res, next) => livrosRouter(req, res, next));

// ── EMPRÉSTIMOS ──
// GET /emprestimos → todos autenticados
// POST /emprestimos → aluno/professor (fazer reserva)
// PATCH devolver/retirar/retirada-qr → só bibliotecário
// POST qr-retirada → aluno (gerar QR)
// PATCH renovar → aluno
app.get('/emprestimos', autenticar, (req, res, next) => emprestimosRouter(req, res, next));
app.post('/emprestimos', autenticar, (req, res, next) => emprestimosRouter(req, res, next));
app.patch('/emprestimos/retirada-qr', autenticarBibliotecario, (req, res, next) => emprestimosRouter(req, res, next));
app.patch('/emprestimos/:id/devolver', autenticarBibliotecario, (req, res, next) => emprestimosRouter(req, res, next));
app.patch('/emprestimos/:id/retirar', autenticarBibliotecario, (req, res, next) => emprestimosRouter(req, res, next));
app.patch('/emprestimos/:id/renovar', autenticar, (req, res, next) => emprestimosRouter(req, res, next));
app.post('/emprestimos/:id/qr-retirada', autenticar, (req, res, next) => emprestimosRouter(req, res, next));

// ── USUÁRIOS (rotas autenticadas) ──
// GET /usuarios → só bibliotecário
app.get('/usuarios', autenticarBibliotecario, (req, res, next) => usuariosRouter(req, res, next));
app.delete('/usuarios/:id', autenticarBibliotecario, (req, res, next) => usuariosRouter(req, res, next));

// ── COMUNICADOS ──
// GET → todos autenticados
// POST → só bibliotecário
app.get('/comunicados', autenticar, (req, res, next) => comunicadosRouter(req, res, next));
app.post('/comunicados', autenticarBibliotecario, (req, res, next) => comunicadosRouter(req, res, next));
app.delete('/comunicados/:id', autenticarBibliotecario, (req, res, next) => comunicadosRouter(req, res, next));

// ── AVALIAÇÕES ──
// GET → todos autenticados
// POST → aluno/professor
app.use('/avaliacoes', autenticar, avaliacoesRouter);

// ── DESEJOS ──
// todos autenticados (aluno gerencia os próprios)
app.use('/desejos', autenticar, desejosRouter);

// ── SUSPENSÕES ──
// GET verificar → todos autenticados
// POST/DELETE → só bibliotecário
app.get('/suspensoes/verificar/:id', autenticar, (req, res, next) => suspensoesRouter(req, res, next));
app.get('/suspensoes', autenticarBibliotecario, (req, res, next) => suspensoesRouter(req, res, next));
app.post('/suspensoes', autenticarBibliotecario, (req, res, next) => suspensoesRouter(req, res, next));
app.delete('/suspensoes/:id', autenticarBibliotecario, (req, res, next) => suspensoesRouter(req, res, next));

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