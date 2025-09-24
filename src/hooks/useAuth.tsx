import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const OWNER_EMAIL = 'info@miquelcabello.com';

const isOwnerEmail = (email?: string | null) => (email ?? '').toLowerCase() === OWNER_EMAIL;

const PLAN_DEFAULTS: Record<'FREE' | 'PROFESSIONAL' | 'ENTERPRISE', {
  maxEmployees: number | null;
  canAssignRoles: boolean;
  canAssignDepartment: boolean;
  canAssignRegion: boolean;
  canAddCustomCategories: boolean;
  monthlyExpenseLimit: number | null;
}> = {
  FREE: {
    maxEmployees: 2,
    canAssignRoles: false,
    canAssignDepartment: false,
    canAssignRegion: false,
    canAddCustomCategories: false,
    monthlyExpenseLimit: 50,
  },
  PROFESSIONAL: {
    maxEmployees: 25,
    canAssignRoles: false,
    canAssignDepartment: true,
    canAssignRegion: true,
    canAddCustomCategories: false,
    monthlyExpenseLimit: null,
  },
  ENTERPRISE: {
    maxEmployees: null,
    canAssignRoles: true,
    canAssignDepartment: true,
    canAssignRegion: true,
    canAddCustomCategories: true,
    monthlyExpenseLimit: null,
  },
};
export interface Account {
  id: string;
  name: string;
  plan: 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE';
  owner_user_id: string;
  max_employees: number | null;
  can_assign_roles: boolean;
  can_assign_department: boolean;
  can_assign_region: boolean;
  can_add_custom_categories: boolean;
  monthly_expense_limit: number | null;
}

const applyPlanDefaults = (account: Account): Account => {
  const defaults = PLAN_DEFAULTS[account.plan];
  const normalizedRoleCapability = account.plan === 'ENTERPRISE'
    ? (account.can_assign_roles ?? defaults.canAssignRoles)
    : false;
  return {
    ...account,
    max_employees: account.max_employees ?? defaults.maxEmployees,
    can_assign_roles: normalizedRoleCapability,
    can_assign_department: account.can_assign_department ?? defaults.canAssignDepartment,
    can_assign_region: account.can_assign_region ?? defaults.canAssignRegion,
    can_add_custom_categories: account.can_add_custom_categories ?? defaults.canAddCustomCategories,
    monthly_expense_limit: account.monthly_expense_limit ?? defaults.monthlyExpenseLimit,
  };
};

const buildEnterpriseAccount = (id: string, name?: string | null): Account =>
  applyPlanDefaults({
    id,
    name: name || 'Cuenta principal',
    plan: 'ENTERPRISE',
    owner_user_id: id,
    max_employees: null,
    can_assign_roles: true,
    can_assign_department: true,
    can_assign_region: true,
    can_add_custom_categories: true,
    monthly_expense_limit: null,
  });

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  role: 'ADMIN' | 'EMPLOYEE';
  department?: string | null;
  region?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  account_id?: string;
}

interface AuthContextType {
  account: Account | null;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isMaster: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const clearAccountState = () => {
      if (!mounted) return;
      setAccount(null);
      setProfile(null);
    };

    const applyProfile = (rawProfile: any, currentUser: User) => {
      if (!mounted) return;

      if (!rawProfile) {
        if (isOwnerEmail(currentUser.email)) {
          const ownerAccount = buildEnterpriseAccount(currentUser.id, currentUser.email);
          const ownerName = (currentUser.user_metadata as Record<string, unknown> | undefined)?.name;
          const masterProfile: Profile = {
            id: currentUser.id,
            user_id: currentUser.id,
            name: typeof ownerName === 'string' && ownerName.length > 0 ? ownerName : (currentUser.email ?? 'Cuenta principal'),
            role: 'ADMIN',
            department: null,
            region: null,
            status: 'ACTIVE',
          };
          setProfile(masterProfile);
          setAccount(ownerAccount);
        } else {
          setProfile(null);
          setAccount(null);
        }
        return;
      }

      const metadata = currentUser.user_metadata as Record<string, unknown> | undefined;
      const hasAccountId = Object.prototype.hasOwnProperty.call(rawProfile, 'account_id');
      const rawPlan = typeof metadata?.plan === 'string' ? metadata.plan.toUpperCase() : undefined;
      const allowedPlans: Array<'FREE' | 'PROFESSIONAL' | 'ENTERPRISE'> = ['FREE', 'PROFESSIONAL', 'ENTERPRISE'];
      const fallbackPlan: 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE' = allowedPlans.includes(rawPlan as any)
        ? (rawPlan as 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE')
        : 'FREE';

      const baseProfile: Profile = {
        id: rawProfile.id,
        user_id: rawProfile.user_id,
        name: rawProfile.name,
        role: (rawProfile.role as Profile['role']) ?? 'EMPLOYEE',
        department: rawProfile.department ?? null,
        region: rawProfile.region ?? null,
        status: (rawProfile.status as Profile['status']) ?? 'ACTIVE',
        ...(hasAccountId && rawProfile.account_id ? { account_id: rawProfile.account_id as string } : {}),
      };

      let resolvedAccount: Account | null = rawProfile.account
        ? applyPlanDefaults({
            id: rawProfile.account.id,
            name: rawProfile.account.name,
            plan: rawProfile.account.plan,
            owner_user_id: rawProfile.account.owner_user_id,
            max_employees: rawProfile.account.max_employees,
            can_assign_roles: rawProfile.account.can_assign_roles,
            can_assign_department: rawProfile.account.can_assign_department,
            can_assign_region: rawProfile.account.can_assign_region,
            can_add_custom_categories: rawProfile.account.can_add_custom_categories,
            monthly_expense_limit: rawProfile.account.monthly_expense_limit ?? null,
          })
        : null;

      if (!resolvedAccount) {
        const fallbackAccountId = (hasAccountId && rawProfile.account_id)
          ? (rawProfile.account_id as string)
          : (typeof metadata?.account_id === 'string' && metadata.account_id.length > 0
            ? metadata.account_id
            : rawProfile.user_id ?? currentUser.id);

        const fallbackOwnerId = typeof metadata?.account_owner_id === 'string' && metadata.account_owner_id.length > 0
          ? metadata.account_owner_id
          : rawProfile.user_id ?? currentUser.id;

        const fallbackName = typeof metadata?.company_name === 'string' && metadata.company_name.length > 0
          ? metadata.company_name
          : currentUser.email ?? 'Cuenta principal';

        resolvedAccount = applyPlanDefaults({
          id: fallbackAccountId,
          name: fallbackName,
          plan: fallbackPlan,
          owner_user_id: fallbackOwnerId,
          max_employees: null,
          can_assign_roles: fallbackPlan === 'ENTERPRISE',
          can_assign_department: fallbackPlan !== 'FREE',
          can_assign_region: fallbackPlan !== 'FREE',
          can_add_custom_categories: fallbackPlan === 'ENTERPRISE',
          monthly_expense_limit: fallbackPlan === 'FREE' ? 50 : null,
        });
      }

      if (isOwnerEmail(currentUser.email)) {
        const accountId = hasAccountId && rawProfile.account_id
          ? (rawProfile.account_id as string)
          : resolvedAccount?.id ?? currentUser.id;

        baseProfile.role = 'ADMIN';
        baseProfile.status = 'ACTIVE';
        if (hasAccountId) {
          baseProfile.account_id = accountId;
        }

        resolvedAccount = buildEnterpriseAccount(accountId, baseProfile.name);
      } else if (resolvedAccount) {
        if (!baseProfile.account_id) {
          baseProfile.account_id = resolvedAccount.id;
        }
        if (resolvedAccount.owner_user_id === currentUser.id) {
          baseProfile.role = 'ADMIN';
        }
      }

      if (!baseProfile.account_id && resolvedAccount) {
        baseProfile.account_id = resolvedAccount.id;
      }

      setProfile(baseProfile);
      setAccount(resolvedAccount);
    };

    const loadProfile = async (currentUser: User) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (error) throw error;

        let enrichedProfile = data;

        if (enrichedProfile && !enrichedProfile.account) {
          const hasAccountId = Object.prototype.hasOwnProperty.call(enrichedProfile, 'account_id');
          const candidateAccountId = hasAccountId ? enrichedProfile.account_id : null;

          if (candidateAccountId) {
            try {
              const { data: accountRow, error: accountError } = await supabase
                .from('accounts')
                .select(`
                  id,
                  name,
                  plan,
                  owner_user_id,
                  max_employees,
                  can_assign_roles,
                  can_assign_department,
                  can_assign_region,
                  can_add_custom_categories,
                  monthly_expense_limit
                `)
                .eq('id', candidateAccountId as string)
                .maybeSingle();

              if (!accountError && accountRow) {
                const normalized = applyPlanDefaults({
                  id: accountRow.id,
                  name: accountRow.name,
                  plan: accountRow.plan,
                  owner_user_id: accountRow.owner_user_id,
                  max_employees: accountRow.max_employees,
                  can_assign_roles: accountRow.can_assign_roles,
                  can_assign_department: accountRow.can_assign_department,
                  can_assign_region: accountRow.can_assign_region,
                  can_add_custom_categories: accountRow.can_add_custom_categories,
                  monthly_expense_limit: accountRow.monthly_expense_limit ?? null,
                });
                enrichedProfile = { ...enrichedProfile, account: normalized, account_id: enrichedProfile.account_id ?? normalized.id };
              }
            } catch (accountFetchError) {
              console.warn('[Auth] Failed to load related account', accountFetchError);
            }
          }
        }

        applyProfile(enrichedProfile, currentUser);
      } catch (error) {
        console.error('[Auth] Unable to load profile', error);
        throw error;
      }
    };

    const syncSession = async (nextSession: Session | null) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      const activeUser = nextSession?.user;
      if (!activeUser) {
        clearAccountState();
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        await loadProfile(activeUser);
      } catch (error) {
        console.error('[Auth] Failed to load profile for session user', error);
        clearAccountState();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const authListener = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
    });
    const subscription = authListener?.data?.subscription;

    const initializeSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) {
          return;
        }

        if (error) {
          throw error;
        }

        await syncSession(data.session ?? null);
      } catch (error) {
        console.error('[Auth] Failed to initialize session', error);
        if (!mounted) {
          return;
        }

        clearAccountState();
        setSession(null);
        setUser(null);
        setLoading(false);

        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.warn('[Auth] Failed to sign out after initialization error', signOutError);
        }
      }
    };

    void initializeSession();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setAccount(null);
    setProfile(null);
    setSession(null);
    setUser(null);
    setLoading(false);
  };

  const isMaster = isOwnerEmail(user?.email);

  const value = {
    account,
    user,
    session,
    profile,
    loading,
    isMaster,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
