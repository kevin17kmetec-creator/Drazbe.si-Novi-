-- Run this in your Supabase SQL Editor to add payment tracking to auctions
ALTER TABLE public.auctions 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Ensure the webhook can update the auction
CREATE POLICY "Allow service role to update auctions"
ON public.auctions FOR UPDATE
USING (true)
WITH CHECK (true);
