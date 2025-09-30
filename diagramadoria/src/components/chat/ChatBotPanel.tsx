import React, { useMemo, useRef, useState } from 'react';
import { suggestActionFromText } from '../../ai/openaiClient';
import buildManualGuide, { buildManualGuideForAiAction } from '../../utils/assistantGuides';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const hasOpenAI = !!import.meta.env.VITE_OPENAI_API_KEY;

// buildManualGuide removed in favor of shared util

// Removed verbose AI explanation to return a single, preciso manual.

const ChatBotPanel: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([{
        role: 'assistant',
        content: 'Hola, soy tu asistente. Dame una instrucción y te responderé de forma precisa sólo con los pasos necesarios. Ej: "¿Cómo crear una clase?"'
    }]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);
    const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

    const handleSend = async () => {
        if (!canSend) return;
        const userText = input.trim();
        setInput('');
        setSending(true);
        setMessages(prev => [...prev, { role: 'user', content: userText }]);
        try {
            let aiJson: any | null = null;
            if (hasOpenAI) {
                aiJson = await suggestActionFromText(userText);
            }
            const precise = hasOpenAI
                ? buildManualGuideForAiAction(aiJson, userText)
                : buildManualGuide(userText);
            setMessages(prev => [...prev, { role: 'assistant', content: precise }]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Ocurrió un error al procesar tu consulta.' }]);
        } finally {
            setSending(false);
            setTimeout(scrollToBottom, 50);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '500px',
            maxHeight: '500px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '0 0 10px 10px',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                color: 'white',
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: '500'
            }}>
                💡 Pregúntame sobre diagramas UML
            </div>

            {/* Messages area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.3) transparent'
            }}>
                {messages.map((m, idx) => (
                    <div key={idx} style={{
                        display: 'flex',
                        justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-start'
                    }}>
                        {m.role === 'assistant' && (
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: '8px',
                                flexShrink: 0,
                                fontSize: '16px'
                            }}>🤖</div>
                        )}
                        <div style={{
                            maxWidth: m.role === 'user' ? '80%' : '85%',
                            minWidth: '120px',
                            whiteSpace: 'pre-wrap',
                            wordWrap: 'break-word',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            background: m.role === 'user'
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : 'rgba(255, 255, 255, 0.95)',
                            color: m.role === 'user' ? 'white' : '#1f2937',
                            padding: '12px 16px',
                            borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                            fontSize: '14px',
                            lineHeight: '1.5'
                        }}>
                            {m.content}
                        </div>
                        {m.role === 'user' && (
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'linear-gradient(45deg, #ff9a9e 0%, #fecfef 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginLeft: '8px',
                                flexShrink: 0,
                                fontSize: '16px'
                            }}>👤</div>
                        )}
                    </div>
                ))}
                {sending && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: '8px'
                        }}>🤖</div>
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.9)',
                            padding: '12px 16px',
                            borderRadius: '18px 18px 18px 4px',
                            color: '#6b7280',
                            fontSize: '14px',
                            fontStyle: 'italic'
                        }}>
                            Pensando...
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div style={{
                display: 'flex',
                gap: '8px',
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderTop: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Pregunta sobre diagramas UML..."
                    style={{
                        flex: 1,
                        padding: '12px 16px',
                        borderRadius: '25px',
                        border: 'none',
                        outline: 'none',
                        background: 'rgba(255, 255, 255, 0.9)',
                        color: '#1f2937',
                        fontSize: '14px',
                        boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}
                />
                <button
                    onClick={handleSend}
                    disabled={!canSend}
                    style={{
                        padding: '12px 20px',
                        borderRadius: '25px',
                        border: 'none',
                        background: canSend
                            ? 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)'
                            : 'rgba(255, 255, 255, 0.3)',
                        color: 'white',
                        cursor: canSend ? 'pointer' : 'not-allowed',
                        fontSize: '14px',
                        fontWeight: '600',
                        boxShadow: canSend ? '0 2px 8px rgba(102, 126, 234, 0.3)' : 'none',
                        transition: 'all 0.2s ease'
                    }}
                >
                    {sending ? '⏳' : '📤'}
                </button>
            </div>

            {/* Warning message */}
            {!hasOpenAI && (
                <div style={{
                    margin: '8px 12px 12px 12px',
                    color: '#d97706',
                    background: 'rgba(253, 230, 138, 0.9)',
                    border: '1px solid #f59e0b',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    textAlign: 'center'
                }}>
                    ⚠️ IA desactivada. Define VITE_OPENAI_API_KEY para habilitarla.
                </div>
            )}
        </div>
    );
};

export default ChatBotPanel;
