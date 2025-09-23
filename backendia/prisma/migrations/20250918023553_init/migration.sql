-- CreateTable
CREATE TABLE "public"."Usuario" (
    "id_usuario" SERIAL NOT NULL,
    "correo" TEXT NOT NULL,
    "contrasena" TEXT NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "public"."Proyecto" (
    "id_proyecto" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "diagrama_json" JSONB,
    "estado" TEXT NOT NULL,

    CONSTRAINT "Proyecto_pkey" PRIMARY KEY ("id_proyecto")
);

-- CreateTable
CREATE TABLE "public"."Permisos" (
    "id_permiso" SERIAL NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "Permisos_pkey" PRIMARY KEY ("id_permiso")
);

-- CreateTable
CREATE TABLE "public"."Detalle_Proyecto" (
    "id_detalle" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_permiso" INTEGER NOT NULL,

    CONSTRAINT "Detalle_Proyecto_pkey" PRIMARY KEY ("id_detalle")
);

-- CreateTable
CREATE TABLE "public"."Acciones_Proyecto" (
    "id_accion" SERIAL NOT NULL,
    "id_detalle" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Acciones_Proyecto_pkey" PRIMARY KEY ("id_accion")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "public"."Usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "Detalle_Proyecto_id_usuario_id_proyecto_id_permiso_key" ON "public"."Detalle_Proyecto"("id_usuario", "id_proyecto", "id_permiso");

-- AddForeignKey
ALTER TABLE "public"."Detalle_Proyecto" ADD CONSTRAINT "Detalle_Proyecto_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."Usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Detalle_Proyecto" ADD CONSTRAINT "Detalle_Proyecto_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "public"."Proyecto"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Detalle_Proyecto" ADD CONSTRAINT "Detalle_Proyecto_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "public"."Permisos"("id_permiso") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Acciones_Proyecto" ADD CONSTRAINT "Acciones_Proyecto_id_detalle_fkey" FOREIGN KEY ("id_detalle") REFERENCES "public"."Detalle_Proyecto"("id_detalle") ON DELETE CASCADE ON UPDATE CASCADE;
