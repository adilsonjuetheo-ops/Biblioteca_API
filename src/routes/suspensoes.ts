import { Router, Request, Response } from 'express';
import { pool } from '../db/connection';

const router = Router();

// Listar suspensões ativas
router.get('/', async (req: Request, res: Response) => {
  try {
    const { usuarioId } = req.query;
    let query = `
      SELECT s.*, u.nome as usuario_nome, u.email as usuario_email,
             u.turma as usuario_turma, e.livro_id,
             l.titulo as livro_titulo
      FROM suspensoes s
      LEFT JOIN usuarios u ON s.usuario_id = u.id
      LEFT JOIN emprestimos e ON s.emprestimo_id = e.id
      LEFT JOIN livros l ON e.livro_id = l.id
      WHERE s.expira_em > NOW()
    `;
    const params: any[] = [];
    if (usuarioId) {
      query += ` AND s.usuario_id = $1`;
      params.push(Number(usuarioId));
    }
    query += ` ORDER BY s.criado_em DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar suspensões' });
  }
});

// Verificar se usuário está bloqueado
router.get('/verificar/:usuarioId', async (req: Request, res: Response) => {
  try {
    const { usuarioId } = req.params;
    const result = await pool.query(
      `SELECT s.*, l.titulo as livro_titulo
       FROM suspensoes s
       LEFT JOIN emprestimos e ON s.emprestimo_id = e.id
       LEFT JOIN livros l ON e.livro_id = l.id
       WHERE s.usuario_id = $1 AND s.expira_em > NOW()
       ORDER BY s.expira_em DESC LIMIT 1`,
      [Number(usuarioId)]
    );
    if (result.rows.length === 0) {
      return res.json({ bloqueado: false });
    }
    const suspensao = result.rows[0];
    res.json({
      bloqueado: true,
      expiraEm: suspensao.expira_em,
      motivo: suspensao.motivo,
      livroTitulo: suspensao.livro_titulo,
      dias: suspensao.dias,
    });
  } catch {
    res.status(500).json({ erro: 'Erro ao verificar suspensão' });
  }
});

// Aplicar suspensão (bibliotecário)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { usuarioId, emprestimoId, dias, motivo } = req.body;
    if (!usuarioId || !dias) {
      return res.status(400).json({ erro: 'usuarioId e dias são obrigatórios' });
    }
    if (dias < 1 || dias > 30) {
      return res.status(400).json({ erro: 'Dias deve ser entre 1 e 30' });
    }

    const expiraEm = new Date();
    expiraEm.setDate(expiraEm.getDate() + Number(dias));

    // Registrar suspensão
    const result = await pool.query(
      `INSERT INTO suspensoes (usuario_id, emprestimo_id, dias, motivo, expira_em)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [usuarioId, emprestimoId || null, dias, motivo || 'Devolução em atraso', expiraEm]
    );

    // Atualizar campo bloqueado_ate no usuário
    await pool.query(
      `UPDATE usuarios SET bloqueado_ate = $1 WHERE id = $2`,
      [expiraEm, usuarioId]
    );

    // Criar aviso automático para o aluno
    await pool.query(
      `INSERT INTO comunicados (titulo, mensagem, destinatario, autor, criado_em)
       VALUES ($1, $2, 'alunos', 'Sistema', NOW())`,
      [
        '⚠️ Conta bloqueada',
        `Sua conta foi bloqueada por ${dias} dia(s) devido a: ${motivo || 'devolução em atraso'}. Você poderá realizar novos empréstimos após ${expiraEm.toLocaleDateString('pt-BR')}.`,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ erro: 'Erro ao aplicar suspensão' });
  }
});

// Remover suspensão manualmente
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await pool.query(`DELETE FROM suspensoes WHERE id = $1`, [Number(req.params.id)]);
    res.json({ mensagem: 'Suspensão removida com sucesso' });
  } catch {
    res.status(500).json({ erro: 'Erro ao remover suspensão' });
  }
});

export default router;
