import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../store/store';
import { login, register } from '../store/authSlice';
import type { RootState } from '../store/store';
import '../styles/LoginCss.css'

const LoginPage = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const [isRegister, setIsRegister] = useState<boolean>(false);
    // const loading = useSelector((state: RootState) => state.auth.loading);
    // const error = useSelector((state: RootState) => state.auth.error);
    const token = useSelector((state: RootState) => state.auth.token);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const formData = new FormData(e.target as HTMLFormElement);
            const nombre = formData.get('name') as string;
            const correo  = formData.get('username') as string;
            const confirm = formData.get('confirm') as string;
            const contrasena = formData.get('password') as string;
            if (isRegister) {
                if (contrasena !== confirm) {
                    alert("Las contraseñas no coinciden");
                    return;
                }
                await dispatch(register({ correo, contrasena, nombre}));
            } else {
                console.log("Intentando iniciar sesión con:", { correo, contrasena });
                await dispatch(login({ correo, contrasena }));
            }    
        } catch (error) {
            console.error("Error en el proceso de autenticación:", error);
        }
    };

    useEffect(() => {
        if (token) {
            navigate('/dashboard');  // Ir al ProjectDashboard (proyectos colaborativos)
        }
    }, [token, navigate]);

    return (
        <div className='contenedor-principal'>
            <form onSubmit={handleSubmit}>
                <div id='titulo'>
                    <div
                        className={`option ${!isRegister ? 'active' : ''}`}
                        onClick={() => setIsRegister(false)}
                        role="button"
                        tabIndex={0}
                    >
                        <h2>Login</h2>
                    </div>
                    <div
                        className={`option ${isRegister ? 'active' : ''}`}
                        onClick={() => setIsRegister(true)}
                        role="button"
                        tabIndex={0}
                    >
                        <h3>Registrarte</h3>
                    </div>
                </div>

                {isRegister && (
                    <div className='field'>
                        <label htmlFor='name'>Nombre completo:</label>
                        <input id='name' name='name' type='text' placeholder='Tu nombre completo' />
                    </div>
                )}

                <div className='field'>
                    <label htmlFor='username'>Correo:</label>
                    <input type='email' id='username' name='username' placeholder='micorreo@gmail.com' required />
                </div>

                <div className='field'>
                    <label htmlFor='password'>Contraseña:</label>
                    <input type='password' id='password' name='password' placeholder='micontrasena123' required />
                </div>

                {isRegister && (
                    <div className='field'>
                        <label htmlFor='confirm'>Confirmar contraseña:</label>
                        <input id='confirm' name='confirm' type='password' placeholder='Repite la contraseña' required />
                    </div>
                )}

                <button type='submit'>{isRegister ? 'Registrarse' : 'Login'}</button>
            </form>
        </div>
    );
};

export default LoginPage;
