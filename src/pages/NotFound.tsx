import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-success-light flex items-center justify-center p-4">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
          <h2 className="text-2xl font-semibold mb-2">Página no encontrada</h2>
          <p className="text-muted-foreground mb-8">
            La página que buscas no existe o ha sido movida.
          </p>
        </div>
        
        <Button 
          onClick={() => navigate('/')}
          className="bg-gradient-primary hover:opacity-90 gap-2"
        >
          <Home className="h-4 w-4" />
          Volver al inicio
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
