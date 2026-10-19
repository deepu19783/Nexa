
create extension if not exists pgcrypto;

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chats_user_updated_idx
  on public.chats(user_id, updated_at desc);

create index if not exists messages_chat_created_idx
  on public.messages(chat_id, created_at);

alter table public.chats enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Users can read their own chats" on public.chats;
create policy "Users can read their own chats"
  on public.chats for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own chats" on public.chats;
create policy "Users can create their own chats"
  on public.chats for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can rename their own chats" on public.chats;
create policy "Users can rename their own chats"
  on public.chats for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own chats" on public.chats;
create policy "Users can delete their own chats"
  on public.chats for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read their own messages" on public.messages;
create policy "Users can read their own messages"
  on public.messages for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create messages in their own chats" on public.messages;
create policy "Users can create messages in their own chats"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.chats
      where chats.id = messages.chat_id
        and chats.user_id = auth.uid()
    )
  );
