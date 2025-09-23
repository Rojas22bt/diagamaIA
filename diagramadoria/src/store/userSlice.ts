import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getUsers } from '../api/userApi';
import { projectApi } from '../api/projectApi';
import type { CreateProjectData, Project } from '../api/projectApi';

export const fetchUser = createAsyncThunk(
  'user/fetchUser',
  async () => {
    const user = await getUsers();
    return user;
  }
);

export const createProject = createAsyncThunk(
  'user/createProject',
  async (projectData: { titulo: string; descripcion: string }) => {
    const createData: CreateProjectData = {
      name: projectData.titulo,
      description: projectData.descripcion
    };
    const project = await projectApi.createProject(createData);
    return project;
  }
);

export const getUserProjects = createAsyncThunk(
  'user/getUserProjects',
  async () => {
    const projects = await projectApi.getUserProjects();
    return projects;
  }
);

export const deleteProject = createAsyncThunk(
  'user/deleteProject',
  async (projectId: number) => {
    await projectApi.deleteProject(projectId);
    return projectId;
  }
);

interface UserState {
  data: any;
  projects: Project[];
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  data: null,
  projects: [],
  loading: false,
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearProjects: (state) => {
      state.projects = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })
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
        state.error = action.error.message || null;
      })
      .addCase(getUserProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUserProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = action.payload;
      })
      .addCase(getUserProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })
      .addCase(deleteProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = state.projects.filter(p => p.id !== action.payload);
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      });
  },
});

export const { clearProjects } = userSlice.actions;
export default userSlice.reducer;