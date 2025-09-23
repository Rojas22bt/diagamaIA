import { Routes, Route } from "react-router-dom"
import LoginPage from "../pages/LoginPage"
import ConnectedDiagramPage from "../pages/ConnectedDiagramPage"
// import DiagramOnlyPage from "../pages/DiagramOnlyPage"
import ProjectDashboard from "../pages/ProjectDashboard"
import InvitationPanel from "../components/dashboard/InvitationPanel"

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<ProjectDashboard />} />
            <Route path="/invitations" element={<InvitationPanel />} />
            <Route path="/projects/:projectId/invite" element={<InvitationPanel />} />
            <Route path="/diagram/:projectId" element={<ConnectedDiagramPage />} />
            {/* Rutas antiguas eliminadas para evitar duplicidad */}
        </Routes>
    )
}

export default AppRoutes