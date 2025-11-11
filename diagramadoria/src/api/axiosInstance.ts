import axios from 'axios';

const axiosInstance = axios.create({
 //baseURL: 'http://localhost:3000/api',
  baseURL: 'https://diagamaia.onrender.com/api',
  //hola
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default axiosInstance;
