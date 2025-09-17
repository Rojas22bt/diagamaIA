import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Trash2, Link, Save, Download } from 'lucide-react';

type Attribute = {
  id: number;
  name: string;
  type: string;
  visibility: 'private' | 'public' | 'protected';
};

type Method = {
  id: number;
  name: string;
  returnType: string;
  visibility: 'private' | 'public' | 'protected';
  parameters: any[];
};

type ClassType = {
  id: number;
  name: string;
  x: number;
  y: number;
  attributes: Attribute[];
  methods: Method[];
};

type Connection = {
  id: number;
  from: number;
  to: number;
  type: string;
};

const ClassDiagramEditor = () => {
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassType | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionStart, setConnectionStart] = useState<number | null>(null);
  const [draggedClass, setDraggedClass] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Crear nueva clase
  const createClass = () => {
    const newClass = {
      id: Date.now(),
      name: 'NuevaClase',
      x: 100 + classes.length * 50,
      y: 100 + classes.length * 50,
      attributes: [],
      methods: []
    };
    setClasses([...classes, newClass]);
  };

  // Eliminar clase
  const deleteClass = (classId: number) => {
    setClasses(classes.filter(c => c.id !== classId));
    setConnections(connections.filter(conn => 
      conn.from !== classId && conn.to !== classId
    ));
    if (selectedClass?.id === classId) {
      setSelectedClass(null);
    }
  };

  // Actualizar clase
  const updateClass = (classId: number, updates: Partial<ClassType>) => {
    setClasses(classes.map(c => 
      c.id === classId ? { ...c, ...updates } : c
    ));
  };

  // Agregar atributo
  const addAttribute = (classId: number) => {
    const newAttribute: Attribute = {
      id: Date.now(),
      name: 'nuevoAtributo',
      type: 'string',
      visibility: 'private'
    };
    updateClass(classId, {
      attributes: [...(classes.find(c => c.id === classId)?.attributes || []), newAttribute]
    });
  };

  // Agregar método
  const addMethod = (classId: number) => {
    const newMethod: Method = {
      id: Date.now(),
      name: 'nuevoMetodo',
      returnType: 'void',
      visibility: 'public',
      parameters: []
    };
    updateClass(classId, {
      methods: [...(classes.find(c => c.id === classId)?.methods || []), newMethod]
    });
  };

  // Eliminar atributo
  const deleteAttribute = (classId: number, attributeId: number) => {
    const classData = classes.find(c => c.id === classId);
    if (!classData) return;
    updateClass(classId, {
      attributes: classData.attributes.filter(attr => attr.id !== attributeId)
    });
  };

  // Eliminar método
  const deleteMethod = (classId: number, methodId: number) => {
    const classData = classes.find(c => c.id === classId);
    if (!classData) return;
    updateClass(classId, {
      methods: classData.methods.filter(method => method.id !== methodId)
    });
  };

  // Manejar conexiones
  const startConnection = (classId: number) => {
    setIsConnecting(true);
    setConnectionStart(classId);
  };

  const endConnection = (classId: number) => {
    if (isConnecting && connectionStart && connectionStart !== classId) {
      const newConnection = {
        id: Date.now(),
        from: connectionStart,
        to: classId,
        type: 'association'
      };
      setConnections([...connections, newConnection]);
    }
    setIsConnecting(false);
    setConnectionStart(null);
  };

  // Manejar drag and drop
  const handleMouseDown = (e: React.MouseEvent, classId: number) => {
  if ((e.target as HTMLElement).closest('.class-controls')) return;
    
    const classElement = e.currentTarget;
    const rect = classElement.getBoundingClientRect();
    if (!svgRef.current) return;
    // const svgRect = svgRef.current.getBoundingClientRect(); // No se usa
    setDraggedClass(classId);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggedClass) {
      if (!svgRef.current) return;
      const svgRect = svgRef.current.getBoundingClientRect();
      const newX = e.clientX - svgRect.left - dragOffset.x;
      const newY = e.clientY - svgRect.top - dragOffset.y;
      updateClass(draggedClass, { x: newX, y: newY });
    }
  }, [draggedClass, dragOffset, updateClass]);

  const handleMouseUp = useCallback(() => {
    setDraggedClass(null);
  }, []);

  useEffect(() => {
    if (draggedClass) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedClass, handleMouseMove, handleMouseUp]);

  // Renderizar líneas de conexión
  const renderConnections = () => {
    return connections.map(conn => {
      const fromClass = classes.find(c => c.id === conn.from);
      const toClass = classes.find(c => c.id === conn.to);
      
      if (!fromClass || !toClass) return null;

      const fromX = fromClass.x + 150;
      const fromY = fromClass.y + 30;
      const toX = toClass.x + 150;
      const toY = toClass.y + 30;

      return (
        <g key={conn.id}>
          <line
            x1={fromX}
            y1={fromY}
            x2={toX}
            y2={toY}
            stroke="#666"
            strokeWidth="2"
            markerEnd="url(#arrowhead)"
          />
          <text
            x={(fromX + toX) / 2}
            y={(fromY + toY) / 2 - 5}
            fontSize="12"
            textAnchor="middle"
            className="fill-gray-600"
          >
            {conn.type}
          </text>
        </g>
      );
    });
  };

  // Guardar diagrama
  const saveDiagram = () => {
    const diagramData = { classes, connections };
    const dataStr = JSON.stringify(diagramData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diagrama-clases.json';
    link.click();
  };

  return (
    <div className="w-full h-screen bg-gray-50 flex">
      {/* Panel izquierdo */}
      <div className="w-80 bg-white shadow-lg p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Editor de Diagramas UML</h2>
        
        <div className="mb-6">
          <button
            onClick={createClass}
            className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            <Plus size={16} />
            Nueva Clase
          </button>
        </div>

        <div className="mb-6">
          <button
            onClick={saveDiagram}
            className="w-full flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            <Save size={16} />
            Guardar Diagrama
          </button>
        </div>

        {/* Panel de propiedades de clase seleccionada */}
        {selectedClass && (
          <div className="border rounded p-4">
            <h3 className="font-semibold mb-3">Propiedades de Clase</h3>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Nombre:</label>
              <input
                type="text"
                value={selectedClass.name}
                onChange={(e) => updateClass(selectedClass.id, { name: e.target.value })}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>

            <div className="mb-3">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Atributos:</label>
                <button
                  onClick={() => addAttribute(selectedClass.id)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <Plus size={14} />
                </button>
              </div>
              {selectedClass.attributes?.map(attr => (
                <div key={attr.id} className="flex items-center gap-1 mb-1">
                  <select
                    value={attr.visibility}
                    onChange={(e) => {
                      const newAttributes = selectedClass.attributes.map(a =>
                        a.id === attr.id ? { ...a, visibility: e.target.value as 'private' | 'public' | 'protected' } : a
                      );
                      updateClass(selectedClass.id, { attributes: newAttributes });
                    }}
                    className="text-xs border rounded px-1"
                  >
                    <option value="private">-</option>
                    <option value="public">+</option>
                    <option value="protected">#</option>
                  </select>
                  <input
                    type="text"
                    value={attr.name}
                    onChange={(e) => {
                      const newAttributes = selectedClass.attributes.map(a =>
                        a.id === attr.id ? { ...a, name: e.target.value } : a
                      );
                      updateClass(selectedClass.id, { attributes: newAttributes });
                    }}
                    className="flex-1 text-xs border rounded px-1"
                  />
                  <input
                    type="text"
                    value={attr.type}
                    onChange={(e) => {
                      const newAttributes = selectedClass.attributes.map(a =>
                        a.id === attr.id ? { ...a, type: e.target.value } : a
                      );
                      updateClass(selectedClass.id, { attributes: newAttributes });
                    }}
                    className="w-16 text-xs border rounded px-1"
                    placeholder="tipo"
                  />
                  <button
                    onClick={() => deleteAttribute(selectedClass.id, attr.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mb-3">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Métodos:</label>
                <button
                  onClick={() => addMethod(selectedClass.id)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <Plus size={14} />
                </button>
              </div>
              {selectedClass.methods?.map(method => (
                <div key={method.id} className="flex items-center gap-1 mb-1">
                  <select
                    value={method.visibility}
                    onChange={(e) => {
                      const newMethods = selectedClass.methods.map(m =>
                        m.id === method.id ? { ...m, visibility: e.target.value as 'private' | 'public' | 'protected' } : m
                      );
                      updateClass(selectedClass.id, { methods: newMethods });
                    }}
                    className="text-xs border rounded px-1"
                  >
                    <option value="private">-</option>
                    <option value="public">+</option>
                    <option value="protected">#</option>
                  </select>
                  <input
                    type="text"
                    value={method.name}
                    onChange={(e) => {
                      const newMethods = selectedClass.methods.map(m =>
                        m.id === method.id ? { ...m, name: e.target.value } : m
                      );
                      updateClass(selectedClass.id, { methods: newMethods });
                    }}
                    className="flex-1 text-xs border rounded px-1"
                  />
                  <input
                    type="text"
                    value={method.returnType}
                    onChange={(e) => {
                      const newMethods = selectedClass.methods.map(m =>
                        m.id === method.id ? { ...m, returnType: e.target.value } : m
                      );
                      updateClass(selectedClass.id, { methods: newMethods });
                    }}
                    className="w-16 text-xs border rounded px-1"
                    placeholder="tipo"
                  />
                  <button
                    onClick={() => deleteMethod(selectedClass.id, method.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Área del diagrama */}
      <div className="flex-1 relative">
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-white rounded shadow-lg p-2 text-sm">
            <p><strong>Controles:</strong></p>
            <p>• Click en clase para seleccionar</p>
            <p>• Arrastra para mover</p>
            <p>• Botón conectar para relacionar</p>
          </div>
        </div>

        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="bg-white"
          style={{ backgroundImage: 'radial-gradient(circle, #e0e0e0 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#666"
              />
            </marker>
          </defs>

          {renderConnections()}

          {classes.map(classData => (
            <g key={classData.id}>
              {/* Clase */}
              <foreignObject
                x={classData.x}
                y={classData.y}
                width="300"
                height="120"
                onMouseDown={(e) => handleMouseDown(e, classData.id)}
                className="cursor-move"
              >
                <div
                  className={`bg-white border-2 rounded shadow-lg ${
                    selectedClass?.id === classData.id ? 'border-blue-500' : 'border-gray-300'
                  }`}
                  onClick={() => setSelectedClass(classData)}
                >
                  {/* Header de la clase */}
                  <div className="bg-blue-100 p-3 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg">{classData.name}</h3>
                    <div className="class-controls flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startConnection(classData.id);
                        }}
                        className={`p-1 rounded ${
                          isConnecting && connectionStart === classData.id
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                        title="Conectar"
                      >
                        <Link size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isConnecting) {
                            endConnection(classData.id);
                          } else {
                            deleteClass(classData.id);
                          }
                        }}
                        className={`p-1 rounded ${
                          isConnecting
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-red-500 text-white hover:bg-red-600'
                        }`}
                        title={isConnecting ? "Conectar aquí" : "Eliminar"}
                      >
                        {isConnecting ? <Link size={14} /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Atributos */}
                  {classData.attributes && classData.attributes.length > 0 && (
                    <div className="p-3 border-b">
                      <h4 className="font-semibold text-sm mb-2">Atributos:</h4>
                      {classData.attributes.map(attr => (
                        <div key={attr.id} className="text-sm font-mono">
                          {attr.visibility === 'private' ? '- ' : attr.visibility === 'public' ? '+ ' : '# '}
                          {attr.name}: {attr.type}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Métodos */}
                  {classData.methods && classData.methods.length > 0 && (
                    <div className="p-3">
                      <h4 className="font-semibold text-sm mb-2">Métodos:</h4>
                      {classData.methods.map(method => (
                        <div key={method.id} className="text-sm font-mono">
                          {method.visibility === 'private' ? '- ' : method.visibility === 'public' ? '+ ' : '# '}
                          {method.name}(): {method.returnType}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </foreignObject>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

export default ClassDiagramEditor;