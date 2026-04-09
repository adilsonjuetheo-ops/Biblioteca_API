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

dotenv.config();

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
    for (const [col, type] of Object.entries({ retiradaq_r_codigo: 'TEXT', retiradaq_r_payload: 'TEXT', retiradaq_r_gerado_em: 'TIMESTAMP', retiradaq_r_expira_em: 'TIMESTAMP', retiradaq_r_usado_em: 'TIMESTAMP', retiradaq_r_invalidado_em: 'TIMESTAMP' })) {
      await pool.query('ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS ' + col + ' ' + type);
    }
    console.log('[migrations] OK');
  } catch (e) {
    console.error('[migrations] Erro:', e);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => { res.json({ status: 'API Biblioteca funcionando!' }); });

app.use('/livros', livrosRouter);
app.use('/emprestimos', emprestimosRouter);
app.use('/usuarios', usuariosRouter);
app.use('/comunicados', comunicadosRouter);
app.use('/avaliacoes', avaliacoesRouter);
app.use('/desejos', desejosRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Servidor rodando na porta ' + PORT);
  runMigrations();
});
