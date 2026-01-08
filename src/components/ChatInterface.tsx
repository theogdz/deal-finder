'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ConversationState {
    itemType: string | null;
    zipcode: string | null;
    radius: number | null;
    maxPrice: number | null;
    email: string | null;
    preferences: Record<string, unknown> | null;
    needsConfirmation: boolean;
    isComplete: boolean;
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [state, setState] = useState<ConversationState | null>(null);
    const [alertCreated, setAlertCreated] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Start conversation on mount
    useEffect(() => {
        startConversation();
    }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const startConversation = async () => {
        try {
            const res = await fetch('/api/chat');
            const data = await res.json();
            setConversationId(data.conversationId);
            setMessages([{ role: 'assistant', content: data.message }]);
            setState(data.state);
        } catch (error) {
            console.error('Failed to start conversation:', error);
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId, message: userMessage }),
            });

            const data = await res.json();

            if (data.message) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
            }

            if (data.state) {
                setState(data.state);
            }

            if (data.searchId) {
                setAlertCreated(true);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Sorry, I'm having trouble. Please try again."
            }]);
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (cents: number) => `$${(cents / 100).toLocaleString()}`;

    return (
        <div className="chat-container">
            <div className="chat-main">
                <div className="chat-messages">
                    {messages.map((msg, i) => (
                        <div key={i} className={`chat-message ${msg.role}`}>
                            <div className="chat-bubble">
                                {msg.content}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="chat-message assistant">
                            <div className="chat-bubble">
                                <span className="typing-indicator">
                                    <span></span><span></span><span></span>
                                </span>
                            </div>
                        </div>
                    )}

                    {alertCreated && (
                        <div className="alert-success-banner">
                            <span className="success-icon">✓</span>
                            <div>
                                <strong>Alert created!</strong>
                                <p>We&apos;ll email you when we find matching deals.</p>
                            </div>
                            <a href="/dashboard" className="view-dashboard-link">View dashboard →</a>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={sendMessage} className="chat-input-form">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={alertCreated ? "Start a new search..." : "Type your message..."}
                        disabled={loading}
                        className="chat-input"
                    />
                    <button type="submit" disabled={loading || !input.trim()} className="chat-send-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                        </svg>
                    </button>
                </form>
            </div>

            {/* Sidebar showing extracted preferences */}
            <div className="chat-sidebar">
                <h3 className="sidebar-title">Your Alert</h3>

                <div className="preference-list">
                    <div className="preference-item">
                        <span className="preference-label">Looking for</span>
                        <span className={`preference-value ${state?.itemType ? '' : 'empty'}`}>
                            {state?.itemType || 'Not specified yet'}
                        </span>
                    </div>

                    <div className="preference-item">
                        <span className="preference-label">Location</span>
                        <span className={`preference-value ${state?.zipcode ? '' : 'empty'}`}>
                            {state?.zipcode ? `${state.zipcode} (${state.radius || 25} mi)` : 'Not specified yet'}
                        </span>
                    </div>

                    <div className="preference-item">
                        <span className="preference-label">Budget</span>
                        <span className={`preference-value ${state?.maxPrice ? '' : 'empty'}`}>
                            {state?.maxPrice ? formatPrice(state.maxPrice) : 'No limit'}
                        </span>
                    </div>

                    <div className="preference-item">
                        <span className="preference-label">Email</span>
                        <span className={`preference-value ${state?.email ? '' : 'empty'}`}>
                            {state?.email || 'Not provided yet'}
                        </span>
                    </div>
                </div>

                {state?.needsConfirmation && !alertCreated && (
                    <div className="confirmation-prompt">
                        <p>Ready to create this alert?</p>
                        <p className="confirmation-hint">Just say &quot;yes&quot; or &quot;create it&quot; to confirm</p>
                    </div>
                )}
            </div>
        </div>
    );
}
