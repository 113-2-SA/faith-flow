const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(__dirname, '..', '.magisterium.tokens.json');
const MCP_URL = process.env.MAGISTERIUM_MCP_URL || 'https://mcp.magisterium.com';

class MagisteriumService {
    getToken() {
        if (!fs.existsSync(TOKEN_FILE)) {
            throw new Error('Magisterium token 不存在，請執行: node scripts/magisterium-auth.js');
        }

        const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = tokenData.obtained_at + (tokenData.expires_in || 3600);
        
        if (now >= expiresAt) {
            throw new Error('Token 已過期，請重新執行: node scripts/magisterium-auth.js');
        }

        return tokenData.access_token;
    }

    async chat(userMessage, firebaseToken) {
        try {
            const mcpToken = this.getToken();

            const response = await fetch(`${MCP_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${mcpToken}`,
                    'X-Firebase-Token': firebaseToken,
                },
                body: JSON.stringify({
                    message: userMessage,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Magisterium API 錯誤 ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            return {
                knowledge_answer: data.knowledge_answer || '',
                companion_response: data.companion_response || '',
                citations: data.citations || [],
            };
        } catch (error) {
            console.error('Magisterium Service Error:', error);
            throw error;
        }
    }

    generateTitle(firstMessage) {
        const title = firstMessage.slice(0, 20);
        return title.length < firstMessage.length ? `${title}...` : title;
    }
}

module.exports = new MagisteriumService();