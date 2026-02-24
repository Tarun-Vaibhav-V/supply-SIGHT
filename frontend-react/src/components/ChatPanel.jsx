import { useState, useRef, useEffect } from 'react';
import api from '../api/axios';
import '../styles/chatpanel.css';

export default function ChatPanel() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMsg = { role: 'user', content: text };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        // Build history for the API
        const history = messages
            .reduce((acc, msg, i, arr) => {
                if (msg.role === 'user') {
                    const next = arr[i + 1];
                    acc.push({
                        user: msg.content,
                        assistant: next?.role === 'assistant' ? next.content : '',
                    });
                }
                return acc;
            }, []);

        try {
            const res = await api.post('/chat', { message: text, history });
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: res.data.response },
            ]);
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: `⚠️ ${err.response?.data?.detail || 'Failed to get response. Make sure you are logged in.'}`,
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Simple markdown-like rendering
    const renderContent = (text) => {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n- /g, '\n• ')
            .replace(/\n/g, '<br/>');
    };

    return (
        <>
            <button className="chat-fab" onClick={() => setOpen(!open)} title="Ask SupplySight AI">
                {open ? '✕' : '🤖'}
            </button>

            {open && (
                <div className="chat-drawer">
                    {/* Header */}
                    <div className="chat-header">
                        <div className="chat-header-left">
                            <div className="chat-header-icon">⚡</div>
                            <div>
                                <div className="chat-header-title">SupplySight AI</div>
                                <div className="chat-header-status">● Online</div>
                            </div>
                        </div>
                        <button className="chat-close" onClick={() => setOpen(false)}>✕</button>
                    </div>

                    {/* Messages */}
                    <div className="chat-messages">
                        {messages.length === 0 && (
                            <div className="chat-welcome">
                                <span className="chat-welcome-icon">🤖</span>
                                <div className="chat-welcome-title">SupplySight AI</div>
                                <div>Ask me anything about your supply chain — inventory levels, shipment status, risk alerts, supplier reliability, and more.</div>
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`chat-msg ${msg.role}`}
                                dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                            />
                        ))}
                        {loading && (
                            <div className="chat-typing">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        )}
                        <div ref={endRef} />
                    </div>

                    {/* Input */}
                    <div className="chat-input-area">
                        <textarea
                            className="chat-input"
                            rows={1}
                            placeholder="Ask about your supply chain..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <button className="chat-send" onClick={sendMessage} disabled={loading || !input.trim()}>
                            ➤
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
