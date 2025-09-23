import axiosInstance from './axiosInstance';

export const getUsers = async () => {
  const response = await axiosInstance.get('/users/usuarios');
  return response.data;
};

export const createUser = async (userData: any) => {
  const response = await axiosInstance.post('/users/register', userData);
  return response.data;
};

export const loginUser = async (credenciales: any) =>{
    const responser = await axiosInstance.post('/users/login', credenciales);
    return responser.data;              
}