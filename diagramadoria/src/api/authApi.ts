import axiosInstance from './axiosInstance';

export interface LoginCredentials {
  correo: string;
  contrasena: string;
}

export interface RegisterData {
  nombre: string;
  correo: string;
  contrasena: string;
}

export interface User {
  id: number;
  nombre: string;
  correo: string;
  created_at?: string;
}

export interface AuthResponse {
  token: string;
  usuario: User;
}

// Configurar interceptor para incluir token en todas las requests
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas de error 401 (token expirado)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await axiosInstance.post('/users/login', {
      correo: credentials.correo,
      contrasena: credentials.contrasena
    });
    return response.data;
  },

  register: async (userData: RegisterData): Promise<AuthResponse> => {
    const response = await axiosInstance.post('/users/register', {
      nombre: userData.nombre,
      correo: userData.correo,
      contrasena: userData.contrasena
    });
    return response.data;
  },

  getProfile: async (): Promise<User> => {
    const response = await axiosInstance.get('/users/usuarios');
    return response.data;
  },

  getUserByEmail: async (_email: string): Promise<User> => {
    const response = await axiosInstance.get(`/users/usuarios`);
    return response.data;
  }
};