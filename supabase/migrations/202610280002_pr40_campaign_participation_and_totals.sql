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
  FROM (SELECT DISTINCT unnest(p_kinds) AS k) selected WHERE true
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
  IF TG_OP='UPDATE' AND (NEW.mission_id IS DISTINCT FROM OLD.mission_id OR NEW.actor_id IS DISTINCT FROM OLD.actor_id)
  THEN RAISE EXCEPTION 'Campaign mission and owner cannot be reassigned'; END IF;
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


-- Edit all centrally-owned mission fields atomically; the campaign forms only read
-- from the mission. Same authorization as update_mission_v2.
CREATE OR REPLACE FUNCTION public.update_mission_v3(
 p_mission uuid,p_city uuid,p_manual_place text,p_manual_country text,p_community uuid,
 p_title text,p_overview text,p_location text,p_goal text,p_sdgs smallint[],
 p_roles text,p_start date,p_end date,p_budget numeric,p_funding numeric,p_currency character
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.missions m WHERE m.id=p_mission AND m.removed_at IS NULL AND public.can_act_as(m.created_by_actor_id)
 ) THEN RAISE EXCEPTION 'Not permitted'; END IF;
 IF p_sdgs IS NULL OR cardinality(p_sdgs)=0 OR EXISTS(SELECT 1 FROM unnest(p_sdgs) s WHERE s NOT BETWEEN 1 AND 17)
 THEN RAISE EXCEPTION 'Invalid SDGs'; END IF;
 IF char_length(trim(coalesce(p_title,''))) NOT BETWEEN 3 AND 180
   OR char_length(trim(coalesce(p_overview,''))) NOT BETWEEN 10 AND 5000
   OR char_length(trim(coalesce(p_location,''))) NOT BETWEEN 2 AND 240
   OR char_length(trim(coalesce(p_goal,''))) NOT BETWEEN 3 AND 2000
   OR char_length(trim(coalesce(p_roles,''))) NOT BETWEEN 1 AND 2000
   OR p_start IS NULL OR p_end IS NULL OR p_end<p_start
   OR p_budget IS NULL OR p_budget < 0 OR p_funding IS NULL OR p_funding <=0
   OR p_currency NOT IN ('EUR','USD','GBP')
 THEN RAISE EXCEPTION 'Invalid mission details'; END IF;
 IF p_city IS NOT NULL THEN
   IF p_manual_place IS NOT NULL OR p_manual_country IS NOT NULL
   THEN RAISE EXCEPTION 'Choose one location mode'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.places WHERE id=p_city AND source_key IS NOT NULL)
   THEN RAISE EXCEPTION 'City unavailable'; END IF;
 ELSE
   IF nullif(trim(coalesce(p_manual_place,'')),'') IS NULL
     OR nullif(trim(coalesce(p_manual_country,'')),'') IS NULL
     OR char_length(trim(coalesce(p_manual_place,'')))>160
     OR p_community IS NOT NULL
   THEN RAISE EXCEPTION 'Invalid manual location'; END IF;
 END IF;
 UPDATE public.missions SET
 city_id=p_city,manual_place=nullif(trim(coalesce(p_manual_place,'')),''),
 manual_country=nullif(trim(coalesce(p_manual_country,'')),''),
 community_id=p_community,title=trim(p_title),overview=trim(p_overview),
 location_text=trim(p_location),goal=trim(p_goal),roles_summary=trim(p_roles),
 starts_on=p_start,ends_on=p_end,budget_amount=p_budget,
 funding_goal_amount=p_funding,currency_code=p_currency,updated_at=now()
 WHERE id=p_mission;
 DELETE FROM public.mission_sdgs WHERE mission_id=p_mission;
 INSERT INTO public.mission_sdgs(mission_id,sdg_number)
 SELECT p_mission,s FROM (SELECT DISTINCT unnest(p_sdgs)::smallint AS s) x ORDER BY s;
END;
$$;
REVOKE ALL ON FUNCTION public.update_mission_v3(uuid,uuid,text,text,uuid,text,text,text,text,smallint[],text,date,date,numeric,numeric,character) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_mission_v3(uuid,uuid,text,text,uuid,text,text,text,text,smallint[],text,date,date,numeric,numeric,character) TO authenticated;
