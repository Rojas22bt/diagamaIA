import express from "express";
import cors from "cors";
import type { CorsOptions } from "cors";
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import invitationRoutes from './routes/invitation.routes.js';

const app = express();
app.use(express.json());

// CORS robusto: permite localhost y tu Azure SWA; respalda a CORS_ORIGINS si está definido
const defaultOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://calm-smoke-04a369c10.2.azurestaticapps.net',
];
const envOrigins = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || [];
const staticAllow = new Set([...defaultOrigins, ...envOrigins]);
const azureHostRegex = /\.azurestaticapps\.net$/i;

const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        // No origin (por ejemplo, curl o same-origin) => permitir
        if (!origin) return callback(null, true);
        try {
            const host = new URL(origin).hostname;
            const isLocal = host === 'localhost' || host === '127.0.0.1';
            if (staticAllow.has(origin) || isLocal || azureHostRegex.test(host)) {
                return callback(null, true);
            }
        } catch {
            // Si falla el parseo, rechazar de forma segura
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    // Deja que cors refleje los headers y métodos por defecto (suficiente para preflight)
    optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Asegura manejar preflight en todas las rutas
app.options('*', cors(corsOptions));

app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/invitations', invitationRoutes);

// Health check endpoint for Render
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

export default app;