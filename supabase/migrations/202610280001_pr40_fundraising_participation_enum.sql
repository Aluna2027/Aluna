-- PR #40, phase 1: additive participation type. Keep in its own migration so PostgreSQL commits the enum value before functions reference it.
ALTER TYPE public.mission_participation_kind ADD VALUE IF NOT EXISTS 'fundraising';
