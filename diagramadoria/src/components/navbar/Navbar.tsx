import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../store/store';
import { logout } from '../../store/authSlice';
import './NavbarCss.css';

const Navbar = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const handleLogoClick = () => {
        navigate('/dashboard');
    };

    const handleProjectsClick = () => {
        navigate('/dashboard');
    };

    const handleInvitationsClick = () => {
        navigate('/invitations');
    };

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    return (
        <nav className= "navbar">
            <div className='navbar-content'>
                <button onClick={handleLogoClick}>
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <div>DiagramaIA</div>
                <ul className="navbar-menu">
                    <li><button onClick={handleProjectsClick}>Proyectos</button></li>
                    <li><button onClick={handleInvitationsClick}>Invitaciones</button></li>
                    <li>View</li>
                    <li>Help</li>
                    <li>Settings</li>
                    <li><button onClick={handleLogout}>Logout</button></li>
                </ul>
            </div>
        </nav>
    );
};

export default Navbar;