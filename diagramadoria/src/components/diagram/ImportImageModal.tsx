import React, { useState } from 'react';
import { FiUpload, FiX } from 'react-icons/fi';
import { AiOutlineFileImage } from 'react-icons/ai';
import { BsStars } from 'react-icons/bs';

interface ImportImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (file: File) => void;
    onAnalyzeWithAI?: (file: File) => void;
}

const ImportImageModal: React.FC<ImportImageModalProps> = ({ 
    isOpen, 
    onClose, 
    onUpload,
    onAnalyzeWithAI 
}) => {
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    if (!isOpen) return null;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setSelectedImage(file);
        
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setPreviewUrl(null);
        }
    };

    const handleUpload = () => {
        if (selectedImage) {
            onUpload(selectedImage);
            handleClose();
        }
    };

    const handleAnalyzeWithAI = async () => {
        if (selectedImage && onAnalyzeWithAI) {
            setIsAnalyzing(true);
            try {
                await onAnalyzeWithAI(selectedImage);
            } finally {
                setIsAnalyzing(false);
            }
        }
    };

    const handleClose = () => {
        setSelectedImage(null);
        setPreviewUrl(null);
        setIsAnalyzing(false);
        onClose();
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const files = e.dataTransfer.files;
        if (files && files[0] && files[0].type.startsWith('image/')) {
            const file = files[0];
            setSelectedImage(file);
            
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl mx-4 relative transform transition-all duration-300 scale-100 animate-fadeIn pointer-events-auto border border-gray-200/50">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-200/50 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-t-2xl backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100/80 rounded-lg backdrop-blur-sm">
                            <AiOutlineFileImage className="text-blue-600 text-2xl" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Importar Imagen</h2>
                            <p className="text-xs text-gray-600">Sube una imagen de diagrama UML para importar</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-200/60 rounded-full transition-colors duration-200 backdrop-blur-sm"
                        title="Cerrar"
                    >
                        <FiX className="text-xl text-gray-600" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-5">
                    {/* Upload Area */}
                    <div
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className="border-2 border-dashed border-gray-300/60 rounded-xl p-6 text-center hover:border-blue-400/80 transition-colors duration-200 bg-gray-50/50 hover:bg-blue-50/50 backdrop-blur-sm"
                    >
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                            id="image-upload"
                        />
                        <label
                            htmlFor="image-upload"
                            className="cursor-pointer flex flex-col items-center gap-3"
                        >
                            <div className="p-3 bg-blue-100/70 rounded-full backdrop-blur-sm">
                                <FiUpload className="text-3xl text-blue-600" />
                            </div>
                            <div>
                                <p className="text-base font-semibold text-gray-700">
                                    Arrastra y suelta una imagen aquí
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    o haz clic para seleccionar un archivo
                                </p>
                            </div>
                            <div className="mt-2 px-4 py-2 bg-blue-600/90 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium text-sm backdrop-blur-sm">
                                Seleccionar Imagen
                            </div>
                        </label>
                    </div>

                    {/* Preview */}
                    {previewUrl && (
                        <div className="space-y-3 animate-fadeIn">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-gray-800">Vista Previa</h3>
                                <span className="text-xs text-gray-500 bg-gray-100/70 px-3 py-1 rounded-full backdrop-blur-sm">
                                    {selectedImage?.name}
                                </span>
                            </div>
                            <div className="relative rounded-xl overflow-hidden border border-gray-200/50 shadow-md bg-gray-50/50 p-3 backdrop-blur-sm">
                                <img
                                    src={previewUrl}
                                    alt="Preview"
                                    className="max-h-80 w-full object-contain rounded-lg"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-5 border-t border-gray-200/50 bg-gray-50/50 rounded-b-2xl backdrop-blur-sm">
                    {onAnalyzeWithAI && selectedImage && (
                        <button
                            onClick={handleAnalyzeWithAI}
                            disabled={isAnalyzing}
                            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600/90 to-indigo-600/90 text-white px-5 py-2.5 rounded-lg font-semibold shadow-md hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 backdrop-blur-sm text-sm"
                        >
                            <BsStars className={`text-lg ${isAnalyzing ? 'animate-spin' : ''}`} />
                            {isAnalyzing ? 'Analizando...' : 'Analizar con IA'}
                        </button>
                    )}
                    <button
                        onClick={handleUpload}
                        disabled={!selectedImage}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600/90 to-blue-700/90 text-white px-5 py-2.5 rounded-lg font-semibold shadow-md hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 backdrop-blur-sm text-sm"
                    >
                        <FiUpload className="text-lg" />
                        Subir Imagen
                    </button>
                    <button
                        onClick={handleClose}
                        className="px-5 py-2.5 bg-gray-200/70 text-gray-700 rounded-lg font-semibold shadow-sm hover:bg-gray-300/80 transition-all duration-200 transform hover:scale-105 backdrop-blur-sm text-sm"
                    >
                        Cancelar
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: scale(0.96) translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.25s ease-out;
                }
            `}</style>
        </div>
    );
};

export default ImportImageModal;
