import React, { useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { Typography, IconButton, Paper } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopCircleIcon from "@mui/icons-material/StopCircle";

interface AudioRecorderProps {
  onTranscript: (text: string) => void;
}

function AudioRecorder({ onTranscript }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const { transcript, resetTranscript } = useSpeechRecognition();

  const startRecording = () => {
    setIsRecording(true);
    resetTranscript();
  SpeechRecognition.startListening({ continuous: true, language: "es-ES" });
  };

  const stopRecording = () => {
    setIsRecording(false);
    SpeechRecognition.stopListening();
    if (transcript) {
      onTranscript(transcript);
      resetTranscript();
    }
  };

  return (
    <Paper elevation={3} style={{ margin: "20px 0", padding: 24 }}>
      <Typography variant="h6">Entrada por voz</Typography>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <IconButton
          color={isRecording ? "error" : "primary"}
          size="large"
          aria-label={isRecording ? "Detener grabación" : "Iniciar grabación"}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? <StopCircleIcon fontSize="large" /> : <MicIcon fontSize="large" />}
        </IconButton>
        <Typography variant="body2" color={isRecording ? "error" : "textSecondary"}>
          {isRecording ? "Grabando... (haz clic para detener)" : "Haz clic para empezar a grabar"}
        </Typography>
      </div>
      <div style={{ marginTop: "10px", minHeight: "40px", padding: "10px", background: "#eee", borderRadius: "8px" }}>
        <Typography variant="subtitle1" gutterBottom>
          {transcript || (isRecording ? "Hablando..." : "Transcripción de audio aquí")}
        </Typography>
      </div>
    </Paper>
  );
}

const AudioIAPage: React.FC = () => {
  const [lastTranscript, setLastTranscript] = useState("");

  return (
    <div style={{ maxWidth: 600, margin: "40px auto" }}>
      <Typography variant="h4" gutterBottom>
        Audio IA - Transcripción por voz
      </Typography>
      <AudioRecorder onTranscript={setLastTranscript} />
      {lastTranscript && (
        <Paper elevation={2} style={{ marginTop: 24, padding: 16 }}>
          <Typography variant="subtitle1" color="primary">
            Última transcripción:
          </Typography>
          <Typography variant="body1">{lastTranscript}</Typography>
        </Paper>
      )}
    </div>
  );
};

export default AudioIAPage;