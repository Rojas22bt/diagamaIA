import express from "express";
import cors from "cors";
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import invitationRoutes from './routes/invitation.routes.js';

const app = express();
app.use(express.json());

// Allow configuring CORS via env in productionaaa
  const defaultOrigins = ['http://localhost:5173'];
// const defaultOrigins = ['https://calm-smoke-04a369c10.2.azurestaticapps.net'];
//const defaultOrigins = ['https://diagramadoria.netlify.app'];
const envOrigins = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
    origin: envOrigins && envOrigins.length > 0 ? envOrigins : defaultOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/invitations', invitationRoutes);

// Health check endpoint for Render
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

export default app;