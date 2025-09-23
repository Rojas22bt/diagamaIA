import axiosInstance from './axiosInstance';

export interface Project {
  id: number;
  name: string;
  description: string | null;
  diagrama_json: any;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  creator_id: number;
  estado?: string;
  rol?: string; // rol del usuario actual en este proyecto (creador/colaborador/etc)
  creator?: {
    id: number;
    name: string;
    email: string;
  };
  detalles?: ProjectDetail[];
  colaboradores?: Array<{
    usuario: {
      id: number;
      name: string;
      email: string;
    };
    rol: string;
  }>;
}

export interface ProjectDetail {
  id: number;
  user_id: number;
  project_id: number;
  permission_id: number;
  joined_at: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  permission: {
    id: number;
    nombre: string;
    descripcion: string;
  };
}

export interface CreateProjectData {
  name: string;
  description?: string;
  diagrama_json?: any;
  is_public?: boolean;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  diagrama_json?: any;
  is_public?: boolean;
}

export const projectApi = {
  // Crear nuevo proyecto
  createProject: async (projectData: CreateProjectData): Promise<Project> => {
    const response = await axiosInstance.post('/projects', projectData);
    return response.data.proyecto || response.data;
  },

  // Obtener proyectos del usuario
  getUserProjects: async (): Promise<Project[]> => {
    const response = await axiosInstance.get('/projects');
    return response.data.proyectos || response.data;
  },

  // Obtener proyecto por ID
  getProjectById: async (projectId: number): Promise<Project> => {
    const response = await axiosInstance.get(`/projects/${projectId}`);
    return response.data.proyecto || response.data;
  },

  // Actualizar proyecto
  updateProject: async (projectId: number, projectData: UpdateProjectData): Promise<Project> => {
    const response = await axiosInstance.put(`/projects/${projectId}`, projectData);
    return response.data;
  },

  // Actualizar solo el diagrama JSON
  updateProjectDiagram: async (projectId: number, diagramaJson: any): Promise<Project> => {
    const response = await axiosInstance.put(`/projects/${projectId}/diagram`, {
      diagrama_json: diagramaJson
    });
    return response.data;
  },

  // Eliminar proyecto
  deleteProject: async (projectId: number): Promise<void> => {
    await axiosInstance.delete(`/projects/${projectId}`);
  },

  // Remover colaborador (solo para creadores)
  removeCollaborator: async (projectId: number, userId: number): Promise<void> => {
    await axiosInstance.delete(`/projects/${projectId}/collaborators/${userId}`);
  },

  // Actualizar rol de colaborador (solo para creadores)
  updateCollaboratorRole: async (projectId: number, userId: number, role: 'editor' | 'vista'): Promise<void> => {
    await axiosInstance.put(`/projects/${projectId}/collaborators/${userId}/role`, { rol: role });
  },

  // Obtener colaboradores del proyecto
  getProjectCollaborators: async (projectId: number): Promise<ProjectDetail[]> => {
    const response = await axiosInstance.get(`/projects/${projectId}/collaborators`);
    return response.data;
  }
};