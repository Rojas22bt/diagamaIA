import { useNavigate } from 'react-router-dom';
import './NavbarCss.css';

const Navbar = () => {
    const navigate = useNavigate();

    const handleLogoClick = () => {
        navigate('/');
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
                    <li>File</li>
                    <li>Editation</li>
                    <li>View</li>
                    <li>Help</li>
                    <li>Settings</li>
                </ul>
            </div>
        </nav>
    );
};

export default Navbar;