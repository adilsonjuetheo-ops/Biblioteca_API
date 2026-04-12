"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/marlene.ts
const express_1 = __importDefault(require("express"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const router = express_1.default.Router();
const client = new sdk_1.default({ apiKey: process.env.ANTHROPIC_API_KEY });
router.post('/', async (req, res) => {
    const { system, messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ erro: 'messages é obrigatório' });
    }
    try {
        const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system,
            messages,
        });
        const texto = response.content?.[0]?.type === 'text'
            ? response.content[0].text
            : 'Desculpa, não consegui responder agora.';
        res.json({ resposta: texto });
    }
    catch (err) {
        console.error('Erro Marlene:', err);
        res.status(500).json({ erro: 'Erro ao contatar a IA' });
    }
});
exports.default = router;
