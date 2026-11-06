import { useEffect, useState } from 'react';
import axios from 'axios';
import axiosInstance from '../../../api/axiosInstance';
import socketService from '../../../services/socketService';
import { parseLiveResult } from '../live';
import type { LiveResult } from '../live';

export function useLiveValidation(projectId: string, enabled: boolean, diagramKey: string) {
  const [result, setResult] = useState<LiveResult | null>(null);
  const [error, setError] = useState<{ status: 'forbidden' | 'failed'; message: string } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let fetching = false;
    let settled = false;
    let terminalReceived = false;
    let polls = 0;
    const receive = (input: unknown) => {
      try {
        const parsed = parseLiveResult(input, projectId);
        if (controller.signal.aborted || parsed.diagramKey !== diagramKey) return;
        if (terminalReceived && parsed.status === 'loading') return;
        settled = parsed.status !== 'loading';
        terminalReceived = settled;
        setResult(parsed);
        setError(null);
      } catch { /* Ignore malformed or cross-project events. */ }
    };
    const refresh = async () => {
      if (fetching || controller.signal.aborted) return;
      fetching = true;
      try {
        const response = await axiosInstance.get<unknown>(`/projects/${projectId}/validation`, { signal: controller.signal });
        const parsed = parseLiveResult(response.data, projectId);
        if (parsed.diagramKey === diagramKey) receive(parsed);
      } catch (failure) {
        if (controller.signal.aborted) return;
        settled = true;
        const response = axios.isAxiosError<{ error?: string }>(failure) ? failure.response : undefined;
        const forbidden = [401, 403].includes(response?.status ?? 0);
        const detail = response?.data?.error;
        setError({ status: forbidden ? 'forbidden' : 'failed', message: forbidden ? 'No tienes permiso para consultar los avisos de este proyecto.' : typeof detail === 'string' ? detail : 'No se pudo consultar la revisión. Comprueba la conexión y que el diagrama esté guardado.' });
      } finally { fetching = false; }
    };
    const onReconnect = () => { settled = false; polls = 0; void refresh(); };
    socketService.on('validation-result', receive);
    socketService.on('joined-project', onReconnect);
    void refresh();
    const timer = window.setInterval(() => {
      if (settled || fetching) return;
      if (++polls <= 20) void refresh();
      else {
        settled = true;
        setError({ status: 'failed', message: 'No llegó una revisión para este diagrama. Guarda los cambios y vuelve a abrir el panel.' });
      }
    }, 2000);
    return () => {
      controller.abort(); window.clearInterval(timer);
      socketService.off('validation-result', receive);
      socketService.off('joined-project', onReconnect);
    };
  }, [projectId, enabled, diagramKey]);
  const current = enabled && result?.diagramKey === diagramKey ? result : null;
  return { result: current, error: enabled ? error : null };
}
