import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Lock, ShieldCheck, AlertCircle } from 'lucide-react';

function collectAuthParams() {
  if (typeof window === 'undefined') {
    return new URLSearchParams();
  }

  const combined = new URLSearchParams();
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const search = window.location.search.startsWith('?')
    ? window.location.search.slice(1)
    : window.location.search;

  if (hash) {
    for (const [key, value] of new URLSearchParams(hash).entries()) {
      combined.set(key, value);
    }
  }

  if (search) {
    for (const [key, value] of new URLSearchParams(search).entries()) {
      if (!combined.has(key)) {
        combined.set(key, value);
      }
    }
  }

  return combined;
}

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);

  const params = useMemo(() => collectAuthParams(), []);

  useEffect(() => {
    const initializeSession = async () => {
      try {
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const code = params.get('code');
        const tokenHash = params.get('token_hash');
        const type = params.get('type');

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type === 'invite') {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'invite',
          });
          if (error) throw error;
        } else {
          throw new Error('Enlace de invitación inválido o caducado. Solicita una nueva invitación.');
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        setEmail(userData.user?.email ?? null);
        setInitialError(null);
      } catch (error: any) {
        console.error('[AcceptInvite] unable to establish session', error);
        setInitialError(error?.message ?? 'No hemos podido validar esta invitación.');
      } finally {
        setLoading(false);
      }
    };

    void initializeSession();
  }, [params]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!password || password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }

      toast.success('¡Contraseña configurada correctamente!');
      navigate('/upload');
    } catch (error: any) {
      console.error('[AcceptInvite] update password failed', error);
      toast.error(error?.message ?? 'No hemos podido guardar tu contraseña');
    } finally {
      setUpdating(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-success-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          onClick={handleBackToLogin}
          className="mb-6 gap-2 hover:bg-background/50"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio de sesión
        </Button>

        <Card className="shadow-xl bg-gradient-card border-0">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {initialError ? (
                <AlertCircle className="h-16 w-16 text-warning" />
              ) : (
                <ShieldCheck className="h-16 w-16 text-success" />
              )}
            </div>
            <CardTitle>{initialError ? 'Invitación no válida' : 'Completa tu acceso'}</CardTitle>
            <CardDescription>
              {initialError
                ? initialError
                : 'Define una contraseña segura para acceder a tu cuenta'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-muted-foreground">
                Validando invitación...
              </div>
            ) : initialError ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Pide a tu administrador que te envíe un nuevo enlace de invitación.
                </p>
                <Button onClick={handleBackToLogin} className="w-full">
                  Ir al login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {email && (
                  <div className="text-sm text-muted-foreground text-center">
                    Estás configurando la cuenta <strong>{email}</strong>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-primary hover:opacity-90"
                  disabled={updating}
                >
                  {updating ? 'Guardando...' : 'Guardar contraseña'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
