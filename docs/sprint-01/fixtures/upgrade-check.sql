SELECT titulo, diagrama_json FROM "Proyecto" WHERE titulo = 'preexisting';
SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'Validation%' ORDER BY tablename;
