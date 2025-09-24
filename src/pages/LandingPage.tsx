import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Shield, BarChart3, CheckCircle, ArrowRight, Upload, Bot, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PricingPlan {
  name: string;
  price: string;
  description: string;
  features: string[];
  popular?: boolean;
}

const pricingPlans: PricingPlan[] = [
  {
    name: "Starter",
    price: "Gratis",
    description: "Perfecto para equipos pequeños que empiezan",
    features: [
      "Hasta 50 gastos por mes",
      "Análisis de recibos con IA",
      "Dashboard básico",
      "2 usuarios incluidos",
      "Soporte por email"
    ]
  },
  {
    name: "Professional",
    price: "29€/mes",
    description: "Para empresas en crecimiento que necesitan más control",
    features: [
      "Gastos ilimitados",
      "IA avanzada con mayor precisión",
      "Analytics completos",
      "Hasta 25 usuarios",
      "Flujos de aprobación personalizados",
      "Exportación de datos",
      "Soporte prioritario",
      "Integraciones avanzadas"
    ],
    popular: true
  },
  {
    name: "Enterprise",
    price: "99€/mes",
    description: "Solución completa para grandes organizaciones",
    features: [
      "Todo lo incluido en Professional",
      "Usuarios ilimitados", 
      "API personalizada",
      "Cumplimiento RGPD avanzado",
      "Auditoría completa",
      "Soporte 24/7",
      "Implementación dedicada",
      "SLA garantizado"
    ]
  }
];

export default function LandingPage() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/auth');
  };

  const handleLogin = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="bg-gradient-primary rounded-lg p-2">
                <BarChart3 className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                ExpensePro AI
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={handleLogin}>
                Iniciar Sesión
              </Button>
              <Button onClick={handleGetStarted} className="bg-gradient-primary hover:opacity-90">
                Empezar Gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 lg:py-32 bg-gradient-to-br from-primary-light via-background to-success-light">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-6 bg-primary/10 text-primary hover:bg-primary/20" variant="secondary">
            <Zap className="mr-2 h-4 w-4" />
            Powered by AI
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-hero bg-clip-text text-transparent">
            AI Expense Pro (local)
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Automatiza la captura de recibos con IA, aprueba gastos al instante y obtén insights 
            financieros en tiempo real. La herramienta definitiva para equipos financieros.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" onClick={handleGetStarted} className="bg-gradient-primary hover:opacity-90">
              <Upload className="mr-2 h-5 w-5" />
              Prueba Gratis por 30 Días
            </Button>
            <Button size="lg" variant="outline">
              Ver Demo
            </Button>
          </div>

          {/* Feature Icons */}
          <div className="flex flex-wrap justify-center gap-8 text-muted-foreground">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-primary" />
              <span>IA Avanzada</span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-success" />
              <span>Seguro</span>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-accent" />
              <span>Multi-usuario</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Todo lo que necesitas para gestionar gastos
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Desde la captura automática hasta el análisis avanzado
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-gradient-card border-0 shadow-md">
              <CardHeader>
                <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>IA para Recibos</CardTitle>
                <CardDescription>
                  Extrae datos automáticamente de cualquier recibo con precisión del 98%
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-card border-0 shadow-md">
              <CardHeader>
                <div className="bg-success/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                <CardTitle>Aprobación Rápida</CardTitle>
                <CardDescription>
                  Flujos de aprobación automatizados que reducen el tiempo en 80%
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-card border-0 shadow-md">
              <CardHeader>
                <div className="bg-accent/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Analytics Avanzado</CardTitle>
                <CardDescription>
                  Dashboards interactivos con insights financieros en tiempo real
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Elige el plan perfecto para tu equipo
            </h2>
            <p className="text-xl text-muted-foreground">
              Empieza gratis y escala según necesites
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative ${plan.popular ? 'ring-2 ring-primary shadow-xl scale-105' : 'shadow-md'} bg-gradient-card border-0`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-primary text-primary-foreground">
                    Más Popular
                  </Badge>
                )}
                
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.price !== "Gratis" && <span className="text-muted-foreground">/mes</span>}
                  </div>
                  <CardDescription className="mt-2">{plan.description}</CardDescription>
                </CardHeader>
                
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className={`w-full ${plan.popular ? 'bg-gradient-primary hover:opacity-90' : ''}`}
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={handleGetStarted}
                  >
                    {plan.price === "Gratis" ? "Empezar Gratis" : "Elegir Plan"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/30 py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="bg-gradient-primary rounded-lg p-2">
              <BarChart3 className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ExpensePro AI</span>
          </div>
          <p className="text-muted-foreground">
            © 2024 ExpensePro AI. Simplificando la gestión de gastos empresariales.
          </p>
        </div>
      </footer>
    </div>
  );
}