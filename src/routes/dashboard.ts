import { Router } from 'express';
import { pool } from '../db/connection';

const router = Router();

router.get('/resumo', async (_req, res) => {
  try {
    const [
      totalLivros,
      livrosDisponiveis,
      emprestimosAtivos,
      emprestimosAtrasados,
      emprestimosDevolvidos,
      ultimosEmprestimos,
      livrosMaisEmprestados,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM livros'),
      pool.query('SELECT COUNT(*)::int AS total FROM livros WHERE COALESCE(disponiveis, 0) > 0'),
      pool.query("SELECT COUNT(*)::int AS total FROM emprestimos WHERE status IN ('reservado', 'retirado')"),
      pool.query("SELECT COUNT(*)::int AS total FROM emprestimos WHERE status = 'retirado' AND data_devolucao < NOW()"),
      pool.query("SELECT COUNT(*)::int AS total FROM emprestimos WHERE status = 'devolvido'"),
      pool.query(`
        SELECT
          e.id,
          CASE
            WHEN e.status = 'devolvido' THEN 'devolvido'
            WHEN e.status = 'retirado' AND e.data_devolucao < NOW() THEN 'atrasado'
            ELSE e.status
          END AS status,
          e.data_reserva,
          e.data_retirada,
          e.data_devolucao,
          l.titulo AS "livroTitulo",
          l.autor AS "livroAutor",
          u.nome AS "usuarioNome"
        FROM emprestimos e
        LEFT JOIN livros l ON l.id = e.livro_id
        LEFT JOIN usuarios u ON u.id = e.usuario_id
        ORDER BY COALESCE(e.data_retirada, e.data_reserva, e.criado_em) DESC, e.id DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT
          l.id,
          l.titulo,
          COUNT(e.id)::int AS total
        FROM emprestimos e
        INNER JOIN livros l ON l.id = e.livro_id
        GROUP BY l.id, l.titulo
        ORDER BY total DESC, l.titulo ASC
        LIMIT 5
      `),
    ]);

    res.json({
      resumo: {
        totalLivros: totalLivros.rows[0]?.total || 0,
        livrosDisponiveis: livrosDisponiveis.rows[0]?.total || 0,
        emprestimosAtivos: emprestimosAtivos.rows[0]?.total || 0,
        emprestimosAtrasados: emprestimosAtrasados.rows[0]?.total || 0,
        emprestimosDevolvidos: emprestimosDevolvidos.rows[0]?.total || 0,
      },
      ultimosEmprestimos: ultimosEmprestimos.rows,
      livrosMaisEmprestados: livrosMaisEmprestados.rows,
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao carregar resumo do dashboard' });
  }
});

export default router;
