-- 1. Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    auction_id text,
    participant_one uuid NOT NULL REFERENCES auth.users(id),
    participant_two uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- Ensure a unique chat room exists between two users for a given auction
CREATE UNIQUE INDEX IF NOT EXISTS unique_conversation_idx 
ON public.conversations(auction_id, LEAST(participant_one, participant_two), GREATEST(participant_one, participant_two));

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Policies for conversations
CREATE POLICY "Users can view their conversations" 
ON public.conversations FOR SELECT 
USING (auth.uid() = participant_one OR auth.uid() = participant_two);

CREATE POLICY "Users can create conversations they are a part of" 
ON public.conversations FOR INSERT 
WITH CHECK (auth.uid() = participant_one OR auth.uid() = participant_two);

-- 2. Drop and recreate messages table
DROP TABLE IF EXISTS public.messages CASCADE;

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES auth.users(id),
    content text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies for messages
CREATE POLICY "Users can view messages in their conversations"
ON public.messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.conversations c 
        WHERE c.id = messages.conversation_id 
        AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
    )
);

CREATE POLICY "Users can insert messages into their conversations"
ON public.messages FOR INSERT
WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.conversations c 
        WHERE c.id = conversation_id 
        AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
    )
);

CREATE POLICY "Users can update read status"
ON public.messages FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.conversations c 
        WHERE c.id = messages.conversation_id 
        AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
    )
)
WITH CHECK (
    sender_id != auth.uid() -- Only the receiver can update
);

-- 3. Turn on Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 4. Helper Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
