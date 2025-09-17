import { useNavigate } from "react-router-dom";
import { useState } from "react";
import '../styles/LoginCss.css'

const LoginPage = () => {
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegister(true);
    navigate("/dashboard/home");
  }

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
