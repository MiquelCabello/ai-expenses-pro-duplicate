import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BarChart3, Mail, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

export default function RegistrationConfirmationPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const type = searchParams.get('type');
  const isAlreadyRegistered = type === 'already_registered';

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Se ha enviado un enlace para restablecer tu contraseña');
        setEmail('');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-success-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/auth')}
          className="mb-6 gap-2 hover:bg-background/50"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al login
        </Button>

        <Card className="shadow-xl bg-gradient-card border-0">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="bg-gradient-primary rounded-lg p-2">
                <BarChart3 className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                ExpensePro AI
              </h1>
            </div>
            
            {isAlreadyRegistered ? (
              <>
                <div className="flex justify-center mb-4">
                  <AlertCircle className="h-16 w-16 text-warning" />
                </div>
                <CardTitle className="text-warning">Usuario Ya Registrado</CardTitle>
                <CardDescription>
                  Este correo electrónico ya tiene una cuenta registrada en el sistema
                </CardDescription>
              </>
            ) : (
              <>
                <div className="flex justify-center mb-4">
                  <CheckCircle className="h-16 w-16 text-success" />
                </div>
                <CardTitle className="text-success">¡Registro Completado!</CardTitle>
                <CardDescription>
                  Tu cuenta ha sido creada exitosamente y está pendiente de aprobación
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {isAlreadyRegistered ? (
              <div className="space-y-4">
                <div className="text-center text-sm text-muted-foreground">
                  ¿Olvidaste tu contraseña? Ingresa tu correo electrónico para recibir un enlace de recuperación.
                </div>
                
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo Electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu@empresa.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-primary hover:opacity-90"
                    disabled={loading}
                  >
                    {loading ? 'Enviando...' : 'Recuperar Contraseña'}
                  </Button>
                </form>

                <div className="text-center">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/auth')}
                    className="w-full"
                  >
                    Volver al Login
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-sm">Próximos pasos:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Revisa tu bandeja de entrada y confirma tu correo electrónico</li>
                    <li>• Tu cuenta será activada automáticamente tras la confirmación</li>
                    <li>• Podrás acceder al sistema como Administrador</li>
                    <li>• Desde tu cuenta podrás registrar empleados</li>
                  </ul>
                </div>

                <div className="text-center space-y-3">
                  <Button
                    onClick={() => navigate('/auth')}
                    className="w-full bg-gradient-primary hover:opacity-90"
                  >
                    Ir al Login
                  </Button>
                  
                  <div className="text-xs text-muted-foreground">
                    Si no recibes el correo en unos minutos, revisa tu carpeta de spam
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}