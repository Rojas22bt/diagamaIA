import { Routes, Route } from "react-router-dom"
import Dashboard from "../components/dashboard/Dashboard"
import LoginPage from "../pages/LoginPage"
// import DiagramPage from "../pages/DiagramPage"
import DiagramaPage from "../pages/DiagramaPage"

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/diagram" element={<DiagramaPage />} />
            <Route path="/dashboard/*" element={<Dashboard />} />
        </Routes>
    )
}

export default AppRoutes