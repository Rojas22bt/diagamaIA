import axiosInstance from './axiosInstance';

// Tipos normalizados para el frontende
export interface Invitation {
  id: number;
  project_id: number;
  from_user_id: number;
  to_user_id: number;
  permission_id: number;
  estado: 'pendiente' | 'aceptada' | 'rechazada';
  mensaje: string | null;
  created_at: string;
  updated_at: string;
  proyecto?: {
    id: number;
    name: string;
    description: string;
  };
  from_user?: {
    id?: number;
    name?: string | null;
    email?: string | null;
  };
  to_user?: {
    id?: number;
    name?: string | null;
    email?: string | null;
  };
  permission?: {
    id: number;
    nombre: string;
    descripcion: string;
  };
}

export interface Permission {
  id: number;
  nombre: string;
  descripcion: string;
}

export interface SendInvitationData {
  projectId: number;
  toUserEmail: string;
  permissionId: number;
  mensaje?: string;
}

export interface RespondToInvitationData {
  invitationId: number;
  response: 'aceptada' | 'rechazada';
}

// Utilidades de mapeo: adaptan la respuesta del backend (esquema Prisma en español)
const mapDbInvitationToUi = (raw: any): Invitation => {
  // Campos base
  const id = raw.id_invitacion ?? raw.id ?? 0;
  const project_id = raw.id_proyecto ?? raw.project_id ?? 0;
  const from_user_id = raw.id_remitente ?? raw.from_user_id ?? 0;
  const to_user_id = raw.id_destinatario ?? raw.to_user_id ?? 0;
  const permission_id = raw.id_permiso ?? raw.permission_id ?? 0;
  const estado = (raw.estado as Invitation['estado']) ?? 'pendiente';
  const created_at = raw.fecha_envio ?? raw.created_at ?? new Date().toISOString();
  const updated_at = raw.fecha_respuesta ?? raw.updated_at ?? created_at;

  // Relacionales opcionales
  const proyecto = raw.Proyecto
    ? {
        id: raw.Proyecto.id_proyecto ?? raw.Proyecto.id ?? project_id,
        name: raw.Proyecto.titulo ?? raw.Proyecto.name ?? '',
        description: raw.Proyecto.descripcion ?? raw.Proyecto.description ?? ''
      }
    : raw.proyecto
    ? raw.proyecto
    : undefined;

  const from_user = raw.Remitente
    ? {
        name: raw.Remitente.nombre ?? null,
        email: raw.Remitente.correo ?? null
      }
    : raw.from_user;

  const to_user = raw.Destinatario
    ? {
        name: raw.Destinatario.nombre ?? null,
        email: raw.Destinatario.correo ?? null
      }
    : raw.to_user;

  const permission = raw.Permiso
    ? {
        id: raw.Permiso.id_permiso ?? permission_id,
        nombre: raw.Permiso.descripcion ?? 'colaborador',
        descripcion: raw.Permiso.descripcion ?? 'colaborador'
      }
    : raw.permission
    ? raw.permission
    : undefined;

  return {
    id,
    project_id,
    from_user_id,
    to_user_id,
    permission_id,
    estado,
    mensaje: raw.mensaje ?? null,
    created_at,
    updated_at,
    proyecto,
    from_user,
    to_user,
    permission
  };
};

const mapDbPermissionsToUi = (arr: any[]): Permission[] =>
  (Array.isArray(arr) ? arr : []).map((p) => ({
    id: p.id_permiso ?? p.id ?? 0,
    nombre: p.descripcion ?? p.nombre ?? 'colaborador',
    descripcion: p.descripcion ?? p.nombre ?? ''
  }));

export const invitationApi = {
  // Enviar invitación (POST /invitations)
  sendInvitation: async (invitationData: SendInvitationData): Promise<Invitation> => {
    const response = await axiosInstance.post('/invitations', {
      id_proyecto: invitationData.projectId,
      correo_destinatario: invitationData.toUserEmail,
      id_permiso: invitationData.permissionId,
      mensaje: invitationData.mensaje
    });
    const data = response.data?.invitacion ?? response.data;
    return mapDbInvitationToUi(data);
  },

  // Obtener invitaciones recibidas (GET /invitations/received)
  getReceivedInvitations: async (): Promise<Invitation[]> => {
    const response = await axiosInstance.get('/invitations/received');
    const list = response.data?.invitaciones ?? response.data ?? [];
    const safe = Array.isArray(list) ? list : [];
    return safe.map(mapDbInvitationToUi);
  },

  // Obtener invitaciones enviadas (GET /invitations/sent)
  getSentInvitations: async (): Promise<Invitation[]> => {
    const response = await axiosInstance.get('/invitations/sent');
    const list = response.data?.invitaciones ?? response.data ?? [];
    const safe = Array.isArray(list) ? list : [];
    return safe.map(mapDbInvitationToUi);
  },

  // Responder a invitación (PUT /invitations/:id/respond)
  respondToInvitation: async (data: RespondToInvitationData): Promise<Invitation> => {
    const response = await axiosInstance.put(`/invitations/${data.invitationId}/respond`, {
      respuesta: data.response
    });
    const payload = response.data?.invitacion ?? response.data;
    return mapDbInvitationToUi(payload);
  },

  // Cancelar invitación enviada
  cancelInvitation: async (invitationId: number): Promise<void> => {
    await axiosInstance.delete(`/invitations/${invitationId}`);
  },

  // Obtener permisos disponibles (GET /invitations/permissions)
  getPermissions: async (): Promise<Permission[]> => {
    const response = await axiosInstance.get('/invitations/permissions');
    const list = response.data?.permisos ?? response.data ?? [];
    return mapDbPermissionsToUi(Array.isArray(list) ? list : []);
  }
};