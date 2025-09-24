/// <reference path="../types.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MASTER_EMAIL = "info@miquelcabello.com";
const inviteRedirectEnv = Deno.env.get("INVITE_REDIRECT_URL") ?? null;

type AccountRow = {
  id: string;
  name: string;
  plan: string;
  owner_user_id: string;
  max_employees: number | null;
  can_assign_roles: boolean;
  can_assign_department: boolean;
  can_assign_region: boolean;
  can_add_custom_categories: boolean;
  monthly_expense_limit: number | null;
};

type ProfileRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  account_id: string | null;
  account?: AccountRow | null;
};

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: "server_not_configured" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer", "").trim();

  if (!token) {
    return new Response(JSON.stringify({ error: "missing_token" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const {
    data: { user: adminUser },
    error: authError,
  } = await adminClient.auth.getUser(token);

  if (authError || !adminUser) {
    return new Response(JSON.stringify({ error: "not_authenticated" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const accountSelect = `
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
  `;

  const { data: profileDataRaw, error: profileError } = await adminClient
    .from('profiles')
    .select(`
      id,
      user_id,
      role,
      status,
      account_id,
      account:accounts (
        ${accountSelect}
      )
    `)
    .eq('user_id', adminUser.id)
    .maybeSingle<ProfileRow>();

  let accountTableAvailable = true;
  let profileData: ProfileRow | null = profileDataRaw ?? null;

  if (profileError) {
    const relationshipMissing = profileError.code === 'PGRST200' ||
      profileError.code === 'PGRST205' ||
      (typeof profileError.message === 'string' && profileError.message.includes('schema cache'));

    if (relationshipMissing) {
      accountTableAvailable = false;
      const { data: fallbackProfile, error: fallbackProfileError } = await adminClient
        .from('profiles')
        .select(`
          id,
          user_id,
          role,
          status,
          account_id
        `)
        .eq('user_id', adminUser.id)
        .maybeSingle<ProfileRow>();

      if (fallbackProfile) {
        profileData = { ...fallbackProfile, account: null };
      }

      if (fallbackProfileError) {
        console.warn('[create-employee] fallback profile lookup failed', fallbackProfileError);
      }
    } else {
      console.warn('[create-employee] profile lookup failed', profileError);
    }
  }

  let account: AccountRow | null = null;
  if (accountTableAvailable && profileDataRaw?.account) {
    account = profileDataRaw.account ?? null;
  }
  let accountId = profileData?.account_id as string | null;
  let actorRole = profileData?.role ?? null;
  let actorStatus = profileData?.status ?? null;

  if (!profileData && adminUser.email && adminUser.email.toLowerCase() === MASTER_EMAIL) {
    const masterAccount: AccountRow = {
      id: adminUser.id,
      name: adminUser.email ?? 'Cuenta principal',
      plan: 'ENTERPRISE',
      owner_user_id: adminUser.id,
      max_employees: null,
      can_assign_roles: true,
      can_assign_department: true,
      can_assign_region: true,
      can_add_custom_categories: true,
      monthly_expense_limit: null,
    };
    account = masterAccount;
    accountId = adminUser.id;
    actorRole = 'ADMIN';
    actorStatus = 'ACTIVE';
  }

  if (accountTableAvailable && profileData && !account && accountId) {
    const { data: accountRow, error: accountFetchError } = await adminClient
      .from('accounts')
      .select(accountSelect)
      .eq('id', accountId)
      .maybeSingle<AccountRow>();
    if (!accountFetchError && accountRow) {
      account = accountRow;
    }
  }

  if (accountTableAvailable && !account) {
    const { data: ownedAccount, error: ownedAccountError } = await adminClient
      .from('accounts')
      .select(accountSelect)
      .eq('owner_user_id', adminUser.id)
      .maybeSingle<AccountRow>();

    if (ownedAccount) {
      account = ownedAccount;
      accountId = ownedAccount.id;

      if (profileData) {
        if (profileData.account_id !== accountId || profileData.role !== 'ADMIN' || profileData.status !== 'ACTIVE') {
          const { error: profileSyncError } = await adminClient
            .from('profiles')
            .update({
              account_id: accountId,
              role: 'ADMIN',
              status: 'ACTIVE',
            })
            .eq('user_id', adminUser.id);

          if (profileSyncError) {
            console.warn('[create-employee] unable to sync profile with owned account', profileSyncError);
          } else {
            actorRole = 'ADMIN';
            actorStatus = 'ACTIVE';
          }
        }
      } else {
        actorRole = 'ADMIN';
        actorStatus = 'ACTIVE';
      }
    } else if (ownedAccountError) {
      console.warn('[create-employee] owner account lookup failed', ownedAccountError);
    }
  }

  if (accountTableAvailable && !account) {
    const fallbackName = (adminUser.user_metadata as Record<string, unknown> | null)?.company_name;
    const derivedName = typeof fallbackName === 'string' && fallbackName.length > 0
      ? fallbackName
      : adminUser.email ?? 'Cuenta principal';

    const { data: createdAccount, error: createAccountError } = await adminClient
      .from('accounts')
      .insert({
        owner_user_id: adminUser.id,
        name: derivedName,
        plan: 'FREE',
      })
      .select(accountSelect)
      .maybeSingle<AccountRow>();

    if (createAccountError || !createdAccount) {
      const isUniqueViolation = createAccountError?.code === '23505' ||
        (createAccountError?.message && createAccountError.message.includes('duplicate key value'));

      if (isUniqueViolation) {
        const { data: existingAccount, error: existingAccountError } = await adminClient
          .from('accounts')
          .select(accountSelect)
          .eq('owner_user_id', adminUser.id)
          .maybeSingle<AccountRow>();

        if (existingAccount) {
          account = existingAccount;
          accountId = existingAccount.id;
        } else {
          console.error('[create-employee] account exists but lookup failed after unique violation', existingAccountError);
          return new Response(JSON.stringify({ error: 'account_lookup_failed' }), {
            status: 500,
            headers: jsonHeaders,
          });
        }
      } else {
        console.error('[create-employee] failed to auto-create account', createAccountError);
        return new Response(JSON.stringify({ error: 'account_provision_failed' }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
    } else {
      account = createdAccount;
      accountId = createdAccount.id;
    }

    if (accountTableAvailable) {
      const { error: profileUpdateError } = await adminClient
        .from('profiles')
        .update({
          account_id: accountId,
          role: 'ADMIN',
          status: 'ACTIVE',
        })
        .eq('user_id', adminUser.id);

      if (profileUpdateError) {
        console.warn('[create-employee] unable to update profile with new account', profileUpdateError);
      } else {
        actorRole = 'ADMIN';
        actorStatus = 'ACTIVE';
      }
    }
  }

  if (!account) {
    const fallbackAccount: AccountRow = {
      id: adminUser.id,
      name: adminUser.email ?? 'Cuenta principal',
      plan: 'FREE',
      owner_user_id: adminUser.id,
      max_employees: null,
      can_assign_roles: false,
      can_assign_department: true,
      can_assign_region: true,
      can_add_custom_categories: true,
      monthly_expense_limit: null,
    };
    account = fallbackAccount;
  }

  if (!account || actorRole !== 'ADMIN' || actorStatus !== 'ACTIVE') {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: jsonHeaders,
    });
  }

  let payload: {
    name?: string;
    email?: string;
    role?: string;
    department?: string | null;
    region?: string | null;
    redirectTo?: string | null;
  };
  try {
    payload = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const name = (payload.name || "").trim();
  const email = (payload.email || "").trim().toLowerCase();

  if (!name || !email) {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;
  if (!emailRegex.test(email)) {
    return new Response(JSON.stringify({ error: "invalid_email" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const allowsAdminInvites = account.plan === 'ENTERPRISE' && account.can_assign_roles === true;
  const requestedRole = payload.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE';
  const normalizedRole = allowsAdminInvites && requestedRole === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE';
  const rawDepartment = typeof payload.department === 'string' ? payload.department.trim() : '';
  const rawRegion = typeof payload.region === 'string' ? payload.region.trim() : '';
  const normalizedDepartment = account.can_assign_department ? (rawDepartment || null) : null;
  const normalizedRegion = account.can_assign_region ? (rawRegion || null) : null;

  const redirectCandidates: string[] = [];
  const rawRedirect = typeof payload.redirectTo === 'string' ? payload.redirectTo.trim() : '';
  if (rawRedirect.length > 0) {
    redirectCandidates.push(rawRedirect);
  }
  if (inviteRedirectEnv) {
    redirectCandidates.push(inviteRedirectEnv);
  }
  const requestOrigin = req.headers.get('origin');
  if (requestOrigin) {
    try {
      redirectCandidates.push(new URL('/accept-invite', requestOrigin).toString());
    } catch (error) {
      console.warn('[create-employee] invalid origin for redirect candidate', error);
    }
  }

  let inviteRedirectTo: string | null = null;
  for (const candidate of redirectCandidates) {
    try {
      inviteRedirectTo = new URL(candidate).toString();
      break;
    } catch (error) {
      console.warn('[create-employee] skipped invalid redirect URL candidate', candidate, error);
    }
  }

  let activeCount: number | null = null;

  if (accountTableAvailable) {
    const { count, error: countError } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', account.id)
      .eq('status', 'ACTIVE');

    if (countError) {
      return new Response(JSON.stringify({ error: 'count_failed' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    activeCount = count;
  }

  if (
    accountTableAvailable &&
    typeof account.max_employees === 'number' &&
    activeCount !== null &&
    activeCount >= account.max_employees
  ) {
    return new Response(JSON.stringify({ error: 'EMPLOYEE_LIMIT_REACHED' }), {
      status: 409,
      headers: jsonHeaders,
    });
  }

  const accountIdentifier = accountId ?? account.id;
  const accountOwnerId = account?.owner_user_id ?? adminUser.id;

  const userMetadata: Record<string, unknown> = {
    name,
    role: normalizedRole,
    department: normalizedDepartment,
    region: normalizedRegion,
    account_owner_id: accountOwnerId,
  };

  if (accountIdentifier) {
    userMetadata.account_id = accountIdentifier;
  }

  const createResponse = await adminClient.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: userMetadata,
    app_metadata: {
      roles: [normalizedRole],
    },
  });

  if (createResponse.error) {
    const code = createResponse.error.message?.includes('already registered') ? 409 : 400;
    return new Response(JSON.stringify({ error: createResponse.error.message || 'create_failed' }), {
      status: code,
      headers: jsonHeaders,
    });
  }

  const createdUser = createResponse.data.user;

  try {
    const inviteMetadata: Record<string, unknown> = {
      name,
      role: normalizedRole,
      department: normalizedDepartment,
      region: normalizedRegion,
      account_owner_id: accountOwnerId,
    };

    if (accountIdentifier) {
      inviteMetadata.account_id = accountIdentifier;
    }

    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: inviteMetadata,
      redirectTo: inviteRedirectTo ?? undefined,
    });
  } catch (error) {
    console.warn('Failed to send invite email', error);
  }

  return new Response(JSON.stringify({
    success: true,
    user_id: createdUser?.id ?? null,
    message: 'employee_created',
  }), {
    status: 200,
    headers: jsonHeaders,
  });
});
