import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { projectApi } from '../api/projectApi';
import type { Project, CreateProjectData, UpdateProjectData } from '../api/projectApi';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
}

const initialState: ProjectState = {
  projects: [],
  currentProject: null,
  loading: false,
  error: null,
};

// Thunks
export const createProject = createAsyncThunk(
  'projects/createProject',
  async (projectData: CreateProjectData, { rejectWithValue }) => {
    try {
      const project = await projectApi.createProject(projectData);
      return project;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Error al crear proyecto');
    }
  }
);

export const fetchUserProjects = createAsyncThunk(
  'projects/fetchUserProjects',
  async (_, { rejectWithValue }) => {
    try {
      const projects = await projectApi.getUserProjects();
      return projects;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Error al cargar proyectos');
    }
  }
);

export const fetchProjectById = createAsyncThunk(
  'projects/fetchProjectById',
  async (projectId: number, { rejectWithValue }) => {
    try {
      const project = await projectApi.getProjectById(projectId);
      return project;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Error al cargar proyecto');
    }
  }
);

export const updateProject = createAsyncThunk(
  'projects/updateProject',
  async ({ projectId, projectData }: { projectId: number; projectData: UpdateProjectData }, { rejectWithValue }) => {
    try {
      const project = await projectApi.updateProject(projectId, projectData);
      return project;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Error al actualizar proyecto');
    }
  }
);

export const updateProjectDiagram = createAsyncThunk(
  'projects/updateProjectDiagram',
  async ({ projectId, diagramaJson }: { projectId: number; diagramaJson: any }, { rejectWithValue }) => {
    try {
      const project = await projectApi.updateProjectDiagram(projectId, diagramaJson);
      return project;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Error al actualizar diagrama');
    }
  }
);

export const deleteProject = createAsyncThunk(
  'projects/deleteProject',
  async (projectId: number, { rejectWithValue }) => {
    try {
      await projectApi.deleteProject(projectId);
      return projectId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Error al eliminar proyecto');
    }
  }
);

export const removeCollaborator = createAsyncThunk(
  'projects/removeCollaborator',
  async ({ projectId, userId }: { projectId: number; userId: number }, { rejectWithValue }) => {
    try {
      await projectApi.removeCollaborator(projectId, userId);
      return { projectId, userId };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Error al remover colaborador');
    }
  }
);

const projectSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setCurrentProject(state, action) {
      state.currentProject = action.payload;
    },
    clearCurrentProject(state) {
      state.currentProject = null;
    },
    updateCurrentProjectDiagram(state, action) {
      if (state.currentProject) {
        state.currentProject.diagrama_json = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Create project
      .addCase(createProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.loading = false;
        state.projects.push(action.payload);
      })
      .addCase(createProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch user projects
      .addCase(fetchUserProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = action.payload;
      })
      .addCase(fetchUserProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch project by ID
      .addCase(fetchProjectById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjectById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentProject = action.payload;
      })
      .addCase(fetchProjectById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update project
      .addCase(updateProject.fulfilled, (state, action) => {
        const index = state.projects.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.projects[index] = action.payload;
        }
        if (state.currentProject?.id === action.payload.id) {
          state.currentProject = action.payload;
        }
      })
      // Update project diagram
      .addCase(updateProjectDiagram.fulfilled, (state, action) => {
        const index = state.projects.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.projects[index] = action.payload;
        }
        if (state.currentProject?.id === action.payload.id) {
          state.currentProject = action.payload;
        }
      })
      // Delete project
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.projects = state.projects.filter(p => p.id !== action.payload);
        if (state.currentProject?.id === action.payload) {
          state.currentProject = null;
        }
      })
      // Remove collaborator
      .addCase(removeCollaborator.fulfilled, (state, action) => {
        if (state.currentProject?.id === action.payload.projectId) {
          state.currentProject.detalles = state.currentProject.detalles?.filter(
            d => d.user_id !== action.payload.userId
          );
        }
      });
  },
});

export const { clearError, setCurrentProject, clearCurrentProject, updateCurrentProjectDiagram } = projectSlice.actions;
export default projectSlice.reducer;