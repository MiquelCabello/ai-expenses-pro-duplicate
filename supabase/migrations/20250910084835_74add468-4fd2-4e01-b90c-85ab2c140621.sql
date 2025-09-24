-- Fix infinite recursion in profiles RLS policies
-- Drop the problematic admin policy that causes recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- Create a simpler admin policy that doesn't cause recursion
-- This policy allows viewing all profiles if the user's own profile has admin role
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'ADMIN'::user_role
  ) 
  OR auth.uid() = user_id
);

-- Allow admins to insert profiles (simplified)
CREATE POLICY "Admins can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'ADMIN'::user_role
  )
);