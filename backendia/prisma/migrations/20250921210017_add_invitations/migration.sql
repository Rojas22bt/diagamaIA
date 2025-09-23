-- CreateTable
CREATE TABLE "public"."Invitacion" (
    "id_invitacion" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_remitente" INTEGER NOT NULL,
    "id_destinatario" INTEGER NOT NULL,
    "id_permiso" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "fecha_envio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_respuesta" TIMESTAMP(3),

    CONSTRAINT "Invitacion_pkey" PRIMARY KEY ("id_invitacion")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitacion_id_proyecto_id_destinatario_key" ON "public"."Invitacion"("id_proyecto", "id_destinatario");

-- AddForeignKey
ALTER TABLE "public"."Invitacion" ADD CONSTRAINT "Invitacion_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "public"."Proyecto"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitacion" ADD CONSTRAINT "Invitacion_id_remitente_fkey" FOREIGN KEY ("id_remitente") REFERENCES "public"."Usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitacion" ADD CONSTRAINT "Invitacion_id_destinatario_fkey" FOREIGN KEY ("id_destinatario") REFERENCES "public"."Usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitacion" ADD CONSTRAINT "Invitacion_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "public"."Permisos"("id_permiso") ON DELETE CASCADE ON UPDATE CASCADE;
