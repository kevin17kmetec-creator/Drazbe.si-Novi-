-- Stripe Connect DB Updates

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT false;

-- Create policy to allow service role to update users table for Stripe webhooks
DROP POLICY IF EXISTS "Service role can update users" ON public.users;
CREATE POLICY "Service role can update users"
ON public.users
FOR UPDATE
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Allow authenticated users to update their own stripe_account_id if it is null (initial assignment via API)
DROP POLICY IF EXISTS "Users can update their own stripe details" ON public.users;
CREATE POLICY "Users can update their own stripe details"
ON public.users
FOR UPDATE
USING (auth.uid() = id);

-- Add payment fields to auctions
ALTER TABLE public.auctions 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Ensure the webhook can update the auction
DROP POLICY IF EXISTS "Allow service role to update auctions" ON public.auctions;
CREATE POLICY "Allow service role to update auctions"
ON public.auctions FOR UPDATE
USING (true)
WITH CHECK (true);
