-- Manager <-> Admin two-way messaging with reply threading.
--
-- The manager_messages table originally modelled admin -> manager notices only
-- (manager_id = recipient, created_by = admin author). To let managers message
-- admins back and thread replies, we add:
--   * sender_role: who authored the row. Existing rows are admin-authored.
--   * parent_message_id: links a reply to the message it responds to.
--
-- Direction is derived from sender_role, so no new manager_message_type enum
-- value is needed. Every row in a conversation keeps manager_id set to the
-- manager the thread belongs to (even admin replies), so the manager's existing
-- "messages for me" query returns the whole thread unchanged.

alter table public.manager_messages
  add column if not exists sender_role public.user_role not null default 'ADMIN';

alter table public.manager_messages
  add column if not exists parent_message_id uuid
    references public.manager_messages(id) on delete cascade;

create index if not exists idx_manager_messages_parent
  on public.manager_messages(parent_message_id)
  where parent_message_id is not null;

create index if not exists idx_manager_messages_sender_role
  on public.manager_messages(season_id, sender_role, created_at desc);
