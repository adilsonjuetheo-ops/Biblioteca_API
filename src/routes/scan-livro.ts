// routes/scan-livro.ts
import express, { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { pool } from '../db/connection';
 
const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 
// Busca URL da capa na Open Library pelo título e autor
async function buscarCapaOpenLibrary(titulo: string, autor?: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${titulo}${autor ? ' ' + autor : ''}`);
    const url = `https://openlibrary.org/search.json?q=${query}&limit=1&fields=cover_i,isbn`;
    const res = await fetch(url);
    const data = await res.json() as any;
 
    const doc = data?.docs?.[0];
    if (!doc) return null;
 
    // Tenta pela cover_id primeiro
    if (doc.cover_i) {
      return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    }
 
    // Tenta pelo ISBN se tiver
    const isbn = doc.isbn?.[0];
    if (isbn) {
      return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
    }
 
    return null;
  } catch (err) {
    console.error('[scan] Erro ao buscar capa Open Library:', err);
    return null;
  }
}
 
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
                media_type: (mediaType as any) || 'image/jpeg',
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
 
    let dados: any;
    try {
      dados = JSON.parse(jsonLimpo);
    } catch {
      return res.status(500).json({ erro: 'IA retornou formato inválido' });
    }
 
    if (dados.erro) {
      return res.status(422).json({ erro: dados.erro });
    }
 
    // Busca capa na Open Library automaticamente
    console.log('[scan] Buscando capa para:', dados.titulo, dados.autor);
    const capaUrl = await buscarCapaOpenLibrary(dados.titulo, dados.autor);
    console.log('[scan] Capa encontrada:', capaUrl);
 
    res.json({ ...dados, capa: capaUrl || null });
  } catch (err: any) {
    console.error('[scan] Erro analisar:', err?.message || err);
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