import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ThemeProvider';
import { Settings, Euro, Globe, Clock, Palette, FolderOpen, Briefcase, Plus, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Category {
  id: string;
  name: string;
  budget_monthly: number | null;
}

interface ProjectCode {
  id: string;
  code: string;
  name: string;
  status: string;
}

const PREFERENCES_STORAGE_KEY = 'expensepro-general-preferences';

const isValidThemePreference = (value: unknown): value is 'light' | 'dark' | 'system' =>
  value === 'light' || value === 'dark' || value === 'system';

export default function ConfigurationPage() {
  const { profile, account, isMaster, user } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [projectCodes, setProjectCodes] = useState<ProjectCode[]>([]);
  const [loading, setLoading] = useState(true);

  // Configuration states
  const [language, setLanguage] = useState('es');
  const [timezone, setTimezone] = useState('Europe/Madrid');
  const [currency, setCurrency] = useState('EUR');
  const [defaultVat, setDefaultVat] = useState('21');
  const [autoApprovalLimit, setAutoApprovalLimit] = useState('100');
  const [sandboxMode, setSandboxMode] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  const isDarkMode = theme === 'dark' || (theme === 'system' && systemPrefersDark);

  // Dialog states
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectCode | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryBudget, setNewCategoryBudget] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<ProjectCode | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  const planNameMap: Record<'FREE' | 'PROFESSIONAL' | 'ENTERPRISE', string> = {
    FREE: 'Starter',
    PROFESSIONAL: 'Professional',
    ENTERPRISE: 'Enterprise',
  };
  const planConfig: Record<'FREE' | 'PROFESSIONAL' | 'ENTERPRISE', { maxEmployees: number | null; monthlyLimit: number | null; categoryLimit: number | null; projectLimit: number | null }> = {
    FREE: { maxEmployees: 2, monthlyLimit: 50, categoryLimit: 0, projectLimit: 0 },
    PROFESSIONAL: { maxEmployees: 25, monthlyLimit: null, categoryLimit: 5, projectLimit: 10 },
    ENTERPRISE: { maxEmployees: null, monthlyLimit: null, categoryLimit: null, projectLimit: null },
  };
  const planKey = (account?.plan ?? 'FREE') as 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE';
  const planName = isMaster ? 'Master' : planNameMap[planKey];
  const resolvedAccountId = isMaster ? null : (profile?.account_id ?? account?.id ?? null);
  const canAddCustomCategories = planKey !== 'FREE';
  const canManageProjects = planKey !== 'FREE';
  const maxEmployees = isMaster ? null : account?.max_employees ?? planConfig[planKey].maxEmployees;
  const monthlyLimit = isMaster ? null : account?.monthly_expense_limit ?? planConfig[planKey].monthlyLimit;
  const categoryLimit = planConfig[planKey].categoryLimit;
  const projectLimit = planConfig[planKey].projectLimit;
  const isCategoriesEnabled = planKey !== 'FREE';
  const categoriesLimitReached = typeof categoryLimit === 'number' && categories.length >= categoryLimit;
  const projectLimitReached = typeof projectLimit === 'number' && projectCodes.length >= projectLimit;
  const isAdminUser = isMaster || profile?.role === 'ADMIN';

  useEffect(() => {
    if (profile && !isAdminUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [profile, isAdminUser, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    setSystemPrefersDark(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedPreferences = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (!storedPreferences) return;

      const parsedPreferences: {
        language?: unknown;
        timezone?: unknown;
        theme?: unknown;
      } = JSON.parse(storedPreferences);

      if (typeof parsedPreferences.language === 'string') {
        setLanguage(parsedPreferences.language);
      }

      if (typeof parsedPreferences.timezone === 'string') {
        setTimezone(parsedPreferences.timezone);
      }

      if (isValidThemePreference(parsedPreferences.theme)) {
        setTheme(parsedPreferences.theme);
      }
    } catch (error) {
      console.error('Error loading saved preferences:', error);
    }
  }, [setTheme]);

  const loadData = useCallback(async () => {
    try {
      if (!isMaster) {
        if (profile && profile.role !== 'ADMIN') {
          setCategories([]);
          setProjectCodes([]);
          setLoading(false);
          return;
        }
        if (!profile) {
          setLoading(false);
          return;
        }
        if (!resolvedAccountId) {
          console.warn('[Configuration] Missing account_id for non-master user', profile?.id);
          setCategories([]);
          setProjectCodes([]);
          setLoading(false);
          return;
        }
      }

      let categoriesQuery = supabase
        .from('categories')
        .select('*')
        .order('name');

      if (!isMaster && resolvedAccountId) {
        categoriesQuery = categoriesQuery.eq('account_id', resolvedAccountId);
      }

      let projectCodesQuery = supabase
        .from('project_codes')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('code');

      if (!isMaster && resolvedAccountId) {
        projectCodesQuery = projectCodesQuery.eq('account_id', resolvedAccountId);
      }

      const [{ data: categoriesData, error: categoriesError }, { data: projectCodesData, error: projectCodesError }] = await Promise.all([
        categoriesQuery,
        projectCodesQuery,
      ]);

      if (categoriesError) throw categoriesError;
      if (projectCodesError) throw projectCodesError;

      setCategories(categoriesData ?? []);
      setProjectCodes(projectCodesData ?? []);
    } catch (error) {
      console.error('Error loading configuration data:', error);
      toast.error('Error al cargar los datos de configuración');
    } finally {
      setLoading(false);
    }
  }, [resolvedAccountId, isMaster, profile]);

  const savePreferences = async () => {
    try {
      // Here you would typically save to a user preferences table
      // For now, just simulate saving
      await new Promise(resolve => setTimeout(resolve, 500));
      if (typeof window !== 'undefined') {
        const preferencesToStore = {
          language,
          timezone,
          theme
        };
        localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferencesToStore));
      }
      toast.success('Preferencias guardadas correctamente');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Error al guardar preferencias');
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveCompanyProfile = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!account || !profile) {
      toast.error('No se ha podido cargar la cuenta activa');
      return;
    }

    // Placeholder: simulate persistence
    await new Promise((resolve) => setTimeout(resolve, 400));
    toast.success('Datos de la empresa guardados (placeholder)');
  };

  const saveFinancialConfig = async () => {
    try {
      // Here you would typically save to a system configuration table
      // For now, just simulate saving
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Configuración financiera guardada correctamente');
    } catch (error) {
      toast.error('Error al guardar configuración financiera');
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryBudget(category.budget_monthly?.toString() || '');
  };

  const handleUpdateCategory = async () => {
    if (isMaster) {
      toast.info('Gestiona las categorías específicas desde la consola administrativa global.');
      return;
    }

    if (!editingCategory || !resolvedAccountId) {
      toast.error('No se ha podido identificar la cuenta activa.');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: newCategoryName,
          budget_monthly: newCategoryBudget ? parseFloat(newCategoryBudget) : null
        })
        .eq('id', editingCategory.id)
        .eq('account_id', resolvedAccountId);

      if (error) throw error;

      toast.success('Categoría actualizada correctamente');
      setEditingCategory(null);
      loadData();
    } catch (error) {
      toast.error('Error al actualizar categoría');
    }
  };

  const handleAddCategory = async () => {
    if (isMaster) {
      toast.info('Gestiona las categorías específicas desde la consola administrativa global.');
      return;
    }

    if (!resolvedAccountId) {
      toast.error('No se ha podido identificar la cuenta activa.');
      return;
    }

    if (!isCategoriesEnabled) {
      toast.error('La gestión de categorías está disponible a partir del plan Professional.');
      return;
    }

    if (typeof categoryLimit === 'number' && categories.length >= categoryLimit) {
      toast.error(`Has alcanzado el límite de ${categoryLimit} categorías en tu plan.`);
      return;
    }
    if (!canAddCustomCategories) {
      toast.error('Tu plan actual no permite añadir categorías personalizadas');
      return;
    }
    if (!newCategoryName.trim()) {
      toast.error('El nombre de la categoría es requerido');
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .insert({
          name: newCategoryName,
          budget_monthly: newCategoryBudget ? parseFloat(newCategoryBudget) : null,
          account_id: resolvedAccountId
        });

      if (error) throw error;

      toast.success('Categoría añadida correctamente');
      setIsAddingCategory(false);
      setNewCategoryName('');
      setNewCategoryBudget('');
      loadData();
    } catch (error) {
      toast.error('Error al añadir categoría');
    }
  };

  const handleEditProject = (project: ProjectCode) => {
    setEditingProject(project);
    setNewProjectCode(project.code);
    setNewProjectName(project.name);
  };

  const handleUpdateProject = async () => {
    if (isMaster) {
      toast.info('Gestiona los proyectos desde la consola administrativa global.');
      return;
    }

    if (!editingProject || !resolvedAccountId) {
      toast.error('No se ha podido identificar la cuenta activa.');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('project_codes')
        .update({
          code: newProjectCode,
          name: newProjectName
        })
        .eq('id', editingProject.id)
        .eq('account_id', resolvedAccountId);

      if (error) throw error;

      toast.success('Código de proyecto actualizado correctamente');
      setEditingProject(null);
      loadData();
    } catch (error) {
      toast.error('Error al actualizar código de proyecto');
    }
  };

  const handleAddProject = async () => {
    if (isMaster) {
      toast.info('Gestiona los proyectos desde la consola administrativa global.');
      return;
    }

    if (!resolvedAccountId) {
      toast.error('No se ha podido identificar la cuenta activa.');
      return;
    }

    if (!canManageProjects) {
      toast.error('La gestión de códigos de proyecto está disponible a partir del plan Professional.');
      return;
    }

    if (typeof projectLimit === 'number' && projectCodes.length >= projectLimit) {
      toast.error(`Has alcanzado el límite de ${projectLimit} códigos de proyecto en tu plan.`);
      return;
    }
    if (!newProjectCode.trim() || !newProjectName.trim()) {
      toast.error('El código y nombre del proyecto son requeridos');
      return;
    }

    try {
      const { error } = await supabase
        .from('project_codes')
        .insert({
          code: newProjectCode,
          name: newProjectName,
          status: 'ACTIVE',
          account_id: resolvedAccountId
        });

      if (error) throw error;

      toast.success('Código de proyecto añadido correctamente');
      setIsAddingProject(false);
      setNewProjectCode('');
      setNewProjectName('');
      loadData();
    } catch (error) {
      toast.error('Error al añadir código de proyecto');
    }
  };

  const handleDeleteCategory = async () => {
    if (isMaster) {
      toast.info('Gestiona las categorías específicas desde la consola administrativa global.');
      return;
    }

    if (!categoryToDelete || !resolvedAccountId) {
      toast.error('No se ha podido identificar la cuenta activa.');
      return;
    }

    setIsDeletingCategory(true);
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryToDelete.id)
        .eq('account_id', resolvedAccountId);

      if (error) throw error;

      toast.success(`Categoría "${categoryToDelete.name}" eliminada correctamente`);
      setCategoryToDelete(null);
      loadData();
    } catch (error) {
      toast.error('Error al eliminar categoría');
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const handleDeleteProject = async () => {
    if (isMaster) {
      toast.info('Gestiona los proyectos desde la consola administrativa global.');
      return;
    }

    if (!projectToDelete || !resolvedAccountId) {
      toast.error('No se ha podido identificar la cuenta activa.');
      return;
    }

    setIsDeletingProject(true);
    try {
      const { error } = await supabase
        .from('project_codes')
        .update({ status: 'INACTIVE' })
        .eq('id', projectToDelete.id)
        .eq('account_id', resolvedAccountId);

      if (error) throw error;

      toast.success(`Código de proyecto "${projectToDelete.code}" desactivado correctamente`);
      setProjectToDelete(null);
      loadData();
    } catch (error) {
      toast.error('Error al desactivar código de proyecto');
    } finally {
      setIsDeletingProject(false);
    }
  };

  const handleUpgradeClick = () => {
    toast.info('La actualización de plan estará disponible en la integración de pagos.');
  };

  if (profile && !isAdminUser) {
    return null;
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando configuración...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl">Plan {planName}</CardTitle>
                <CardDescription>
                  {typeof monthlyLimit === 'number'
                    ? `Hasta ${monthlyLimit} gastos al mes · ${typeof maxEmployees === 'number' ? `${maxEmployees} usuarios incluidos` : 'Usuarios ilimitados'}`
                    : 'Gastos ilimitados y usuarios flexibles'}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {canAddCustomCategories ? (
                  <Badge variant="secondary">Categorías personalizadas</Badge>
                ) : (
                  <Badge variant="outline">Categorías limitadas</Badge>
                )}
                <Badge variant="outline">Plan actual</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              {isMaster
                ? 'Acceso total a todas las cuentas y configuraciones.'
                : 'Gestiona tu suscripción y mejora de plan cuando esté disponible la pasarela de pago.'}
            </p>
            <Button onClick={handleUpgradeClick} variant="outline" disabled={isMaster}>
              {isMaster ? 'Gestión centralizada' : 'Actualizar Plan'}
            </Button>
          </CardContent>
        </Card>

        {!isMaster && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Briefcase className="h-5 w-5" />
                <span>Datos de la empresa</span>
              </CardTitle>
              <CardDescription>
                Información básica de tu organización. Se mostrará como referencia a tus empleados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveCompanyProfile} className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2 space-y-2">
                  <Label>Nombre comercial</Label>
                  <Input defaultValue={account?.name ?? ''} placeholder="Nombre de la empresa" />
                </div>
                <div className="space-y-2">
                  <Label>Sector</Label>
                  <Select defaultValue="services">
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona sector" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="services">Servicios profesionales</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="manufacturing">Manufactura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sede principal</Label>
                  <Input defaultValue={profile?.region ?? ''} placeholder="Ciudad / Región" />
                </div>
                <div className="space-y-2">
                  <Label>Correo de contacto</Label>
                  <Input type="email" defaultValue={user?.email ?? ''} placeholder="contacto@empresa.com" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Descripción breve</Label>
                  <textarea
                    className="w-full border rounded-md p-2 text-sm"
                    rows={3}
                    placeholder="Describe brevemente tu empresa y sus principales operaciones"
                  />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit">Guardar datos de la empresa</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preferencias Generales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="h-5 w-5" />
                <span>Preferencias Generales</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tema Oscuro */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Tema Oscuro</Label>
                  <p className="text-xs text-muted-foreground">Alternar entre tema claro y oscuro</p>
                </div>
                <Switch
                  checked={isDarkMode}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
              </div>

              <Separator />

              {/* Idioma */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Idioma</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Zona Horaria */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Zona Horaria</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Madrid">Europe/Madrid</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                    <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={savePreferences} className="w-full">
                Guardar Preferencias
              </Button>
            </CardContent>
          </Card>

          {/* Configuración Financiera */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Euro className="h-5 w-5" />
                <span>Configuración Financiera</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Moneda Base */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Moneda Base</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* IVA por Defecto */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">IVA por Defecto (%)</Label>
                <Input
                  type="number"
                  value={defaultVat}
                  onChange={(e) => setDefaultVat(e.target.value)}
                  placeholder="21"
                />
              </div>

              {/* Límite Aprobación Automática */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Límite Aprobación Automática (€)</Label>
                <Input
                  type="number"
                  value={autoApprovalLimit}
                  onChange={(e) => setAutoApprovalLimit(e.target.value)}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">
                  Gastos menores a este importe se aprueban automáticamente
                </p>
              </div>

              {/* Modo Sandbox */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Modo Sandbox</Label>
                  <p className="text-xs text-muted-foreground">Activar para pruebas sin facturación real</p>
                </div>
                <Switch
                  checked={sandboxMode}
                  onCheckedChange={setSandboxMode}
                />
              </div>

              <Button onClick={saveFinancialConfig} className="w-full">
                Guardar Configuración
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gestión de Categorías */}
          {isCategoriesEnabled ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FolderOpen className="h-5 w-5" />
                    <span>Gestión de Categorías</span>
                  </div>
                  {typeof categoryLimit === 'number' && (
                    <Badge variant={categoriesLimitReached ? 'destructive' : 'outline'}>
                      {categories.length}/{categoryLimit}
                    </Badge>
                  )}
                </div>
                <CardDescription>Categorías activas en tu cuenta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="font-medium">{category.name}</span>
                      {category.budget_monthly && (
                        <Badge variant="outline">
                          Presupuesto: {category.budget_monthly}€/mes
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:justify-end">
                      <Dialog open={editingCategory?.id === category.id} onOpenChange={(open) => !open && setEditingCategory(null)}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => handleEditCategory(category)}>
                            <Edit2 className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar Categoría</DialogTitle>
                            <DialogDescription>
                              Modifica los datos de la categoría
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="category-name">Nombre</Label>
                              <Input
                                id="category-name"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Nombre de la categoría"
                              />
                            </div>
                            <div>
                              <Label htmlFor="category-budget">Presupuesto Mensual (€)</Label>
                              <Input
                                id="category-budget"
                                type="number"
                                value={newCategoryBudget}
                                onChange={(e) => setNewCategoryBudget(e.target.value)}
                                placeholder="0"
                              />
                            </div>
                            <div className="flex justify-end space-x-2">
                              <Button variant="outline" onClick={() => setEditingCategory(null)}>
                                Cancelar
                              </Button>
                              <Button onClick={handleUpdateCategory}>
                                Guardar
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button variant="destructive" size="sm" onClick={() => setCategoryToDelete(category)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}

                <AlertDialog
                  open={!!categoryToDelete}
                  onOpenChange={(open) => {
                    if (!open && !isDeletingCategory) {
                      setCategoryToDelete(null);
                    }
                  }}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción eliminará permanentemente la categoría "{categoryToDelete?.name}".
                        No se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeletingCategory}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={isDeletingCategory}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={async (event) => {
                          event.preventDefault();
                          await handleDeleteCategory();
                        }}
                      >
                        {isDeletingCategory ? 'Eliminando...' : 'Eliminar'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={!canAddCustomCategories || categoriesLimitReached}
                      title={
                        !canAddCustomCategories
                          ? 'Disponible a partir del plan Professional'
                          : categoriesLimitReached
                            ? `Has alcanzado el límite de ${categoryLimit} categorías`
                            : undefined
                      }
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nueva Categoría
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nueva Categoría</DialogTitle>
                      <DialogDescription>Define una categoría personalizada para clasificar tus gastos</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="category-new-name">Nombre</Label>
                        <Input
                          id="category-new-name"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Nombre de la categoría"
                        />
                      </div>
                      <div>
                        <Label htmlFor="category-new-budget">Presupuesto Mensual (€)</Label>
                        <Input
                          id="category-new-budget"
                          type="number"
                          value={newCategoryBudget}
                          onChange={(e) => setNewCategoryBudget(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setIsAddingCategory(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleAddCategory}>
                          Crear
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ) : (
            <Card className="opacity-90">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FolderOpen className="h-5 w-5" />
                  <span>Gestión de Categorías</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Las categorías personalizadas están disponibles a partir del plan Professional.
                </p>
                <Button className="mt-4" variant="outline" onClick={handleUpgradeClick}>Ver planes</Button>
              </CardContent>
            </Card>
          )}
          {canManageProjects ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Briefcase className="h-5 w-5" />
                    <span>Gestión de Códigos de Proyecto</span>
                  </div>
                  {typeof projectLimit === 'number' && (
                    <Badge variant={projectLimitReached ? 'destructive' : 'outline'}>
                      {projectCodes.length}/{projectLimit}
                    </Badge>
                  )}
                </div>
                <CardDescription>Códigos activos para clasificar gastos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {projectCodes.map((project) => (
                  <div
                    key={project.id}
                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="font-medium">{project.code}</span>
                      <Badge variant="outline">{project.name}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:justify-end">
                      <Dialog open={editingProject?.id === project.id} onOpenChange={(open) => !open && setEditingProject(null)}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => handleEditProject(project)}>
                            <Edit2 className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar Código</DialogTitle>
                            <DialogDescription>
                              Actualiza la información del código de proyecto
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="project-code">Código</Label>
                              <Input
                                id="project-code"
                                value={newProjectCode}
                                onChange={(e) => setNewProjectCode(e.target.value)}
                                placeholder="PRJ-001"
                              />
                            </div>
                            <div>
                              <Label htmlFor="project-name">Nombre</Label>
                              <Input
                                id="project-name"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                placeholder="Nombre del proyecto"
                              />
                            </div>
                            <div className="flex justify-end space-x-2">
                              <Button variant="outline" onClick={() => setEditingProject(null)}>
                                Cancelar
                              </Button>
                              <Button onClick={handleUpdateProject}>
                                Guardar
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button variant="destructive" size="sm" onClick={() => setProjectToDelete(project)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Desactivar
                      </Button>
                    </div>
                  </div>
                ))}

                <AlertDialog
                  open={!!projectToDelete}
                  onOpenChange={(open) => {
                    if (!open && !isDeletingProject) {
                      setProjectToDelete(null);
                    }
                  }}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción desactivará el código "{projectToDelete?.code}".
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeletingProject}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={isDeletingProject}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={async (event) => {
                          event.preventDefault();
                          await handleDeleteProject();
                        }}
                      >
                        {isDeletingProject ? 'Desactivando...' : 'Desactivar'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Dialog open={isAddingProject} onOpenChange={setIsAddingProject}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={projectLimitReached}
                      title={projectLimitReached ? `Has alcanzado el límite de ${projectLimit} códigos de proyecto` : undefined}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nuevo Código de Proyecto
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nuevo Código de Proyecto</DialogTitle>
                      <DialogDescription>Crea un código para agrupar tus gastos</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="project-new-code">Código</Label>
                        <Input
                          id="project-new-code"
                          value={newProjectCode}
                          onChange={(e) => setNewProjectCode(e.target.value)}
                          placeholder="PRJ-002"
                        />
                      </div>
                      <div>
                        <Label htmlFor="project-new-name">Nombre</Label>
                        <Input
                          id="project-new-name"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          placeholder="Nombre del proyecto"
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setIsAddingProject(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleAddProject}>
                          Crear
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ) : (
            <Card className="opacity-90">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Briefcase className="h-5 w-5" />
                  <span>Gestión de Códigos de Proyecto</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Los códigos de proyecto personalizados están disponibles a partir del plan Professional.
                </p>
                <Button className="mt-4" variant="outline" onClick={handleUpgradeClick}>Ver planes</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

