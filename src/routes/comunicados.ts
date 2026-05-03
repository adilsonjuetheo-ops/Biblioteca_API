import { Router } from 'express';
import { db } from '../db/connection';
import { comunicados, usuarios } from '../db/schema';
import { eq, isNotNull } from 'drizzle-orm';

async function enviarPushComunicado(titulo: string, mensagem: string) {
  try {
    const comToken = await db.select({ pushToken: usuarios.pushToken })
      .from(usuarios)
      .where(isNotNull(usuarios.pushToken));

    if (!comToken.length) return;

    const mensagens = comToken.map(u => ({
      to: u.pushToken,
      title: titulo,
      body: mensagem,
      sound: 'default',
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(mensagens),
    });
  } catch (err) {
    console.error('[push] erro ao enviar notificações:', err);
  }
}

const router = Router();

router.get('/', async (req, res) => {
  try {
    const todos = await db.select().from(comunicados)
      .orderBy(comunicados.criadoEm);
    res.json(todos.reverse());
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar comunicados' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { titulo, mensagem, autor, destinatario } = req.body;
    if (!titulo || !mensagem) {
      return res.status(400).json({ erro: 'Título e mensagem são obrigatórios' });
    }
    const novo = await db.insert(comunicados).values({
      titulo, mensagem, autor, destinatario: destinatario || 'todos',
    }).returning();
    enviarPushComunicado(titulo, mensagem);
    res.status(201).json(novo[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar comunicado' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.delete(comunicados)
      .where(eq(comunicados.id, Number(req.params.id)));
    res.json({ mensagem: 'Comunicado removido' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover comunicado' });
  }
});

export default router;