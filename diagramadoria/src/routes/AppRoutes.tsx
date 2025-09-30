import { Routes, Route } from "react-router-dom"
import LoginPage from "../pages/LoginPage"
import ConnectedDiagramPage from "../pages/ConnectedDiagramPage"
// import DiagramOnlyPage from "../pages/DiagramOnlyPage"
import ProjectDashboard from "../pages/ProjectDashboard"
import InvitationPanel from "../components/dashboard/InvitationPanel"
import GenerationBackendSprintBoot from "../pages/GenerationBackendSprintBoot"
import ChatBotPage from "../pages/ChatBotPage"

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<ProjectDashboard />} />
            <Route path="/invitations" element={<InvitationPanel />} />
            <Route path="/projects/:projectId/invite" element={<InvitationPanel />} />
            <Route path="/diagram/:projectId" element={<ConnectedDiagramPage />} />
            <Route path="/generate/:projectId" element={<GenerationBackendSprintBoot />} />
            <Route path="/chatbot" element={<ChatBotPage />} />
            {/* Rutas antiguas eliminadas para evitar duplicidad */}
        </Routes>
    )
}

export default AppRoutes