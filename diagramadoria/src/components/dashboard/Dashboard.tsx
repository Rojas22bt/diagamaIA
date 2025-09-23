import { Navigate } from 'react-router-dom';

// Componente legado neutralizado: redirige al nuevo dashboard canónico
const LegacyDashboardRedirect = () => {
  return <Navigate to="/dashboard" replace />;
};

export default LegacyDashboardRedirect;
