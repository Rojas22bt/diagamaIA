import '../styles/HomeCss.css';

const proyectos = [
    { id: 1, name: 'Proyecto 1', descripcion: 'Diagrama para historias clínicas' },
    { id: 2, name: 'Proyecto 2', descripcion: 'Diagrama para gestión de colas' },
    { id: 3, name: 'Proyecto 3', descripcion: 'Diagrama para sistema de pacientes' },
    { id: 4, name: 'Proyecto 3', descripcion: 'Diagrama para sistema de pacientes' },
    { id: 5, name: 'Proyecto 3', descripcion: 'Diagrama para sistema de pacientes' },
    { id: 6, name: 'Proyecto 3', descripcion: 'Diagrama para sistema de pacientes' },
    { id: 7, name: 'Proyecto 3', descripcion: 'Diagrama para sistema de pacientes' },
    { id: 8, name: 'Proyecto 3', descripcion: 'Diagrama para sistema de pacientes' },
];

const Home = () => {

    return (
        <div className='home-contenedor'>
            <div id='apartados'>
                <div id='titulo-proyectos'>
                    <h2 className='titulo'>Mis Proyectos</h2>
                </div>
                <div id='lista-proyectos'>
                    {proyectos.map(proyecto => (
                        <div key={proyecto.id} className='proyectos'>
                            <h3>{proyecto.name}</h3>
                            <p>{proyecto.descripcion}</p>
                        </div>
                    ))}
                </div>
                <button id='nuevo' >
                    ?
                </button>
            </div>
        </div>
    );
};

export default Home;
