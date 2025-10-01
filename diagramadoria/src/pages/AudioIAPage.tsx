import React, { useMemo, useState, useRef, useEffect } from "react";
import { Typography, Paper, Tabs, Tab, IconButton, Input } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import { suggestActionsFromText, type ActionSuggestion } from "../ai/openaiClient";

interface AudioRecorderProps {
  onTranscript: (text: string) => void;
}

function AudioRecorder({ onTranscript }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const recordTimerRef = useRef<number | null>(null);
  const MAX_RECORDING_MS = 7000; // 7 segundos

  useEffect(() => {
    return () => {
      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop());
      }
      if (recordTimerRef.current) {
        clearTimeout(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, [audioStream]);

  const handleVoiceInput = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioStream(stream);

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
          alert("El reconocimiento de voz no está disponible en este navegador.");
          return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = "es-ES";
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let finalText = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
              finalText += res[0].transcript;
            }
          }
          if (finalText) {
            setInputValue((prev) => (prev ? prev + " " : "") + finalText.trim());
          }
        };

        recognition.start();
        setIsRecording(true);

        if (recordTimerRef.current) {
          clearTimeout(recordTimerRef.current);
        }
        recordTimerRef.current = window.setTimeout(() => {
          try { recognition.stop(); } catch {}
          setIsRecording(false);
          if (audioStream) {
            audioStream.getTracks().forEach((track) => track.stop());
            setAudioStream(null);
          }
          if (inputValue.trim()) {
            onTranscript(inputValue);
            setInputValue("");
          }
        }, MAX_RECORDING_MS);
      } catch (error) {
        console.error("Error accessing microphone:", error);
        alert("No se pudo acceder al micrófono. Verifica los permisos del navegador.");
      }
    } else {
      if (recordTimerRef.current) {
        clearTimeout(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop());
        setAudioStream(null);
      }
      setIsRecording(false);
      if (inputValue.trim()) {
        onTranscript(inputValue);
        setInputValue("");
      }
    }
  };

  return (
    <Paper className="ai-card" elevation={3}>
      <div className="ai-head">
        <Typography variant="subtitle1">Entrada por voz</Typography>
        <IconButton
          color={isRecording ? "error" : "primary"}
          size="small"
          aria-label={isRecording ? "Detener grabación" : "Iniciar grabación"}
          onClick={handleVoiceInput}
        >
          {isRecording ? <StopCircleIcon /> : <MicIcon />}
        </IconButton>
      </div>
      <div className="ai-voice">
        <Typography variant="body2" color={isRecording ? "error" : "textSecondary"}>
          {isRecording ? "Grabando... (haz clic para detener)" : "Haz clic en el micrófono para empezar"}
        </Typography>
        {isRecording && (
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Escribe o habla aquí..."
            fullWidth
          />
        )}
      </div>
    </Paper>
  );
}

const AudioIAPage: React.FC = () => {
  const [aiResults, setAiResults] = useState<ActionSuggestion[]>([]);
  const [isCallingAI, setIsCallingAI] = useState(false);
  const [manualPrompt, setManualPrompt] = useState("");
  const [tab, setTab] = useState<'voz' | 'texto'>("voz");
  const aiResultPretty = useMemo(() => JSON.stringify(aiResults, null, 2), [aiResults]);

  const applySuggestion = (s: ActionSuggestion | undefined) => {
    if (!s) return;
    const evt = new CustomEvent<ActionSuggestion>('diagram-ai-action', { detail: s });
    window.dispatchEvent(evt);
  };

  const applyAll = async (list: ActionSuggestion[]) => {
    for (const s of list) {
      applySuggestion(s);
      // ligera pausa para que el diagrama procese eventos secuenciales
      await new Promise(r => setTimeout(r, 60));
    }
  };

  return (
    <div className="ai-panel" style={{ padding: '20px', backgroundColor: '#1e1e2f', borderRadius: '10px', color: '#fff' }}>
      <div className="ai-panel__top" style={{ marginBottom: '20px', textAlign: 'center' }}>
        <Typography variant="h4" style={{ fontWeight: 'bold', color: '#00d1b2' }}>Asistente IA</Typography>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          TabIndicatorProps={{ style: { backgroundColor: '#00d1b2' } }}
          style={{ marginTop: '10px' }}
        >
          <Tab label="Voz" value="voz" style={{ color: '#fff', fontWeight: 'bold' }} />
          <Tab label="Texto" value="texto" style={{ color: '#fff', fontWeight: 'bold' }} />
        </Tabs>
      </div>
      {tab === 'voz' && (
        <div style={{ textAlign: 'center' }}>
          <AudioRecorder
            onTranscript={async (t) => {
              setIsCallingAI(true);
              const suggestions = await suggestActionsFromText(t);
              setAiResults(suggestions);
              setIsCallingAI(false);
            }}
          />
          {isCallingAI && <Typography style={{ color: '#00d1b2', marginTop: '10px' }}>Procesando...</Typography>}
        </div>
      )}
      {tab === 'texto' && (
        <div style={{ textAlign: 'center' }}>
          <textarea
            value={manualPrompt}
            onChange={(e) => setManualPrompt(e.target.value)}
            placeholder="Escribe tu consulta aquí..."
            style={{ width: '100%', height: '100px', borderRadius: '5px', padding: '10px', marginBottom: '10px' }}
          />
          <button
            onClick={async () => {
              setIsCallingAI(true);
              const suggestions = await suggestActionsFromText(manualPrompt);
              setAiResults(suggestions);
              setIsCallingAI(false);
            }}
            style={{ backgroundColor: '#00d1b2', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Generar sugerencia
          </button>
          {isCallingAI && <Typography style={{ color: '#00d1b2', marginTop: '10px' }}>Procesando...</Typography>}
        </div>
      )}
      <div style={{ marginTop: '20px', backgroundColor: '#2e2e3f', padding: '10px', borderRadius: '5px' }}>
        <Typography variant="h6" style={{ color: '#00d1b2' }}>Resultados:</Typography>
        <pre style={{ color: '#fff', overflowX: 'auto' }}>{aiResultPretty}</pre>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={() => applySuggestion(aiResults[0])}
            disabled={aiResults.length === 0 || aiResults[0]?.type === 'noop'}
            style={{ backgroundColor: '#1abc9c', color: '#fff', padding: '8px 12px', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            Aplicar 1º resultado
          </button>
          <button
            onClick={() => applyAll(aiResults)}
            disabled={aiResults.length === 0}
            style={{ backgroundColor: '#10b981', color: '#fff', padding: '8px 12px', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            Aplicar todos
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioIAPage;