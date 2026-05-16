-- Create user balances table
CREATE TABLE IF NOT EXISTS public.user_balances (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    available_balance BIGINT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own balances"
    ON public.user_balances FOR SELECT
    USING (auth.uid() = user_id);

-- Create wallet transactions table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    amount BIGINT NOT NULL, -- in cents, positive for credit, negative for debit
    type TEXT NOT NULL CHECK (type IN ('auction_sale', 'auction_purchase', 'subscription_buy', 'payout_withdrawal', 'card_deposit')),
    reference_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
    ON public.wallet_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Create RPC for internal wallet payment for auctions
CREATE OR REPLACE FUNCTION execute_internal_wallet_payment(
    p_buyer_id UUID,
    p_seller_id UUID,
    p_total_amount BIGINT, -- in cents
    p_commission_amount BIGINT, -- in cents
    p_auction_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    buyer_balance BIGINT;
    seller_credit BIGINT;
BEGIN
    -- 1. Check buyer balance
    SELECT available_balance INTO buyer_balance 
    FROM public.user_balances 
    WHERE user_id = p_buyer_id 
    FOR UPDATE; -- lock the row

    IF buyer_balance IS NULL OR buyer_balance < p_total_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- 2. Deduct from buyer
    UPDATE public.user_balances
    SET available_balance = available_balance - p_total_amount,
        updated_at = NOW()
    WHERE user_id = p_buyer_id;

    -- 3. Add to seller (minus commission)
    seller_credit := p_total_amount - p_commission_amount;
    
    INSERT INTO public.user_balances (user_id, available_balance)
    VALUES (p_seller_id, seller_credit)
    ON CONFLICT (user_id) DO UPDATE 
    SET available_balance = public.user_balances.available_balance + seller_credit,
        updated_at = NOW();

    -- 4. Insert transactions
    INSERT INTO public.wallet_transactions (user_id, amount, type, reference_id)
    VALUES 
        (p_buyer_id, -p_total_amount, 'auction_purchase', p_auction_id),
        (p_seller_id, seller_credit, 'auction_sale', p_auction_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Create RPC for internal subscription payment
CREATE OR REPLACE FUNCTION execute_internal_subscription_payment(
    p_user_id UUID,
    p_total_amount BIGINT, -- in cents
    p_package_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_balance BIGINT;
BEGIN
    -- 1. Check balance
    SELECT available_balance INTO v_balance 
    FROM public.user_balances 
    WHERE user_id = p_user_id 
    FOR UPDATE;

    IF v_balance IS NULL OR v_balance < p_total_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- 2. Deduct from user
    UPDATE public.user_balances
    SET available_balance = available_balance - p_total_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- 3. Insert transaction
    INSERT INTO public.wallet_transactions (user_id, amount, type, reference_id)
    VALUES (p_user_id, -p_total_amount, 'subscription_buy', p_package_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC to credit user balance (used from backend webhook)
CREATE OR REPLACE FUNCTION credit_user_balance(
    p_user_id UUID,
    p_amount BIGINT, -- in cents
    p_type TEXT,
    p_reference_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO public.user_balances (user_id, available_balance)
    VALUES (p_user_id, p_amount)
    ON CONFLICT (user_id) DO UPDATE 
    SET available_balance = public.user_balances.available_balance + p_amount,
        updated_at = NOW();

    INSERT INTO public.wallet_transactions (user_id, amount, type, reference_id)
    VALUES (p_user_id, p_amount, p_type, p_reference_id);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC to debit user balance (used for payouts)
CREATE OR REPLACE FUNCTION debit_user_balance(
    p_user_id UUID,
    p_amount BIGINT, -- in cents
    p_type TEXT,
    p_reference_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_balance BIGINT;
BEGIN
    SELECT available_balance INTO v_balance 
    FROM public.user_balances 
    WHERE user_id = p_user_id 
    FOR UPDATE;

    IF v_balance IS NULL OR v_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    UPDATE public.user_balances
    SET available_balance = available_balance - p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    INSERT INTO public.wallet_transactions (user_id, amount, type, reference_id)
    VALUES (p_user_id, -p_amount, p_type, p_reference_id);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
