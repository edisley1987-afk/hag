const express = require('express');
const axios = require('axios');
const app = express();

// Configurações
const TARGET = 'https://hag-9ki9.onrender.com/atualizar';
const AUTH_TOKEN = 'Basic MTE4NTgyOjExODU4Mg=='; // O seu token de autenticação
const PORT = 3000; // Usando 3000 para evitar problemas de permissão do Windows

app.use(express.json({ limit: '20mb' }));

app.post('/atualizar', async (req, res) => {
    console.log('[LOG] Recebido dado do Gateway. Repassando...');
    
    try {
        const resp = await axios.post(TARGET, req.body, { 
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': AUTH_TOKEN
            }, 
            timeout: 10000 
        });
        
        console.log('[SUCESSO] Repassado ao Render.');
        res.status(200).json({ status: 'forwarded' });
    } catch (err) {
        console.error('[ERRO] Falha ao enviar para o Render:', err.message);
        res.status(502).json({ error: 'Erro na ponte', detail: err.message });
    }
});

app.get('/', (req, res) => res.send('Ponte Proxy HAG Online'));

app.listen(PORT, () => console.log(`Ponte Proxy iniciada na porta ${PORT}`));
