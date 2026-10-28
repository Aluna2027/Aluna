-- PR #40 post-cutover hardening: apply only after PR #40 is released to main.
-- Do not apply while the legacy main campaign creator still writes arbitrary goal_amount.
-- These checks reject future changes to older records that lack required PR40 fields.

-- A direct Data API insert must not bypass the mission participation requirement.
DROP POLICY IF EXISTS "Create own mission campaigns" ON public.fundraising_campaigns;
CREATE POLICY "Create campaigns for joined missions" ON public.fundraising_campaigns
FOR INSERT TO authenticated WITH CHECK (
  public.can_act_as(actor_id) AND (
    EXISTS (SELECT 1 FROM public.missions m WHERE m.id=mission_id AND m.created_by_actor_id=actor_id AND m.removed_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.mission_participations mp WHERE mp.mission_id=mission_id AND mp.actor_id=actor_id AND mp.participation_kind='fundraising')
  )
);


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


