// Ruta: src/pages/UploadPage.tsx
// Descripción: Página de "Subir Ticket" ajustada para renderizar dentro de AppLayout (sidebar fija).
// Anotaciones: elimina wrappers full-screen y unifica el header con el estilo del resto.

import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import ReceiptUpload from '@/components/ReceiptUpload';
import { ArrowLeft } from 'lucide-react';

/**
 * Renderiza la página dentro de <AppLayout> para mantener la sidebar visible.
 *
 * Cambios clave respecto a la versión anterior:
 * - Se elimina el contenedor "min-h-screen" a nivel raíz (evitaba el layout común).
 * - Se reemplaza el header propio por un encabezado simple de página (coherente con otras vistas).
 * - No se toca la lógica de subida (ReceiptUpload se mantiene igual).
 */
export default function UploadPage() {
  const navigate = useNavigate();

  const handleUploadComplete = () => {
    // NOTE: Al completar, volvemos al dashboard (mismo comportamiento previo)
    navigate('/dashboard');
  };

  return (
    <AppLayout>
      {/* Contenido de página estándar */}
      <div className="p-6 md:p-8 w-full max-w-5xl mx-auto">
        {/* Encabezado de página */}
        <div className="mb-6 flex items-center gap-3">
        
        </div>

        {/* Contenedor del uploader */}
        <div className="">
          <ReceiptUpload onUploadComplete={handleUploadComplete} />
        </div>
      </div>
    </AppLayout>
  );
}
