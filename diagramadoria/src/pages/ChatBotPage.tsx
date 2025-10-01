import React, { useMemo, useRef, useState } from 'react';
import Navbar from '../components/navbar/Navbar';
import { suggestActionFromText } from '../ai/openaiClient';
import buildManualGuide, { buildManualGuideForAiAction } from '../utils/assistantGuides';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const hasOpenAI = !!import.meta.env.VITE_OPENAI_API_KEY;

// Removed verbose AI explanation to return a single, preciso manual.

const ChatBotPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content:
      'Hola, soy tu asistente. Dame una instrucción y te responderé de forma precisa sólo con los pasos necesarios.\nEjemplo: "¿Cómo crear una clase?"'
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
      // Regla especial: responder cómo ejecutar el backend en localhost
      const normalize = (s: string) => s
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const q = normalize(userText);
      const mentionsBackend = q.includes('backend') || q.includes('back end');
      const mentionsLocal = q.includes('localhost') || q.includes('local host') || q.includes('local');
      const mentionsRun = q.includes('funcionar') || q.includes('iniciar') || q.includes('levantar')
        || q.includes('arrancar') || q.includes('ejecutar') || q.includes('correr') || q.includes('run');
      if (mentionsBackend && mentionsLocal && mentionsRun) {
        const fixedAnswer = 'Debes abrir el backend en visual studio code, esperar almenos 1 minuto para cargar el backend y luego ingresar el siguiente comando: mvn clean spring-boot:run';
        setMessages(prev => [...prev, { role: 'assistant', content: fixedAnswer }]);
        return;
      }

      let aiJson: any | null = null;
      if (hasOpenAI) {
        aiJson = await suggestActionFromText(userText);
      }
      const precise = hasOpenAI
        ? buildManualGuideForAiAction(aiJson, userText)
        : buildManualGuide(userText);
      setMessages(prev => [...prev, { role: 'assistant', content: precise }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Ocurrió un error al procesar tu consulta.' }]);
    } finally {
      setSending(false);
      setTimeout(scrollToBottom, 50);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f7f7f9' }}>
      <Navbar />
      <div style={{ flex: 1, padding: '88px 16px 16px 16px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <h2 style={{ margin: '0 0 8px 0' }}>🧠 Chat Bot</h2>
        <p style={{ color: '#555', marginTop: 0 }}>
          Pregunta en español y te doy dos respuestas: pasos manuales y cómo usar la IA para lograrlo.
        </p>

        <div style={{
          border: '1px solid #ddd',
          borderRadius: 8,
          background: '#fff',
          padding: 12,
          height: '60vh',
          overflowY: 'auto'
        }}>
          {messages.map((m, idx) => (
            <div key={idx} style={{
              display: 'flex',
              marginBottom: 10,
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                maxWidth: '85%',
                whiteSpace: 'pre-wrap',
                background: m.role === 'user' ? '#d6f4ff' : '#f1f3f5',
                color: '#222',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #e3e3e3'
              }}>
                {m.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Escribe tu pregunta..."
            style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc' }}
          />
          <button onClick={handleSend} disabled={!canSend} style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: 'none',
            background: canSend ? '#2563eb' : '#9bb9f0',
            color: 'white',
            cursor: canSend ? 'pointer' : 'not-allowed'
          }}>
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>

        {!hasOpenAI && (
          <div style={{ marginTop: 8, color: '#8a6d3b', background: '#fff3cd', border: '1px solid #faebcc', padding: '8px 12px', borderRadius: 6 }}>
            Nota: Las funciones de IA están desactivadas. Define VITE_OPENAI_API_KEY en tu entorno para habilitarlas.
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatBotPage;
