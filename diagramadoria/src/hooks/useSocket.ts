import { useEffect, useCallback, useRef, useState } from 'react';
import socketService from '../services/socketService';
import type { DiagramUpdate } from '../services/socketService';

interface UseSocketOptions {
  projectId?: string | number;
  onDiagramUpdate?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

export const useSocket = (options: UseSocketOptions = {}) => {
  const { projectId, onDiagramUpdate, onConnect, onDisconnect, onError } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const isConnectedRef = useRef(false);
  const projectIdRef = useRef<string | number | undefined>(projectId);

  // Update refs when props change
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setConnectionError('No authentication token available');
      return;
    }

    try {
      console.log('Connecting to WebSocket...');
      socketService.connect(token);
      setConnectionError(null);
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      setConnectionError('Failed to connect to WebSocket');
    }
  }, []);

  const disconnect = useCallback(() => {
    try {
      console.log('Disconnecting from WebSocket...');
      if (projectIdRef.current) {
        socketService.leaveProject(Number(projectIdRef.current));
      }
      socketService.disconnect();
    } catch (error) {
      console.error('Error disconnecting from WebSocket:', error);
    }
  }, []);

  const joinProject = useCallback((pid?: string | number) => {
    const projectToJoin = pid || projectIdRef.current;
    if (!projectToJoin) return;
    
    const numericProjectId = Number(projectToJoin);
    console.log('Joining project:', numericProjectId);
    socketService.joinProject(numericProjectId);
  }, []);

  const sendDiagramUpdate = useCallback((payload: DiagramUpdate) => {
    if (!isConnectedRef.current) {
      console.warn('Socket not connected, cannot send diagram update');
      return false;
    }
    
    try {
      socketService.sendDiagramUpdate(payload);
      return true;
    } catch (error) {
      console.error('Error sending diagram update:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    // Set up event listeners
    const handleConnect = () => {
      console.log('Socket connected');
      setIsConnected(true);
      isConnectedRef.current = true;
      setConnectionError(null);
      
      // Auto-join project if we have one
      if (projectIdRef.current) {
        setTimeout(() => {
          joinProject(projectIdRef.current);
        }, 100);
      }
      
      onConnect?.();
    };

    const handleDisconnect = (reason: string) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      isConnectedRef.current = false;
      onDisconnect?.();
    };

    const handleConnectError = (error: any) => {
      console.error('Socket connection error:', error);
      setConnectionError('Connection failed');
      setIsConnected(false);
      isConnectedRef.current = false;
      onError?.(error);
    };

    const handleDiagramUpdate = (data: any) => {
      console.log('Received diagram update:', data);
      onDiagramUpdate?.(data);
    };

    const handleJoinedProject = (joinedProjectId: number) => {
      console.log('Successfully joined project:', joinedProjectId);
    };

    // Register event listeners
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('connect_error', handleConnectError);
    socketService.on('diagram-updated', handleDiagramUpdate);
    socketService.on('joined-project', handleJoinedProject);

    // Initial connection
    connect();

    return () => {
      // Clean up event listeners
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('connect_error', handleConnectError);
      socketService.off('diagram-updated', handleDiagramUpdate);
      socketService.off('joined-project', handleJoinedProject);
    };
  }, [connect, onConnect, onDisconnect, onError, onDiagramUpdate, joinProject]);

  // Join project when projectId changes
  useEffect(() => {
    if (isConnected && projectId) {
      joinProject(projectId);
    }
  }, [isConnected, projectId, joinProject]);

  return {
    isConnected,
    connectionError,
    connect,
    disconnect,
    joinProject,
    sendDiagramUpdate,
    socketService
  };
};