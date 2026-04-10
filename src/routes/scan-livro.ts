// routes/scan-livro.ts
import express, { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { pool } from '../db/connection';

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/scan-livro/analisar — recebe imagem base64 e retorna dados do livro
router.post('/analisar', async (req: Request, res: Response) => {
  const { imagemBase64, mediaType } = req.body;

  if (!imagemBase64) {
    return res.status(400).json({ erro: 'imagemBase64 é obrigatório' });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: imagemBase64,
              },
            },
            {
              type: 'text',
              text: `Analise a capa deste livro e extraia as informações disponíveis.
Responda APENAS com um JSON válido, sem texto adicional, sem markdown, sem explicações.
Formato exato:
{
  "titulo": "título do livro",
  "autor": "nome do autor ou null",
  "genero": "gênero literário ou null",
  "sinopse": "breve sinopse se visível na capa ou null",
  "totalExemplares": 1
}
Se não conseguir identificar o título, retorne {"erro": "Não foi possível identificar o livro"}.`,
            },
          ],
        },
      ],
    });

    const texto = response.content?.[0]?.type === 'text'
      ? response.content[0].text.trim()
      : null;

    if (!texto) {
      return res.status(500).json({ erro: 'Sem resposta da IA' });
    }

    // Remove possíveis backticks de markdown
    const jsonLimpo = texto.replace(/```json|```/g, '').trim();
    const dados = JSON.parse(jsonLimpo);

    if (dados.erro) {
      return res.status(422).json({ erro: dados.erro });
    }

    res.json(dados);
  } catch (err: any) {
    console.error('Erro scan-livro analisar:', err);
    res.status(500).json({ erro: 'Erro ao analisar imagem' });
  }
});

// POST /api/scan-livro/cadastrar — salva o livro no banco
router.post('/cadastrar', async (req: Request, res: Response) => {
  const { titulo, autor, genero, sinopse, capa, totalExemplares } = req.body;

  if (!titulo?.trim()) {
    return res.status(400).json({ erro: 'Título é obrigatório' });
  }

  try {
    const total = Number(totalExemplares) || 1;
    const result = await pool.query(
      `INSERT INTO livros (titulo, autor, genero, sinopse, capa, total_exemplares, disponiveis)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING *`,
      [
        titulo.trim(),
        autor?.trim() || null,
        genero?.trim() || null,
        sinopse?.trim() || null,
        capa?.trim() || null,
        total,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Erro scan-livro cadastrar:', err);
    res.status(500).json({ erro: 'Erro ao cadastrar livro' });
  }
});

export default router;