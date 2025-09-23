import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { invitationApi } from '../api/invitationApi';
import type { Invitation, Permission, SendInvitationData, RespondToInvitationData } from '../api/invitationApi';

interface InvitationState {
  receivedInvitations: Invitation[];
  sentInvitations: Invitation[];
  permissions: Permission[];
  loading: boolean;
  error: string | null;
}

const initialState: InvitationState = {
  receivedInvitations: [],
  sentInvitations: [],
  permissions: [],
  loading: false,
  error: null,
};

// Thunks
export const sendInvitation = createAsyncThunk(
  'invitations/sendInvitation',
  async (invitationData: SendInvitationData, { rejectWithValue }) => {
    try {
      const invitation = await invitationApi.sendInvitation(invitationData);
      return invitation;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Error al enviar invitación');
    }
  }
);

export const fetchReceivedInvitations = createAsyncThunk(
  'invitations/fetchReceivedInvitations',
  async (_, { rejectWithValue }) => {
    try {
      const invitations = await invitationApi.getReceivedInvitations();
      return invitations;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Error al cargar invitaciones recibidas');
    }
  }
);

export const fetchSentInvitations = createAsyncThunk(
  'invitations/fetchSentInvitations',
  async (_, { rejectWithValue }) => {
    try {
      const invitations = await invitationApi.getSentInvitations();
      return invitations;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Error al cargar invitaciones enviadas');
    }
  }
);

export const respondToInvitation = createAsyncThunk(
  'invitations/respondToInvitation',
  async (data: RespondToInvitationData, { rejectWithValue }) => {
    try {
      const invitation = await invitationApi.respondToInvitation(data);
      return invitation;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Error al responder invitación');
    }
  }
);

export const cancelInvitation = createAsyncThunk(
  'invitations/cancelInvitation',
  async (invitationId: number, { rejectWithValue }) => {
    try {
      await invitationApi.cancelInvitation(invitationId);
      return invitationId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Error al cancelar invitación');
    }
  }
);

export const fetchPermissions = createAsyncThunk(
  'invitations/fetchPermissions',
  async (_, { rejectWithValue }) => {
    try {
      const permissions = await invitationApi.getPermissions();
      return permissions;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Error al cargar permisos');
    }
  }
);

const invitationSlice = createSlice({
  name: 'invitations',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Send invitation
      .addCase(sendInvitation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendInvitation.fulfilled, (state, action) => {
        state.loading = false;
        state.sentInvitations.push(action.payload);
      })
      .addCase(sendInvitation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch received invitations
      .addCase(fetchReceivedInvitations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReceivedInvitations.fulfilled, (state, action) => {
        state.loading = false;
        state.receivedInvitations = action.payload;
      })
      .addCase(fetchReceivedInvitations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch sent invitations
      .addCase(fetchSentInvitations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSentInvitations.fulfilled, (state, action) => {
        state.loading = false;
        state.sentInvitations = action.payload;
      })
      .addCase(fetchSentInvitations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Respond to invitation
      .addCase(respondToInvitation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(respondToInvitation.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.receivedInvitations.findIndex(inv => inv.id === action.payload.id);
        if (index !== -1) {
          state.receivedInvitations[index] = action.payload;
        }
      })
      .addCase(respondToInvitation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Cancel invitation
      .addCase(cancelInvitation.fulfilled, (state, action) => {
        state.sentInvitations = state.sentInvitations.filter(inv => inv.id !== action.payload);
      })
      // Fetch permissions
      .addCase(fetchPermissions.fulfilled, (state, action) => {
        state.permissions = action.payload;
      });
  },
});

export const { clearError } = invitationSlice.actions;
export default invitationSlice.reducer;