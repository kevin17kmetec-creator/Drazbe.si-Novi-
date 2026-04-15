-- database-schema.sql

-- 1. Update users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS tax_id TEXT,
ADD COLUMN IF NOT EXISTS country_code TEXT,
ADD COLUMN IF NOT EXISTS company_status TEXT CHECK (company_status IN ('individual', 'company')),
ADD COLUMN IF NOT EXISTS auto_invoice_generation BOOLEAN DEFAULT true;

-- 2. Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID REFERENCES public.auctions(id),
    buyer_id UUID REFERENCES public.users(id),
    seller_id UUID REFERENCES public.users(id),
    stripe_payment_intent_id TEXT,
    amount_total NUMERIC NOT NULL,
    platform_fee NUMERIC NOT NULL,
    vat_amount NUMERIC NOT NULL,
    vat_rate NUMERIC NOT NULL,
    is_reverse_charge BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES public.transactions(id),
    user_id UUID REFERENCES public.users(id),
    type TEXT CHECK (type IN ('invoice', 'certificate')),
    file_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create storage bucket for documents if it doesn't exist
-- Note: You might need to create the bucket manually in the Supabase Dashboard if this fails
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage Policies for documents bucket
-- Allow authenticated users to read their own documents
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow service role to insert documents
CREATE POLICY "Service role can insert documents"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'documents');

-- 6. RLS Policies for transactions and documents
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can view their own document records"
ON public.documents FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
