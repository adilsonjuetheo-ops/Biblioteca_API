import { Router } from 'express';
import { db } from '../db/connection';
import { pool } from '../db/connection';
import { emprestimos, livros, usuarios, avaliacoes, desejos, comunicados } from '../db/schema';
import { eq } from 'drizzle-orm';
import { calcularStatus } from './emprestimos';
import { dashboardCache } from '../cache';

const router = Router();

// GET /dashboard — carrega todos os dados do app em uma única chamada
router.get('/', async (req, res) => {
  try {
    const uid = req.usuarioAutenticado?.id;
    const perfil = req.usuarioAutenticado?.perfil;
    const isBiblio = !!perfil && !['aluno', 'professor'].includes(perfil);

    const cacheKey = `dash:${uid}:${isBiblio ? 'b' : 'u'}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached) return res.json(cached);

    const [
      todosEmprestimos,
      todosLivros,
      todasAvaliacoes,
      todosDesejos,
      todosUsuarios,
      todosComunicados,
      suspensoeResult,
    ] = await Promise.all([
      db.select({
        id: emprestimos.id,
        usuarioId: emprestimos.usuarioId,
        livroId: emprestimos.livroId,
        status: emprestimos.status,
        dataReserva: emprestimos.dataReserva,
        dataDevolucao: emprestimos.dataDevolucao,
        renovado: emprestimos.renovado,
        livroTitulo: livros.titulo,
        livroAutor: livros.autor,
        livroGenero: livros.genero,
        livroCapa: livros.capa,
        usuarioNome: usuarios.nome,
        usuarioTurma: usuarios.turma,
        usuarioMatricula: usuarios.matricula,
      })
        .from(emprestimos)
        .leftJoin(livros, eq(emprestimos.livroId, livros.id))
        .leftJoin(usuarios, eq(emprestimos.usuarioId, usuarios.id)),

      db.select().from(livros),

      db.select().from(avaliacoes),

      uid
        ? db.select().from(desejos).where(eq(desejos.usuarioId, Number(uid)))
        : Promise.resolve([]),

      isBiblio
        ? db.select({
            id: usuarios.id,
            nome: usuarios.nome,
            email: usuarios.email,
            matricula: usuarios.matricula,
            turma: usuarios.turma,
            perfil: usuarios.perfil,
          }).from(usuarios)
        : Promise.resolve([]),

      db.select().from(comunicados).orderBy(comunicados.criadoEm),

      pool.query(`
        SELECT s.*, u.nome as usuario_nome, u.email as usuario_email,
               u.turma as usuario_turma, e.livro_id,
               l.titulo as livro_titulo
        FROM suspensoes s
        LEFT JOIN usuarios u ON s.usuario_id = u.id
        LEFT JOIN emprestimos e ON s.emprestimo_id = e.id
        LEFT JOIN livros l ON e.livro_id = l.id
        WHERE s.expira_em > NOW()
        ORDER BY s.criado_em DESC
      `),
    ]);

    const resultado = {
      livros: todosLivros,
      emprestimos: todosEmprestimos.map(e => ({ ...e, status: calcularStatus(e as any) })),
      avaliacoes: todasAvaliacoes,
      desejos: todosDesejos,
      usuarios: todosUsuarios,
      comunicados: [...todosComunicados].reverse(),
      suspensoes: suspensoeResult.rows,
    };
    dashboardCache.set(cacheKey, resultado);
    res.json(resultado);
  } catch (err) {
    console.error('[dashboard]', err);
    res.status(500).json({ erro: 'Erro ao carregar dashboard' });
  }
});

// GET /dashboard/resumo — estatísticas para o painel admin
router.get('/resumo', async (_req, res) => {
  try {
    const cached = dashboardCache.get('resumo');
    if (cached) return res.json(cached);

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

    const resultado = {
      resumo: {
        totalLivros: totalLivros.rows[0]?.total || 0,
        livrosDisponiveis: livrosDisponiveis.rows[0]?.total || 0,
        emprestimosAtivos: emprestimosAtivos.rows[0]?.total || 0,
        emprestimosAtrasados: emprestimosAtrasados.rows[0]?.total || 0,
        emprestimosDevolvidos: emprestimosDevolvidos.rows[0]?.total || 0,
      },
      ultimosEmprestimos: ultimosEmprestimos.rows,
      livrosMaisEmprestados: livrosMaisEmprestados.rows,
    };
    dashboardCache.set('resumo', resultado);
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao carregar resumo do dashboard' });
  }
});

export default router;
