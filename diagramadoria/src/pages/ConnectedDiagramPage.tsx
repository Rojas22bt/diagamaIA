import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as joint from 'jointjs'
import { FcReddit, FcDeleteDatabase } from "react-icons/fc"
import { FaPlus, FaRegLightbulb } from 'react-icons/fa'
import { FiDownload, FiUpload } from 'react-icons/fi';
import { saveAs } from 'file-saver';
import '../styles/DiagramCss.css'
import AudioIAPage from './AudioIAPage'
import ChatBotPanel from '../components/chat/ChatBotPanel'
import ImportImageModal from '../components/diagram/ImportImageModal'
import 'jointjs/dist/joint.css'
import type { ActionSuggestion } from '../ai/openaiClient'
import { suggestAttributesForClasses, type AttributeSuggestion, suggestClassesFromProjectTitle, type ClassSuggestion, suggestRelationsFromProjectTitle, type RelationSuggestion } from '../ai/openaiClient'
import { addActivity, setActiveProjectId, getActiveProjectId, getActivities } from '../utils/collaboration'
import { projectApi } from '../api/projectApi';
import { invitationApi } from '../api/invitationApi';
import { useDispatch } from 'react-redux';
import { fetchSentInvitations, fetchReceivedInvitations } from '../store/invitationSlice';
import socketService from '../services/socketService';
import type { DiagramUpdate } from '../services/socketService';
// import type { RootState } from '../store/store';

type ClassType = {
    id: number;
    name: string;
    x: number;
    y: number;
    displayId: number;
    attributes: string[];
    methods: string[];
    element?: joint.shapes.standard.Rectangle;
};

// Modelo estructurado para guardar/cargar
type UMLAttribute = { name: string; type: string };
type UMLMethod = { name: string; returns: string };
type UMLClassNode = {
    id: string; // uid estable
    displayId: number;
    name: string;
    position: { x: number; y: number };
    size?: { width: number; height: number };
    attributes: UMLAttribute[];
    methods: UMLMethod[];
};
type UMLRelationType = 'asociacion' | 'herencia' | 'agregacion' | 'composicion';
type UMLRelation = {
    id: string;
    fromDisplayId: number;
    toDisplayId: number;
    type: UMLRelationType;
    originCard?: string;
    destCard?: string;
    verb?: string;
};
type DiagramModel = {
    version: 1;
    nextDisplayId: number;
    classes: UMLClassNode[];
    relations: UMLRelation[];
};

function measureText(text: string, fontSize: number = 15, fontFamily: string = 'monospace', fontWeight: string = 'bold') {
    const span = document.createElement('span');
    span.style.visibility = 'hidden';
    span.style.fontSize = `${fontSize}px`;
    span.style.fontFamily = fontFamily;
    span.style.fontWeight = fontWeight;
    span.style.whiteSpace = 'pre';
    document.body.appendChild(span);
    span.textContent = text;
    const rect = span.getBoundingClientRect();
    document.body.removeChild(span);
    return { width: rect.width, height: rect.height };
}

const ConnectedDiagramPage: React.FC = () => {
    const navigate = useNavigate();
    const { projectId } = useParams<{ projectId: string }>();
    const dispatch = useDispatch();
    const diagramaRef = useRef<HTMLDivElement>(null);
    const [graph, setGraph] = useState<joint.dia.Graph | null>(null);
    const [paper, setPaper] = useState<joint.dia.Paper | null>(null);
    // Refs to avoid stale closures in socket handlers
    const graphRef = useRef<joint.dia.Graph | null>(null);
    const paperRef = useRef<joint.dia.Paper | null>(null);
    const [scale, setScale] = useState<number>(1);
    const [classes, setClasses] = useState<ClassType[]>([]);
    const [relations, setRelations] = useState<UMLRelation[]>([]);
    const [open, setOpen] = useState<boolean>(false);
    const [openCollab, setOpenCollab] = useState<boolean>(false);
    const [openActivity, setOpenActivity] = useState<boolean>(false);
    const [openReco, setOpenReco] = useState<boolean>(false);
    const [openChatBot, setOpenChatBot] = useState<boolean>(false);
    const [recoLoading, setRecoLoading] = useState<boolean>(false);
    const [recoList, setRecoList] = useState<AttributeSuggestion[]>([]);
    // Nueva sección: recomendaciones de CLASES/tablas basadas en el título del proyecto
    const [openClassReco, setOpenClassReco] = useState<boolean>(false);
    const [classRecoLoading, setClassRecoLoading] = useState<boolean>(false);
    const [classRecoList, setClassRecoList] = useState<ClassSuggestion[]>([]);
    // Recomendaciones de RELACIONES
    const [openRelReco, setOpenRelReco] = useState<boolean>(false);
    const [relRecoLoading, setRelRecoLoading] = useState<boolean>(false);
    const [relRecoList, setRelRecoList] = useState<RelationSuggestion[]>([]);
    const [collabDraft, setCollabDraft] = useState<{ name: string; email: string; role: 'editor' | 'vista' }>({ name: '', email: '', role: 'editor' });
    // Colaboradores desde el backend (sincronizados)
    type ServerCollab = { userId: number; name: string; email: string; role: 'editor' | 'vista'; isCreator?: boolean };
    const [serverCollabs, setServerCollabs] = useState<ServerCollab[]>([]);
    // Control de permisos del usuario actual
    const [isOwner, setIsOwner] = useState<boolean>(false);
    const [myRole, setMyRole] = useState<'creador' | 'editor' | 'vista' | ''>('');
    const [activities, setActivities] = useState(() => {
        const pid = getActiveProjectId();
        return pid ? getActivities(pid) : [];
    });
    const [showImportImageModal, setShowImportImageModal] = useState(false);

    // Handlers para el modal de importar imagen
    const handleUploadImage = (file: File) => {
        // Aquí puedes implementar la lógica para procesar la imagen
        console.log('Imagen subida:', file.name);
        alert('Imagen subida: ' + file.name);
        // TODO: Implementar procesamiento de imagen (OCR, conversión a diagrama, etc.)
    };

    const handleAnalyzeImageWithAI = async (file: File) => {
        // Aquí puedes implementar la lógica de análisis con IA
        console.log('Analizando imagen con IA:', file.name);
        
        try {
            // TODO: Llamar a tu API de IA para analizar la imagen
            // Ejemplo:
            // const result = await analyzeImageWithAI(file);
            // Procesar el resultado y crear clases/relaciones en el diagrama
            
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulación
            alert('Análisis completado. Se detectaron elementos del diagrama.');
            
            // Aquí podrías crear clases basadas en el análisis de la IA
            // Por ejemplo: crear clases detectadas en la imagen
        } catch (error) {
            console.error('Error al analizar imagen:', error);
            alert('Error al analizar la imagen con IA');
        }
    };

    // Helper para mostrar etiqueta de usuario (preferir correo sobre nombre/ID)
    const getUserDisplay = (userId?: number) => {
        // Si no tenemos ID, intenta usar el usuario local (puede ser yo mismo)
        try {
            const meRaw = localStorage.getItem('user');
            if (meRaw) {
                const me = JSON.parse(meRaw);
                const myEmail = me?.correo || me?.email;
                if (!userId && myEmail) return String(myEmail);
                if (me?.id === userId) return String(myEmail || me?.nombre || me?.name || me?.username || 'Usuario');
            }
        } catch { }
        if (typeof userId === 'number') {
            const found = serverCollabs.find(c => c.userId === userId);
            if (found) return String(found.email || found.name || 'Usuario');
        }
        return 'Usuario';
    };
    // Ref reactivo para consultar rol actual dentro de closures (paper.interactive)
    const roleRef = useRef(myRole);
    useEffect(() => { roleRef.current = myRole; }, [myRole]);
    // para evitar cargar dos veces desde servidor
    const loadedFromServerRef = useRef<boolean>(false);
    // debounce ref para emisiones de movimiento
    const moveDebounceRef = useRef<number | null>(null);
    // flag para evitar emitir create_relation duplicado desde onAdd
    const creatingLinkRef = useRef<boolean>(false);
    // flag para suprimir emisión de eventos de borrado de relación durante borrado en cascada
    const suppressLinkEmitRef = useRef<boolean>(false);
    // (se mueve la lógica de autosave más abajo, después de declarar nextNumber)

    // Modal para editar clase
    const [editModal, setEditModal] = useState<{
        visible: boolean;
        element: any;
        title: string;
        attributesArr: { name: string; type: string }[];
        methodsArr: { name: string; returns: string }[];
    }>({ visible: false, element: null, title: '', attributesArr: [], methodsArr: [] });

    // Relación por número de clase (más dinámico)
    const [originNum, setOriginNum] = useState<string>('');
    const [destNum, setDestNum] = useState<string>('');
    const [nextNumber, setNextNumber] = useState<number>(1);
    // Relación UML tipo
    const [relationType, setRelationType] = useState<string>('asociacion');
    // Cardinalidades y etiqueta de relación
    const [originCard, setOriginCard] = useState<string>('1..*');
    const [destCard, setDestCard] = useState<string>('1..*');
    const [relationVerb, setRelationVerb] = useState<string>('Pertenecen');

    // --- Autosave y referencias reactivas (deben declararse después de nextNumber) ---
    const saveDebounceRef = useRef<number | null>(null);
    const classesRef = useRef<ClassType[]>(classes);
    const relationsRef = useRef<UMLRelation[]>(relations);
    const nextNumberRef = useRef<number>(nextNumber);
    // Flag para evitar eco/loops cuando aplicamos cambios remotos
    const applyingRemoteRef = useRef<boolean>(false);
    useEffect(() => { classesRef.current = classes; }, [classes]);
    useEffect(() => { relationsRef.current = relations; }, [relations]);
    useEffect(() => { nextNumberRef.current = nextNumber; }, [nextNumber]);

    // Auto-save when classes or relations change (but not when applying remote changes)
    useEffect(() => {
        console.log('useEffect autosave triggered. Classes:', classes.length, 'Relations:', relations.length, 'applyingRemote:', applyingRemoteRef.current, 'graph:', !!graph, 'paper:', !!paper);

        // Don't auto-save if we're applying remote changes
        if (applyingRemoteRef.current) {
            console.log('Skipping autosave - applying remote changes');
            return;
        }

        // Only save if we have actual content and we're not in an initial load state
        if ((classes.length > 0 || relations.length > 0) && graph && paper) {
            console.log('State changed, scheduling autosave... Classes:', classes.length, 'Relations:', relations.length);
            scheduleAutoSave();
        } else {
            console.log('Not scheduling autosave - conditions not met');
        }
    }, [classes, relations]);

    const buildModelForAutosave = (): DiagramModel => {
        const classesNodes: UMLClassNode[] = classesRef.current.map(c => {
            let size: { width: number; height: number } | undefined = undefined;
            try {
                if (c.element && (c.element as any).size) {
                    const s = (c.element as any).size();
                    size = { width: s.width, height: s.height };
                }
            } catch { }
            return {
                id: `c-${c.displayId}`,
                displayId: c.displayId,
                name: c.name,
                position: { x: c.x, y: c.y },
                size,
                attributes: c.attributes.map(line => {
                    const [n, ...rest] = line.split(':');
                    return { name: (n || '').trim(), type: (rest.join(':') || '').trim() };
                }),
                methods: c.methods.map(line => {
                    const namePart = line.replace(/\(.*\)/, '').trim();
                    const name = namePart.split(':')[0].trim();
                    const returns = (line.includes(':') ? line.split(':').slice(1).join(':') : 'void').trim();
                    return { name, returns };
                })
            };
        });
        return {
            version: 1,
            nextDisplayId: nextNumberRef.current,
            classes: classesNodes,
            relations: relationsRef.current
        };
    };

    const scheduleAutoSave = () => {
        try {
            // Only send updates if not applying remote changes
            if (applyingRemoteRef.current) return;

            if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current);
            const pidRaw = projectId ? Number(projectId) : Number(getActiveProjectId() || 0);
            if (!pidRaw) return;

            saveDebounceRef.current = window.setTimeout(() => {
                // Double check we're not in the middle of applying remote changes
                if (applyingRemoteRef.current) return;

                const fullModel = buildModelForAutosave();
                const payload: DiagramUpdate = {
                    projectId: pidRaw,
                    userId: Number(localStorage.getItem('userId') || 0),
                    diagramData: fullModel,
                    changeType: 'autosave',
                    elementId: undefined,
                    timestamp: new Date().toISOString()
                };

                console.log('Enviando autosave para proyecto:', pidRaw);
                try {
                    if (socketService.isConnected()) {
                        socketService.sendDiagramUpdate(payload);
                    } else {
                        console.warn('Socket no conectado, no se puede enviar autosave');
                    }
                } catch (err) {
                    console.error('Error enviando autosave:', err);
                }
            }, 900);
        } catch (err) {
            console.error('Error en scheduleAutoSave:', err);
        }
    };

    // Normaliza atributos sugeridos para clases: garantiza 'id' propio y elimina llaves foráneas
    const normalizeSuggestedClassAttributes = (
        _currentClassName: string,
        suggested: Array<{ name: string; type: string; reason?: string }>,
        allClassNames: string[]
    ): Array<{ name: string; type: string }> => {
        const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
        const classSet = new Set(allClassNames.map(norm));
        // const self = norm(currentClassName); // reservado para posibles reglas futuras

        const isForeignKeyName = (attrName: string) => {
            const n = norm(attrName);
            if (n === 'id') return false; // propio id
            // patrones comunes de FK
            if (/(^id[a-z0-9_]+)|([a-z0-9_]+id$)/i.test(attrName)) {
                // Si el prefijo/sufijo coincide con alguna clase conocida, trátalo como FK
                for (const cn of classSet) {
                    if (n === `${cn}id` || n === `id${cn}`) return true;
                }
                // heurística: nombres tipo userId, order_id
                return true;
            }
            // referencias por nombre de clase explícita
            for (const cn of classSet) {
                if (n === `${cn}fk` || n === `fk${cn}`) return true;
            }
            return false;
        };

        // 1) eliminar duplicados por nombre (case-insensitive)
        const seen = new Set<string>();
        let filtered = suggested.filter(a => {
            const key = norm(a.name);
            if (!key) return false;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // 2) quitar llaves foráneas hacia otras clases
        filtered = filtered.filter(a => !isForeignKeyName(a.name));

        // 3) garantizar atributo 'id' propio al inicio
        const hasId = filtered.some(a => norm(a.name) === 'id');
        if (!hasId) {
            filtered = [{ name: 'id', type: 'Int' }, ...filtered];
        }

        // 4) si el atributo 'id' existe pero sin tipo, darle uno por defecto
        filtered = filtered.map(a => norm(a.name) === 'id' ? { name: a.name, type: a.type?.trim() || 'Int' } : { name: a.name, type: a.type });

        return filtered;
    };

    // Agregar una clase sugerida por IA al diagrama (visible para todos via WebSocket)
    const addSuggestedClass = (suggestion: ClassSuggestion, forcedDisplayId?: number) => {
        if (!graph || !(myRole === 'creador' || myRole === 'editor')) return;
        const name = (suggestion.name || '').trim() || 'Clase';
        if (!name) return;
        // evita duplicar por nombre
        if (classesRef.current.some(c => c.name.toLowerCase() === name.toLowerCase())) return;

        const id = Date.now();
        const x = 120 + classesRef.current.length * 60;
        const y = 120 + classesRef.current.length * 60;
        const displayId = typeof forcedDisplayId === 'number' ? forcedDisplayId : nextNumberRef.current;
        // Normalizar atributos: agregar 'id' propio y quitar FKs hacia otras clases
        const allNames = [
            ...classesRef.current.map(c => c.name),
            ...classRecoList.map(s => s.name)
        ];
        const normalizedAttrs = normalizeSuggestedClassAttributes(name, (suggestion.attributes || []), allNames);
        const attributes = normalizedAttrs.map(a => `${a.name}: ${a.type}`);
        const methods: string[] = [];

        const labelText = `${name}\n-----------------------\n${attributes.join('\n')}`;
        const fontSize = 12;
        const paddingX = 20; const paddingY = 30;
        const lines = labelText.split('\n');
        let maxLineWidth = 0; lines.forEach(line => { const m = measureText(line, fontSize); if (m.width > maxLineWidth) maxLineWidth = m.width; });
        const width = Math.max(220, maxLineWidth + paddingX);
        const height = fontSize * lines.length + paddingY;

        const rect = new joint.shapes.standard.Rectangle();
        rect.position(x, y);
        rect.resize(width, height);
        rect.attr({
            body: { fill: '#fff', stroke: '#3986d3', strokeWidth: 2, rx: 20, ry: 20, filter: { name: 'dropShadow', args: { dx: 0, dy: 2, blur: 2, color: '#3986d3', opacity: 0.15 } } },
            label: { text: labelText, fontWeight: 'bold', fontSize, fill: '#2477c3', fontFamily: 'monospace', xAlignment: 'middle' },
            idBg: { x: 10, y: 10, width: 26, height: 18, fill: '#2477c3', rx: 4, ry: 4 },
            idBadge: { text: String(displayId), x: 23, y: 23, fontSize: 12, fontWeight: 'bold', fill: '#ffffff', textAnchor: 'middle' }
        });
        rect.markup = [
            { tagName: 'rect', selector: 'body' },
            { tagName: 'text', selector: 'label' },
            { tagName: 'rect', selector: 'idBg' },
            { tagName: 'text', selector: 'idBadge' },
            {
                tagName: 'g', children: [
                    { tagName: 'text', selector: 'editIcon', className: 'edit-btn', attributes: { x: width - 55, y: 22, fontSize: 20, fill: '#007bff', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '⚙️' },
                    { tagName: 'text', selector: 'deleteIcon', className: 'delete-btn', attributes: { x: width - 30, y: 22, fontSize: 20, fill: '#dc3545', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '❌' }
                ]
            }
        ];
        rect.addTo(graph);
        clampElementInside(rect);

        setClasses(prev => [...prev, { id, name, x, y, displayId, attributes, methods, element: rect }]);
        // Asegurar avance del contador (evita duplicados en inserciones rápidas o en lote)
        setNextNumber(n => Math.max(n, displayId + 1));

        const pidNum = projectId ? Number(projectId) : Number(getActiveProjectId() || 0);
        if (pidNum) {
            const selfId = Number(localStorage.getItem('userId') || 0);
            const selfName = getUserDisplay(selfId);
            addActivity(String(pidNum), { type: 'create_class', message: `${selfName} creó clase #${displayId} (${name})`, byUserId: selfId, byName: selfName });
            setActivities(getActivities(String(pidNum)));
            try {
                const newNode: UMLClassNode = { id: `c-${displayId}`, displayId, name, position: { x, y }, size: { width, height }, attributes: attributes.map((line: string) => parseAttrString(line)), methods: [] };
                const payload: DiagramUpdate = { projectId: pidNum, userId: Number(localStorage.getItem('userId') || 0), diagramData: { node: newNode }, changeType: 'create_class', elementId: displayId, timestamp: new Date().toISOString() };
                try { if (socketService.isConnected() && !socketService.isInProject(pidNum)) socketService.joinProject(pidNum); } catch { }
                socketService.sendDiagramUpdate(payload);
                scheduleAutoSave();
            } catch { }
        }
    };

    // Agregar todas las clases sugeridas y luego pedir a la IA relaciones y dibujarlas
    const addAllSuggestedClasses = async () => {
        if (!(myRole === 'creador' || myRole === 'editor')) return;
        if (!graph) return;
        if (classRecoList.length === 0) return;

        try {
            setClassRecoLoading(true);
            // 1) Agregar clases (evitar duplicados por nombre ya existentes)
            const existingNames = new Set(classesRef.current.map(c => c.name.toLowerCase()));
            let nextId = nextNumberRef.current;
            for (const s of classRecoList) {
                if (!s?.name) continue;
                if (existingNames.has(s.name.toLowerCase())) continue;
                addSuggestedClass(s, nextId);
                nextId += 1;
                existingNames.add(s.name.toLowerCase());
            }

            // 2) Esperar un poco a que React/JointJS terminen de insertar
            await new Promise(res => setTimeout(res, 350));

            // 3) Pedir relaciones recomendadas y aplicarlas
            if (projectId) {
                try {
                    const proj = await projectApi.getProjectById(Number(projectId));
                    const title = proj?.name || 'Proyecto';
                    const names = classesRef.current.map(c => c.name);
                    const rels = await suggestRelationsFromProjectTitle(title, names);
                    // dedupe
                    const key = (r: RelationSuggestion) => `${r.originName}__${r.destName}__${r.relationType || 'asociacion'}__${r.originCard || ''}__${r.destCard || ''}__${r.verb || ''}`;
                    const seen = new Set<string>();
                    const filtered = (rels || []).filter(r => {
                        const k = key(r); if (seen.has(k)) return false; seen.add(k); return true;
                    });
                    // Aplicar
                    for (const r of filtered) {
                        applySuggestedRelation(r);
                    }
                } catch (e) {
                    console.error('No se pudieron obtener/aplicar relaciones sugeridas tras agregar clases:', e);
                }
            }
        } finally {
            setClassRecoLoading(false);
        }
    };

    // Resaltar clases cuando se escribe el número de origen/destino
    useEffect(() => {
        classes.forEach(cls => {
            const isOrigin = originNum && Number(originNum) === cls.displayId;
            const isDest = destNum && Number(destNum) === cls.displayId;
            if (cls.element) {
                cls.element.attr('body/stroke', isOrigin || isDest ? '#f39c12' : '#3986d3');
                cls.element.attr('body/strokeWidth', isOrigin || isDest ? 4 : 2);
            }
        });
    }, [originNum, destNum, classes]);

    useEffect(() => {
        if (!diagramaRef.current) return;
        const g = new joint.dia.Graph();
        const paperInstance = new joint.dia.Paper({
            el: diagramaRef.current,
            model: g,
            width: '100%',
            height: '100%',
            gridSize: 10,
            drawGrid: true,
            background: { color: '#fdfdfd' },
            // Interactividad dependiente del rol: vista = solo lectura
            interactive: function (this: any) {
                const canEdit = roleRef.current === 'creador' || roleRef.current === 'editor';
                if (!canEdit) return false;
                // Habilitar movimientos/edición estándar cuando se puede editar
                return {
                    elementMove: true,
                    linkMove: true,
                    labelMove: true,
                    arrowheadMove: true,
                    vertexAdd: true,
                    vertexMove: true,
                    vertexRemove: true
                } as any;
            },
        });

        setGraph(g);
        setPaper(paperInstance);
        graphRef.current = g;
        paperRef.current = paperInstance;

        // connect socket if token available
        try {
            const token = localStorage.getItem('token');
            if (token) {
                console.log('Inicializando conexión WebSocket...');
                socketService.connect(token);

                // Join immediately if already connected (navigation from another page)
                if (projectId && socketService.isConnected()) {
                    console.log('Socket ya conectado, uniéndose al proyecto...');
                    socketService.joinProject(Number(projectId));
                }

                // also join on future connects (first time or reconnects)
                const onConnect = () => {
                    console.log('Socket conectado, uniéndose al proyecto:', projectId);
                    if (projectId) {
                        setTimeout(() => {
                            socketService.joinProject(Number(projectId));
                        }, 100); // Small delay to ensure connection is stable
                    }
                };

                socketService.on('connect', onConnect);

                // Handle connection errors
                socketService.on('connect_error', (error: any) => {
                    console.error('Error de conexión WebSocket:', error);
                });

                // Handle project join confirmation
                socketService.on('joined-project', (joinedProjectId: number) => {
                    console.log('Confirmación: Unido al proyecto', joinedProjectId);
                });

                // Notificar en actividades cuando un usuario entra o sale del proyecto
                socketService.on('user-joined', (payload: any) => {
                    try {
                        const pid = projectId ? Number(projectId) : undefined;
                        if (!pid) return;
                        if (payload?.projectId && payload.projectId !== pid) return;
                        const selfId = Number(localStorage.getItem('userId') || 0);
                        if (payload?.userId === selfId) return; // no registrar mi propio ingreso
                        const display = payload?.email || payload?.userEmail || payload?.correo || payload?.name || payload?.userName || getUserDisplay(payload?.userId);
                        addActivity(String(pid), { type: 'user_joined', message: `${display} se unió al proyecto`, byUserId: payload?.userId, byName: display });
                        setActivities(getActivities(String(pid)));
                    } catch { }
                });
                socketService.on('user-left', (payload: any) => {
                    try {
                        const pid = projectId ? Number(projectId) : undefined;
                        if (!pid) return;
                        if (payload?.projectId && payload.projectId !== pid) return;
                        const selfId = Number(localStorage.getItem('userId') || 0);
                        if (payload?.userId === selfId) return; // no registrar mi propia salida
                        const display = payload?.email || payload?.userEmail || payload?.correo || payload?.name || payload?.userName || getUserDisplay(payload?.userId);
                        addActivity(String(pid), { type: 'user_left', message: `${display} salió del proyecto`, byUserId: payload?.userId, byName: display });
                        setActivities(getActivities(String(pid)));
                    } catch { }
                });

                // clean listener on unmount
                (paperInstance as any).__socketOnConnect = onConnect;
            } else {
                console.warn('No hay token disponible para conectar WebSocket');
            }
        } catch (err) {
            console.error('Error inicializando WebSocket:', err);
        }

        paperInstance.on('element:pointerclick', function (cellView: any, evt: any) {
            const target = evt.target as Element;
            const isEdit = !!(target && (target as Element).closest && (target as Element).closest('.edit-btn'));
            const isDelete = !!(target && (target as Element).closest && (target as Element).closest('.delete-btn'));

            if (isEdit) {
                if (!(roleRef.current === 'creador' || roleRef.current === 'editor')) return;
                // Abrir modal edición
                const element = cellView.model;
                const labelText = element.attr('label/text') as string;
                const partes = labelText.split('-----------------------');
                const nombreActual = partes[0]?.trim() || '';
                const atributosActualLines = partes[1]?.split('\n').map(a => a.trim()).filter(a => a) || [];
                const metodosActualLines = partes[2]?.split('\n').map(m => m.trim()).filter(m => m) || [];
                const atributosActual = atributosActualLines.map((line: string) => {
                    const [n, ...rest] = line.split(':');
                    return { name: (n || '').trim(), type: (rest.join(':') || '').trim() };
                });
                const metodosActual = metodosActualLines.map((line: string) => {
                    // admite "metodo()" o "metodo(): Tipo"
                    const namePart = line.replace(/\(.*\)/, '').trim();
                    const name = namePart.split(':')[0].trim();
                    const returns = (line.includes(':') ? line.split(':').slice(1).join(':') : 'void').trim();
                    return { name, returns };
                });

                setEditModal({
                    visible: true,
                    element,
                    title: nombreActual,
                    attributesArr: atributosActual,
                    methodsArr: metodosActual
                });
            }
            if (isDelete) {
                if (!(roleRef.current === 'creador' || roleRef.current === 'editor')) return;
                // Elimina del graph y estado
                cellView.model.remove();
                // quitar clase
                let removedDisplayId: number | null = null;
                setClasses(current => {
                    const cls = current.find(c => c.element === cellView.model);
                    removedDisplayId = cls?.displayId ?? null;
                    return current.filter(c => c.element !== cellView.model);
                });
                // quitar relaciones asociadas y links del graph
                if (removedDisplayId != null && graph) {
                    setRelations(prev => prev.filter(r => r.fromDisplayId !== removedDisplayId && r.toDisplayId !== removedDisplayId));
                    try {
                        // Evitar que los remove() de links disparen emisión de delete_relation
                        suppressLinkEmitRef.current = true;
                        const links = (graph as any).getLinks ? (graph as any).getLinks() : [];
                        links.forEach((l: any) => {
                            const sId = l.get('source')?.id;
                            const tId = l.get('target')?.id;
                            const elIds = [sId, tId];
                            const belongs = classes.some(c => c.element && elIds.includes((c.element as any).id) && (c.displayId === removedDisplayId));
                            if (belongs) l.remove();
                        });
                        suppressLinkEmitRef.current = false;
                    } catch { }
                }
                setEditModal(editModal => ({ ...editModal, visible: false }));
                // No emitir aquí para evitar duplicado; onRemove (element) ya emite delete_element
            }
        });
        // Broadcast selection when user starts interacting
        paperInstance.on('element:pointerdown', function (cellView: any) {
            try {
                const pid = projectId ? Number(projectId) : undefined;
                if (!pid) return;
                const cls = classesRef.current.find(c => c.element === cellView.model);
                const displayId = cls?.displayId;
                if (displayId !== undefined) {
                    socketService.sendElementSelect({ projectId: pid, elementId: displayId, elementType: 'class' });
                }
            } catch { }
        });

        // Handle clicks on relation delete buttons
        paperInstance.on('link:pointerclick', function (linkView: any, evt: any) {
            const target = evt.target as Element;
            const isDeleteRelation = !!(target && (target as Element).closest && (target as Element).closest('.delete-relation-btn'));

            if (isDeleteRelation) {
                // Verificar permisos
                if (!(roleRef.current === 'creador' || roleRef.current === 'editor')) return;

                const link = linkView.model;
                const sourceElement = link.getSourceElement();
                const targetElement = link.getTargetElement();

                if (sourceElement && targetElement) {
                    try {
                        // Encontrar las clases correspondientes
                        const sourceClass = classesRef.current.find(c => c.element === sourceElement);
                        const targetClass = classesRef.current.find(c => c.element === targetElement);

                        if (sourceClass && targetClass) {
                            // Eliminar del graph
                            suppressLinkEmitRef.current = true;
                            link.remove();
                            suppressLinkEmitRef.current = false;

                            // Eliminar del estado de relaciones
                            setRelations(prev => prev.filter(r =>
                                !((r.fromDisplayId === sourceClass.displayId && r.toDisplayId === targetClass.displayId) ||
                                    (r.fromDisplayId === targetClass.displayId && r.toDisplayId === sourceClass.displayId))
                            ));

                            // Registrar actividad y broadcast
                            const pidNum = projectId ? Number(projectId) : Number(getActiveProjectId() || 0);
                            if (pidNum) {
                                const selfId = Number(localStorage.getItem('userId') || 0);
                                const selfName = getUserDisplay(selfId);
                                addActivity(String(pidNum), {
                                    type: 'delete_relation',
                                    message: `${selfName} eliminó relación entre #${sourceClass.displayId} (${sourceClass.name}) y #${targetClass.displayId} (${targetClass.name})`,
                                    byUserId: selfId,
                                    byName: selfName
                                });
                                setActivities(getActivities(String(pidNum)));

                                try {
                                    const selfId = Number(localStorage.getItem('userId') || 0);
                                    const payload = {
                                        projectId: pidNum,
                                        userId: selfId,
                                        diagramData: {
                                            fromDisplayId: sourceClass.displayId,
                                            toDisplayId: targetClass.displayId,
                                            fromName: sourceClass.name,
                                            toName: targetClass.name
                                        },
                                        changeType: 'delete_relation',
                                        elementId: `${sourceClass.displayId}-${targetClass.displayId}`,
                                        timestamp: new Date().toISOString()
                                    };
                                    socketService.sendDiagramUpdate(payload);
                                } catch { }
                            }
                        }
                    } catch (error) {
                        console.error('Error eliminando relación:', error);
                    }
                }
            }
        });

        // Listen for remote diagram updates
        socketService.on('diagram-updated', (data: any) => {
            try {
                console.log('Received diagram update:', data);
                if (!data) {
                    console.log('No data in update');
                    return;
                }
                // Use refs to avoid stale state in closure
                const gInst = graphRef.current;
                const pInst = paperRef.current;
                if (!gInst || !pInst) {
                    console.log('Graph or paper not available yet');
                    return;
                }

                // Ignore updates from ourselves
                const currentUserId = Number(localStorage.getItem('userId') || 0);
                if (data.userId === currentUserId) {
                    console.log('Ignoring update from self');
                    return;
                }

                // If update comes from other user, render model
                const incoming = data.diagramData;
                if (!incoming) {
                    console.log('No diagram data in update');
                    return;
                }

                // If it's our project
                const pid = projectId ? Number(projectId) : undefined;
                if (pid && data.projectId === pid) {
                    console.log('Applying remote update for project:', pid, 'changeType:', data.changeType);
                    console.log('Current graph elements count:', gInst.getElements().length);
                    console.log('Incoming data structure:', incoming);
                    // Ignore autosave for rendering (it's for persistence only)
                    if (data.changeType === 'autosave') {
                        return;
                    }

                    // Registrar actividad de cambios remotos con autor y tipo
                    try {
                        const actorName = (data as any)?.userEmail || (data as any)?.email || (data as any)?.userName || getUserDisplay((data as any)?.userId);
                        let msg = '';
                        switch (data.changeType) {
                            case 'move': {
                                const d = incoming as any;
                                if (d && typeof d.displayId === 'number') msg = `movió clase #${d.displayId}`; else msg = 'movió elementos';
                                break;
                            }
                            case 'create_class': {
                                const n = (incoming as any)?.node;
                                msg = n ? `creó clase #${n.displayId} (${n.name || 'Clase'})` : 'creó una clase';
                                break;
                            }
                            case 'create_relation': {
                                const r = (incoming as any)?.relation;
                                msg = r ? `creó relación ${r.type || ''} #${r.fromDisplayId}→#${r.toDisplayId}` : 'creó una relación';
                                break;
                            }
                            case 'delete_relation': {
                                const r = incoming as any;
                                msg = (r && r.fromDisplayId != null && r.toDisplayId != null) ? `eliminó relación #${r.fromDisplayId}↔#${r.toDisplayId}` : 'eliminó una relación';
                                break;
                            }
                            case 'edit_element': {
                                const d = incoming as any;
                                msg = d?.displayId != null ? `editó clase #${d.displayId}${d?.name ? ` (${d.name})` : ''}` : 'editó un elemento';
                                break;
                            }
                            case 'delete_element': {
                                const d = incoming as any;
                                msg = d?.displayId != null ? `eliminó clase #${d.displayId}` : 'eliminó un elemento';
                                break;
                            }
                            case 'import': {
                                msg = 'importó un diagrama';
                                break;
                            }
                            case 'edit_relation': {
                                msg = 'editó una relación';
                                break;
                            }
                            default: {
                                msg = `realizó cambios (${data.changeType || 'desconocido'})`;
                            }
                        }
                        addActivity(String(pid), { type: 'change', message: `${actorName} ${msg}`, byUserId: (data as any)?.userId, byName: actorName });
                        setActivities(getActivities(String(pid)));
                    } catch { }
                    // Fast-path for move updates: only patch positions to avoid total re-render
                    if (data.changeType === 'move' && incoming && typeof incoming === 'object') {
                        try {
                            applyingRemoteRef.current = true;
                            pInst.freeze();
                            // Minimal payload support: { displayId, x, y }
                            if (typeof (incoming as any).displayId === 'number' && typeof (incoming as any).x === 'number' && typeof (incoming as any).y === 'number') {
                                const { displayId, x, y } = incoming as any;
                                const updated: ClassType[] = classesRef.current.map(c => {
                                    if (c.displayId === displayId && c.element) {
                                        try { (c.element as any).position(x, y); } catch { }
                                        return { ...c, x, y };
                                    }
                                    return c;
                                });
                                setClasses(updated);
                            } else if (Array.isArray((incoming as any).classes)) {
                                const posMap = new Map<number, { x: number; y: number }>();
                                (incoming.classes as any[]).forEach((c: any) => {
                                    if (typeof c?.displayId === 'number' && typeof c?.x === 'number' && typeof c?.y === 'number') {
                                        posMap.set(c.displayId, { x: c.x, y: c.y });
                                    }
                                });
                                // Update elements positions directly
                                const updated: ClassType[] = classesRef.current.map(c => {
                                    const u = posMap.get(c.displayId);
                                    if (u && c.element) {
                                        try { (c.element as any).position(u.x, u.y); } catch { }
                                        return { ...c, x: u.x, y: u.y };
                                    }
                                    return c;
                                });
                                setClasses(updated);
                            }
                            setTimeout(() => {
                                try {
                                    pInst.unfreeze();
                                    // ensure views update
                                    gInst.getElements().forEach(el => {
                                        const v = pInst.findViewByModel(el);
                                        v?.update();
                                    });
                                } catch { }
                                applyingRemoteRef.current = false;
                            }, 50);
                        } catch (e) {
                            console.error('Error applying move update:', e);
                            applyingRemoteRef.current = false;
                        }
                        return;
                    }

                    // Fast-path create_class: add only new class if payload matches
                    if (data.changeType === 'create_class' && incoming && typeof incoming === 'object') {
                        try {
                            applyingRemoteRef.current = true;
                            pInst.freeze();
                            if ((incoming as any).node && (incoming as any).node.displayId) {
                                const node = (incoming as any).node as UMLClassNode;
                                const newCls = addClassNode(node, gInst, roleRef.current === 'creador' || roleRef.current === 'editor');
                                setClasses(prev => [...prev, newCls]);
                                setNextNumber(n => Math.max(n, (node.displayId || 0) + 1));
                            }
                        } catch (e) { console.error('Error applying create_class:', e); }
                        finally {
                            try { pInst.unfreeze(); } catch { }
                            applyingRemoteRef.current = false;
                        }
                        return;
                    }
                    // Fast-path create_relation: add a single link if possible
                    if (data.changeType === 'create_relation' && incoming && typeof incoming === 'object') {
                        try {
                            applyingRemoteRef.current = true;
                            pInst.freeze();
                            if ((incoming as any).relation && (incoming as any).relation.fromDisplayId) {
                                addRelationLink((incoming as any).relation as UMLRelation, gInst);
                            }
                        } catch (e) { console.error('Error applying create_relation:', e); }
                        finally {
                            try { pInst.unfreeze(); } catch { }
                            applyingRemoteRef.current = false;
                        }
                        return;
                    }
                    // Fast-path delete_relation: remove a single link if provided as minimal payload
                    if (data.changeType === 'delete_relation' && incoming && typeof incoming === 'object') {
                        try {
                            applyingRemoteRef.current = true;
                            pInst.freeze();
                            const fromDisplayId = (incoming as any).fromDisplayId as number | undefined;
                            const toDisplayId = (incoming as any).toDisplayId as number | undefined;
                            if (typeof fromDisplayId === 'number' && typeof toDisplayId === 'number') {
                                // Update state
                                setRelations(prev => prev.filter(r => !(r.fromDisplayId === fromDisplayId && r.toDisplayId === toDisplayId)));
                                // Remove the specific link from the graph
                                try {
                                    const fromEl = classesRef.current.find(c => c.displayId === fromDisplayId)?.element as any;
                                    const toEl = classesRef.current.find(c => c.displayId === toDisplayId)?.element as any;
                                    if (fromEl && toEl) {
                                        const links = (gInst as any).getLinks ? (gInst as any).getLinks() : [];
                                        links.forEach((l: any) => {
                                            const sId = l.get('source')?.id; const tId = l.get('target')?.id;
                                            if (sId === fromEl.id && tId === toEl.id) l.remove();
                                        });
                                    }
                                } catch { }
                            }
                        } catch (e) { console.error('Error applying delete_relation:', e); }
                        finally {
                            try { pInst.unfreeze(); } catch { }
                            applyingRemoteRef.current = false;
                        }
                        return;
                    }
                    // Fast-path edit_element: update only one class (label/size)
                    if (data.changeType === 'edit_element' && incoming && typeof incoming === 'object') {
                        try {
                            applyingRemoteRef.current = true;
                            const displayId = (incoming as any).displayId as number | undefined;
                            if (!displayId) return;
                            const name = (incoming as any).name as string | undefined;
                            const attributes = (incoming as any).attributes as UMLAttribute[] | undefined;
                            const methods = (incoming as any).methods as UMLMethod[] | undefined;
                            const size = (incoming as any).size as { width: number; height: number } | undefined;
                            const cls = classesRef.current.find(c => c.displayId === displayId);
                            if (!cls || !cls.element) return;
                            pInst.freeze();
                            const newName = name ?? cls.name;
                            const newAttrs: UMLAttribute[] = attributes ?? cls.attributes.map(parseAttrString);
                            const newMethods: UMLMethod[] = methods ?? cls.methods.map(parseMethodString);
                            const labelText = toLabelText(newName, newAttrs);
                            let width = size?.width, height = size?.height;
                            if (typeof width !== 'number' || typeof height !== 'number') {
                                const fontSize = 12; const paddingX = 20; const paddingY = 30;
                                const lines = labelText.split('\n');
                                let maxLineWidth = 0; lines.forEach(line => { const m = measureText(line, fontSize); if (m.width > maxLineWidth) maxLineWidth = m.width; });
                                width = Math.max(220, maxLineWidth + paddingX); height = fontSize * lines.length + paddingY;
                            }
                            cls.element.attr({
                                label: { text: labelText, fontWeight: 'bold', fontSize: 12, fill: '#2477c3', fontFamily: 'monospace', xAlignment: 'middle' },
                                idBg: { x: 10, y: 10, width: 26, height: 18, fill: '#2477c3', rx: 4, ry: 4 },
                                idBadge: { text: String(displayId), x: 23, y: 23, fontSize: 12, fontWeight: 'bold', fill: '#ffffff', textAnchor: 'middle' }
                            });
                            cls.element.resize(width!, height!);
                            // reubicar botones
                            const baseMarkup: any[] = [
                                { tagName: 'rect', selector: 'body' },
                                { tagName: 'text', selector: 'label' },
                                { tagName: 'rect', selector: 'idBg' },
                                { tagName: 'text', selector: 'idBadge' },
                                {
                                    tagName: 'g', children: [
                                        { tagName: 'text', selector: 'editIcon', className: 'edit-btn', attributes: { class: 'edit-btn', x: (width! - 55), y: 22, fontSize: 20, fill: '#007bff', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '⚙️' },
                                        { tagName: 'text', selector: 'deleteIcon', className: 'delete-btn', attributes: { class: 'delete-btn', x: (width! - 30), y: 22, fontSize: 20, fill: '#dc3545', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '❌' }
                                    ]
                                }
                            ];
                            (cls.element as any).markup = baseMarkup;
                            clampElementInside(cls.element);
                            // actualizar estado
                            const newAttrsText = newAttrs.map(a => `${a.name}: ${a.type}`);
                            const newMethodsText = newMethods.map(m => `${m.name}(): ${m.returns}`);
                            setClasses(prev => prev.map(c => c.displayId === displayId ? { ...c, name: newName, attributes: newAttrsText, methods: newMethodsText } : c));
                        } catch (e) { console.error('Error applying edit_element:', e); }
                        finally {
                            try { pInst.unfreeze(); } catch { }
                            applyingRemoteRef.current = false;
                        }
                        return;
                    }
                    // Fast-path delete_element: remove only one class
                    if (data.changeType === 'delete_element' && incoming && typeof incoming === 'object') {
                        try {
                            applyingRemoteRef.current = true;
                            const displayId = (incoming as any).displayId as number | undefined;
                            if (!displayId) return;
                            const cls = classesRef.current.find(c => c.displayId === displayId);
                            if (!cls || !cls.element) return;
                            pInst.freeze();
                            // remove element from graph
                            try { (cls.element as any).remove(); } catch { }
                            // remove links attached to it
                            try {
                                suppressLinkEmitRef.current = true;
                                const links = (gInst as any).getLinks ? (gInst as any).getLinks() : [];
                                const elId = (cls.element as any).id;
                                links.forEach((l: any) => {
                                    const sId = l.get('source')?.id; const tId = l.get('target')?.id;
                                    if (sId === elId || tId === elId) l.remove();
                                });
                                suppressLinkEmitRef.current = false;
                            } catch { }
                            // update state
                            setClasses(prev => prev.filter(c => c.displayId !== displayId));
                            setRelations(prev => prev.filter(r => r.fromDisplayId !== displayId && r.toDisplayId !== displayId));
                        } catch (e) { console.error('Error applying delete_element:', e); }
                        finally {
                            try { pInst.unfreeze(); } catch { }
                            applyingRemoteRef.current = false;
                        }
                        return;
                    }

                    // Fast-path delete_relation: remove only specific relation
                    if (data.changeType === 'delete_relation' && incoming && typeof incoming === 'object') {
                        try {
                            applyingRemoteRef.current = true;
                            const fromDisplayId = (incoming as any).fromDisplayId as number | undefined;
                            const toDisplayId = (incoming as any).toDisplayId as number | undefined;

                            if (fromDisplayId == null || toDisplayId == null) return;

                            // Find the classes
                            const sourceClass = classesRef.current.find(c => c.displayId === fromDisplayId);
                            const targetClass = classesRef.current.find(c => c.displayId === toDisplayId);

                            if (!sourceClass?.element || !targetClass?.element) return;

                            pInst.freeze();

                            // Find and remove the link from graph
                            try {
                                suppressLinkEmitRef.current = true;
                                const links = (gInst as any).getLinks ? (gInst as any).getLinks() : [];
                                const sourceId = (sourceClass.element as any).id;
                                const targetId = (targetClass.element as any).id;

                                links.forEach((l: any) => {
                                    const sourceElementId = l.get('source')?.id;
                                    const targetElementId = l.get('target')?.id;
                                    if ((sourceElementId === sourceId && targetElementId === targetId) ||
                                        (sourceElementId === targetId && targetElementId === sourceId)) {
                                        l.remove();
                                    }
                                });
                                suppressLinkEmitRef.current = false;
                            } catch { }

                            // Update relations state
                            setRelations(prev => prev.filter(r =>
                                !((r.fromDisplayId === fromDisplayId && r.toDisplayId === toDisplayId) ||
                                    (r.fromDisplayId === toDisplayId && r.toDisplayId === fromDisplayId))
                            ));

                        } catch (e) {
                            console.error('Error applying delete_relation:', e);
                        } finally {
                            try { pInst.unfreeze(); } catch { }
                            applyingRemoteRef.current = false;
                        }
                        return;
                    }

                    // Set flag to prevent echo/loops
                    applyingRemoteRef.current = true;

                    // Check if it's a structured model with classes array
                    if (incoming && typeof incoming === 'object' && Array.isArray(incoming.classes)) {
                        console.log('Processing structured model with', incoming.classes.length, 'classes');

                        // Force paper to freeze before clearing
                        try {
                            pInst.freeze();
                            console.log('Paper frozen for update');
                        } catch { }

                        // Use renderFromModel for structured data
                        renderFromModel(incoming, gInst, roleRef.current === 'creador' || roleRef.current === 'editor');

                        // Force complete re-render with proper timing
                        setTimeout(() => {
                            try {
                                console.log('Unfreezing paper and forcing update...');
                                pInst.unfreeze();

                                // Force paper to update its view
                                const elements = gInst.getElements();
                                console.log('Elements after render:', elements.length);

                                // Force redraw all elements
                                elements.forEach(element => {
                                    const view = pInst.findViewByModel(element);
                                    if (view) {
                                        view.update();
                                    }
                                });

                                // Force a complete redraw of the paper
                                try {
                                    (pInst as any).dumpViews();
                                    (pInst as any).renderViews();
                                } catch { }

                                console.log('Forced paper update completed');

                            } catch (err) {
                                console.error('Error during paper update:', err);
                            }
                            applyingRemoteRef.current = false;
                        }, 200);

                    } else if (typeof incoming === 'string') {
                        // Try to parse JSON string
                        try {
                            console.log('Parsing JSON string data');
                            const parsedData = JSON.parse(incoming);

                            pInst.freeze();

                            if (Array.isArray(parsedData.classes)) {
                                renderFromModel(parsedData, gInst, roleRef.current === 'creador' || roleRef.current === 'editor');
                            } else {
                                // Fallback to joint.js JSON format
                                gInst.fromJSON(parsedData);
                                rebuildStateFromGraph(gInst);
                            }

                            setTimeout(() => {
                                try {
                                    pInst.unfreeze();

                                    // Force redraw
                                    const elements = gInst.getElements();
                                    elements.forEach(element => {
                                        const view = pInst.findViewByModel(element);
                                        if (view) {
                                            view.update();
                                        }
                                    });
                                } catch { }
                                applyingRemoteRef.current = false;
                            }, 200);

                        } catch (parseErr) {
                            console.error('Error parsing JSON:', parseErr);
                            applyingRemoteRef.current = false;
                        }
                    } else {
                        // Fallback: assume it's joint.js format
                        console.log('Applying diagram as joint.js format (fallback)');
                        try {
                            pInst.freeze();
                            gInst.fromJSON(incoming);
                            rebuildStateFromGraph(gInst);

                            setTimeout(() => {
                                try {
                                    pInst.unfreeze();

                                    // Force redraw all elements
                                    const elements = gInst.getElements();
                                    elements.forEach(element => {
                                        const view = pInst.findViewByModel(element);
                                        if (view) {
                                            view.update();
                                        }
                                    });
                                } catch { }
                                applyingRemoteRef.current = false;
                            }, 200);

                        } catch (err) {
                            console.error('Error applying joint.js format:', err);
                            applyingRemoteRef.current = false;
                        }
                    }
                    // Fast-path create_class: add only new class if payload matches
                    if (data.changeType === 'create_class' && incoming && typeof incoming === 'object') {
                        try {
                            applyingRemoteRef.current = true;
                            pInst.freeze();
                            if ((incoming as any).node && (incoming as any).node.displayId) {
                                const node = (incoming as any).node as UMLClassNode;
                                const newCls = addClassNode(node, gInst, roleRef.current === 'creador' || roleRef.current === 'editor');
                                setClasses(prev => [...prev, newCls]);
                                setNextNumber(n => Math.max(n, (node.displayId || 0) + 1));
                            }
                        } catch (e) { console.error('Error applying create_class:', e); }
                        finally {
                            try { pInst.unfreeze(); } catch { }
                            applyingRemoteRef.current = false;
                        }
                        return;
                    }
                    // Fast-path create_relation: add a single link if possible
                    if (data.changeType === 'create_relation' && incoming && typeof incoming === 'object') {
                        try {
                            applyingRemoteRef.current = true;
                            pInst.freeze();
                            if ((incoming as any).relation && (incoming as any).relation.fromDisplayId) {
                                addRelationLink((incoming as any).relation as UMLRelation, gInst);
                            }
                        } catch (e) { console.error('Error applying create_relation:', e); }
                        finally {
                            try { pInst.unfreeze(); } catch { }
                            applyingRemoteRef.current = false;
                        }
                        return;
                    }
                    // Fast-path edit_element: update only one class (label/size)
                    if (data.changeType === 'edit_element' && incoming && typeof incoming === 'object') {
                        try {
                            applyingRemoteRef.current = true;
                            const displayId = (incoming as any).displayId as number | undefined;
                            if (!displayId) return;
                            const name = (incoming as any).name as string | undefined;
                            const attributes = (incoming as any).attributes as UMLAttribute[] | undefined;
                            const methods = (incoming as any).methods as UMLMethod[] | undefined;
                            const size = (incoming as any).size as { width: number; height: number } | undefined;
                            const cls = classesRef.current.find(c => c.displayId === displayId);
                            if (!cls || !cls.element) return;
                            pInst.freeze();
                            const newName = name ?? cls.name;
                            const newAttrs: UMLAttribute[] = attributes ?? cls.attributes.map(parseAttrString);
                            const newMethods: UMLMethod[] = methods ?? cls.methods.map(parseMethodString);
                            const labelText = toLabelText(newName, newAttrs);
                            let width = size?.width, height = size?.height;
                            if (typeof width !== 'number' || typeof height !== 'number') {
                                const fontSize = 12; const paddingX = 20; const paddingY = 30;
                                const lines = labelText.split('\n');
                                let maxLineWidth = 0; lines.forEach(line => { const m = measureText(line, fontSize); if (m.width > maxLineWidth) maxLineWidth = m.width; });
                                width = Math.max(220, maxLineWidth + paddingX); height = fontSize * lines.length + paddingY;
                            }
                            cls.element.attr({
                                label: { text: labelText, fontWeight: 'bold', fontSize: 12, fill: '#2477c3', fontFamily: 'monospace', xAlignment: 'middle' },
                                idBg: { x: 10, y: 10, width: 26, height: 18, fill: '#2477c3', rx: 4, ry: 4 },
                                idBadge: { text: String(displayId), x: 23, y: 23, fontSize: 12, fontWeight: 'bold', fill: '#ffffff', textAnchor: 'middle' }
                            });
                            cls.element.resize(width!, height!);
                            // reubicar botones
                            const baseMarkup: any[] = [
                                { tagName: 'rect', selector: 'body' },
                                { tagName: 'text', selector: 'label' },
                                { tagName: 'rect', selector: 'idBg' },
                                { tagName: 'text', selector: 'idBadge' },
                                {
                                    tagName: 'g', children: [
                                        { tagName: 'text', selector: 'editIcon', className: 'edit-btn', attributes: { class: 'edit-btn', x: (width! - 55), y: 22, fontSize: 20, fill: '#007bff', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '⚙️' },
                                        { tagName: 'text', selector: 'deleteIcon', className: 'delete-btn', attributes: { class: 'delete-btn', x: (width! - 30), y: 22, fontSize: 20, fill: '#dc3545', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '❌' }
                                    ]
                                }
                            ];
                            (cls.element as any).markup = baseMarkup;
                            clampElementInside(cls.element);
                            // actualizar estado
                            const newAttrsText = newAttrs.map(a => `${a.name}: ${a.type}`);
                            const newMethodsText = newMethods.map(m => `${m.name}(): ${m.returns}`);
                            setClasses(prev => prev.map(c => c.displayId === displayId ? { ...c, name: newName, attributes: newAttrsText, methods: newMethodsText } : c));
                        } catch (e) { console.error('Error applying edit_element:', e); }
                        finally {
                            try { pInst.unfreeze(); } catch { }
                            applyingRemoteRef.current = false;
                        }
                        return;
                    }
                    // Fast-path delete_element: remove only one class
                    if (data.changeType === 'delete_element' && incoming && typeof incoming === 'object') {
                        try {
                            applyingRemoteRef.current = true;
                            const displayId = (incoming as any).displayId as number | undefined;
                            if (!displayId) return;
                            const cls = classesRef.current.find(c => c.displayId === displayId);
                            if (!cls || !cls.element) return;
                            pInst.freeze();
                            // remove element from graph
                            try { (cls.element as any).remove(); } catch { }
                            // remove links attached to it
                            try {
                                suppressLinkEmitRef.current = true;
                                const links = (gInst as any).getLinks ? (gInst as any).getLinks() : [];
                                const elId = (cls.element as any).id;
                                links.forEach((l: any) => {
                                    const sId = l.get('source')?.id; const tId = l.get('target')?.id;
                                    if (sId === elId || tId === elId) l.remove();
                                });
                                suppressLinkEmitRef.current = false;
                            } catch { }
                            // update state
                            setClasses(prev => prev.filter(c => c.displayId !== displayId));
                            setRelations(prev => prev.filter(r => r.fromDisplayId !== displayId && r.toDisplayId !== displayId));
                        } catch (e) { console.error('Error applying delete_element:', e); }
                        finally {
                            try { pInst.unfreeze(); } catch { }
                            applyingRemoteRef.current = false;
                        }
                        return;
                    }
                } else {
                    console.log('Update not for current project, ignoring');
                }
            } catch (err) {
                console.error('Error applying remote diagram update:', err);
                applyingRemoteRef.current = false;
            }
        });

        // Cursor moved events (optional visualization)
        socketService.on('cursor-moved', () => {
            // TODO: show remote cursors on canvas (future improvement)
        });
        socketService.on('element-selected', (data: any) => {
            try {
                const pid = projectId ? Number(projectId) : undefined;
                if (!pid || data?.elementId == null) return;
                const gInst = graphRef.current;
                if (!gInst) return;
                const cls = classesRef.current.find(c => c.displayId === Number(data.elementId));
                const el = cls?.element;
                if (!el) return;
                const orig = { stroke: el.attr('body/stroke'), width: el.attr('body/strokeWidth') } as any;
                el.attr('body/stroke', '#f39c12');
                el.attr('body/strokeWidth', 4);
                setTimeout(() => {
                    try {
                        el.attr('body/stroke', orig.stroke || '#3986d3');
                        el.attr('body/strokeWidth', orig.width || 2);
                    } catch { }
                }, 300);
            } catch { }
        });

        return () => {
            try {
                console.log('Limpiando conexiones WebSocket...');
                graphRef.current = null;
                paperRef.current = null;

                // Clean up socket event listeners
                const handler = (paperInstance as any).__socketOnConnect;
                if (handler) {
                    socketService.off('connect', handler);
                }

                // Remove all event listeners for this component
                socketService.off('diagram-updated');
                socketService.off('cursor-moved');
                socketService.off('joined-project');
                socketService.off('connect_error');
                socketService.off('user-joined');
                socketService.off('user-left');

                // Leave current project if we're in one
                if (projectId) {
                    socketService.leaveProject(Number(projectId));
                }

                // Clear auto-save timeout
                if (saveDebounceRef.current) {
                    window.clearTimeout(saveDebounceRef.current);
                }
            } catch (err) {
                console.error('Error durante cleanup:', err);
            }
        };
    }, []);

    // Utilidades para reconstruir estado a partir del Graph
    const ensureClassMarkup = (element: joint.dia.Element, includeButtons: boolean = true) => {
        try {
            // mantener tamaño actual
            const size = (element as any).size ? (element as any).size() : { width: 220, height: 140 };
            const width = size.width || 220;
            // reinyectar botones y badges para edición/eliminación e id
            const base: any[] = [
                { tagName: 'rect', selector: 'body' },
                { tagName: 'text', selector: 'label' },
                { tagName: 'rect', selector: 'idBg' },
                { tagName: 'text', selector: 'idBadge' }
            ];
            if (includeButtons) {
                base.push({
                    tagName: 'g', children: [
                        { tagName: 'text', selector: 'editIcon', className: 'edit-btn', attributes: { class: 'edit-btn', x: width - 55, y: 22, fontSize: 20, fill: '#007bff', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '⚙️' },
                        { tagName: 'text', selector: 'deleteIcon', className: 'delete-btn', attributes: { class: 'delete-btn', x: width - 30, y: 22, fontSize: 20, fill: '#dc3545', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '❌' }
                    ]
                });
            }
            (element as any).markup = base;
        } catch { }
    };

    // Cuando cambia el rol o cargamos el graph/paper, asegúrate de que TODAS las clases existentes
    // tengan los botones de editar/eliminar si el usuario puede editar. Esto arregla el caso donde
    // una clase creada remotamente antes de conocer el rol se renderizó sin botones.
    useEffect(() => {
        if (!graph || !paper) return;
        const canEdit = myRole === 'creador' || myRole === 'editor';
        try {
            paper.freeze();
        } catch { }
        try {
            const elements = (graph as any).getElements ? (graph as any).getElements() : [];
            elements.forEach((el: any) => ensureClassMarkup(el, canEdit));
            // Forzar actualización de las vistas tras reinyectar el markup
            elements.forEach((el: any) => {
                try {
                    const view = paper.findViewByModel(el);
                    view?.update();
                } catch { }
            });
        } catch { }
        try {
            paper.unfreeze();
        } catch { }
    }, [myRole, graph, paper]);

    const rebuildStateFromGraph = (g: joint.dia.Graph) => {
        try {
            const elements = (g as any).getElements ? (g as any).getElements() : [];
            const parsed: ClassType[] = [];
            let maxDisplayId = 0;
            elements.forEach((el: any) => {
                // Solo considerar rectángulos estándar (clases)
                try { ensureClassMarkup(el as any, (myRole === 'creador' || myRole === 'editor')); } catch { }
                const pos = el.position ? el.position() : { x: 0, y: 0 };
                const labelText: string = el.attr ? (el.attr('label/text') as string) : '';
                const parts = (labelText || '').split('-----------------------');
                const title = (parts[0] || '').trim() || 'Clase';
                const attrs = (parts[1] || '')
                    .split('\n')
                    .map(s => s.trim())
                    .filter(Boolean);
                const methods = (parts[2] || '')
                    .split('\n')
                    .map(s => s.trim())
                    .filter(Boolean);
                let displayId = 0;
                try {
                    const idText = el.attr('idBadge/text');
                    displayId = parseInt(String(idText || '0'), 10) || 0;
                } catch {
                    // como fallback, deducir por orden
                    displayId = parsed.length + 1;
                }
                if (displayId > maxDisplayId) maxDisplayId = displayId;
                parsed.push({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    name: title,
                    x: pos.x,
                    y: pos.y,
                    displayId,
                    attributes: attrs,
                    methods,
                    element: el
                });
            });
            setClasses(parsed);
            setNextNumber(maxDisplayId > 0 ? maxDisplayId + 1 : 1);
        } catch (e) {
            console.error('No se pudo reconstruir el estado desde el diagrama:', e);
        }
    };

    // Normaliza JSON proveniente del backend/import para que cada celda tenga un tipo válido
    const normalizeDiagramJSON = (raw: any) => {
        try {
            const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!data || !Array.isArray(data.cells)) return data;
            const cells = data.cells.map((cell: any) => {
                if (!cell || typeof cell !== 'object') return cell;
                const isLink = !!(cell.source || cell.target);
                if (!cell.type || typeof cell.type !== 'string') {
                    cell.type = isLink ? 'standard.Link' : 'standard.Rectangle';
                }
                return cell;
            });
            return { ...data, cells };
        } catch {
            return raw;
        }
    };

    // Utilidades de modelo estructurado
    const toLabelText = (name: string, attrs: UMLAttribute[]) => {
        const attrsText = attrs.map(a => `${a.name}: ${a.type || 'Any'}`);
        // Mostrar solo título y atributos
        return `${name}\n-----------------------\n${attrsText.join('\n')}`;
    };

    const parseAttrString = (line: string): UMLAttribute => {
        const [n, ...rest] = line.split(':');
        return { name: (n || '').trim(), type: (rest.join(':') || '').trim() };
    };
    const parseMethodString = (line: string): UMLMethod => {
        const namePart = line.replace(/\(.*\)/, '').trim();
        const name = namePart.split(':')[0].trim();
        const returns = (line.includes(':') ? line.split(':').slice(1).join(':') : 'void').trim();
        return { name, returns };
    };

    const buildModelFromCurrent = (): DiagramModel => {
        // Deriva modelo desde el estado actual (classes + relations)
        const classesNodes: UMLClassNode[] = classes.map(c => {
            let size: { width: number; height: number } | undefined = undefined;
            try {
                if (c.element && (c.element as any).size) {
                    const s = (c.element as any).size();
                    size = { width: s.width, height: s.height };
                }
            } catch { }
            return {
                id: `c-${c.displayId}`,
                displayId: c.displayId,
                name: c.name,
                position: { x: c.x, y: c.y },
                size,
                attributes: c.attributes.map(parseAttrString),
                methods: c.methods.map(parseMethodString)
            };
        });
        return {
            version: 1,
            nextDisplayId: nextNumber,
            classes: classesNodes,
            relations
        };
    };

    // Normaliza displayId únicos en modelos importados o remotos y mantiene relaciones coherentes
    const normalizeModelDisplayIds = (model: DiagramModel): DiagramModel => {
        try {
            const classes = Array.isArray(model.classes) ? [...model.classes] : [];
            const relations = Array.isArray(model.relations) ? [...model.relations] : [];
            const used = new Set<number>();
            let maxId = 0;
            // Ocorrencias por id
            const occ: Record<number, number[]> = {};
            classes.forEach((c, idx) => {
                const idNum = Number(c.displayId);
                if (!occ[idNum]) occ[idNum] = [];
                occ[idNum].push(idx);
            });
            // Inicializar usados con el primer índice de cada id válido > 0
            for (const idStr of Object.keys(occ)) {
                const idNum = Number(idStr);
                if (Number.isFinite(idNum) && idNum > 0) {
                    // Mantener el primero
                    used.add(idNum);
                    if (idNum > maxId) maxId = idNum;
                }
            }
            let nextId = Math.max(1, maxId + 1);
            const invalidMapping = new Map<number, number>();
            // Reasignar: todos los inválidos y los duplicados a partir del segundo
            for (const [idStr, idxs] of Object.entries(occ)) {
                const idNum = Number(idStr);
                const isValid = Number.isFinite(idNum) && idNum > 0;
                if (!isValid) {
                    // Todos estos deben reasignarse
                    for (const idx of idxs) {
                        while (used.has(nextId)) nextId++;
                        const newId = nextId++;
                        used.add(newId);
                        invalidMapping.set(idNum, newId);
                        (classes[idx] as any).displayId = newId;
                        (classes[idx] as any).id = `c-${newId}`;
                    }
                    continue;
                }
                // Duplicados válidos: conservar el primero, reasignar el resto
                const [keep, ...dups] = idxs;
                if (typeof keep === 'number') {
                    (classes[keep] as any).displayId = idNum;
                    (classes[keep] as any).id = `c-${idNum}`;
                }
                for (const idx of dups) {
                    while (used.has(nextId)) nextId++;
                    const newId = nextId++;
                    used.add(newId);
                    (classes[idx] as any).displayId = newId;
                    (classes[idx] as any).id = `c-${newId}`;
                    // Importante: no mapear el id viejo a nuevo para no redirigir relaciones ambiguas
                }
            }
            // Actualizar relaciones solo para ids inválidos (no para duplicados)
            const classIds = new Set(classes.map(c => c.displayId));
            const normalizedRelations: UMLRelation[] = relations
                .map(r => {
                    let from = r.fromDisplayId;
                    let to = r.toDisplayId;
                    if (invalidMapping.has(from)) from = invalidMapping.get(from)!;
                    if (invalidMapping.has(to)) to = invalidMapping.get(to)!;
                    return { ...r, fromDisplayId: from, toDisplayId: to };
                })
                .filter(r => classIds.has(r.fromDisplayId) && classIds.has(r.toDisplayId));

            // Recalcular nextDisplayId
            const newMax = Math.max(0, ...classes.map(c => c.displayId));
            const newNext = Math.max(model.nextDisplayId || 1, newMax + 1);

            return {
                version: 1,
                nextDisplayId: newNext,
                classes,
                relations: normalizedRelations
            } as DiagramModel;
        } catch {
            return model;
        }
    };

    const renderFromModel = (model: DiagramModel, g: joint.dia.Graph, includeButtons: boolean = true) => {
        console.log('renderFromModel called with:', model, 'includeButtons:', includeButtons);
        // Asegurar IDs únicos antes de renderizar
        const normalized = normalizeModelDisplayIds(model);

        // Limpia y pinta todo basado en modelo
        console.log('Freezing paper and clearing graph...');
        try {
            if (paper) {
                paper.freeze();
            }
        } catch { }

        try {
            g.clear();
            console.log('Graph cleared successfully');
        } catch (err) {
            console.error('Error clearing graph:', err);
        }

        const newClasses: ClassType[] = [];

        // Pintar clases
        const classList = [...(normalized.classes || [])].sort((a, b) => a.displayId - b.displayId);
        console.log('Rendering classes:', classList.length);

        for (const node of classList) {
            console.log('Rendering class:', node.name, 'at position:', node.position);

            const labelText = toLabelText(node.name, node.attributes);
            const fontSize = 12;
            let width = 220;
            let height = 140;

            if (node.size && typeof node.size.width === 'number' && typeof node.size.height === 'number') {
                width = node.size.width;
                height = node.size.height;
            } else {
                const paddingX = 20;
                const paddingY = 30;
                const lines = labelText.split('\n');
                let maxLineWidth = 0;
                lines.forEach(line => {
                    const { width } = measureText(line, fontSize);
                    if (width > maxLineWidth) maxLineWidth = width;
                });
                width = Math.max(220, maxLineWidth + paddingX);
                height = fontSize * lines.length + paddingY;
            }

            const rect = new joint.shapes.standard.Rectangle();

            // Set position first, then resize
            rect.position(node.position.x, node.position.y);
            rect.resize(width, height);

            console.log(`Element ${node.name} positioned at (${node.position.x}, ${node.position.y}) with size ${width}x${height}`);

            rect.attr({
                body: {
                    fill: '#fff', stroke: '#3986d3', strokeWidth: 2, rx: 20, ry: 20,
                    filter: { name: 'dropShadow', args: { dx: 0, dy: 2, blur: 2, color: '#3986d3', opacity: 0.15 } }
                },
                label: { text: labelText, fontWeight: 'bold', fontSize, fill: '#2477c3', fontFamily: 'monospace', xAlignment: 'middle' },
                idBg: { x: 10, y: 10, width: 26, height: 18, fill: '#2477c3', rx: 4, ry: 4 },
                idBadge: { text: String(node.displayId), x: 23, y: 23, fontSize: 12, fontWeight: 'bold', fill: '#ffffff', textAnchor: 'middle' }
            });

            const baseMarkup: any[] = [
                { tagName: 'rect', selector: 'body' },
                { tagName: 'text', selector: 'label' },
                { tagName: 'rect', selector: 'idBg' },
                { tagName: 'text', selector: 'idBadge' }
            ];

            if (includeButtons) {
                baseMarkup.push({
                    tagName: 'g', children: [
                        { tagName: 'text', selector: 'editIcon', className: 'edit-btn', attributes: { class: 'edit-btn', x: width - 55, y: 22, fontSize: 20, fill: '#007bff', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '⚙️' },
                        { tagName: 'text', selector: 'deleteIcon', className: 'delete-btn', attributes: { class: 'delete-btn', x: width - 30, y: 22, fontSize: 20, fill: '#dc3545', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '❌' }
                    ]
                });
            }

            rect.markup = baseMarkup;

            // Add to graph and verify
            try {
                rect.addTo(g);
                console.log(`Element ${node.name} added to graph successfully`);

                // Verify position after adding
                const actualPos = rect.position();
                console.log(`Element ${node.name} actual position after addTo:`, actualPos);

            } catch (err) {
                console.error(`Error adding element ${node.name} to graph:`, err);
            }

            clampElementInside(rect);

            newClasses.push({
                id: Date.now() + Math.floor(Math.random() * 1000),
                name: node.name,
                x: node.position.x,
                y: node.position.y,
                displayId: node.displayId,
                attributes: node.attributes.map(a => `${a.name}: ${a.type}`),
                methods: node.methods.map(m => `${m.name}(): ${m.returns}`),
                element: rect
            });
        }

        console.log('Setting state with', newClasses.length, 'classes and', (model.relations || []).length, 'relations');

        // Update state but don't trigger autosave (we're applying remote changes)
        setClasses(newClasses);
        setRelations(normalized.relations || []);
        setNextNumber(normalized.nextDisplayId || (Math.max(0, ...newClasses.map(c => c.displayId)) + 1));

        // Pintar relaciones
        console.log('Rendering relations:', normalized.relations?.length || 0);
        const getElByDisplay = (idNum: number) => newClasses.find(c => c.displayId === idNum)?.element;

        for (const rel of normalized.relations || []) {
            const origenEl = getElByDisplay(rel.fromDisplayId);
            const destinoEl = getElByDisplay(rel.toDisplayId);
            if (!origenEl || !destinoEl) {
                console.warn('Could not find elements for relation:', rel);
                continue;
            }
            console.log('Creating relation from', rel.fromDisplayId, 'to', rel.toDisplayId);

            const link = new joint.shapes.standard.Link();
            link.source(origenEl);
            link.target(destinoEl);
            let lineAttrs: any = { stroke: '#0b132b', strokeWidth: 2 };
            if (rel.type === 'herencia') {
                lineAttrs.targetMarker = { type: 'path', d: 'M 15 0 L 0 -10 L 0 10 Z', fill: '#ffffff', stroke: '#0b132b', strokeWidth: 2 };
            } else if (rel.type === 'agregacion' || rel.type === 'composicion') {
                lineAttrs.targetMarker = { type: 'path', d: 'M 0 0 L 10 -7 L 20 0 L 10 7 Z', fill: '#ffffff', stroke: '#0b132b', strokeWidth: 2 };
            }
            link.attr({ line: lineAttrs });
            if (rel.type === 'asociacion') {
                const labels: any[] = [];
                if (rel.originCard) labels.push({ position: 0.15, attrs: { text: { text: rel.originCard, fill: '#0b132b', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#ffffff', stroke: '#d0d7de', strokeWidth: 1, rx: 4, ry: 4, opacity: 0.9 } } });
                if (rel.destCard) labels.push({ position: 0.85, attrs: { text: { text: rel.destCard, fill: '#0b132b', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#ffffff', stroke: '#d0d7de', strokeWidth: 1, rx: 4, ry: 4, opacity: 0.9 } } });
                if (rel.verb) labels.push({ position: 0.5, attrs: { text: { text: rel.verb, fill: '#111', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#fff', stroke: '#e5e7eb', strokeWidth: 1, rx: 6, ry: 6, opacity: 0.9 } } });

                // Agregar botón de eliminación para usuarios con permisos
                if (includeButtons) {
                    labels.push({
                        position: rel.verb ? 0.35 : 0.5,
                        attrs: {
                            text: {
                                text: '❌',
                                fill: '#dc3545',
                                fontSize: 14,
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            },
                            rect: {
                                fill: '#ffffff',
                                stroke: '#dc3545',
                                strokeWidth: 1,
                                rx: 8,
                                ry: 8,
                                opacity: 0.9,
                                cursor: 'pointer'
                            }
                        },
                        markup: [
                            { tagName: 'rect', selector: 'rect' },
                            { tagName: 'text', selector: 'text', className: 'delete-relation-btn' }
                        ]
                    });
                }

                try { link.labels(labels); } catch { }
            } else {
                // Para otros tipos de relación, solo agregar botón de eliminación
                if (includeButtons) {
                    try {
                        link.labels([{
                            position: 0.5,
                            attrs: {
                                text: {
                                    text: '❌',
                                    fill: '#dc3545',
                                    fontSize: 14,
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                },
                                rect: {
                                    fill: '#ffffff',
                                    stroke: '#dc3545',
                                    strokeWidth: 1,
                                    rx: 8,
                                    ry: 8,
                                    opacity: 0.9,
                                    cursor: 'pointer'
                                }
                            },
                            markup: [
                                { tagName: 'rect', selector: 'rect' },
                                { tagName: 'text', selector: 'text', className: 'delete-relation-btn' }
                            ]
                        }]);
                    } catch { }
                }
            }
            link.connector('smooth');

            try {
                link.addTo(g);
                console.log(`Relation ${rel.type} added to graph successfully`);
            } catch (err) {
                console.error('Error adding relation to graph:', err);
            }
        }

        console.log('renderFromModel completed. Total elements in graph:', g.getElements().length);
        console.log('Graph elements positions:');
        g.getElements().forEach(el => {
            const pos = el.position();
            const id = el.attr('idBadge/text');
            console.log(`Element ${id}: position (${pos.x}, ${pos.y})`);
        });

        // Don't unfreeze here - let the calling function handle it
        console.log('renderFromModel finished (paper still frozen)');
    };

    // Helper: add a single class node to the graph/state
    const addClassNode = (node: UMLClassNode, g: joint.dia.Graph, includeButtons: boolean = true): ClassType => {
        const labelText = toLabelText(node.name, node.attributes);
        const fontSize = 12;
        let width = 220;
        let height = 140;
        if (node.size && typeof node.size.width === 'number' && typeof node.size.height === 'number') {
            width = node.size.width; height = node.size.height;
        } else {
            const paddingX = 20; const paddingY = 30;
            const lines = labelText.split('\n');
            let maxLineWidth = 0; lines.forEach(line => { const m = measureText(line, fontSize); if (m.width > maxLineWidth) maxLineWidth = m.width; });
            width = Math.max(220, maxLineWidth + paddingX); height = fontSize * lines.length + paddingY;
        }
        const rect = new joint.shapes.standard.Rectangle();
        rect.position(node.position.x, node.position.y);
        rect.resize(width, height);
        rect.attr({
            body: { fill: '#fff', stroke: '#3986d3', strokeWidth: 2, rx: 20, ry: 20, filter: { name: 'dropShadow', args: { dx: 0, dy: 2, blur: 2, color: '#3986d3', opacity: 0.15 } } },
            label: { text: labelText, fontWeight: 'bold', fontSize, fill: '#2477c3', fontFamily: 'monospace', xAlignment: 'middle' },
            idBg: { x: 10, y: 10, width: 26, height: 18, fill: '#2477c3', rx: 4, ry: 4 },
            idBadge: { text: String(node.displayId), x: 23, y: 23, fontSize: 12, fontWeight: 'bold', fill: '#ffffff', textAnchor: 'middle' }
        });
        const baseMarkup: any[] = [{ tagName: 'rect', selector: 'body' }, { tagName: 'text', selector: 'label' }, { tagName: 'rect', selector: 'idBg' }, { tagName: 'text', selector: 'idBadge' }];
        if (includeButtons) {
            baseMarkup.push({
                tagName: 'g', children: [
                    { tagName: 'text', selector: 'editIcon', className: 'edit-btn', attributes: { class: 'edit-btn', x: width - 55, y: 22, fontSize: 20, fill: '#007bff', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '⚙️' },
                    { tagName: 'text', selector: 'deleteIcon', className: 'delete-btn', attributes: { class: 'delete-btn', x: width - 30, y: 22, fontSize: 20, fill: '#dc3545', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '❌' }
                ]
            });
        }
        rect.markup = baseMarkup;
        rect.addTo(g);
        clampElementInside(rect);
        return {
            id: Date.now() + Math.floor(Math.random() * 1000),
            name: node.name,
            x: node.position.x,
            y: node.position.y,
            displayId: node.displayId,
            attributes: node.attributes.map(a => `${a.name}: ${a.type}`),
            methods: node.methods.map(m => `${m.name}(): ${m.returns}`),
            element: rect
        };
    };

    // Helper: add a single relation to the graph/state
    const addRelationLink = (rel: UMLRelation, g: joint.dia.Graph) => {
        const origenEl = classesRef.current.find(c => c.displayId === rel.fromDisplayId)?.element;
        const destinoEl = classesRef.current.find(c => c.displayId === rel.toDisplayId)?.element;
        if (!origenEl || !destinoEl) return false;
        const link = new joint.shapes.standard.Link();
        link.source(origenEl);
        link.target(destinoEl);
        let lineAttrs: any = { stroke: '#0b132b', strokeWidth: 2 };
        if (rel.type === 'herencia') {
            lineAttrs.targetMarker = { type: 'path', d: 'M 15 0 L 0 -10 L 0 10 Z', fill: '#ffffff', stroke: '#0b132b', strokeWidth: 2 };
        } else if (rel.type === 'agregacion' || rel.type === 'composicion') {
            lineAttrs.targetMarker = { type: 'path', d: 'M 0 0 L 10 -7 L 20 0 L 10 7 Z', fill: '#ffffff', stroke: '#0b132b', strokeWidth: 2 };
        }
        link.attr({ line: lineAttrs });
        if (rel.type === 'asociacion') {
            const labels: any[] = [];
            if (rel.originCard) labels.push({ position: 0.15, attrs: { text: { text: rel.originCard, fill: '#0b132b', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#ffffff', stroke: '#d0d7de', strokeWidth: 1, rx: 4, ry: 4, opacity: 0.9 } } });
            if (rel.destCard) labels.push({ position: 0.85, attrs: { text: { text: rel.destCard, fill: '#0b132b', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#ffffff', stroke: '#d0d7de', strokeWidth: 1, rx: 4, ry: 4, opacity: 0.9 } } });
            if (rel.verb) labels.push({ position: 0.5, attrs: { text: { text: rel.verb, fill: '#111', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#fff', stroke: '#e5e7eb', strokeWidth: 1, rx: 6, ry: 6, opacity: 0.9 } } });

            // Agregar botón de eliminación para usuarios con permisos
            if (myRole === 'creador' || myRole === 'editor') {
                labels.push({
                    position: rel.verb ? 0.35 : 0.5,
                    attrs: {
                        text: {
                            text: '❌',
                            fill: '#dc3545',
                            fontSize: 14,
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        },
                        rect: {
                            fill: '#ffffff',
                            stroke: '#dc3545',
                            strokeWidth: 1,
                            rx: 8,
                            ry: 8,
                            opacity: 0.9,
                            cursor: 'pointer'
                        }
                    },
                    markup: [
                        { tagName: 'rect', selector: 'rect' },
                        { tagName: 'text', selector: 'text', className: 'delete-relation-btn' }
                    ]
                });
            }

            try { link.labels(labels); } catch { }
        } else {
            // Para otros tipos de relación, solo agregar botón de eliminación
            if (myRole === 'creador' || myRole === 'editor') {
                try {
                    link.labels([{
                        position: 0.5,
                        attrs: {
                            text: {
                                text: '❌',
                                fill: '#dc3545',
                                fontSize: 14,
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            },
                            rect: {
                                fill: '#ffffff',
                                stroke: '#dc3545',
                                strokeWidth: 1,
                                rx: 8,
                                ry: 8,
                                opacity: 0.9,
                                cursor: 'pointer'
                            }
                        },
                        markup: [
                            { tagName: 'rect', selector: 'rect' },
                            { tagName: 'text', selector: 'text', className: 'delete-relation-btn' }
                        ]
                    }]);
                } catch { }
            }
        }
        link.connector('smooth');
        try { link.addTo(g); } catch { }
        setRelations(prev => [...prev, rel]);
        return true;
    };

    // Asegura que los elementos no salgan del área visible del diagrama
    const clampElementInside = (element: joint.dia.Element) => {
        const canvas = diagramaRef.current;
        if (!canvas) return;
        const cw = canvas.clientWidth || 0;
        const ch = canvas.clientHeight || 0;
        const s = scale || 1;
        const size = (element as any).size ? (element as any).size() : { width: 0, height: 0 };
        const pos = (element as any).position ? (element as any).position() : { x: 0, y: 0 };
        const maxXGraph = Math.max(0, cw / s - size.width);
        const maxYGraph = Math.max(0, ch / s - size.height);
        const nx = Math.min(Math.max(0, pos.x), maxXGraph);
        const ny = Math.min(Math.max(0, pos.y), maxYGraph);
        if (nx !== pos.x || ny !== pos.y) {
            (element as any).position(nx, ny);
        }
    };

    // Clamp durante el arrastre
    useEffect(() => {
        if (!graph) return;
        const onChangePos = (cell: any) => {
            if (cell && typeof cell.isElement === 'function' && cell.isElement()) {
                clampElementInside(cell as joint.dia.Element);
                // sincroniza posición en estado
                setClasses(prev => prev.map(c => c.element === cell ? { ...c, x: (cell as any).position().x, y: (cell as any).position().y } : c));

                // emitir movimiento con debounce
                try {
                    if (applyingRemoteRef.current) return;
                    if (moveDebounceRef.current) window.clearTimeout(moveDebounceRef.current);
                    const el = cell as any;
                    const pos = el.position ? el.position() : { x: 0, y: 0 };
                    moveDebounceRef.current = window.setTimeout(() => {
                        const pid = projectId ? Number(projectId) : undefined;
                        if (pid) {
                            // minimal payload for moved class
                            let displayId: number | undefined = undefined;
                            try {
                                const cls = classesRef.current.find(c => c.element === cell);
                                if (cls) displayId = cls.displayId;
                                if (displayId === undefined && el?.attr) {
                                    const badge = el.attr('idBadge/text');
                                    if (badge) displayId = Number(badge);
                                }
                            } catch { }
                            const payload: DiagramUpdate = {
                                projectId: pid,
                                userId: Number(localStorage.getItem('userId') || 0),
                                diagramData: displayId !== undefined ? { displayId, x: pos.x, y: pos.y } : { classes: classesRef.current.map(c => ({ displayId: c.displayId, x: c.x, y: c.y })) },
                                changeType: 'move',
                                elementId: displayId,
                                timestamp: new Date().toISOString()
                            };
                            // cursor move event
                            try { socketService.sendCursorMove({ projectId: pid, userId: Number(localStorage.getItem('userId') || 0), x: pos.x, y: pos.y, userName: localStorage.getItem('userName') || '' }); } catch { }
                            try { socketService.sendDiagramUpdate(payload); } catch { }
                            // programar guardado del modelo completo
                            scheduleAutoSave();
                        }
                    }, 120);
                } catch (err) { }
            }
        };
        (graph as any).on('change:position', onChangePos);
        // Observadores de cambios en relaciones (links)
        const onAdd = (cell: any) => {
            try {
                if (applyingRemoteRef.current) return;
                if (creatingLinkRef.current) return; // evitar doble emisión al crear desde código
                if (cell && typeof cell.isLink === 'function' && cell.isLink()) {
                    scheduleAutoSave();
                    const pid = projectId ? Number(projectId) : undefined;
                    if (pid) {
                        const sourceId = (cell.get('source')?.id) as string | undefined;
                        const targetId = (cell.get('target')?.id) as string | undefined;
                        const fromCls = classesRef.current.find(c => (c.element as any)?.id === sourceId);
                        const toCls = classesRef.current.find(c => (c.element as any)?.id === targetId);
                        if (fromCls && toCls) {
                            const minimalRel: UMLRelation = { id: `r-${Date.now()}`, fromDisplayId: fromCls.displayId, toDisplayId: toCls.displayId, type: 'asociacion' };
                            const payload: DiagramUpdate = { projectId: pid, userId: Number(localStorage.getItem('userId') || 0), diagramData: { relation: minimalRel }, changeType: 'create_relation', elementId: undefined, timestamp: new Date().toISOString() };
                            try { socketService.sendDiagramUpdate(payload); } catch { }
                        }
                    }
                }
            } catch { }
        };
        const onRemove = (cell: any) => {
            try {
                if (applyingRemoteRef.current) return;
                if (cell && typeof cell.isLink === 'function' && cell.isLink()) {
                    if (suppressLinkEmitRef.current) return; // no emitir cuando estamos borrando por cascada
                    const pid = projectId ? Number(projectId) : undefined;
                    if (pid) {
                        try {
                            const sourceId = (cell.get('source')?.id) as string | undefined;
                            const targetId = (cell.get('target')?.id) as string | undefined;
                            const fromCls = classesRef.current.find(c => (c.element as any)?.id === sourceId);
                            const toCls = classesRef.current.find(c => (c.element as any)?.id === targetId);
                            if (fromCls && toCls) {
                                // actualiza estado local sin re-render total
                                setRelations(prev => prev.filter(r => !(r.fromDisplayId === fromCls.displayId && r.toDisplayId === toCls.displayId)));
                                const payload: DiagramUpdate = {
                                    projectId: pid,
                                    userId: Number(localStorage.getItem('userId') || 0),
                                    diagramData: { fromDisplayId: fromCls.displayId, toDisplayId: toCls.displayId },
                                    changeType: 'delete_relation',
                                    elementId: undefined,
                                    timestamp: new Date().toISOString()
                                };
                                try { socketService.sendDiagramUpdate(payload); } catch { }
                            } else {
                                // fallback a autosave si no se puede mapear
                                scheduleAutoSave();
                            }
                        } catch {
                            scheduleAutoSave();
                        }
                    }
                }
                if (cell && typeof cell.isElement === 'function' && cell.isElement()) {
                    // A class was removed via keyboard/delete, broadcast minimal delete
                    const pid = projectId ? Number(projectId) : undefined;
                    if (pid) {
                        const cls = classesRef.current.find(c => c.element === cell);
                        const displayId = cls?.displayId;
                        if (displayId != null) {
                            setClasses(prev => prev.filter(c => c.displayId !== displayId));
                            setRelations(prev => prev.filter(r => r.fromDisplayId !== displayId && r.toDisplayId !== displayId));
                            const payload: DiagramUpdate = { projectId: pid, userId: Number(localStorage.getItem('userId') || 0), diagramData: { displayId }, changeType: 'delete_element', elementId: displayId, timestamp: new Date().toISOString() };
                            try { socketService.sendDiagramUpdate(payload); } catch { }
                        }
                    }
                }
            } catch { }
        };
        const onLinkChange = (cell: any) => {
            try {
                if (applyingRemoteRef.current) return;
                if (cell && typeof cell.isLink === 'function' && cell.isLink()) {
                    scheduleAutoSave();
                    const pid = projectId ? Number(projectId) : undefined;
                    if (pid) {
                        const payload: DiagramUpdate = { projectId: pid, userId: Number(localStorage.getItem('userId') || 0), diagramData: buildModelFromCurrent(), changeType: 'edit_relation', elementId: undefined, timestamp: new Date().toISOString() };
                        try { socketService.sendDiagramUpdate(payload); } catch { }
                    }
                }
            } catch { }
        };
        (graph as any).on('add', onAdd);
        (graph as any).on('remove', onRemove);
        (graph as any).on('change:source', onLinkChange);
        (graph as any).on('change:target', onLinkChange);
        (graph as any).on('change:vertices', onLinkChange);

        return () => {
            (graph as any).off('change:position', onChangePos as any);
            (graph as any).off('add', onAdd as any);
            (graph as any).off('remove', onRemove as any);
            (graph as any).off('change:source', onLinkChange as any);
            (graph as any).off('change:target', onLinkChange as any);
            (graph as any).off('change:vertices', onLinkChange as any);
        };
    }, [graph, scale]);

    // Clamp cuando se redimensiona la ventana
    useEffect(() => {
        const onResize = () => {
            classes.forEach(c => c.element && clampElementInside(c.element));
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [classes, scale]);

    // Escuchar acciones de IA emitidas desde AudioIAPage
    useEffect(() => {
        function onAIAction(e: Event) {
            const ce = e as CustomEvent<ActionSuggestion>;
            const action = ce.detail;
            if (!action) return;
            // Proteger: solo creador/editor pueden ejecutar acciones IA que modifican el diagrama
            if (!(myRole === 'creador' || myRole === 'editor')) return;
            if (action.type === 'create_class') {
                // Crear clase con datos sugeridos
                if (!graph) return;
                const id = Date.now();
                const name = action.name || 'Clase';
                const x = 120 + classes.length * 60;
                const y = 120 + classes.length * 60;
                const displayId = nextNumber;
                const attributes = (action.attributes || []).map(a => `${a.name}: ${a.type || 'Any'}`);
                const labelText = `${name}\n-----------------------\n${attributes.join('\n')}`;
                const fontSize = 12;
                const paddingX = 20;
                const paddingY = 30;
                const lines = labelText.split('\n');
                let maxLineWidth = 0;
                lines.forEach(line => {
                    const { width } = measureText(line, fontSize);
                    if (width > maxLineWidth) maxLineWidth = width;
                });
                const width = Math.max(220, maxLineWidth + paddingX);
                const height = fontSize * lines.length + paddingY;

                const rect = new joint.shapes.standard.Rectangle();
                rect.position(x, y);
                rect.resize(width, height);
                rect.attr({
                    body: {
                        fill: '#fff', stroke: '#3986d3', strokeWidth: 2, rx: 20, ry: 20,
                        filter: { name: 'dropShadow', args: { dx: 0, dy: 2, blur: 2, color: '#3986d3', opacity: 0.15 } }
                    },
                    label: { text: labelText, fontWeight: 'bold', fontSize, fill: '#2477c3', fontFamily: 'monospace', xAlignment: 'middle' },
                    idBg: { x: 10, y: 10, width: 26, height: 18, fill: '#2477c3', rx: 4, ry: 4 },
                    idBadge: { text: String(displayId), x: 23, y: 23, fontSize: 12, fontWeight: 'bold', fill: '#ffffff', textAnchor: 'middle' }
                });
                rect.markup = [
                    { tagName: 'rect', selector: 'body' },
                    { tagName: 'text', selector: 'label' },
                    { tagName: 'rect', selector: 'idBg' },
                    { tagName: 'text', selector: 'idBadge' },
                    {
                        tagName: 'g', children: [
                            { tagName: 'text', selector: 'editIcon', className: 'edit-btn', attributes: { x: width - 55, y: 22, fontSize: 20, fill: '#007bff', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '⚙️' },
                            { tagName: 'text', selector: 'deleteIcon', className: 'delete-btn', attributes: { x: width - 30, y: 22, fontSize: 20, fill: '#dc3545', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '❌' }
                        ]
                    }
                ];
                rect.addTo(graph);
                clampElementInside(rect);
                setClasses(prev => [...prev, { id, name, x, y, displayId, attributes, methods: [], element: rect }]);
                setNextNumber(n => n + 1);
                const pidNumAI = projectId ? Number(projectId) : Number(getActiveProjectId() || 0);
                if (pidNumAI) {
                    const selfId = Number(localStorage.getItem('userId') || 0);
                    const selfName = getUserDisplay(selfId);
                    addActivity(String(pidNumAI), { type: 'create_class', message: `${selfName} creó clase #${displayId} (${name})`, byUserId: selfId, byName: selfName });
                    setActivities(getActivities(String(pidNumAI)));
                    try {
                        const newNode: UMLClassNode = { id: `c-${displayId}`, displayId, name, position: { x, y }, size: { width, height }, attributes: attributes.map((line: string) => parseAttrString(line)), methods: [] };
                        const payload: DiagramUpdate = { projectId: pidNumAI, userId: Number(localStorage.getItem('userId') || 0), diagramData: { node: newNode }, changeType: 'create_class', elementId: displayId, timestamp: new Date().toISOString() };
                        // Join room if not yet
                        try { if (socketService.isConnected() && !socketService.isInProject(pidNumAI)) socketService.joinProject(pidNumAI); } catch { }
                        socketService.sendDiagramUpdate(payload);
                        // persist full model as well
                        scheduleAutoSave();
                    } catch { }
                }
                return;
            }
            if (action.type === 'create_relation') {
                if (action.originNumber) setOriginNum(String(action.originNumber));
                if (action.destNumber) setDestNum(String(action.destNumber));
                if (action.relationType) setRelationType(action.relationType);
                if (action.originCard) setOriginCard(action.originCard);
                if (action.destCard) setDestCard(action.destCard);
                if (action.verb) setRelationVerb(action.verb);
                // crear después de un tick para que el highlight se vea
                setTimeout(() => crearRelacion(), 50);
                return;
            }
            if (action.type === 'delete_relation') {
                if (!graph) return;
                const origen = classes.find(c => c.displayId === Number(action.originNumber));
                const destino = classes.find(c => c.displayId === Number(action.destNumber));
                if (!origen?.element || !destino?.element) return;
                try {
                    const links = (graph as any).getLinks ? (graph as any).getLinks() : [];
                    const aId = (origen.element as any).id;
                    const bId = (destino.element as any).id;
                    let removed = false;
                    links.forEach((l: any) => {
                        const s = l.get('source'); const t = l.get('target');
                        const sid = s && s.id; const tid = t && t.id;
                        if ((sid === aId && tid === bId) || (sid === bId && tid === aId)) {
                            suppressLinkEmitRef.current = true; try { l.remove(); removed = true; } catch { } suppressLinkEmitRef.current = false;
                        }
                    });
                    if (removed) {
                        setRelations(prev => prev.filter(r => !((r.fromDisplayId === origen.displayId && r.toDisplayId === destino.displayId) || (r.fromDisplayId === destino.displayId && r.toDisplayId === origen.displayId))));
                        const pid = projectId ? Number(projectId) : Number(getActiveProjectId() || 0);
                        if (pid) {
                            const minimal = { fromDisplayId: origen.displayId, toDisplayId: destino.displayId };
                            const payload: DiagramUpdate = { projectId: pid, userId: Number(localStorage.getItem('userId') || 0), diagramData: minimal, changeType: 'delete_relation', elementId: undefined, timestamp: new Date().toISOString() };
                            try { if (socketService.isConnected() && !socketService.isInProject(pid)) socketService.joinProject(pid); } catch { }
                            socketService.sendDiagramUpdate(payload);
                            scheduleAutoSave();
                        }
                    }
                } catch { }
                return;
            }
        }
        window.addEventListener('diagram-ai-action', onAIAction as EventListener);
        return () => window.removeEventListener('diagram-ai-action', onAIAction as EventListener);
    }, [graph, classes, nextNumber, relationType, originCard, destCard, relationVerb, myRole]);

    const nuevaClase = () => {
        if (!graph || !(myRole === 'creador' || myRole === 'editor')) return;
        const id = Date.now();
        const name = 'Nuevo';
        const x = 100 + classes.length * 50;
        const y = 100 + classes.length * 50;
        const displayId = nextNumber;
        const attributes: string[] = ['atributo1: String', 'atributo2: Int'];
        const methods: string[] = [];

        const labelText = `${name}\n-----------------------\n${attributes.join('\n')}`;
        const fontSize = 12;
        const paddingX = 20;
        const paddingY = 30;
        const lines = labelText.split('\n');
        let maxLineWidth = 0;
        lines.forEach(line => {
            const { width } = measureText(line, fontSize);
            if (width > maxLineWidth) maxLineWidth = width;
        });
        const width = Math.max(220, maxLineWidth + paddingX);
        const height = fontSize * lines.length + paddingY;

        const rect = new joint.shapes.standard.Rectangle();
        rect.position(x, y);
        rect.resize(width, height);
        rect.attr({
            body: {
                fill: '#fff',
                stroke: '#3986d3',
                strokeWidth: 2,
                rx: 20,
                ry: 20,
                filter: {
                    name: 'dropShadow',
                    args: {
                        dx: 0,
                        dy: 2,
                        blur: 2,
                        color: '#3986d3',
                        opacity: 0.15
                    }
                }
            },
            label: {
                text: labelText,
                fontWeight: 'bold',
                fontSize: fontSize,
                fill: '#2477c3',
                fontFamily: 'monospace',
                xAlignment: 'middle'
            },
            idBg: {
                x: 10,
                y: 10,
                width: 26,
                height: 18,
                fill: '#2477c3',
                rx: 4,
                ry: 4
            },
            idBadge: {
                text: String(displayId),
                x: 23,
                y: 23,
                fontSize: 12,
                fontWeight: 'bold',
                fill: '#ffffff',
                textAnchor: 'middle'
            }
        });

        // Botones SVG editar y eliminar
        rect.markup = [
            { tagName: 'rect', selector: 'body' },
            { tagName: 'text', selector: 'label' },
            { tagName: 'rect', selector: 'idBg' },
            { tagName: 'text', selector: 'idBadge' },
            {
                tagName: 'g',
                children: [
                    {
                        tagName: 'text',
                        selector: 'editIcon',
                        className: 'edit-btn',
                        attributes: {
                            class: 'edit-btn',
                            x: width - 55,
                            y: 22,
                            fontSize: 20,
                            fill: '#007bff',
                            fontWeight: 'bold',
                            textAnchor: 'middle',
                            cursor: 'pointer',
                        },
                        textContent: '⚙️'
                    },
                    {
                        tagName: 'text',
                        selector: 'deleteIcon',
                        className: 'delete-btn',
                        attributes: {
                            class: 'delete-btn',
                            x: width - 30,
                            y: 22,
                            fontSize: 20,
                            fill: '#dc3545',
                            fontWeight: 'bold',
                            textAnchor: 'middle',
                            cursor: 'pointer',
                        },
                        textContent: '❌'
                    }
                ]
            }
        ];

        rect.addTo(graph);
        clampElementInside(rect);

        setClasses([...classes, { id, name, x, y, displayId, attributes, methods, element: rect }]);
        setNextNumber(n => n + 1);
        const pidNum = projectId ? Number(projectId) : Number(getActiveProjectId() || 0);
        if (pidNum) {
            const selfId = Number(localStorage.getItem('userId') || 0);
            const selfName = getUserDisplay(selfId);
            addActivity(String(pidNum), { type: 'create_class', message: `${selfName} creó clase #${displayId} (${name})`, byUserId: selfId, byName: selfName });
            setActivities(getActivities(String(pidNum)));
            try {
                const newNode: UMLClassNode = { id: `c-${displayId}`, displayId, name, position: { x, y }, size: { width, height }, attributes: attributes.map((line: string) => parseAttrString(line)), methods: [] };
                const payload: DiagramUpdate = { projectId: pidNum, userId: Number(localStorage.getItem('userId') || 0), diagramData: { node: newNode }, changeType: 'create_class', elementId: displayId, timestamp: new Date().toISOString() };
                try { if (socketService.isConnected() && !socketService.isInProject(pidNum)) socketService.joinProject(pidNum); } catch { }
                socketService.sendDiagramUpdate(payload);
                scheduleAutoSave();
            } catch { }
        }
    };

    // Crear relación azul visible entre clases seleccionadas por ID
    const crearRelacion = () => {
        if (!graph || !originNum || !destNum || !(myRole === 'creador' || myRole === 'editor')) return;
        const origen = classes.find(cls => cls.displayId === Number(originNum));
        const destino = classes.find(cls => cls.displayId === Number(destNum));
        if (!origen?.element || !destino?.element) return;

        // Si ya existe una relación entre estas dos clases (en cualquier dirección), eliminarla para conservar solo la última
        try {
            const links = (graph as any).getLinks ? (graph as any).getLinks() : [];
            const aId = (origen.element as any).id;
            const bId = (destino.element as any).id;
            links.forEach((l: any) => {
                const sId = l.get('source')?.id;
                const tId = l.get('target')?.id;
                if ((sId === aId && tId === bId) || (sId === bId && tId === aId)) {
                    l.remove();
                }
            });
        } catch { }

        const link = new joint.shapes.standard.Link();
        link.source(origen.element);
        link.target(destino.element);

        // Estilo según tipo de relación (más cercano a UML)
        let lineAttrs: any = {
            stroke: '#0b132b',
            strokeWidth: 2
        };
        if (relationType === 'asociacion') {
            // Asociación: línea simple (sin flecha), cardinalidad visible
            // Sin targetMarker para asemejarse a Association UML
        } else if (relationType === 'herencia') {
            // Generalización: triángulo hueco
            lineAttrs.targetMarker = {
                type: 'path',
                d: 'M 15 0 L 0 -10 L 0 10 Z',
                fill: '#ffffff',
                stroke: '#0b132b',
                strokeWidth: 2
            };
        } else if (relationType === 'agregacion') {
            // Agregación: rombo hueco
            lineAttrs.targetMarker = {
                type: 'path',
                d: 'M 0 0 L 10 -7 L 20 0 L 10 7 Z',
                fill: '#ffffff',
                stroke: '#0b132b',
                strokeWidth: 2
            };
        } else if (relationType === 'composicion') {
            // Composición: rombo sólido
            lineAttrs.targetMarker = {
                type: 'path',
                d: 'M 0 0 L 10 -7 L 20 0 L 10 7 Z',
                fill: '#ffffff',
                stroke: '#0b132b',
                strokeWidth: 2
            };
        }
        link.attr({ line: lineAttrs });
        // Etiquetas: SOLO para Asociación (cardinalidades y verbo)
        if (relationType === 'asociacion') {
            const originLabelText = originCard;
            const destLabelText = destCard;
            try {
                const labels: any[] = [
                    {
                        position: 0.15,
                        attrs: {
                            text: { text: originLabelText, fill: '#0b132b', fontSize: 12, fontWeight: 'bold' },
                            rect: { fill: '#ffffff', stroke: '#d0d7de', strokeWidth: 1, rx: 4, ry: 4, opacity: 0.9 }
                        }
                    },
                    {
                        position: 0.85,
                        attrs: {
                            text: { text: destLabelText, fill: '#0b132b', fontSize: 12, fontWeight: 'bold' },
                            rect: { fill: '#ffffff', stroke: '#d0d7de', strokeWidth: 1, rx: 4, ry: 4, opacity: 0.9 }
                        }
                    }
                ];
                if (relationVerb && relationVerb.trim()) {
                    labels.push({
                        position: 0.5,
                        attrs: {
                            text: { text: relationVerb.trim(), fill: '#111', fontSize: 12, fontWeight: 'bold' },
                            rect: { fill: '#fff', stroke: '#e5e7eb', strokeWidth: 1, rx: 6, ry: 6, opacity: 0.9 }
                        }
                    });
                }

                // Agregar botón de eliminación para usuarios con permisos
                if (myRole === 'creador' || myRole === 'editor') {
                    labels.push({
                        position: relationVerb && relationVerb.trim() ? 0.35 : 0.5,
                        attrs: {
                            text: {
                                text: '❌',
                                fill: '#dc3545',
                                fontSize: 14,
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            },
                            rect: {
                                fill: '#ffffff',
                                stroke: '#dc3545',
                                strokeWidth: 1,
                                rx: 8,
                                ry: 8,
                                opacity: 0.9,
                                cursor: 'pointer'
                            }
                        },
                        markup: [
                            { tagName: 'rect', selector: 'rect' },
                            { tagName: 'text', selector: 'text', className: 'delete-relation-btn' }
                        ]
                    });
                }

                link.labels(labels);
            } catch (e) {
                try {
                    // @ts-ignore
                    link.appendLabel({ position: 0.15, attrs: { text: { text: originLabelText, fill: '#0b132b', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#ffffff', stroke: '#d0d7de', strokeWidth: 1, rx: 4, ry: 4, opacity: 0.9 } } });
                    // @ts-ignore
                    link.appendLabel({ position: 0.85, attrs: { text: { text: destLabelText, fill: '#0b132b', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#ffffff', stroke: '#d0d7de', strokeWidth: 1, rx: 4, ry: 4, opacity: 0.9 } } });
                    if (relationVerb && relationVerb.trim()) {
                        // @ts-ignore
                        link.appendLabel({ position: 0.5, attrs: { text: { text: relationVerb.trim(), fill: '#111', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#fff', stroke: '#e5e7eb', strokeWidth: 1, rx: 6, ry: 6, opacity: 0.9 } } });
                    }
                    // Agregar botón de eliminación en el catch también
                    if (myRole === 'creador' || myRole === 'editor') {
                        // @ts-ignore
                        link.appendLabel({
                            position: relationVerb && relationVerb.trim() ? 0.35 : 0.5,
                            attrs: {
                                text: { text: '❌', fill: '#dc3545', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' },
                                rect: { fill: '#ffffff', stroke: '#dc3545', strokeWidth: 1, rx: 8, ry: 8, opacity: 0.9, cursor: 'pointer' }
                            },
                            markup: [
                                { tagName: 'rect', selector: 'rect' },
                                { tagName: 'text', selector: 'text', className: 'delete-relation-btn' }
                            ]
                        });
                    }
                } catch { }
            }
        } else {
            // Para otros tipos de relación (herencia, agregación, composición), solo agregar botón de eliminación
            if (myRole === 'creador' || myRole === 'editor') {
                try {
                    link.labels([{
                        position: 0.5,
                        attrs: {
                            text: {
                                text: '❌',
                                fill: '#dc3545',
                                fontSize: 14,
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            },
                            rect: {
                                fill: '#ffffff',
                                stroke: '#dc3545',
                                strokeWidth: 1,
                                rx: 8,
                                ry: 8,
                                opacity: 0.9,
                                cursor: 'pointer'
                            }
                        },
                        markup: [
                            { tagName: 'rect', selector: 'rect' },
                            { tagName: 'text', selector: 'text', className: 'delete-relation-btn' }
                        ]
                    }]);
                } catch (e) {
                    try {
                        // @ts-ignore
                        link.appendLabel({
                            position: 0.5,
                            attrs: {
                                text: { text: '❌', fill: '#dc3545', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' },
                                rect: { fill: '#ffffff', stroke: '#dc3545', strokeWidth: 1, rx: 8, ry: 8, opacity: 0.9, cursor: 'pointer' }
                            },
                            markup: [
                                { tagName: 'rect', selector: 'rect' },
                                { tagName: 'text', selector: 'text', className: 'delete-relation-btn' }
                            ]
                        });
                    } catch { }
                }
            }
        }
        link.connector('smooth');
        creatingLinkRef.current = true;
        link.addTo(graph);
        creatingLinkRef.current = false;

        setOriginNum('');
        setDestNum('');
        // Registrar relación en el estado estructurado
        setRelations(prev => {
            const newRel: UMLRelation = {
                id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                fromDisplayId: origen.displayId,
                toDisplayId: destino.displayId,
                type: relationType as UMLRelationType,
                originCard: relationType === 'asociacion' ? originCard : undefined,
                destCard: relationType === 'asociacion' ? destCard : undefined,
                verb: relationType === 'asociacion' ? (relationVerb || undefined) : undefined
            };
            // elimina cualquier relación previa entre mismos nodos (cierre sobreescritura)
            const filtered = prev.filter(r => !((r.fromDisplayId === newRel.fromDisplayId && r.toDisplayId === newRel.toDisplayId) || (r.fromDisplayId === newRel.toDisplayId && r.toDisplayId === newRel.fromDisplayId)));
            return [...filtered, newRel];
        });
        const pidNumRel = projectId ? Number(projectId) : Number(getActiveProjectId() || 0);
        if (pidNumRel) {
            const selfId = Number(localStorage.getItem('userId') || 0);
            const selfName = getUserDisplay(selfId);
            addActivity(String(pidNumRel), { type: 'create_relation', message: `${selfName} creó relación ${relationType} entre #${originNum} y #${destNum}${relationType === 'asociacion' && relationVerb ? ` (${relationVerb})` : ''}`, byUserId: selfId, byName: selfName });
            setActivities(getActivities(String(pidNumRel)));
            try {
                const relationPayload: UMLRelation = { id: `r-${Date.now()}`, fromDisplayId: origen.displayId, toDisplayId: destino.displayId, type: relationType as UMLRelationType, originCard: relationType === 'asociacion' ? originCard : undefined, destCard: relationType === 'asociacion' ? destCard : undefined, verb: relationType === 'asociacion' ? (relationVerb || undefined) : undefined };
                const payload: DiagramUpdate = { projectId: pidNumRel, userId: Number(localStorage.getItem('userId') || 0), diagramData: { relation: relationPayload }, changeType: 'create_relation', elementId: undefined, timestamp: new Date().toISOString() };
                try { if (socketService.isConnected() && !socketService.isInProject(pidNumRel)) socketService.joinProject(pidNumRel); } catch { }
                socketService.sendDiagramUpdate(payload);
                scheduleAutoSave();
            } catch { }
        }
    };

    // Aplica una relación sugerida por IA entre dos clases por nombre
    const applySuggestedRelation = (rel: RelationSuggestion) => {
        if (!graph || !(myRole === 'creador' || myRole === 'editor')) return;
        const origen = classesRef.current.find(c => c.name.toLowerCase() === rel.originName.toLowerCase());
        const destino = classesRef.current.find(c => c.name.toLowerCase() === rel.destName.toLowerCase());
        if (!origen?.element || !destino?.element) return;

        // Si ya existe una relación entre estas dos clases, elimínala para dejar solo la nueva
        try {
            const links = (graph as any).getLinks ? (graph as any).getLinks() : [];
            const aId = (origen.element as any).id;
            const bId = (destino.element as any).id;
            links.forEach((l: any) => {
                const s = l.get('source'); const t = l.get('target');
                const sid = s && s.id; const tid = t && t.id;
                if ((sid === aId && tid === bId) || (sid === bId && tid === aId)) { suppressLinkEmitRef.current = true; try { l.remove(); } catch { } suppressLinkEmitRef.current = false; }
            });
        } catch { }

        const relationType = (rel.relationType || 'asociacion') as UMLRelationType;
        const originCard = relationType === 'asociacion' ? (rel.originCard || '1..1') : undefined;
        const destCard = relationType === 'asociacion' ? (rel.destCard || '1..1') : undefined;
        const verb = relationType === 'asociacion' ? (rel.verb || undefined) : undefined;

        const link = new joint.shapes.standard.Link();
        link.source(origen.element);
        link.target(destino.element);
        let lineAttrs: any = { stroke: '#0b132b', strokeWidth: 2 };
        if (relationType === 'herencia') {
            lineAttrs.targetMarker = { type: 'path', d: 'M 15 0 L 0 -10 L 0 10 Z', fill: '#ffffff', stroke: '#0b132b', strokeWidth: 2 };
        } else if (relationType === 'agregacion' || relationType === 'composicion') {
            lineAttrs.targetMarker = { type: 'path', d: 'M 0 0 L 10 -7 L 20 0 L 10 7 Z', fill: '#ffffff', stroke: '#0b132b', strokeWidth: 2 };
        }
        link.attr({ line: lineAttrs });
        if (relationType === 'asociacion') {
            const labels: any[] = [];
            if (originCard) labels.push({ position: 0.15, attrs: { text: { text: originCard, fill: '#0b132b', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#ffffff', stroke: '#d0d7de', strokeWidth: 1, rx: 4, ry: 4, opacity: 0.9 } } });
            if (destCard) labels.push({ position: 0.85, attrs: { text: { text: destCard, fill: '#0b132b', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#ffffff', stroke: '#d0d7de', strokeWidth: 1, rx: 4, ry: 4, opacity: 0.9 } } });
            if (verb) labels.push({ position: 0.5, attrs: { text: { text: verb, fill: '#111', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#fff', stroke: '#e5e7eb', strokeWidth: 1, rx: 6, ry: 6, opacity: 0.9 } } });

            // Agregar botón de eliminación
            if (myRole === 'creador' || myRole === 'editor') {
                labels.push({
                    position: verb ? 0.35 : 0.5,
                    attrs: {
                        text: {
                            text: '❌',
                            fill: '#dc3545',
                            fontSize: 14,
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        },
                        rect: {
                            fill: '#ffffff',
                            stroke: '#dc3545',
                            strokeWidth: 1,
                            rx: 8,
                            ry: 8,
                            opacity: 0.9,
                            cursor: 'pointer'
                        }
                    },
                    markup: [
                        { tagName: 'rect', selector: 'rect' },
                        { tagName: 'text', selector: 'text', className: 'delete-relation-btn' }
                    ]
                });
            }

            try { link.labels(labels as any); } catch { }
        } else {
            // Para otros tipos de relación, solo agregar botón de eliminación
            if (myRole === 'creador' || myRole === 'editor') {
                try {
                    link.labels([{
                        position: 0.5,
                        attrs: {
                            text: {
                                text: '❌',
                                fill: '#dc3545',
                                fontSize: 14,
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            },
                            rect: {
                                fill: '#ffffff',
                                stroke: '#dc3545',
                                strokeWidth: 1,
                                rx: 8,
                                ry: 8,
                                opacity: 0.9,
                                cursor: 'pointer'
                            }
                        },
                        markup: [
                            { tagName: 'rect', selector: 'rect' },
                            { tagName: 'text', selector: 'text', className: 'delete-relation-btn' }
                        ]
                    }]);
                } catch { }
            }
        }
        link.connector('smooth');
        creatingLinkRef.current = true;
        link.addTo(graph);
        creatingLinkRef.current = false;

        // Actualiza estado estructurado
        setRelations(prev => {
            const newRel: UMLRelation = {
                id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                fromDisplayId: origen.displayId,
                toDisplayId: destino.displayId,
                type: relationType,
                originCard,
                destCard,
                verb
            };
            const filtered = prev.filter(r => !((r.fromDisplayId === newRel.fromDisplayId && r.toDisplayId === newRel.toDisplayId) || (r.fromDisplayId === newRel.toDisplayId && r.toDisplayId === newRel.fromDisplayId)));
            return [...filtered, newRel];
        });

        // Broadcast y actividad
        const pidNumRel = projectId ? Number(projectId) : Number(getActiveProjectId() || 0);
        if (pidNumRel) {
            try {
                const minimalRel = {
                    fromDisplayId: origen.displayId,
                    toDisplayId: destino.displayId,
                    type: relationType,
                    originCard,
                    destCard,
                    verb
                };
                const payload: DiagramUpdate = { projectId: pidNumRel, userId: Number(localStorage.getItem('userId') || 0), diagramData: { relation: minimalRel }, changeType: 'create_relation', elementId: undefined, timestamp: new Date().toISOString() };
                try { if (socketService.isConnected() && !socketService.isInProject(pidNumRel)) socketService.joinProject(pidNumRel); } catch { }
                socketService.sendDiagramUpdate(payload);
                scheduleAutoSave();
            } catch { }
        }
    };

    // Elimina una relación entre dos clases por nombre (si existe)
    const deleteSuggestedRelation = (rel: RelationSuggestion) => {
        if (!graph || !(myRole === 'creador' || myRole === 'editor')) return;
        const origen = classesRef.current.find(c => c.name.toLowerCase() === rel.originName.toLowerCase());
        const destino = classesRef.current.find(c => c.name.toLowerCase() === rel.destName.toLowerCase());
        if (!origen?.element || !destino?.element) return;
        try {
            const links = (graph as any).getLinks ? (graph as any).getLinks() : [];
            const aId = (origen.element as any).id;
            const bId = (destino.element as any).id;
            let removed = false;
            links.forEach((l: any) => {
                const s = l.get('source'); const t = l.get('target');
                const sid = s && s.id; const tid = t && t.id;
                if ((sid === aId && tid === bId) || (sid === bId && tid === aId)) {
                    suppressLinkEmitRef.current = true; try { l.remove(); removed = true; } catch { } suppressLinkEmitRef.current = false;
                }
            });
            if (removed) {
                setRelations(prev => prev.filter(r => !((r.fromDisplayId === origen.displayId && r.toDisplayId === destino.displayId) || (r.fromDisplayId === destino.displayId && r.toDisplayId === origen.displayId))));
                const pid = projectId ? Number(projectId) : Number(getActiveProjectId() || 0);
                if (pid) {
                    const minimal = { fromDisplayId: origen.displayId, toDisplayId: destino.displayId };
                    const payload: DiagramUpdate = { projectId: pid, userId: Number(localStorage.getItem('userId') || 0), diagramData: minimal, changeType: 'delete_relation', elementId: undefined, timestamp: new Date().toISOString() };
                    try { if (socketService.isConnected() && !socketService.isInProject(pid)) socketService.joinProject(pid); } catch { }
                    socketService.sendDiagramUpdate(payload);
                    scheduleAutoSave();
                }
            }
        } catch { }
    };

    const downloadDiagramAsJSON = (_graph: joint.dia.Graph | null) => {
        const model = buildModelFromCurrent();
        const json = JSON.stringify(model, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        saveAs(blob, 'diagram.json');
    };

    const uploadDiagramFromJSON = (event: React.ChangeEvent<HTMLInputElement>, graph: joint.dia.Graph | null) => {
        if (!graph || !event.target.files || event.target.files.length === 0) return;
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                const json = JSON.parse(e.target.result as string);
                if (json && Array.isArray(json.classes)) {
                    // Es nuestro modelo estructurado
                    renderFromModel(json as DiagramModel, graph);
                    // Broadcast import to collaborators
                    const pidNum = projectId ? Number(projectId) : Number(getActiveProjectId() || 0);
                    if (pidNum) {
                        try { if (socketService.isConnected() && !socketService.isInProject(pidNum)) socketService.joinProject(pidNum); } catch { }
                        const payload: DiagramUpdate = {
                            projectId: pidNum,
                            userId: Number(localStorage.getItem('userId') || 0),
                            diagramData: json,
                            changeType: 'import',
                            elementId: undefined,
                            timestamp: new Date().toISOString()
                        };
                        socketService.sendDiagramUpdate(payload);
                        const selfId = Number(localStorage.getItem('userId') || 0);
                        const selfName = getUserDisplay(selfId);
                        addActivity(String(pidNum), { type: 'note', message: `${selfName} importó un diagrama desde JSON`, byUserId: selfId, byName: selfName });
                        setActivities(getActivities(String(pidNum)));
                        scheduleAutoSave();
                        // Recargar para rehidratar desde servidor y asegurar render en tiempo real
                        setTimeout(() => { try { window.location.reload(); } catch { } }, 800);
                    }
                } else {
                    // Intento de compatibilidad con JSON de JointJS
                    const normalized = normalizeDiagramJSON(json);
                    try { (paper as any)?.freeze?.(); } catch { }
                    graph.fromJSON(normalized);
                    try { (paper as any)?.unfreeze?.(); } catch { }
                    rebuildStateFromGraph(graph);
                    // Broadcast as structured model after rebuilding
                    const pidNum = projectId ? Number(projectId) : Number(getActiveProjectId() || 0);
                    if (pidNum) {
                        try { if (socketService.isConnected() && !socketService.isInProject(pidNum)) socketService.joinProject(pidNum); } catch { }
                        const model = buildModelFromCurrent();
                        const payload: DiagramUpdate = {
                            projectId: pidNum,
                            userId: Number(localStorage.getItem('userId') || 0),
                            diagramData: model,
                            changeType: 'import',
                            elementId: undefined,
                            timestamp: new Date().toISOString()
                        };
                        socketService.sendDiagramUpdate(payload);
                        const selfId = Number(localStorage.getItem('userId') || 0);
                        const selfName = getUserDisplay(selfId);
                        addActivity(String(pidNum), { type: 'note', message: `${selfName} importó un diagrama desde JSON`, byUserId: selfId, byName: selfName });
                        setActivities(getActivities(String(pidNum)));
                        scheduleAutoSave();
                        // Recargar para rehidratar desde servidor y asegurar render en tiempo real
                        setTimeout(() => { try { window.location.reload(); } catch { } }, 800);
                    }
                }
            }
            // Permitir volver a importar el mismo archivo si es necesario
            try { if (event?.target) (event.target as HTMLInputElement).value = ''; } catch { }
        };
        reader.readAsText(file);
    };

    const saveProject = async (graph: joint.dia.Graph | null) => {
        if (!graph) return;
        const diagramaObj = buildModelFromCurrent();
        try {
            if (projectId) {
                // actualizar diagrama del proyecto existente
                await projectApi.updateProjectDiagram(Number(projectId), diagramaObj);
                alert('Diagrama guardado en el proyecto.');
            } else {
                // fallback: crear proyecto nuevo
                const response = await projectApi.createProject({
                    name: 'Nuevo Proyecto',
                    description: 'Proyecto creado desde el lienzo',
                    diagrama_json: diagramaObj,
                    is_public: true,
                });
                console.log('Proyecto creado:', response);
                alert('Proyecto creado correctamente.');
            }
        } catch (error) {
            console.error('Error al guardar el proyecto:', error);
            alert('No se pudo guardar el proyecto. Revisa la consola para más detalles.');
        }
    };

    // Ensure active project id is set (so collaboration utilities and invitation API send correct project id)
    useEffect(() => {
        if (projectId) {
            setActiveProjectId(projectId);
        }
    }, [projectId]);

    // Cargar diagrama del backend cuando haya graph y projectId (también capturamos creatorId)
    useEffect(() => {
        const load = async () => {
            if (!graph || !projectId || loadedFromServerRef.current) return;
            try {
                const proj = await projectApi.getProjectById(Number(projectId));
                // OJO: el backend devuelve rol del usuario actual y colaboradores embebidos
                const roleLower = (proj?.rol || '').toLowerCase();
                setMyRole(roleLower as any);
                setIsOwner(roleLower === 'creador');
                // creatorId no usado directamente por UI
                // Mapear colaboradores si vienen en la respuesta
                const mappedColabs: ServerCollab[] = (proj as any)?.colaboradores ? (proj as any).colaboradores.map((col: any) => {
                    const u = col.usuario || {};
                    const name = u.name ?? u.nombre ?? '';
                    const email = u.email ?? u.correo ?? '';
                    const rolStr = String(col.rol || '').toLowerCase();
                    const isCreator = rolStr.includes('creador');
                    let role: 'editor' | 'vista' = rolStr.includes('editor') ? 'editor' : 'vista';
                    return { userId: u.id, name, email, role, isCreator };
                }) : [];
                setServerCollabs(mappedColabs);
                let data = proj?.diagrama_json;
                if (data) {
                    const showButtons = roleLower === 'creador' || roleLower === 'editor';
                    // Si viene como string, intentar parsear
                    try {
                        if (typeof data === 'string') {
                            data = JSON.parse(data);
                        }
                    } catch { }
                    if (data && typeof data === 'object' && Array.isArray((data as any).classes)) {
                        // Cargar desde modelo estructurado
                        console.log('Loading structured model from server...');
                        renderFromModel(data as DiagramModel, graph, showButtons);

                        // Unfreeze and force update for initial load
                        setTimeout(() => {
                            try {
                                console.log('Unfreezing paper after initial load...');
                                if (paper) {
                                    paper.unfreeze();

                                    // Force redraw all elements
                                    const elements = graph.getElements();
                                    console.log('Initial load: forcing update of', elements.length, 'elements');
                                    elements.forEach(element => {
                                        const view = paper.findViewByModel(element);
                                        if (view) {
                                            view.update();
                                        }
                                    });

                                    // Force a complete redraw
                                    try {
                                        (paper as any).dumpViews();
                                        (paper as any).renderViews();
                                    } catch { }
                                }
                            } catch (err) {
                                console.error('Error during initial paper update:', err);
                            }
                        }, 100);

                    } else if (data && typeof data === 'object') {
                        // Compatibilidad: JSON de JointJS anterior
                        console.log('Loading legacy JointJS format from server...');
                        const normalized = normalizeDiagramJSON(data);
                        try {
                            if (paper) {
                                paper.freeze();
                            }
                        } catch { }
                        try { (graph as any).fromJSON?.(normalized); } catch (e) { console.warn('fromJSON falló, JSON no es de JointJS', e); }
                        try {
                            const elements = (graph as any).getElements ? (graph as any).getElements() : [];
                            elements.forEach((el: any) => ensureClassMarkup(el, showButtons));
                        } catch { }
                        rebuildStateFromGraph(graph);

                        // Unfreeze after processing
                        setTimeout(() => {
                            try {
                                if (paper) {
                                    paper.unfreeze();
                                    console.log('Paper unfrozen after legacy format load');
                                }
                            } catch { }
                        }, 100);
                    } else {
                        // Formato desconocido: limpiar
                        setClasses([]);
                        setRelations([]);
                        setNextNumber(1);
                    }
                } else {
                    // limpiar estado por si acaso
                    setClasses([]);
                    setRelations([]);
                    setNextNumber(1);
                }
                loadedFromServerRef.current = true;
            } catch (err: any) {
                console.error('Error cargando proyecto:', err);
                const status = err?.response?.status;
                if (status === 403) {
                    alert('No tienes acceso a este proyecto.');
                } else if (status === 404) {
                    alert('Proyecto no encontrado.');
                } else {
                    alert('No se pudo cargar el proyecto.');
                }
            }
        };
        load();
    }, [graph, projectId, paper]);

    // Cargar colaboradores del servidor
    const loadServerCollaborators = async () => {
        if (!projectId) return;
        try {
            const proj = await projectApi.getProjectById(Number(projectId));
            const roleLower = (proj?.rol || '').toLowerCase();
            setMyRole(roleLower as any);
            setIsOwner(roleLower === 'creador');
            const mapped: ServerCollab[] = (proj as any)?.colaboradores ? (proj as any).colaboradores.map((col: any) => {
                const u = col.usuario || {};
                const name = u.name ?? u.nombre ?? '';
                const email = u.email ?? u.correo ?? '';
                const rolStr = String(col.rol || '').toLowerCase();
                const isCreator = rolStr.includes('creador');
                let role: 'editor' | 'vista' = rolStr.includes('editor') ? 'editor' : 'vista';
                return { userId: u.id, name, email, role, isCreator };
            }) : [];
            setServerCollabs(mapped);
        } catch (err) {
            console.error('No se pudieron cargar colaboradores del proyecto:', err);
        }
    };

    // Cargar colaboradores al abrir el panel o al cambiar projectId
    useEffect(() => {
        if (openCollab) loadServerCollaborators();
    }, [openCollab, projectId]);

    // Obtener recomendaciones de atributos via IA
    const fetchRecommendations = async () => {
        if (!(myRole === 'creador' || myRole === 'editor')) return;
        if (!projectId) return;
        try {
            setRecoLoading(true);
            const proj = await projectApi.getProjectById(Number(projectId));
            const title = proj?.name || 'Proyecto';
            const classPayload = classesRef.current.map(c => ({
                displayId: c.displayId,
                name: c.name,
                attributes: c.attributes.map(parseAttrString)
            }));
            const recos = await suggestAttributesForClasses(title, classPayload);
            // Filtra atributos que ya existan
            const dedup = recos.map(r => ({
                ...r,
                attributes: r.attributes.filter(a => !classesRef.current.find(c => c.displayId === r.displayId)?.attributes.some(ex => ex.split(':')[0].trim().toLowerCase() === a.name.trim().toLowerCase()))
            })).filter(r => r.attributes.length > 0);
            setRecoList(dedup);
        } catch (e) {
            console.error('No se pudieron obtener recomendaciones', e);
            setRecoList([]);
        } finally {
            setRecoLoading(false);
        }
    };

    // Nueva: obtener recomendaciones de CLASES/tablas desde IA usando el título del proyecto
    const fetchClassRecommendations = async () => {
        if (!(myRole === 'creador' || myRole === 'editor')) return;
        if (!projectId) return;
        try {
            setClassRecoLoading(true);
            const proj = await projectApi.getProjectById(Number(projectId));
            const title = proj?.name || 'Proyecto';
            const existing = classesRef.current.map(c => c.name);
            const suggestions = await suggestClassesFromProjectTitle(title, existing);
            // Limpia nombres vacíos o duplicados vs existentes
            const filtered = (suggestions || []).filter(s => s.name && !existing.includes(s.name));
            setClassRecoList(filtered);
        } catch (e) {
            console.error('Error obteniendo recomendaciones de clases:', e);
            setClassRecoList([]);
        } finally {
            setClassRecoLoading(false);
        }
    };

    // Nueva: obtener recomendaciones de RELACIONES entre clases
    const fetchRelationRecommendations = async () => {
        if (!(myRole === 'creador' || myRole === 'editor')) return;
        if (!projectId) return;
        try {
            setRelRecoLoading(true);
            const proj = await projectApi.getProjectById(Number(projectId));
            const title = proj?.name || 'Proyecto';
            const names = classesRef.current.map(c => c.name);
            const rels = await suggestRelationsFromProjectTitle(title, names);
            // Filtrar relaciones hacia clases realmente existentes y evitar duplicados exactos
            const key = (r: RelationSuggestion) => `${r.originName}__${r.destName}__${r.relationType || 'asociacion'}__${r.originCard || ''}__${r.destCard || ''}__${r.verb || ''}`;
            const seen = new Set<string>();
            const filtered = (rels || []).filter(r => {
                const k = key(r); if (seen.has(k)) return false; seen.add(k); return true;
            });
            setRelRecoList(filtered);
        } catch (e) {
            console.error('Error obteniendo recomendaciones de relaciones:', e);
            setRelRecoList([]);
        } finally {
            setRelRecoLoading(false);
        }
    };

    const applyAttributesToClass = (displayId: number, attrs: Array<{ name: string; type: string }>) => {
        if (!graph) return;
        const cls = classesRef.current.find(c => c.displayId === displayId);
        if (!cls || !cls.element) return;
        // Une atributos nuevos al texto
        const newAttrsText = [
            ...cls.attributes,
            ...attrs.map(a => `${a.name}: ${a.type}`)
        ];
        const newMethods = cls.methods;
        const labelText = toLabelText(cls.name, newAttrsText.map(parseAttrString));
        const fontSize = 12;
        const paddingX = 20; const paddingY = 30;
        const lines = labelText.split('\n');
        let maxLineWidth = 0; lines.forEach(line => { const m = measureText(line, fontSize); if (m.width > maxLineWidth) maxLineWidth = m.width; });
        const width = Math.max(220, maxLineWidth + paddingX);
        const height = fontSize * lines.length + paddingY;
        try {
            cls.element.attr({
                label: { text: labelText, fontWeight: 'bold', fontSize: 12, fill: '#2477c3', fontFamily: 'monospace', xAlignment: 'middle' },
            });
            cls.element.resize(width, height);
            const baseMarkup: any[] = [
                { tagName: 'rect', selector: 'body' },
                { tagName: 'text', selector: 'label' },
                { tagName: 'rect', selector: 'idBg' },
                { tagName: 'text', selector: 'idBadge' },
                {
                    tagName: 'g', children: [
                        { tagName: 'text', selector: 'editIcon', className: 'edit-btn', attributes: { class: 'edit-btn', x: (width - 55), y: 22, fontSize: 20, fill: '#007bff', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '⚙️' },
                        { tagName: 'text', selector: 'deleteIcon', className: 'delete-btn', attributes: { class: 'delete-btn', x: (width - 30), y: 22, fontSize: 20, fill: '#dc3545', fontWeight: 'bold', textAnchor: 'middle', cursor: 'pointer' }, textContent: '❌' }
                    ]
                }
            ];
            (cls.element as any).markup = baseMarkup;
            clampElementInside(cls.element);
        } catch { }
        // Actualiza estado
        setClasses(prev => prev.map(c => c.displayId === displayId ? { ...c, attributes: newAttrsText } : c));
        // Broadcast edición mínima
        const pidNum = projectId ? Number(projectId) : Number(getActiveProjectId() || 0);
        if (pidNum) {
            try {
                const payload: DiagramUpdate = {
                    projectId: pidNum,
                    userId: Number(localStorage.getItem('userId') || 0),
                    diagramData: {
                        displayId,
                        name: cls.name,
                        attributes: newAttrsText.map(parseAttrString),
                        methods: newMethods.map(parseMethodString),
                        size: { width, height }
                    },
                    changeType: 'edit_element',
                    elementId: displayId,
                    timestamp: new Date().toISOString()
                };
                try { if (socketService.isConnected() && !socketService.isInProject(pidNum)) socketService.joinProject(pidNum); } catch { }
                socketService.sendDiagramUpdate(payload);
                scheduleAutoSave();
            } catch { }
        }
    };

    return (
        <div className='diagrama-contenedor'>
            {/* Sidebar (oculto para rol vista) */}
            {myRole !== 'vista' && (
                <aside className="sidebar">
                    <h3>Herramientas UML</h3>
                    <div className="sidebar-actions-row">
                        <button onClick={nuevaClase} className="btn btn-primary">➕ Nueva Clase</button>
                        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">← Volver</button>
                    </div>
                    <div className="sidebar-section">
                        <div className="sidebar-title">Relaciones</div>
                        <div className="field">
                            <label>Tipo de relación</label>
                            <select value={relationType} onChange={e => setRelationType(e.target.value)} className="control">
                                <option value="asociacion">Asociación</option>
                                <option value="herencia">Herencia</option>
                                <option value="agregacion">Agregación</option>
                                <option value="composicion">Composición</option>
                            </select>
                        </div>
                        <div className="field">
                            <label>Card. origen</label>
                            {relationType === 'asociacion' ? (
                                <input type="text" value={originCard} onChange={e => setOriginCard(e.target.value)} className="input-sm" placeholder="1..*" />
                            ) : (
                                <input type="text" value={originCard} disabled className="input-sm" placeholder="--" />
                            )}
                        </div>
                        <div className="field">
                            <label>Card. destino</label>
                            {relationType === 'asociacion' ? (
                                <input type="text" value={destCard} onChange={e => setDestCard(e.target.value)} className="input-sm" placeholder="1..*" />
                            ) : (
                                <input type="text" value={destCard} disabled className="input-sm" placeholder="--" />
                            )}
                        </div>
                        {relationType === 'asociacion' && (
                            <div className="field">
                                <label>Verbo</label>
                                <input
                                    type="text"
                                    value={relationVerb}
                                    onChange={e => setRelationVerb(e.target.value)}
                                    className="control"
                                    placeholder="p. ej. contiene"
                                />
                            </div>
                        )}
                        <div className="field">
                            <label>Número origen</label>
                            <input
                                type="number"
                                value={originNum}
                                onChange={e => setOriginNum(e.target.value)}
                                className={`input-sm ${originNum ? '' : 'input-error'}`}
                            />
                        </div>
                        <div className="field">
                            <label>Número destino</label>
                            <input
                                type="number"
                                value={destNum}
                                onChange={e => setDestNum(e.target.value)}
                                className={`input-sm ${destNum ? '' : 'input-error'}`}
                            />
                        </div>
                        <button
                            onClick={crearRelacion}
                            disabled={!originNum || !destNum}
                            className="btn btn-block btn-accent"
                            title={!originNum || !destNum ? 'Completa los números para dibujar' : 'Dibujar relación'}
                        >
                            🔗 Dibujar Relación
                        </button>
                    </div>

                    {/* Opciones de importación y exportación */}
                    <div className="sidebar-section">
                        <div className="sidebar-title">Archivo / Proyecto</div>
                        <button onClick={() => downloadDiagramAsJSON(graph)} className="btn btn-block" title="Exportar diagrama como JSON">
                            <FiDownload /> <span>Exportar JSON</span>
                        </button>
                        <label className="btn btn-block btn-import" title="Importar diagrama desde JSON">
                            <FiUpload /> <span>Importar JSON</span>
                            <input type="file" accept="application/json" onChange={e => uploadDiagramFromJSON(e, graph)} className="file-input-hidden" />
                        </label>
                        <button
                            className="btn btn-block btn-primary"
                            title="Importar Imagen"
                            onClick={() => setShowImportImageModal(true)}
                        >
                            Importar Imagen
                        </button>
                        <button onClick={() => saveProject(graph)} className="btn btn-block btn-primary" title="Guardar proyecto">
                            💾 Guardar Proyecto
                        </button>

                        <button
                            onClick={() => {
                                if (projectId) {
                                    navigate(`/generate/${projectId}`);
                                } else {
                                    alert('Primero abre o guarda un proyecto para generar el backend.');
                                }
                            }}
                            className="btn btn-block"
                            title="Generar Backend (Spring Boot)"
                            style={{
                                backgroundColor: '#6db33f',
                                color: 'white',
                                border: '1px solid #6db33f'
                            }}
                        >🍃 Generar Backend</button>
                    </div>
                </aside>
            )}

            {/* Canvas wrapper: paper host + overlays */}
            <div className="canvas">
                {/* JointJS host - dedicated container to avoid React/JointJS DOM conflicts */}
                <div className="paper-host" ref={diagramaRef} style={{ width: '100%', height: '100%' }} />
                {/* Recomendaciones toggle (visible) */}
                <button
                    onClick={() => { const next = !openReco; setOpenReco(next); if (next) fetchRecommendations(); }}
                    title={myRole === 'vista' ? 'Solo lectura' : 'Recomendaciones IA'}
                    disabled={myRole === 'vista'}
                    style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        zIndex: 5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#fef3c7',
                        color: '#92400e',
                        border: '1px solid #f59e0b',
                        borderRadius: 8,
                        padding: '6px 10px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                        cursor: myRole === 'vista' ? 'not-allowed' : 'pointer'
                    }}
                >
                    <FaRegLightbulb />
                    <span style={{ fontWeight: 700 }}>Recomendaciones</span>
                </button>

                {/* Acceso rápido al Chat Bot (side panel) */}
                <button
                    onClick={() => setOpenChatBot(!openChatBot)}
                    title={openChatBot ? 'Ocultar Chat Bot' : 'Mostrar Chat Bot'}
                    style={{
                        position: 'absolute',
                        top: 10,
                        right: 350,
                        zIndex: 5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#eef2ff',
                        color: '#3730a3',
                        border: '1px solid #6366f1',
                        borderRadius: 8,
                        padding: '6px 10px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                        cursor: 'pointer'
                    }}
                >
                    💬
                    <span style={{ fontWeight: 700 }}>Chat Bot</span>
                </button>

                {/* Toggle para recomendaciones de CLASES/tablas */}
                <button
                    onClick={() => { const next = !openClassReco; setOpenClassReco(next); if (next) fetchClassRecommendations(); }}
                    title={myRole === 'vista' ? 'Solo lectura' : 'Recomendar Clases/Tablas'}
                    disabled={myRole === 'vista'}
                    style={{
                        position: 'absolute',
                        top: 10,
                        right: 180,
                        zIndex: 5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#e0f2fe',
                        color: '#075985',
                        border: '1px solid #38bdf8',
                        borderRadius: 8,
                        padding: '6px 10px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                        cursor: myRole === 'vista' ? 'not-allowed' : 'pointer'
                    }}
                >
                    <FaPlus />
                    <span style={{ fontWeight: 700 }}>Clases sugeridas</span>
                </button>

                {/* Toggle para recomendaciones de RELACIONES */}
                {/* <button
                    onClick={() => { const next = !openRelReco; setOpenRelReco(next); if (next) fetchRelationRecommendations(); }}
                    title={myRole === 'vista' ? 'Solo lectura' : 'Recomendar Relaciones'}
                    disabled={myRole === 'vista'}
                    style={{
                        position: 'absolute', top: 10, right: 380, zIndex: 5, display: 'flex', alignItems: 'center', gap: 8,
                        background: '#eef2ff', color: '#3730a3', border: '1px solid #6366f1', borderRadius: 8, padding: '6px 10px', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', cursor: myRole === 'vista' ? 'not-allowed' : 'pointer'
                    }}
                >
                    <FaRegLightbulb />
                    <span style={{ fontWeight: 700 }}>Relaciones sugeridas</span>
                </button> */}

                {/* Panel lateral de recomendaciones visible */}
                {openReco && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 54,
                            right: 10,
                            width: 360,
                            maxWidth: '90vw',
                            height: '70%',
                            maxHeight: '80vh',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 10,
                            boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                            zIndex: 5,
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc', borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FaRegLightbulb style={{ color: '#f59e0b' }} />
                                <strong>Recomendaciones IA</strong>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={fetchRecommendations} disabled={recoLoading} style={{ background: '#f59e0b', color: '#fff', border: 0, borderRadius: 6, padding: '6px 10px' }}>{recoLoading ? 'Cargando…' : 'Actualizar'}</button>
                                <button onClick={() => setOpenReco(false)} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, padding: '6px 10px' }}>Cerrar</button>
                            </div>
                        </div>
                        <div style={{ padding: 10, overflow: 'auto' }}>
                            {recoList.length === 0 && !recoLoading && (
                                <p style={{ color: '#6b7280' }}>No hay sugerencias por ahora. Haz clic en "Actualizar" para intentar de nuevo.</p>
                            )}
                            {recoList.map(r => (
                                <div key={`reco-panel-${r.displayId}`} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                                    <div style={{ fontWeight: 700, marginBottom: 6 }}>#{r.displayId} {r.className}</div>
                                    <ul style={{ margin: '0 0 8px 18px' }}>
                                        {r.attributes.map((a, idx) => (
                                            <li key={idx}>
                                                <code>{a.name}: {a.type}</code> {a.reason && <span style={{ color: '#6b7280' }}>– {a.reason}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                    <button onClick={() => applyAttributesToClass(r.displayId, r.attributes)} style={{ width: '100%', background: '#10b981', color: '#fff', border: 0, borderRadius: 6, padding: '8px 10px' }}>
                                        Aplicar atributos
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Panel lateral para recomendaciones de clases/tablas */}
                {openClassReco && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 54,
                            right: 380,
                            width: 360,
                            maxWidth: '90vw',
                            height: '70%',
                            maxHeight: '80vh',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 10,
                            boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                            zIndex: 5,
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', background: '#f0f9ff', borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FaPlus style={{ color: '#0284c7' }} />
                                <strong>Clases sugeridas por IA</strong>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={fetchClassRecommendations} disabled={classRecoLoading} style={{ background: '#0284c7', color: '#fff', border: 0, borderRadius: 6, padding: '6px 10px' }}>{classRecoLoading ? 'Cargando…' : 'Actualizar'}</button>
                                <button onClick={addAllSuggestedClasses} disabled={classRecoLoading || classRecoList.length === 0} style={{ background: '#10b981', color: '#fff', border: 0, borderRadius: 6, padding: '6px 10px' }}>{classRecoLoading ? 'Aplicando…' : 'Agregar todas + relaciones'}</button>
                                <button onClick={() => setOpenClassReco(false)} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, padding: '6px 10px' }}>Cerrar</button>
                            </div>
                        </div>
                        <div style={{ padding: 10, overflow: 'auto' }}>
                            {classRecoList.length === 0 && !classRecoLoading && (
                                <p style={{ color: '#6b7280' }}>No hay sugerencias por ahora. Haz clic en "Actualizar" para intentar de nuevo.</p>
                            )}
                            {classRecoList.map((sug, idx) => (
                                <div key={`class-reco-${idx}`} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{sug.name}</div>
                                    {sug.reason && <div style={{ color: '#6b7280', marginBottom: 6 }}>{sug.reason}</div>}
                                    {sug.attributes && sug.attributes.length > 0 && (
                                        <ul style={{ margin: '0 0 8px 18px' }}>
                                            {sug.attributes.map((a, i2) => (
                                                <li key={i2}><code>{a.name}: {a.type}</code> {a.reason && <span style={{ color: '#6b7280' }}>– {a.reason}</span>}</li>
                                            ))}
                                        </ul>
                                    )}
                                    <button onClick={() => addSuggestedClass(sug)} style={{ width: '100%', background: '#10b981', color: '#fff', border: 0, borderRadius: 6, padding: '8px 10px' }}>
                                        Agregar clase
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Panel lateral para Chat Bot */}
                {openChatBot && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 54,
                            right: 750,
                            width: 360,
                            maxWidth: '90vw',
                            height: '70%',
                            maxHeight: '80vh',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 10,
                            boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                            zIndex: 5,
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', background: '#eef2ff', borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: '#3730a3' }}>💬</span>
                                <strong>Chat Bot</strong>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => setOpenChatBot(false)} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, padding: '6px 10px' }}>Cerrar</button>
                            </div>
                        </div>
                        <div style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <ChatBotPanel />
                        </div>
                    </div>
                )}

                {/* Panel lateral para recomendaciones de relaciones */}
                {openRelReco && (
                    <div
                        style={{ position: 'absolute', top: 54, right: 750, width: 360, maxWidth: '90vw', height: '70%', maxHeight: '80vh', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,0.15)', zIndex: 5, display: 'flex', flexDirection: 'column' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', background: '#eef2ff', borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FaRegLightbulb style={{ color: '#6366f1' }} />
                                <strong>Relaciones sugeridas por IA</strong>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={fetchRelationRecommendations} disabled={relRecoLoading} style={{ background: '#6366f1', color: '#fff', border: 0, borderRadius: 6, padding: '6px 10px' }}>{relRecoLoading ? 'Cargando…' : 'Actualizar'}</button>
                                <button onClick={() => { relRecoList.forEach(r => applySuggestedRelation(r)); }} disabled={relRecoList.length === 0} style={{ background: '#10b981', color: '#fff', border: 0, borderRadius: 6, padding: '6px 10px' }}>Aplicar todas</button>
                                <button onClick={() => setOpenRelReco(false)} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, padding: '6px 10px' }}>Cerrar</button>
                            </div>
                        </div>
                        <div style={{ padding: 10, overflow: 'auto' }}>
                            {relRecoList.length === 0 && !relRecoLoading && (
                                <p style={{ color: '#6b7280' }}>No hay sugerencias por ahora. Haz clic en "Actualizar" para intentar de nuevo.</p>
                            )}
                            {relRecoList.map((rel, idx) => (
                                <div key={`rel-reco-${idx}`} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{rel.originName} → {rel.destName} ({rel.relationType || 'asociacion'})</div>
                                    {rel.reason && <div style={{ color: '#6b7280', marginBottom: 6 }}>{rel.reason}</div>}
                                    {rel.relationType === 'asociacion' && (
                                        <div style={{ color: '#111', marginBottom: 6 }}>Cardinalidad: {rel.originCard || '1..1'} → {rel.destCard || '1..1'} {rel.verb ? `• ${rel.verb}` : ''}</div>
                                    )}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => applySuggestedRelation(rel)} style={{ background: '#10b981', color: '#fff', border: 0, borderRadius: 6, padding: '8px 10px' }}>Aplicar</button>
                                        <button onClick={() => deleteSuggestedRelation(rel)} style={{ background: '#ef4444', color: '#fff', border: 0, borderRadius: 6, padding: '8px 10px' }}>Eliminar</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="zoom-controls">
                    <button
                        className="zoom-btn"
                        onClick={() => {
                            if (!paper) return;
                            const ns = Math.max(0.4, Math.min(2, scale - 0.1));
                            paper.scale(ns, ns);
                            setScale(ns);
                        }}
                        title="Zoom -"
                    >-</button>
                    <span className="zoom-level">{Math.round(scale * 100)}%</span>
                    <button
                        className="zoom-btn"
                        onClick={() => {
                            if (!paper) return;
                            const ns = Math.max(0.4, Math.min(2, scale + 0.1));
                            paper.scale(ns, ns);
                            setScale(ns);
                        }}
                        title="Zoom +"
                    >+</button>
                    {/* Botón de Spring Boot movido al sidebar (Archivo / Proyecto) */}
                </div>
            </div>

            {/* Modal de edición de clase */}
            {editModal.visible && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Editar Clase UML</h3>
                        <form onSubmit={e => {
                            e.preventDefault();
                            // Seguridad adicional: solo creador/editor pueden guardar cambios de edición
                            if (!(myRole === 'creador' || myRole === 'editor')) {
                                alert('No tienes permisos para editar esta clase.');
                                return;
                            }
                            const attrsText = editModal.attributesArr
                                .filter(it => it.name.trim())
                                .map(it => `${it.name.trim()}: ${it.type.trim() || 'Any'}`);
                            const methodsText = editModal.methodsArr
                                .filter(it => it.name.trim())
                                .map(it => `${it.name.trim()}(): ${it.returns.trim() || 'void'}`);
                            const newLabelText = `${editModal.title}\n-----------------------\n${attrsText.join('\n')}\n-----------------------\n${methodsText.join('\n')}`;
                            const fontSize = 15;
                            const paddingX = 40;
                            const paddingY = 60;
                            const lines = newLabelText.split('\n');
                            let maxLineWidth = 0;
                            lines.forEach(line => {
                                const { width } = measureText(line, fontSize);
                                if (width > maxLineWidth) maxLineWidth = width;
                            });
                            const width = Math.max(220, maxLineWidth + paddingX);
                            const height = fontSize * lines.length + paddingY;

                            editModal.element.attr({
                                label: {
                                    text: newLabelText,
                                    fontWeight: 'bold',
                                    fontSize: fontSize,
                                    fill: '#2477c3',
                                    fontFamily: 'monospace',
                                    xAlignment: 'middle'
                                },
                                idBg: {
                                    x: 10,
                                    y: 10,
                                    width: 26,
                                    height: 18,
                                    fill: '#2477c3',
                                    rx: 4,
                                    ry: 4
                                },
                                idBadge: {
                                    text: String((classes.find(c => c.element === editModal.element)?.displayId) ?? ''),
                                    x: 23,
                                    y: 23,
                                    fontSize: 12,
                                    fontWeight: 'bold',
                                    fill: '#ffffff',
                                    textAnchor: 'middle'
                                }
                            });
                            editModal.element.resize(width, height);
                            clampElementInside(editModal.element);

                            // Reubica los botones SVG
                            editModal.element.markup = [
                                { tagName: 'rect', selector: 'body' },
                                { tagName: 'text', selector: 'label' },
                                { tagName: 'rect', selector: 'idBg' },
                                { tagName: 'text', selector: 'idBadge' },
                                {
                                    tagName: 'g',
                                    children: [
                                        {
                                            tagName: 'text',
                                            selector: 'editIcon',
                                            className: 'edit-btn',
                                            attributes: {
                                                class: 'edit-btn',
                                                x: width - 55,
                                                y: 22,
                                                fontSize: 20,
                                                fill: '#007bff',
                                                fontWeight: 'bold',
                                                textAnchor: 'middle',
                                                cursor: 'pointer',
                                            },
                                            textContent: '⚙️'
                                        },
                                        {
                                            tagName: 'text',
                                            selector: 'deleteIcon',
                                            className: 'delete-btn',
                                            attributes: {
                                                class: 'delete-btn',
                                                x: width - 30,
                                                y: 22,
                                                fontSize: 20,
                                                fill: '#dc3545',
                                                fontWeight: 'bold',
                                                textAnchor: 'middle',
                                                cursor: 'pointer',
                                            },
                                            textContent: '❌'
                                        }
                                    ]
                                }
                            ];

                            // Actualiza el estado de clases para reflejar los cambios en arrays (opcional)
                            setClasses(prev => prev.map(c => c.element === editModal.element ? {
                                ...c,
                                name: editModal.title,
                                attributes: attrsText,
                                methods: methodsText
                            } : c));

                            setEditModal({ ...editModal, visible: false });
                            // broadcast edit (minimal payload)
                            try {
                                const pid = projectId ? Number(projectId) : getActiveProjectId();
                                const cls = classes.find(c => c.element === editModal.element);
                                const displayId = cls?.displayId;
                                if (pid && displayId != null) {
                                    const attrs: UMLAttribute[] = editModal.attributesArr.map(a => ({ name: a.name.trim(), type: (a.type || 'Any').trim() }));
                                    const methods: UMLMethod[] = editModal.methodsArr.map(m => ({ name: m.name.trim(), returns: (m.returns || 'void').trim() }));
                                    let size: { width: number; height: number } | undefined;
                                    try { const s = editModal.element.size ? editModal.element.size() : undefined; if (s) size = { width: s.width, height: s.height }; } catch { }
                                    const payload: DiagramUpdate = {
                                        projectId: Number(pid),
                                        userId: Number(localStorage.getItem('userId') || 0),
                                        diagramData: { displayId, name: editModal.title, attributes: attrs, methods, size },
                                        changeType: 'edit_element',
                                        elementId: displayId,
                                        timestamp: new Date().toISOString()
                                    };
                                    socketService.sendDiagramUpdate(payload);
                                }
                            } catch (err) { }
                        }}>
                            <label>Título:</label>
                            <input type="text" value={editModal.title} onChange={e => setEditModal({ ...editModal, title: e.target.value })} />
                            {/* Atributos dinámicos */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                                <label style={{ margin: 0 }}>Atributos:</label>
                                <button type="button" onClick={() => setEditModal(m => ({ ...m, attributesArr: [...m.attributesArr, { name: '', type: '' }] }))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4 }}>
                                    <FaPlus /> Agregar atributo
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                                {editModal.attributesArr.map((attr, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                                        <input placeholder="nombre" value={attr.name} onChange={e => setEditModal(m => {
                                            const arr = [...m.attributesArr];
                                            arr[idx] = { ...arr[idx], name: e.target.value };
                                            return { ...m, attributesArr: arr };
                                        })} />
                                        <input placeholder="tipo (String, Int, ...)" value={attr.type} onChange={e => setEditModal(m => {
                                            const arr = [...m.attributesArr];
                                            arr[idx] = { ...arr[idx], type: e.target.value };
                                            return { ...m, attributesArr: arr };
                                        })} />
                                        <button type="button" onClick={() => setEditModal(m => ({ ...m, attributesArr: m.attributesArr.filter((_, i) => i !== idx) }))} title="Eliminar" style={{ padding: 6, backgroundColor: 'red' }}>
                                            <FcDeleteDatabase />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Métodos dinámicos */}
                            {/* <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                                <label style={{ margin: 0 }}>Métodos:</label>
                                <button type="button" onClick={() => setEditModal(m => ({ ...m, methodsArr: [...m.methodsArr, { name: '', returns: '' }] }))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4 }}>
                                    <FaPlus /> Agregar método
                                </button>
                            </div> */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                                {editModal.methodsArr.map((mt, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                                        <input placeholder="nombre" value={mt.name} onChange={e => setEditModal(m => {
                                            const arr = [...m.methodsArr];
                                            arr[idx] = { ...arr[idx], name: e.target.value };
                                            return { ...m, methodsArr: arr };
                                        })} />
                                        <input placeholder="retorna (void, String, ...)" value={mt.returns} onChange={e => setEditModal(m => {
                                            const arr = [...m.methodsArr];
                                            arr[idx] = { ...arr[idx], returns: e.target.value };
                                            return { ...m, methodsArr: arr };
                                        })} />
                                        <button type="button" onClick={() => setEditModal(m => ({ ...m, methodsArr: m.methodsArr.filter((_, i) => i !== idx) }))} title="Eliminar" style={{ padding: 6, backgroundColor: 'red' }}>
                                            <FcDeleteDatabase />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                                <button type="submit">Guardar</button>
                                <button type="button" onClick={() => setEditModal({ ...editModal, visible: false })}>Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Botón flotante de AudioIA (oculto para vista) */}
            {myRole !== 'vista' && (
                <>
                    <div className='audio-toggle-container'>
                        <button className='audio-toggle-btn' onClick={() => setOpen(!open)} title={open ? 'Ocultar AudioIA' : 'Mostrar AudioIA'}>
                            <FcReddit size={45} />
                        </button>
                    </div>
                    <section className={`audioia-section${open ? ' open' : ''}`}>
                        {open && <AudioIAPage />}
                    </section>
                </>
            )}

            {/* Colaboradores Panel */}
            <div className='collab-toggle-container'>
                <button className='collab-toggle-btn' onClick={() => setOpenCollab(!openCollab)} title={openCollab ? 'Ocultar Colaboradores' : 'Mostrar Colaboradores'}>
                    👥
                </button>
            </div>
            <section className={`collab-section${openCollab ? ' open' : ''}`}>
                {openCollab && (
                    <div className='collab-panel'>
                        <div className='collab-head'>
                            <strong>Colaboradores</strong>
                            <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>
                                {isOwner ? '(Eres el creador)' : '(Solo lectura)'}
                            </span>
                            <button style={{ marginLeft: 'auto' }} onClick={loadServerCollaborators}>↻</button>
                        </div>
                        <div className='collab-list'>
                            {serverCollabs.length === 0 && <div className='empty'>Sin colaboradores aún.</div>}
                            {serverCollabs.map(c => {
                                const isCreatorRow = !!c.isCreator;
                                return (
                                    <div key={c.userId} className='collab-item'>
                                        <div>
                                            <div className='name'>{c.name}{isCreatorRow ? ' (Creador)' : ''}</div>
                                            <div className='meta'>{c.email || 'Sin email'}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <select
                                                value={c.role}
                                                disabled={!isOwner || isCreatorRow}
                                                onChange={async (e) => {
                                                    const newRole = e.target.value as 'editor' | 'vista';
                                                    try {
                                                        await projectApi.updateCollaboratorRole(Number(projectId), c.userId, newRole);
                                                        addActivity(String(projectId), { type: 'note', message: `Rol de ${c.name} cambiado a ${newRole}`, by: undefined });
                                                        await loadServerCollaborators();
                                                    } catch (err: any) {
                                                        console.error('No se pudo actualizar el rol:', err);
                                                        alert('No se pudo actualizar el rol. ¿Eres el creador del proyecto?');
                                                    }
                                                }}
                                            >
                                                <option value='editor'>editor</option>
                                                <option value='vista'>vista</option>
                                            </select>
                                            {isOwner && !isCreatorRow && (
                                                <button
                                                    className='icon danger'
                                                    onClick={async () => {
                                                        if (!projectId) return;
                                                        if (!confirm(`¿Quitar a ${c.name} del proyecto?`)) return;
                                                        try {
                                                            await projectApi.removeCollaborator(Number(projectId), c.userId);
                                                            addActivity(String(projectId), { type: 'note', message: `Se removió a ${c.name} del proyecto`, by: undefined });
                                                            await loadServerCollaborators();
                                                        } catch (err) {
                                                            console.error('Error removiendo colaborador:', err);
                                                            alert('No se pudo remover al colaborador.');
                                                        }
                                                    }}
                                                >✖</button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {isOwner && (
                            <div className='collab-form'>
                                <input placeholder='Email del colaborador (requerido)' value={collabDraft.email} onChange={e => setCollabDraft(d => ({ ...d, email: e.target.value }))} />
                                <select value={collabDraft.role} onChange={e => setCollabDraft(d => ({ ...d, role: e.target.value as any }))}>
                                    <option value='editor'>Editor</option>
                                    <option value='vista'>Vista</option>
                                </select>
                                <button className='ai-btn primary' onClick={async () => {
                                    // Preferir projectId de la URL (param) y fallback a localStorage
                                    const pidRaw = (typeof projectId !== 'undefined' && projectId) ? projectId : getActiveProjectId();
                                    if (!pidRaw || !collabDraft.email?.trim()) {
                                        alert('Por favor ingresa el correo del usuario a invitar y asegúrate de estar en un proyecto válido.');
                                        return;
                                    }
                                    const pidNum = Number(pidRaw);
                                    if (Number.isNaN(pidNum) || pidNum <= 0) {
                                        alert('ID de proyecto inválido. Recarga la página o abre el proyecto desde el panel de proyectos.');
                                        return;
                                    }

                                    // Verificar token presente
                                    const token = localStorage.getItem('token');
                                    if (!token) {
                                        alert('No estás autenticado. Inicia sesión antes de invitar colaboradores.');
                                        return;
                                    }

                                    try {
                                        // Obtener permisos disponibles y elegir según rol
                                        const permisos = await invitationApi.getPermissions();
                                        const roleLower = collabDraft.role?.toLowerCase() || 'editor';
                                        let permisoEncontrado = permisos.find(p => (p.nombre || '').toLowerCase().includes(roleLower));
                                        if (!permisoEncontrado) permisoEncontrado = permisos[0];
                                        const permisoId = permisoEncontrado ? permisoEncontrado.id : 2;

                                        // Enviar invitación al backend (usa solo email)
                                        await invitationApi.sendInvitation({ projectId: pidNum, toUserEmail: collabDraft.email.trim(), permissionId: permisoId, mensaje: `Invitación para colaborar como ${collabDraft.role}` });

                                        // Registrar actividad localmente
                                        addActivity(String(pidNum), { type: 'note', message: `Invitación enviada a ${collabDraft.email.trim()} como ${collabDraft.role}`, by: undefined });
                                        setActivities(getActivities(String(pidNum)));

                                        // Limpiar formulario
                                        setCollabDraft({ name: '', email: '', role: 'editor' });

                                        // Refrescar invitaciones en el store
                                        dispatch(fetchSentInvitations() as any);
                                        dispatch(fetchReceivedInvitations() as any);
                                        // Intentar refrescar colaboradores si el backend los incluye inmediatamente al aceptar; por ahora solo recargamos lista
                                        await loadServerCollaborators();
                                    } catch (err: any) {
                                        console.error('Error enviando invitación:', err);
                                        const status = err?.response?.status;
                                        if (status === 403) {
                                            alert('No tienes permisos para invitar: el servidor respondió 403 (Solo el creador puede enviar invitaciones). Asegúrate de estar en el proyecto correcto y ser el creador.');
                                        } else if (status === 404) {
                                            alert('Usuario destinatario no encontrado en el sistema (404). El correo debe corresponder a un usuario registrado.');
                                        } else {
                                            alert('No se pudo enviar la invitación. Revisa la consola para más detalles.');
                                        }
                                    }
                                }}>Agregar</button>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* Actividades Panel */}
            <div className='activity-toggle-container'>
                <button className='activity-toggle-btn' onClick={() => setOpenActivity(!openActivity)} title={openActivity ? 'Ocultar Actividades' : 'Mostrar Actividades'}>
                    📝
                </button>
            </div>
            <section className={`activity-section${openActivity ? ' open' : ''}`}>
                {openActivity && (
                    <div className='activity-panel'>
                        <div className='collab-head'>
                            <strong>Actividad del proyecto</strong>
                        </div>
                        <div className='activity-list'>
                            {activities.length === 0 && <div className='empty'>Aún no hay actividad.</div>}
                            {activities.map(a => (
                                <div key={a.id} className='activity-item'>
                                    <div className='meta-time'>{new Date(a.at).toLocaleString()}</div>
                                    <div className='message'>{a.message}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>
<<<<<<< HEAD

            {/* Modal de Importar Imagen */}
            <ImportImageModal
                isOpen={showImportImageModal}
                onClose={() => setShowImportImageModal(false)}
                onUpload={handleUploadImage}
                onAnalyzeWithAI={handleAnalyzeImageWithAI}
            />
=======
            {showImportImageModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 transition-all duration-300">
                    <div className="bg-white rounded-2xl w-full max-w-lg mx-auto relative flex flex-col border border-blue-200 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600">
                            <div className="flex items-center gap-2">
                                <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5jYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTJ2N2EyIDIgMCAwIDEtMiAySDVhMiAyIDAgMCAxLTItMlY1YTIgMiAwIDAgMSAyLTJoMTEiPjwvcGF0aD48cG9seWxpbmUgcG9pbnRzPSIxNyAxIDIxIDUgMTcgOSI+PC9wb2x5bGluZT48bGluZSB4MT0iMyIgeTE9IjE1IiB4Mj0iMTciIHkyPSIxNSI+PC9saW5lPjwvc3ZnPg==" 
                                    alt="" className="w-6 h-6" />
                                <h2 className="text-xl font-semibold text-white">
                                    Importar Imagen
                                </h2>
                            </div>
                        </div>

                        {/* Área de arrastrar y soltare */}
                        <div className="p-6">
                            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-blue-400 rounded-lg cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <svg className="w-10 h-10 mb-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                                    </svg>
                                    <p className="mb-2 text-sm text-blue-600">
                                        <span className="font-semibold">Click para seleccionar</span> o arrastra una imagen
                                    </p>
                                    <p className="text-xs text-blue-500">PNG, JPG, GIF hasta 10MB</p>
                                </div>
                                <input type="file" 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={handleImageChange} 
                                />
                            </label>

                            {/* Preview */}
                            {previewUrl && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <img 
                                        src={previewUrl} 
                                        alt="Preview" 
                                        className="max-h-[200px] mx-auto object-contain rounded-lg" 
                                    />
                                    {selectedImage && (
                                        <p className="mt-2 text-center text-sm text-gray-500">
                                            {selectedImage.name} ({(selectedImage.size / 1024).toFixed(2)} KB)
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Botones de acción */}
                        <div className="flex border-t border-gray-200">
                            <button
                                onClick={handleUpload}
                                disabled={!selectedImage}
                                className="flex-1 px-6 py-3 bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                                Subir Imagen
                            </button>
                            <button
                                onClick={() => { setShowImportImageModal(false); setSelectedImage(null); setPreviewUrl(null); }}
                                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors duration-200"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
>>>>>>> 68aa817d7cc9e37b64a700a06497f08b20004ec2
        </div>
    )
}

export default ConnectedDiagramPage;