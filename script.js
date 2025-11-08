class CodExpertAI {
    constructor() {
        this.apiKey = localStorage.getItem('openai-key') || '';
        this.model = localStorage.getItem('openai-model') || 'gpt-4o-mini';
        this.userName = localStorage.getItem('user-name') || 'dev';
        this.convos = JSON.parse(localStorage.getItem('convos') || '[]');
        this.currentConvoId = null;
        this.abortController = null;

        this.chatContainer = document.getElementById('chat-container');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.status = document.getElementById('status');
        this.convoList = document.getElementById('convo-list');
        this.modelSelect = document.getElementById('model-select');
        this.modal = document.getElementById('settings-modal');
        this.apiKeyInput = document.getElementById('api-key');
        this.saveKeyBtn = document.getElementById('save-api-key');
        this.testResult = document.getElementById('test-result');
        this.userNameSpan = document.getElementById('user-name');
        this.toast = document.getElementById('toast');

        this.init();
    }

    init() {
        this.userNameSpan.textContent = this.userName;
        this.modelSelect.value = this.model;
        this.renderConvos();
        this.loadConvo(this.convos.length ? this.convos[this.convos.length - 1].id : null);
        this.addWelcome();

        this.sendBtn.onclick = () => this.send();
        this.stopBtn.onclick = () => this.stop();
        this.userInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
        });
        this.userInput.addEventListener('input', () => this.autoResize());
        document.getElementById('new-chat').onclick = () => this.newConvo();
        document.getElementById('settings-btn').onclick = () => this.openModal();
        document.querySelector('.close').onclick = () => this.modal.classList.add('hidden');
        this.saveKeyBtn.onclick = () => this.saveKey();
        this.modelSelect.onchange = () => {
            this.model = this.modelSelect.value;
            localStorage.setItem('openai-model', this.model);
        };
        document.getElementById('mobile-toggle').onclick = () => document.querySelector('.sidebar').classList.toggle('open');

        if (!this.apiKey) this.openModal();
        this.autoResize();
    }

    autoResize() {
        this.userInput.style.height = 'auto';
        this.userInput.style.height = this.userInput.scrollHeight + 'px';
    }

    async send() {
        let msg = this.userInput.value.trim();
        if (!msg || !this.apiKey) return;

        if (msg.startsWith('/name ')) {
            this.userName = msg.slice(6).trim() || 'dev';
            localStorage.setItem('user-name', this.userName);
            this.userNameSpan.textContent = this.userName;
            this.userInput.value = '';
            this.autoResize();
            return;
        }

        this.addMessage(msg, 'user');
        this.userInput.value = '';
        this.autoResize();
        this.sendBtn.classList.add('hidden');
        this.stopBtn.classList.remove('hidden');
        this.status.textContent = 'Cooking...';

        if (!this.currentConvoId) this.newConvo();
        const convo = this.getCurrentConvo();
        convo.messages.push({ role: 'user', content: msg });

        this.abortController = new AbortController();
        try {
            const stream = await this.callOpenAI(convo.messages, this.abortController.signal);
            const aiMsg = this.addMessage('', 'ai', true);
            for await (const chunk of stream) {
                aiMsg.content += chunk;
                this.renderMessage(aiMsg);
                Prism.highlightAllUnder(aiMsg.el);
            }
            convo.messages.push({ role: 'assistant', content: aiMsg.content });
            this.autoTitleConvo();
        } catch (err) {
            if (err.name !== 'AbortError') this.addMessage(`Error: ${err.message}`, 'ai');
        } finally {
            this.stop();
            this.saveConvos();
        }
    }

    stop() {
        if (this.abortController) this.abortController.abort();
        this.sendBtn.classList.remove('hidden');
        this.stopBtn.classList.add('hidden');
        this.status.textContent = 'Ready bro';
    }

    addMessage(content, sender, streaming = false) {
        const msg = { id: Date.now(), content, sender, streaming };
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        msg.el = div;
        const actions = `<div class="message-actions">
            ${sender === 'ai' ? '<button class="regen"><i class="fas fa-sync"></i></button>' : ''}
            <button class="copy"><i class="fas fa-copy"></i></button>
        </div>`;
        div.innerHTML = `<div class="content">${this.format(content)}</div>${actions}`;
        this.chatContainer.appendChild(div);
        this.scroll();
        this.addCopyButtons(div);
        this.getCurrentConvo().messages.push({ role: sender === 'user' ? 'user' : 'assistant', content });
        return msg;
    }

    renderMessage(msg) {
        msg.el.querySelector('.content').innerHTML = this.format(msg.content);
        this.addCopyButtons(msg.el);
        this.scroll();
    }

    format(text) {
        return text
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code><button class="copy-btn">Copy</button></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    addCopyButtons(container) {
        container.querySelectorAll('.copy-btn, .message-actions .copy').forEach(btn => {
            btn.onclick = () => {
                const code = btn.closest('pre') ? btn.parentElement.querySelector('code').textContent : container.querySelector('.content').textContent;
                navigator.clipboard.writeText(code);
                this.showToast('Copied!');
            };
        });
        container.querySelectorAll('.regen').forEach(btn => {
            btn.onclick = () => {
            };
        });
    }

    showToast(msg) {
        this.toast.textContent = msg;
        this.toast.classList.remove('hidden');
        setTimeout(() => this.toast.classList.add('hidden'), 2000);
    }

    scroll() { this.chatContainer.scrollTop = this.chatContainer.scrollHeight; }

    async callOpenAI(messages, signal) {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: `You are CodExpert AI — savage coding mentor. C++, C#, Python, Lua, Batch god. Direct, funny, perfect code blocks, roast trash code. Use ${this.model} power.` },
                    ...messages
                ],
                stream: true,
                temperature: 0.7
            }),
            signal
        });

        if (!res.ok) throw new Error((await res.json()).error?.message || 'API dead');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        return {
            [Symbol.asyncIterator]: async function* () {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) return;
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                            const json = JSON.parse(line.slice(6));
                            yield json.choices[0]?.delta?.content || '';
                        }
                    }
                }
            }
        };
    }

    newConvo() {
        const id = Date.now();
        this.convos.push({ id, title: 'New Chat', messages: [] });
        this.saveConvos();
        this.loadConvo(id);
        this.renderConvos();
        this.chatContainer.innerHTML = '';
        this.addWelcome();
    }

    loadConvo(id) {
        this.currentConvoId = id;
        const convo = this.getCurrentConvo();
        this.chatContainer.innerHTML = '';
        if (convo) {
            convo.messages.forEach(m => this.addMessage(m.content, m.role === 'user' ? 'user' : 'ai'));
        } else {
            this.addWelcome();
        }
        this.renderConvos();
        this.scroll();
    }

    getCurrentConvo() {
        return this.convos.find(c => c.id === this.currentConvoId);
    }

    renderConvos() {
        this.convoList.innerHTML = '';
        this.convos.forEach(c => {
            const div = document.createElement('div');
            div.className = `convo-item ${c.id === this.currentConvoId ? 'active' : ''}`;
            div.innerHTML = `<span>${c.title}</span><button class="delete"><i class="fas fa-trash"></i></button>`;
            div.onclick = (e) => {
                if (!e.target.closest('.delete')) this.loadConvo(c.id);
            };
            div.querySelector('.delete').onclick = () => {
                if (confirm('Delete this chat?')) {
                    this.convos = this.convos.filter(x => x.id !== c.id);
                    this.saveConvos();
                    this.renderConvos();
                    if (c.id === this.currentConvoId) this.newConvo();
                }
            };
            this.convoList.appendChild(div);
        });
    }

    async autoTitleConvo() {
        const convo = this.getCurrentConvo();
        if (convo.title !== 'New Chat' || convo.messages.length < 2) return;
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: `Give a short 3-5 word title for this coding chat: ${convo.messages.slice(0, 5).map(m => m.content).join(' ')}` }],
                    max_tokens: 10
                })
            });
            const data = await res.json();
            convo.title = data.choices[0].message.content.replace(/"/g, '');
            this.renderConvos();
            this.saveConvos();
        } catch (_) { }
    }

    addWelcome() {
        this.chatContainer.innerHTML = `<div class="message ai"><div class="content">Yo <b>${this.userName}</b>! I'm CodExpert AI on ${this.model}. Drop code, bugs, whatever – C++, C#, Py, Lua, Batch. Let's build dope shit 🔥</div></div>`;
    }

    openModal() {
        this.modal.classList.remove('hidden');
        this.apiKeyInput.value = this.apiKey;
    }

    async saveKey() {
        const key = this.apiKeyInput.value.trim();
        if (!key) return;
        this.saveKeyBtn.disabled = true;
        this.saveKeyBtn.textContent = 'Testing...';
        try {
            const test = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Say "key works" in one word' }], max_tokens: 5 })
            });
            if (test.ok) {
                const json = await test.json();
                if (json.choices[0].message.content.toLowerCase().includes('works')) {
                    this.apiKey = key;
                    localStorage.setItem('openai-key', key);
                    this.testResult.className = 'test-result success';
                    this.testResult.textContent = 'Key valid AF 🔥';
                    setTimeout(() => this.modal.classList.add('hidden'), 1500);
                }
            } else throw new Error();
        } catch {
            this.testResult.className = 'test-result error';
            this.testResult.textContent = 'Invalid key or no credits bro';
        } finally {
            this.saveKeyBtn.disabled = false;
            this.saveKeyBtn.textContent = 'Save & Test Key';
        }
    }

    saveConvos() {
        localStorage.setItem('convos', JSON.stringify(this.convos));
    }
}

new CodExpertAI();
