import io from 'socket.io-client';

type DiagramUpdate = {
  projectId: number;
  userId: number;
  diagramData: any;
  changeType?: string;
  elementId?: string | number;
  timestamp?: string;
};

type CursorPosition = {
  projectId: number;
  userId: number;
  userName?: string;
  x: number;
  y: number;
  timestamp?: string;
};

type UserInfo = { id: number; name: string; email?: string };
type ElementSelect = { projectId: number; elementId: number | string; elementType?: string };

type EventHandler = (...args: any[]) => void;

class SocketService {
  private socket: ReturnType<typeof io> | null = null;
  private currentProjectId: number | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  connect(token?: string, url?: string) {
    if (this.socket?.connected) return;
    
  // Prefer explicit URL param, then env vars, and finally production backend as fallback
  const envUrl = (import.meta.env as any).VITE_BACKEND_URL || (import.meta.env as any).VITE_API_BASE_URL;
  // Ensure we connect to the ORIGIN (strip trailing /api if provided)
  const normalizedEnv = typeof envUrl === 'string' ? envUrl.replace(/\/?api\/?$/i, '') : undefined;

  // Nota para desarrollo local:
  // - Puedes crear un archivo .env en diagramadoria con: VITE_BACKEND_URL=http://localhost:3000
  // - O puedes forzar la URL local al llamar: socketService.connect(token, 'http://localhost:3000')
  // - Si prefieres, descomenta la siguiente línea para usar localhost como fallback en dev:
   const endpoint = url || normalizedEnv || 'http://localhost:3000';

  //const endpoint = url || normalizedEnv || 'https://diagamaia.onrender.com';
    console.log('Conectando a Socket.IO en:', endpoint);
    
    this.socket = io(endpoint, { 
      auth: { token },
      transports: ['websocket', 'polling'],
      forceNew: true,
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay
    });

    this.socket.on('connect', () => {
      console.log('Socket conectado:', this.socket?.id);
      this.reconnectAttempts = 0;
      
      // Rejoin project if we were in one
      if (this.currentProjectId) {
        console.log('Rejoining project:', this.currentProjectId);
        this.joinProject(this.currentProjectId);
      }
    });

    this.socket.on('connect_error', (err: any) => {
      console.error('Socket connect_error:', err);
      this.reconnectAttempts++;
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Socket desconectado:', reason);
    });

    this.socket.on('error', (error: string) => {
      console.error('Socket error:', error);
    });

    this.socket.on('joined-project', (projectId: number) => {
      console.log('Successfully joined project:', projectId);
      this.currentProjectId = projectId;
    });

    this.socket.on('user-joined', (data: any) => {
      console.log('User joined project:', data);
    });

    this.socket.on('user-left', (data: any) => {
      console.log('User left project:', data);
    });
  }

  disconnect() {
    if (!this.socket) return;
    try { 
      console.log('Desconectando socket...');
      this.socket.disconnect(); 
    } catch {}
    this.socket = null;
    this.currentProjectId = null;
    this.reconnectAttempts = 0;
  }

  joinProject(projectId: number) {
    if (!this.socket) {
      console.warn('Socket no conectado, no se puede unir al proyecto');
      return;
    }
    console.log('Joining project:', projectId);
    this.socket.emit('join-project', projectId);
    this.currentProjectId = projectId;
  }

  leaveProject(projectId: number) {
    if (!this.socket) return;
    console.log('Leaving project:', projectId);
    this.socket.emit('leave-project', projectId);
    if (this.currentProjectId === projectId) this.currentProjectId = null;
  }

  sendDiagramUpdate(payload: DiagramUpdate) {
    if (!this.socket?.connected) {
      console.warn('Socket no conectado, no se puede enviar actualización');
      return;
    }
    console.log('Sending diagram update:', payload.changeType, 'for project:', payload.projectId);
    this.socket.emit('diagram-update', payload);
  }

  sendCursorMove(payload: CursorPosition) {
    if (!this.socket?.connected) return;
    this.socket.emit('cursor-move', payload);
  }

  sendElementSelect(payload: ElementSelect) {
    if (!this.socket?.connected) return;
    this.socket.emit('element-select', payload);
  }

  on(event: string, handler: EventHandler) {
    this.socket?.on(event, handler);
  }

  off(event: string, handler?: EventHandler) {
    if (!this.socket) return;
    if (handler) this.socket.off(event, handler);
    else this.socket.off(event);
  }

  isConnected() { 
    return !!this.socket && this.socket.connected; 
  }
  
  getSocketId() { 
    return this.socket?.id; 
  }
  
  getCurrentProjectId() { 
    return this.currentProjectId; 
  }

  // Método para verificar si estamos en el proyecto correcto
  isInProject(projectId: number) {
    return this.currentProjectId === projectId && this.isConnected();
  }

  // Método para forzar reconexión
  forceReconnect(token?: string, url?: string) {
    this.disconnect();
    setTimeout(() => {
      this.connect(token, url);
    }, 500);
  }
}

const socketService = new SocketService();
export default socketService;
export type { DiagramUpdate, CursorPosition, UserInfo, ElementSelect };