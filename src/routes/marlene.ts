// routes/marlene.ts
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY });

router.post('/', async (req, res) => {
  const { system, messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ erro: 'messages é obrigatório' });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system,
      messages,
    });

    const texto = response.content?.[0]?.type === 'text'
      ? response.content[0].text
      : 'Desculpa, não consegui responder agora.';

    res.json({ resposta: texto });
  } catch (err: any) {
    console.error('Erro Marlene:', err);
    res.status(500).json({ erro: 'Erro ao contatar a IA' });
  }
});

export default router;