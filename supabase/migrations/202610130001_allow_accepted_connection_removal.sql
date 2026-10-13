-- A participant may remove an accepted connection; no other connection may be deleted.
create policy "Remove accepted own connection"
on public.connections for delete to authenticated
using (status = 'accepted'::public.connection_status and (public.can_act_as(actor_a) or public.can_act_as(actor_b)));
