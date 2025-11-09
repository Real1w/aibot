class CodExpertAI {
    constructor() {
        this.apiKey = localStorage.getItem('openai-key') || '';
        this.model = localStorage.getItem('openai-model') || 'gpt-4o-mini';
        this.userName = localStorage.getItem('user-name') || 'dev';
        this.convos = JSON.parse(localStorage.getItem('convos') || '[]');
        this.currentConvoId = null;
        this.abortController = null;

        // Elements
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

        // Events
        this.sendBtn.onclick = () => this.send();
        this.stopBtn.onclick = () => this.stop();
        this.userInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.send();
            }
        });
        this.userInput.addEventListener('input', () => this.autoResize());
        document.getElementById('new-chat').onclick = () => this.newConvo();
        document.getElementById('settings-btn').onclick = () => this.openModal();
        document.querySelector('.close').onclick = () => this.modal.classList.add('hidden');
        this.saveKeyBtn.onclick = () => this.saveKey();
        this.modelSelect.onchange = () => {
            this.model = this.modelSelect.value;
            localStorage.setItem('openai-model', this.model);
            this.status.textContent = `Switched to ${this.model}`;
            setTimeout(() => this.status.textContent = 'Ready bro', 2000);
            this.status.textContent = `Model switched to ${this.model}`;
            setTimeout(() => this.status.textContent = 'Ready to build', 2200);
        };
        document.getElementById('mobile-toggle').onclick = () => {
            document.querySelector('.sidebar').classList.toggle('open');
        };

        this.autoResize();

        // AUTO OPEN MODAL IF NO KEY
        if (!this.apiKey) {
            this.openModal();
        }
    }

    autoResize() {
        this.userInput.style.height = 'auto';
        this.userInput.style.height = this.userInput.scrollHeight + 'px';
    }

    async send() {
        let msg = this.userInput.value.trim();
        if (!msg || !this.apiKey) {
            if (!this.apiKey) this.openModal();
        const msg = this.userInput.value.trim();
        if (!msg) return;

        if (!this.apiKey) {
            this.openModal();
            this.status.textContent = 'Add your OpenAI key to continue';
            setTimeout(() => this.status.textContent = 'Ready to build', 2200);
            return;
        }

        // Name command
        if (msg.startsWith('/name ')) {
            this.userName = msg.slice(6).trim() || 'dev';
            localStorage.setItem('user-name', this.userName);
            this.userNameSpan.textContent = this.userName;
            this.userInput.value = '';
            this.autoResize();
            this.status.textContent = `Name set to ${this.userName} 🔥`;
            setTimeout(() => this.status.textContent = 'Ready bro', 2000);
            this.status.textContent = `Name updated to ${this.userName}`;
            setTimeout(() => this.status.textContent = 'Ready to build', 2200);
            return;
        }

        this.addMessage(msg, 'user');
        this.userInput.value = '';
        this.autoResize();
        this.sendBtn.classList.add('hidden');
        this.stopBtn.classList.remove('hidden');
        this.status.textContent = 'GPT cooking...';
        this.status.textContent = 'Crafting a response…';

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
            if (err.name !== 'AbortError') {
                this.addMessage(`Error: ${err.message}. Key leaked? Revoke it NOW.`, 'ai');
                this.addMessage(`Something went wrong: ${err.message}. Double-check your API key and try again.`, 'ai');
            }
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
        this.status.textContent = 'Ready to build';
    }

    addMessage(content, sender, streaming = false) {
        const msg = { id: Date.now(), content, sender, streaming };
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        msg.el = div;

        const actions = sender === 'ai'
            ? '<div class="message-actions"><button class="regen"><i class="fas fa-sync"></i></button><button class="copy"><i class="fas fa-copy"></i></button></div>'
            : '<div class="message-actions"><button class="copy"><i class="fas fa-copy"></i></button></div>';

        div.innerHTML = `<div class="content">${this.format(content)}</div>${actions}`;
        this.chatContainer.appendChild(div);
        this.scroll();
        this.addCopyButtons(div);
        this.addRegenButton(div);
        return msg;
    }

    renderMessage(msg) {
        msg.el.querySelector('.content').innerHTML = this.format(msg.content);
        this.addCopyButtons(msg.el);
        this.addRegenButton(msg.el);
        this.scroll();
        Prism.highlightAllUnder(msg.el);
    }

    format(text) {
        return text
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code><button class="copy-btn">Copy</button></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
        if (!text) return '';
        const withBlocks = text.replace(/```([\w+-]*)?\n([\s\S]*?)```/g, (_, lang = '', code = '') => {
            const safeLang = lang ? lang.toLowerCase() : 'plaintext';
            return `<pre><code class="language-${safeLang}">${this.escapeHtml(code)}</code><button class="copy-btn">Copy</button></pre>`;
        });

        return withBlocks
            .replace(/`([^`]+)`/g, (_, code) => `<code>${this.escapeHtml(code)}</code>`)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    addCopyButtons(container) {
        container.querySelectorAll('.copy-btn, .message-actions .copy').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                let text = '';
                if (btn.classList.contains('copy-btn')) {
                    text = btn.parentElement.querySelector('code').textContent;
                } else {
                    const content = btn.closest('.message').querySelector('.content');
                    text = content.textContent;
                }
                navigator.clipboard.writeText(text);
                this.showToast('Copied!');
                this.showToast('Copied to clipboard');
            };
        });
    }

    addRegenButton(container) {
        container.querySelectorAll('.regen').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const msgEl = btn.closest('.message');
                const prevUserMsg = msgEl.previousElementSibling?.querySelector('.content')?.textContent || '';
                if (prevUserMsg) {
                    msgEl.remove();
                    const convo = this.getCurrentConvo();
                    convo.messages.pop(); // remove last assistant
                    this.userInput.value = prevUserMsg;
                    this.send();
                }
            };
        });
    }

    showToast(msg) {
        this.toast.textContent = msg;
        this.toast.classList.remove('hidden');
        setTimeout(() => this.toast.classList.add('hidden'), 2000);
    }

    scroll() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    async callOpenAI(messages, signal) {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: `You are CodExpert AI — savage coding mentor. Master of C++, C#, Python, Lua, Batch. Direct, funny, perfect code blocks, roast bad code. Use ${this.model} power.` },
                    { role: 'system', content: `You are CodExpert AI — an expert engineering mentor. Offer calm, encouraging guidance, structure thinking, and produce high-quality code snippets when they are helpful. Keep answers focused, actionable, and tailored to the user's stack. Model in use: ${this.model}.` },
                    ...messages
                ],
                stream: true,
                temperature: 0.7,
                max_tokens: 3000
            }),
            signal
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || 'API dead bro');
            throw new Error(err.error?.message || 'Service unavailable right now');
        }

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
                            try {
                                const json = JSON.parse(line.slice(6));
                                yield json.choices[0]?.delta?.content || '';
                            } catch (_) { }
                        }
                    }
                }
            }
        };
    }

    newConvo() {
@@ -307,86 +325,87 @@ class CodExpertAI {
        const convo = this.getCurrentConvo();
        if ((convo.title && convo.title !== 'New Chat') || convo.messages.length < 2) return;
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: `Short 3-6 word title for this coding chat: ${convo.messages.slice(0, 4).map(m => m.content.substring(0, 100)).join(' ')}` }],
                    max_tokens: 10
                })
            });
            if (res.ok) {
                const data = await res.json();
                convo.title = data.choices[0].message.content.replace(/"/g, '').trim();
                this.renderConvos();
                this.saveConvos();
            }
        } catch (_) { }
    }

    addWelcome() {
        this.chatContainer.innerHTML = `
            <div class="message ai">
                <div class="content">
                    Yo <b>${this.userName}</b>! I'm CodExpert AI running on <b>${this.model}</b>.<br>
                    Drop any code, bug, or question — C++, C#, Python, Lua, Batch, whatever.<br>
                    Let's build something dope 🔥
                    Welcome back, <b>${this.userName}</b>! I'm CodExpert AI running on <b>${this.model}</b>.<br>
                    Paste tricky snippets, outline product ideas, or describe bugs — I’ll help you debug, refactor, and ship faster.<br>
                    Tip: type <code>/name YourName</code> any time to personalise the experience.
                </div>
            </div>`;
    }

    openModal() {
        this.modal.classList.remove('hidden');
        this.apiKeyInput.value = this.apiKey;
        this.apiKeyInput.focus();
    }

    async saveKey() {
        const key = this.apiKeyInput.value.trim();
        if (!key) return;

        this.saveKeyBtn.disabled = true;
        this.saveKeyBtn.textContent = 'Testing...';
        this.saveKeyBtn.textContent = 'Testing…';
        this.testResult.className = 'test-result';
        this.testResult.textContent = '';

        try {
            const test = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: 'Say "key works" in one word' }],
                    max_tokens: 5
                })
            });

            if (test.ok) {
                const json = await test.json();
                if (json.choices[0].message.content.toLowerCase().includes('works')) {
                    this.apiKey = key;
                    localStorage.setItem('openai-key', key);
                    this.testResult.className = 'test-result success';
                    this.testResult.textContent = 'Key valid! Let’s code 🔥';
                    this.testResult.textContent = 'Key verified — let’s build!';
                    setTimeout(() => this.modal.classList.add('hidden'), 1500);
                    this.status.textContent = `Using ${this.model}`;
                    this.status.textContent = `Model ready: ${this.model}`;
                    setTimeout(() => this.status.textContent = 'Ready to build', 2200);
                }
            } else {
                throw new Error();
            }
        } catch (err) {
            this.testResult.className = 'test-result error';
            this.testResult.textContent = 'Invalid key or no credits. Revoke & make new one.';
            this.testResult.textContent = 'Invalid key or missing credits. Generate a new key and try again.';
        } finally {
            this.saveKeyBtn.disabled = false;
            this.saveKeyBtn.textContent = 'Save & Test Key';
        }
    }

    saveConvos() {
        localStorage.setItem('convos', JSON.stringify(this.convos));
    }
}

document.addEventListener('DOMContentLoaded', () => new CodExpertAI());
