import React, { useEffect, useRef } from 'react'
import * as joint from 'jointjs'
import '../styles/DiagramCss.css'
import AudioIAPage from './AudioIAPage'
import 'jointjs/dist/joint.css'

const DiagramaPage: React.FC = () => {
    const diagramaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!diagramaRef.current) return;

        const graph = new joint.dia.Graph();

        const paper = new joint.dia.Paper({
            el: diagramaRef.current,
            model: graph,
            width: '80%',
            height: '100%',
            gridSize: 10,
            drawGrid: true,
        });
    })


    return (
        <div className='diagrama-contenedor'>
            <div>
                AQUI VAN LOS ELEMENTOS DE LAS CLASES
            </div>
            <div ref={diagramaRef} style={{ width: '100%', minHeight: 'calc(100vh - 60px)', border: '1px solid #ccc' }} >
            </div>
            <section>
                <AudioIAPage />
            </section>
        </div>
    )
}

export default DiagramaPage
