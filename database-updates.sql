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

-- Additional policy if you want the seller to see the transaction:
-- CREATE POLICY "Sellers can view their auction transactions" 
--    ON public.auction_transactions 
--    FOR SELECT 
--    USING (
--        auth.uid() IN (SELECT seller_id FROM public.auctions WHERE id = auction_transactions.auction_id)
--    );

-- Allow authenticated users to insert transactions for themselves
CREATE POLICY "Users can insert their own transactions"
    ON public.auction_transactions
    FOR INSERT
    WITH CHECK (auth.uid() = buyer_id);

-- Standard rule to allow read access for all admins (if you have an admin role system):
-- CREATE POLICY "Admins can view all transactions" ON public.auction_transactions FOR ALL USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');
