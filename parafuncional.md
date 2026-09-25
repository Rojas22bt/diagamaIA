en backenddia:
en terminal:
npm ci 
(ojo node > 18)
crear .env
colocar esto:
DATABASE_URL="postgresql://postgres:tucontra@localhost:5432/diagamaia"
JWT_SECRET="secreto-local"
CORS_ORIGINS="http://localhost:5173"
PORT="3000"
y luego migrar los datos con :
npx prisma migrate deploy
npx prisma generate

y al final :
npm run dev

PARA diagramadoria:
npm ci
crear .env:
VITE_API_BASE_URL="http://localhost:3000/api"
VITE_BACKEND_URL="http://localhost:3000"

al final:
npm run dev