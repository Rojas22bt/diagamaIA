import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import authReducer from './authSlice';
import projectReducer from './projectSlice';
import invitationReducer from './invitationSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    auth: authReducer,
    projects: projectReducer,
    invitations: invitationReducer,
  },
});

// Tipos para TypeScript
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Hook para usar dispatch tipado en componentes
import { useDispatch } from 'react-redux';
export const useAppDispatch = () => useDispatch<AppDispatch>();