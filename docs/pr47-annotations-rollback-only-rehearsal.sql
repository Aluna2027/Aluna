-- PR47 REVIEW CANDIDATE - NOT A VERSIONED MIGRATION, DO NOT APPLY.
-- Generate the actual migration using Supabase CLI after security review.
-- Database: central Aluna Demo only after explicit separate authorization.
BEGIN;

ALTER TABLE public.posts
  ADD COLUMN mention_refs jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.scheduled_posts
  ADD COLUMN mention_refs jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE public.post_mentions (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
  start_offset integer NOT NULL CHECK(start_offset >= 0),
  label text NOT NULL,
  PRIMARY KEY(post_id,start_offset)
);
CREATE INDEX post_mentions_actor_idx ON public.post_mentions(actor_id,post_id);

CREATE TABLE public.post_hashtags (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY(post_id,tag)
);
CREATE INDEX post_hashtags_recent_idx
  ON public.post_hashtags(tag,created_at DESC,post_id);

ALTER TABLE public.post_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.post_mentions,public.post_hashtags FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.post_mentions,public.post_hashtags TO authenticated;
CREATE POLICY "Read mentions of visible posts" ON public.post_mentions
  FOR SELECT TO authenticated USING(public.can_view_post(post_id));
CREATE POLICY "Read hashtags of visible posts" ON public.post_hashtags
  FOR SELECT TO authenticated USING(public.can_view_post(post_id));

ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_kind_check
  CHECK(kind IN('follow','connection','comment','reaction','message','membership','mention'));

CREATE FUNCTION public.pr47_validate_mentions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  item jsonb;
  actor_uuid uuid;
  current_label text;
  label_text text;
  pos integer;
  last_end integer := -1;
BEGIN
  IF jsonb_typeof(NEW.mention_refs) IS DISTINCT FROM 'array'
      OR jsonb_array_length(NEW.mention_refs) > 30 THEN
    RAISE EXCEPTION 'Invalid mention annotations';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(NEW.mention_refs) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
        OR jsonb_typeof(item->'actorId') IS DISTINCT FROM 'string'
        OR jsonb_typeof(item->'start') IS DISTINCT FROM 'number'
        OR (item->>'start') !~ '^[0-9]+$'
        OR jsonb_typeof(item->'label') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Invalid mention annotation fields';
    END IF;
    pos := (item->>'start')::integer;
    actor_uuid := (item->>'actorId')::uuid;
    label_text := item->>'label';
    IF pos < 0 OR pos < last_end OR length(label_text) NOT BETWEEN 1 AND 150
        OR substring(NEW.body FROM pos+1 FOR char_length(label_text)+1)
             IS DISTINCT FROM '@'||label_text THEN
      RAISE EXCEPTION 'Mention position does not match post text';
    END IF;
    IF pos > 0 AND substring(NEW.body FROM pos FOR 1) ~ '[[:alnum:]_]' THEN
      RAISE EXCEPTION 'Invalid mention word boundary';
    END IF;
    last_end := pos + char_length(label_text)+1;

    SELECT coalesce(pr.display_name,o.name) INTO current_label
    FROM public.actors a
    LEFT JOIN public.profiles pr ON pr.id=a.profile_id
    LEFT JOIN public.organizations o
      ON o.id=a.organization_id AND o.removed_at IS NULL
    WHERE a.id=actor_uuid;
    IF current_label IS NULL THEN
      RAISE EXCEPTION 'Mention target not found';
    END IF;
    -- A previously validated mention remains valid after the target renames.
    IF current_label IS DISTINCT FROM label_text
        AND NOT (TG_OP='UPDATE'
          AND OLD.mention_refs @> jsonb_build_array(item)) THEN
      RAISE EXCEPTION 'Mention name does not match target account';
    END IF;
  END LOOP;
  RETURN NEW;
END $fn$;

CREATE TRIGGER pr47_validate_post_mentions BEFORE INSERT OR UPDATE OF body,mention_refs
ON public.posts FOR EACH ROW EXECUTE FUNCTION public.pr47_validate_mentions();
CREATE TRIGGER pr47_validate_scheduled_mentions BEFORE INSERT OR UPDATE OF body,mention_refs
ON public.scheduled_posts FOR EACH ROW EXECUTE FUNCTION public.pr47_validate_mentions();

CREATE FUNCTION public.pr47_sync_post_annotations() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  item jsonb;
  recipient uuid;
  token text[];
BEGIN
  DELETE FROM public.post_mentions WHERE post_id=NEW.id;
  DELETE FROM public.post_hashtags WHERE post_id=NEW.id;

  FOR item IN SELECT value FROM jsonb_array_elements(NEW.mention_refs) LOOP
    recipient := (item->>'actorId')::uuid;
    INSERT INTO public.post_mentions(post_id,actor_id,start_offset,label)
    VALUES(NEW.id,recipient,(item->>'start')::integer,item->>'label');

    -- Only a newly added actor mention can notify; a rename or post edit
    -- cannot send repeat notifications for the same actor.
    IF recipient<>NEW.actor_id
       AND (NEW.visibility='public' OR EXISTS(
         SELECT 1 FROM public.follows f
         WHERE f.follower_actor_id=recipient
           AND f.followed_actor_id=NEW.actor_id))
       AND (TG_OP='INSERT' OR NOT EXISTS(
         SELECT 1 FROM jsonb_array_elements(OLD.mention_refs) prior
         WHERE prior->>'actorId'=item->>'actorId'))
       AND NOT EXISTS(
         SELECT 1 FROM public.notifications n
         WHERE n.recipient_actor_id=recipient
           AND n.kind='mention' AND n.target_id=NEW.id) THEN
      INSERT INTO public.notifications
        (recipient_actor_id,sender_actor_id,kind,target_id)
      VALUES(recipient,NEW.actor_id,'mention',NEW.id);
    END IF;
  END LOOP;

  FOR token IN SELECT regexp_matches(
    NEW.body,'(^|[^[:alnum:]_])#([[:alnum:]_]+)','g')
  LOOP
    INSERT INTO public.post_hashtags(post_id,tag,created_at)
    VALUES(NEW.id,lower(normalize(token[2],NFKC)),NEW.created_at)
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END $fn$;

CREATE TRIGGER pr47_sync_post_annotations AFTER INSERT OR UPDATE OF body,mention_refs
ON public.posts FOR EACH ROW EXECUTE FUNCTION public.pr47_sync_post_annotations();

REVOKE ALL ON FUNCTION public.pr47_validate_mentions() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pr47_sync_post_annotations() FROM PUBLIC,anon,authenticated;

-- RELEASE BLOCKER: the existing publish_due_scheduled_posts function must be
-- reviewed and updated to copy scheduled_posts.mention_refs into the INSERT
-- for posts while retaining all existing permission, retry and lock behavior.
-- Likewise the scheduled-post edit RPC needs to reconcile mentions.
-- This candidate must not be deployed before those changes are included.

ROLLBACK; -- Safety: never let a pasted review candidate commit changes.
