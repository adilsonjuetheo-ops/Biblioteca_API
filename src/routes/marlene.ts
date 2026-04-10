import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ mensagem: 'Rota da Marlene ativa' });
});

export default router;
