// script.js - OpenAI version with key test, model selector, Prism highlighting
class CodExpertAI {
    constructor() {
        this.apiKey = localStorage.getItem('openai-api-key') || '';
        this.model = localStorage.getItem('openai-model') || 'gpt-4o-mini';
        this.chatContainer = document.getElementById('chat-container');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.status = document.getElementById('status');
        this.modal = document.getElementById('settings-modal');
        this.settingsBtn = document.getElementById('settings-btn');
        this.clearBtn = document.getElementById('clear-chat');
        this.apiKeyInput = document.getElementById('api-key');
        this.modelSelect = document.getElementById('model-select');
        this.saveBtn = document.getElementById('save-api-key');
        this.closeBtn = document.querySelector('.close');
        this.testResult = document.getElementById('test-result');

        this.initEventListeners();
        this.loadSettings();
        if (!this.apiKey) this.showModal();
        this.userInput.focus();
    }

    initEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
        });
        this.settingsBtn.addEventListener('click', () => this.showModal());
        this.clearBtn.addEventListener('click', () => this.clearChat());
        this.saveBtn.addEventListener('click', () => this.saveApiKey());
        this.closeBtn.addEventListener('click', () => this.hideModal());
        this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.hideModal(); });
    }

    loadSettings() {
        this.apiKeyInput.value = this.apiKey;
        this.modelSelect.value = this.model;
    }

    showModal() { this.modal.style.display = 'block'; this.loadSettings(); }
    hideModal() { this.modal.style.display = 'none'; }

    async saveApiKey() {
        const key = this.apiKeyInput.value.trim();
        if (!key) return this.showError('Enter a valid key bro');

        this.apiKey = key; this.model = this.modelSelect.value;
        localStorage.setItem('openai-api-key', key);
        localStorage.setItem('openai-model', this.model);

        this.saveBtn.disabled = true; this.saveBtn.textContent = 'Testing...';
        try {
            const test = await this.callOpenAI('Say "key works" in one word');
            if (test.toLowerCase().includes('works')) {
                this.showTestResult('Key valid! Let’s code 🔥', 'success');
                this.hideModal();
                this.status.textContent = `Using ${this.model}`;
                setTimeout(() => this.status.textContent = '', 3000);
            }
        } catch (err) {
            this.showError('Invalid key or no credits. Revoke & make new one.');
        } finally {
            this.saveBtn.disabled = false; this.saveBtn.textContent = 'Save & Test Key';
        }
    }

    showTestResult(msg, type) { this.testResult.textContent = msg; this.testResult.className = `test-result ${type}`; }
    showError(msg) { this.testResult.textContent = msg; this.testResult.className = 'test-result error'; }

    clearChat() {
        if (confirm('Delete chat?')) {
            this.chatContainer.innerHTML = `<div class="welcome-message">... (same welcome) ...</div>`;
        }
    }

    async sendMessage() {
        const msg = this.userInput.value.trim();
        if (!msg || !this.apiKey) { if (!this.apiKey) this.showModal(); return; }

        this.addMessage(msg, 'user'); this.userInput.value = '';
        this.sendBtn.disabled = true; this.status.textContent = 'GPT cooking...';

        try {
            const res = await this.callOpenAI(msg);
            this.addMessage(res, 'ai');
        } catch (err) {
            this.addMessage(`Error: ${err.message}. Revoke that leaked key NOW.`, 'ai');
        } finally {
            this.sendBtn.disabled = false; this.userInput.focus();
        }
    }

    addMessage(text, sender) {
        const div = document.createElement('div'); div.className = `message ${sender}-message`;
        const avatar = document.createElement('div'); avatar.className = `avatar ${sender}-avatar`; avatar.textContent = sender === 'user' ? '👤' : '🤖';
        const content = document.createElement('div'); content.className = sender === 'ai' ? 'ai-message' : 'user-message';
        content.innerHTML = this.format(text);
        div.append(avatar, content);
        this.chatContainer.appendChild(div);
        if (sender === 'ai') Prism.highlightAllUnder(content);
        this.scrollToBottom();
    }

    format(text) {
        return text
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    async callOpenAI(message) {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: `You are CodExpert AI — a savage coding mentor. Master of C++, Python, HTML, Batch, algorithms, debugging, everything. Be direct, funny, give perfect code in blocks, explain like I'm 5 but respect my intelligence. Roast bad code. Use GPT-4o power.` },
                    { role: 'user', content: message }
                ],
                max_tokens: 3000,
                temperature: 0.7
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || 'API dead');
        }

        const data = await res.json();
        return data.choices[0].message.content;
    }

    scrollToBottom() { this.chatContainer.scrollTop = this.chatContainer.scrollHeight; }
}

document.addEventListener('DOMContentLoaded', () => new CodExpertAI());
