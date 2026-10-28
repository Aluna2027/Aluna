-- PR #40, phase 2: verified mission fundraising participation and totals.
-- Apply only after the enum migration has committed.
CREATE OR REPLACE FUNCTION public.create_campaign_with_participation(
  p_mission uuid, p_actor uuid, p_title text, p_story text, p_kinds text[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_id uuid;
  v_goal numeric;
  v_currency character(3);
  v_kind text;
BEGIN
  IF NOT public.can_act_as(p_actor) THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.missions WHERE id=p_mission AND removed_at IS NULL)
  THEN RAISE EXCEPTION 'Mission unavailable'; END IF;
  SELECT funding_goal_amount,currency_code INTO v_goal,v_currency
  FROM public.missions WHERE id=p_mission AND removed_at IS NULL;
  IF v_goal IS NULL OR v_goal <= 0 THEN RAISE EXCEPTION 'Mission funding goal must be positive'; END IF;
  IF char_length(trim(coalesce(p_title,''))) NOT BETWEEN 3 AND 180
    OR char_length(trim(coalesce(p_story,''))) NOT BETWEEN 10 AND 5000
  THEN RAISE EXCEPTION 'Invalid campaign details'; END IF;
  IF p_kinds IS NULL OR NOT ('fundraising'=ANY(p_kinds))
    OR EXISTS (
       SELECT 1 FROM unnest(p_kinds) k
       WHERE k NOT IN ('join_team','volunteer','contribute_skills','contribute_time','provide_expertise','provide_resources','fundraising')
    )
  THEN RAISE EXCEPTION 'Fundraising participation is required'; END IF;
  INSERT INTO public.mission_participations(mission_id,actor_id,participation_kind)
  SELECT p_mission,p_actor,k::public.mission_participation_kind
  FROM (SELECT DISTINCT unnest(p_kinds) AS k) selected
  ON CONFLICT DO NOTHING;
  INSERT INTO public.fundraising_campaigns(mission_id,actor_id,title,story,goal_amount,currency_code)
  VALUES(p_mission,p_actor,trim(p_title),trim(p_story),v_goal,v_currency)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_campaign_with_participation(uuid,uuid,text,text,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_campaign_with_participation(uuid,uuid,text,text,text[]) TO authenticated;

-- A direct Data API insert must not bypass the mission participation requirement.
DROP POLICY IF EXISTS "Create own mission campaigns" ON public.fundraising_campaigns;
CREATE POLICY "Create campaigns for joined missions" ON public.fundraising_campaigns
FOR INSERT TO authenticated WITH CHECK (
  public.can_act_as(actor_id) AND (
    EXISTS (SELECT 1 FROM public.missions m WHERE m.id=mission_id AND m.created_by_actor_id=actor_id AND m.removed_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.mission_participations mp WHERE mp.mission_id=mission_id AND mp.actor_id=actor_id AND mp.participation_kind='fundraising')
  )
);

CREATE OR REPLACE FUNCTION public.sync_campaign_mission_finances()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF NEW.currency_code IS DISTINCT FROM OLD.currency_code AND EXISTS (
    SELECT 1 FROM public.fundraiser_donations d
    JOIN public.fundraising_campaigns c ON c.id=d.campaign_id
    WHERE c.mission_id=NEW.id
  ) THEN RAISE EXCEPTION 'Cannot change currency after donations are recorded'; END IF;
  IF NEW.funding_goal_amount IS DISTINCT FROM OLD.funding_goal_amount
  OR NEW.currency_code IS DISTINCT FROM OLD.currency_code THEN
    IF NEW.funding_goal_amount IS NULL OR NEW.funding_goal_amount <= 0
    THEN RAISE EXCEPTION 'Active campaigns need a positive funding goal'; END IF;
    UPDATE public.fundraising_campaigns
    SET goal_amount=NEW.funding_goal_amount,currency_code=NEW.currency_code,updated_at=now()
    WHERE mission_id=NEW.id AND removed_at IS NULL AND archived_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pr40_sync_mission_finances ON public.missions;
CREATE TRIGGER pr40_sync_mission_finances
AFTER UPDATE OF funding_goal_amount,currency_code ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_mission_finances();

-- Historical, archived and legacy fundraiser donations remain in the shared mission total.
CREATE OR REPLACE FUNCTION public.mission_fundraising_totals(p_mission uuid)
RETURNS TABLE(amount_raised numeric,donor_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT coalesce(sum(d.amount-d.refunded_amount),0)::numeric,
         count(DISTINCT d.donor_reference) FILTER (WHERE d.amount>d.refunded_amount)
  FROM public.fundraiser_donations d
  JOIN public.fundraising_campaigns c ON c.id=d.campaign_id
  WHERE c.mission_id=p_mission
$$;
REVOKE ALL ON FUNCTION public.mission_fundraising_totals(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mission_fundraising_totals(uuid) TO authenticated;


-- Enforce one source of truth for new/changed campaign financial goals.
-- Legacy campaign titles/stories remain editable without rewriting historical totals.
CREATE OR REPLACE FUNCTION public.pr40_guard_campaign_mission_finances()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_goal numeric; v_currency character(3);
BEGIN
  SELECT funding_goal_amount,currency_code INTO v_goal,v_currency
  FROM public.missions WHERE id=NEW.mission_id AND removed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mission unavailable'; END IF;
  IF TG_OP='INSERT' OR NEW.mission_id IS DISTINCT FROM OLD.mission_id
    OR NEW.goal_amount IS DISTINCT FROM OLD.goal_amount
    OR NEW.currency_code IS DISTINCT FROM OLD.currency_code THEN
    IF v_goal IS NULL OR v_goal <= 0 THEN RAISE EXCEPTION 'Invalid mission funding goal'; END IF;
    IF NEW.goal_amount IS DISTINCT FROM v_goal OR NEW.currency_code IS DISTINCT FROM v_currency
    THEN RAISE EXCEPTION 'Campaign finance values must match the SDG Mission'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pr40_guard_campaign_mission_finances ON public.fundraising_campaigns;
CREATE TRIGGER pr40_guard_campaign_mission_finances
BEFORE INSERT OR UPDATE ON public.fundraising_campaigns
FOR EACH ROW EXECUTE FUNCTION public.pr40_guard_campaign_mission_finances();

-- Require an About description for all new and edited mesh communities.
-- NOT VALID avoids rejecting older rows which were created when About was optional;
-- it still checks any new/updated rows.
ALTER TABLE public.mesh_communities
  ADD CONSTRAINT pr40_mesh_community_about_required
  CHECK (description IS NOT NULL AND char_length(trim(description)) BETWEEN 2 AND 3000) NOT VALID;

-- Prevent newly-created or edited missions from omitting their required planning
-- fields, while allowing legacy rows to remain readable until their next edit.
ALTER TABLE public.missions
  ADD CONSTRAINT pr40_mission_required_details
  CHECK (
    roles_summary IS NOT NULL AND char_length(trim(roles_summary)) BETWEEN 1 AND 2000
    AND starts_on IS NOT NULL AND ends_on IS NOT NULL
    AND budget_amount IS NOT NULL
    AND funding_goal_amount IS NOT NULL AND funding_goal_amount > 0
  ) NOT VALID;
