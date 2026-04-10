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
      await pool.query('ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS ' + col + ' ' + type);
    }

    console.log('[migrations] OK');
  } catch (e) {
    console.error('[migrations] Erro:', e);
    // BUG CORRIGIDO: em vez de engolir o erro, lançamos para impedir o servidor de subir
    // com banco incompleto
    throw e;
  }
}

app.get('/', (_req, res) => { res.json({ status: 'API Biblioteca funcionando!' }); });

app.use('/livros', livrosRouter);
app.use('/emprestimos', emprestimosRouter);
app.use('/usuarios', usuariosRouter);
app.use('/comunicados', comunicadosRouter);
app.use('/avaliacoes', avaliacoesRouter);
app.use('/desejos', desejosRouter);
app.use('/suspensoes', suspensoesRouter);
app.use('/api/marlene', marleneRouter);
app.use('/api/scan-livro', scanLivroRouter);
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
