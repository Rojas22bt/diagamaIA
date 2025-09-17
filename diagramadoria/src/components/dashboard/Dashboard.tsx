import { Routes, Route } from 'react-router-dom'
import Navbar from '../navbar/Navbar'
import Home from '../../pages/Home'
import DiagramaPage from '../../pages/DiagramaPage'
import AudioIAPage from '../../pages/AudioIAPage'

const Dashboard = () => {
    return (
        <div className="min-h-screen bg-gray-100">
            <Navbar />
            <div style={{ paddingTop: '60px' }}>
                <Routes>
                    <Route path="home" element={<Home />} />
                    <Route index element={<Home />} />
                    <Route path="diagram" element={<DiagramaPage />} />
                    <Route path="audio" element={<AudioIAPage />} />
                </Routes>
            </div>
        </div>
    )
}

export default Dashboard
