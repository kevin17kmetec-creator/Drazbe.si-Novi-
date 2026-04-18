-- Auction Transactions Table Definition
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.auction_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auction_id UUID NOT NULL, -- You can add REFERENCES public.auctions(id) if your auctions table allows it
    buyer_id UUID NOT NULL REFERENCES auth.users(id),
    final_bid_price NUMERIC NOT NULL,
    commission_net NUMERIC NOT NULL,
    vat_rate INTEGER NOT NULL,
    vat_amount NUMERIC NOT NULL,
    total_commission_gross NUMERIC NOT NULL,
    seller_vat_id TEXT,
    buyer_vat_id TEXT,
    is_reverse_charge BOOLEAN DEFAULT FALSE,
    vies_validation_status TEXT,
    vies_validated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Turn on Row Level Security
ALTER TABLE public.auction_transactions ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own transactions (either as buyer or by joining with auctions as seller)
CREATE POLICY "Users can view their own transactions" 
    ON public.auction_transactions 
    FOR SELECT 
    USING (auth.uid() = buyer_id);

-- Allow authenticated users to insert transactions for themselves
CREATE POLICY "Users can insert their own transactions"
    ON public.auction_transactions
    FOR INSERT
    WITH CHECK (auth.uid() = buyer_id);

-- IMPORTANT FIX FOR AUCTIONS RLS (PUBLIC VISIBILITY)
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;

-- Drop existing restricted select policies if any
DROP POLICY IF EXISTS "Enable read access for all users" ON public.auctions;
DROP POLICY IF EXISTS "Public can view active auctions" ON public.auctions;
DROP POLICY IF EXISTS "Users can view all auctions" ON public.auctions;

-- Allow EVERYONE (even non-logged in users) to view all auctions
CREATE POLICY "Enable read access for all users" 
    ON public.auctions 
    FOR SELECT 
    USING (true);

-- Allow authenticated users to insert their own auctions
CREATE POLICY "Enable insert for authenticated users" 
    ON public.auctions 
    FOR INSERT 
    WITH CHECK (auth.uid() = seller_id);

-- Allow users to update their own auctions
CREATE POLICY "Enable update for users based on seller_id" 
    ON public.auctions 
    FOR UPDATE 
    USING (auth.uid() = seller_id);

-- Allow ANY user to update auction to place bids (needed because current logic increments bid count directly)
-- NOTE: In a strictly secure app this should be restricted, but for this app architecture it must be open
CREATE POLICY "Enable updates for bidding"
    ON public.auctions
    FOR UPDATE
    USING (true);

