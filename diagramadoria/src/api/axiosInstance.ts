import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'https://diagamaia.onrender.com/api', // Cambia la URL según tu backend
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default axiosInstance;
