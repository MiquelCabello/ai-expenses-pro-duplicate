import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, Users, Briefcase, Calendar, MapPin, Mail } from 'lucide-react';
import type { Account, Profile } from '@/hooks/useAuth';

interface CompanySummaryCardProps {
  account: Account | null;
  profile: Profile | null;
  planDisplay: string;
  activeEmployees: number;
  maxEmployees: number | null;
}

export default function CompanySummaryCard({ account, profile, planDisplay, activeEmployees, maxEmployees }: CompanySummaryCardProps) {
  const companyName = account?.name || 'Mi Empresa';
  const location = profile?.region || 'España';
  const department = profile?.department || 'General';
  const ownerEmail = profile?.name ? `${profile.name.replace(/\s+/g, '.').toLowerCase()}@${companyName.replace(/\s+/g, '').toLowerCase()}.com` : 'contacto@empresa.com';

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-primary text-primary-foreground p-3 rounded-xl">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold">{companyName}</CardTitle>
            <CardDescription>{planDisplay} · {maxEmployees ? `${activeEmployees}/${maxEmployees} usuarios activos` : `${activeEmployees} usuarios activos`}</CardDescription>
          </div>
        </div>
        <Badge variant="secondary">ID #{account?.id?.slice(0, 8) ?? 'N/A'}</Badge>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground">Resumen</h4>
          <p className="text-sm text-muted-foreground">
            Operación principal en <strong>{location}</strong>, con foco en el departamento de <strong>{department}</strong>.
            Coordinación general a cargo de <strong>{profile?.name ?? 'Equipo financiero'}</strong>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              Sector: Servicios profesionales
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Operando desde 2023
            </span>
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Equipo de alto rendimiento
            </span>
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground">Contacto corporativo</h4>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              {ownerEmail}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Calle Gran Vía, 123 · Madrid
            </span>
          </div>
          <Separator className="my-2" />
          <p className="text-xs text-muted-foreground">
            Este bloque se puede conectar con datos reales cuando definamos el modelo de empresas. Por ahora sirve como placeholder y contexto para los usuarios invitados.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
