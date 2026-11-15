-- ============================================================================
-- CareLedger Emergency Security Remediation Migration
-- Fixes VULN-01, VULN-02, VULN-03, VULN-04, VULN-05, VULN-06, VULN-07, VULN-08
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. P0: Fix care_relationships RLS and Triggers (VULN-01, VULN-02)
-- ----------------------------------------------------------------------------

-- Drop insecure policies on care_relationships
DROP POLICY IF EXISTS "Authenticated users can create relationship links" ON public.care_relationships;
DROP POLICY IF EXISTS "Caregiver or elder can update relationship status" ON public.care_relationships;
DROP POLICY IF EXISTS "Elders can create pending invitations" ON public.care_relationships;
DROP POLICY IF EXISTS "Elders can update their care relationships" ON public.care_relationships;
DROP POLICY IF EXISTS "Caregivers can resign from active relationships" ON public.care_relationships;

-- Direct INSERT permitted ONLY for elders creating a pending invite
CREATE POLICY "Elders can create pending invitations"
  ON public.care_relationships FOR INSERT
  WITH CHECK (
    auth.uid() = elder_id 
    AND status = 'pending' 
    AND caregiver_id = elder_id 
    AND invite_code IS NOT NULL
  );

-- Elders can update their own relationships (e.g. revoke)
CREATE POLICY "Elders can update their care relationships"
  ON public.care_relationships FOR UPDATE
  USING (auth.uid() = elder_id)
  WITH CHECK (auth.uid() = elder_id);

-- Caregivers can ONLY resign (transition status from active to revoked)
CREATE POLICY "Caregivers can resign from active relationships"
  ON public.care_relationships FOR UPDATE
  USING (auth.uid() = caregiver_id AND status = 'active')
  WITH CHECK (auth.uid() = caregiver_id AND status = 'revoked');

-- Trigger enforcing ownership immutability and state transition invariants
CREATE OR REPLACE FUNCTION public.check_care_relationship_mutations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- 1. Elder ID is strictly immutable
  IF NEW.elder_id <> OLD.elder_id THEN
    RAISE EXCEPTION 'Unauthorized: elder_id cannot be modified';
  END IF;

  -- 2. Revoked relationships can NEVER be reactivated. A new invitation is required.
  IF OLD.status = 'revoked' AND NEW.status <> 'revoked' THEN
    RAISE EXCEPTION 'Unauthorized: Revoked relationships cannot be reactivated. A new invitation is required.';
  END IF;

  -- 3. Activation check: direct REST update cannot activate pending relationship
  -- Only claim_elder_invitation RPC (which atomically clears invite_code) may transition pending -> active
  IF OLD.status = 'pending' AND NEW.status = 'active' THEN
    IF NEW.caregiver_id = OLD.elder_id OR NEW.invite_code IS NOT NULL THEN
      RAISE EXCEPTION 'Unauthorized: Direct activation of pending relationships is forbidden';
    END IF;
  END IF;

  -- 4. Caregiver ID is immutable once active or revoked
  IF OLD.status IN ('active', 'revoked') AND NEW.caregiver_id <> OLD.caregiver_id THEN
    RAISE EXCEPTION 'Unauthorized: caregiver_id cannot be modified';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_care_relationship_mutations ON public.care_relationships;
CREATE TRIGGER trg_check_care_relationship_mutations
  BEFORE UPDATE ON public.care_relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.check_care_relationship_mutations();

-- ----------------------------------------------------------------------------
-- 2. P1: Fix Medication Deletion & Cross-Elder Integrity (VULN-04, VULN-05, VULN-06)
-- ----------------------------------------------------------------------------

-- Fix VULN-04: Caregivers must NOT hard-delete medications
DROP POLICY IF EXISTS "Authorized caregiver can insert and update elder medications" ON public.medications;
DROP POLICY IF EXISTS "Authorized caregiver can insert elder medications" ON public.medications;
DROP POLICY IF EXISTS "Authorized caregiver can update elder medications" ON public.medications;

CREATE POLICY "Authorized caregiver can insert elder medications"
  ON public.medications FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.care_relationships 
    WHERE elder_id = medications.elder_id 
      AND caregiver_id = auth.uid() 
      AND status = 'active'
  ));

CREATE POLICY "Authorized caregiver can update elder medications"
  ON public.medications FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.care_relationships 
    WHERE elder_id = medications.elder_id 
      AND caregiver_id = auth.uid() 
      AND status = 'active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.care_relationships 
    WHERE elder_id = medications.elder_id 
      AND caregiver_id = auth.uid() 
      AND status = 'active'
  ));

-- Fix VULN-05 & VULN-06: Cross-elder integrity & dose attribution in dose_logs trigger
CREATE OR REPLACE FUNCTION public.check_elder_only_taken()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- VULN-05: Cross-elder medication reference validation
  IF NEW.medication_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.medications m
      WHERE m.id = NEW.medication_id AND m.elder_id = NEW.elder_id
    ) THEN
      RAISE EXCEPTION 'Integrity violation: Medication % does not belong to elder %', NEW.medication_id, NEW.elder_id;
    END IF;
  END IF;

  -- VULN-05: Cross-elder schedule reference validation
  IF NEW.schedule_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.medication_schedules s
      WHERE s.id = NEW.schedule_id AND s.elder_id = NEW.elder_id
    ) THEN
      RAISE EXCEPTION 'Integrity violation: Medication schedule % does not belong to elder %', NEW.schedule_id, NEW.elder_id;
    END IF;
  END IF;

  -- Elder-only taken invariant
  IF NEW.status = 'taken' AND (auth.uid() IS NULL OR auth.uid() <> NEW.elder_id OR NEW.actor_role <> 'elder') THEN
    RAISE EXCEPTION 'Only the elder themselves can mark a dose as taken';
  END IF;

  -- VULN-06: Prevent non-elders from attributing ANY action to elder
  IF NEW.actor_role = 'elder' THEN
    IF auth.uid() IS NOT NULL AND auth.uid() <> NEW.elder_id THEN
      RAISE EXCEPTION 'Unauthorized: Non-elder cannot attribute dose action to elder';
    END IF;
    IF NEW.confirmed_by IS NOT NULL AND NEW.confirmed_by <> NEW.elder_id THEN
      RAISE EXCEPTION 'Unauthorized: Confirmed_by for elder action must match elder ID';
    END IF;
  END IF;

  -- VULN-06: Verify confirmed_by cannot be spoofed to elder by a non-elder
  IF NEW.confirmed_by IS NOT NULL AND NEW.confirmed_by = NEW.elder_id THEN
    IF auth.uid() IS NOT NULL AND auth.uid() <> NEW.elder_id THEN
      RAISE EXCEPTION 'Unauthorized: Non-elder cannot confirm on behalf of elder';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is active on both INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_enforce_elder_only_taken ON public.dose_logs;
CREATE TRIGGER trg_enforce_elder_only_taken
  BEFORE INSERT OR UPDATE ON public.dose_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_elder_only_taken();

-- ----------------------------------------------------------------------------
-- 3. P2: Fix RPC Functions (VULN-03, VULN-07, VULN-08)
-- ----------------------------------------------------------------------------

-- Fix VULN-07: claim_elder_invitation must validate caller role is 'caregiver'
CREATE OR REPLACE FUNCTION public.claim_elder_invitation(
  p_invite_code text,
  p_relationship_type text DEFAULT 'family'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $$
DECLARE
  v_caregiver_id uuid;
  v_hash text;
  v_rel record;
BEGIN
  v_caregiver_id := auth.uid();
  IF v_caregiver_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to claim care invitation';
  END IF;

  -- Validate caller has profile with role = 'caregiver'
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = v_caregiver_id AND role = 'caregiver'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only registered caregivers can claim care invitations';
  END IF;

  IF p_invite_code IS NULL OR trim(p_invite_code) = '' THEN
    RAISE EXCEPTION 'Invalid or missing invitation code';
  END IF;

  v_hash := encode(extensions.digest(upper(trim(p_invite_code))::bytea, 'sha256'), 'hex');

  SELECT id, elder_id, caregiver_id, status, expires_at, relationship_type
  INTO v_rel
  FROM public.care_relationships
  WHERE (invite_code = v_hash OR invite_code = p_invite_code)
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;

  IF v_caregiver_id = v_rel.elder_id THEN
    RAISE EXCEPTION 'Unauthorized: An elder cannot claim their own care invitation';
  END IF;

  IF v_rel.expires_at IS NOT NULL AND v_rel.expires_at < now() THEN
    RAISE EXCEPTION 'This invitation code has expired. Please request a new code from the elder';
  END IF;

  UPDATE public.care_relationships
  SET caregiver_id = v_caregiver_id,
      status = 'active',
      relationship_type = COALESCE(NULLIF(p_relationship_type, ''), v_rel.relationship_type, 'family'),
      invite_code = NULL,
      expires_at = NULL,
      updated_at = now()
  WHERE id = v_rel.id;

  RETURN jsonb_build_object(
    'success', true,
    'relationship_id', v_rel.id,
    'elder_id', v_rel.elder_id,
    'caregiver_id', v_caregiver_id
  );
END;
$$;

-- Fix VULN-03: check_and_record_rate_limit caller parameter clamping
CREATE OR REPLACE FUNCTION public.check_and_record_rate_limit(
  p_key text,
  p_max_attempts integer DEFAULT 5,
  p_lockout_seconds integer DEFAULT 900
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_record public.rate_limits%ROWTYPE;
  v_now timestamptz := now();
  v_locked boolean := false;
  v_retry_after int := 0;
  v_max_attempts int;
  v_lockout_seconds int;
BEGIN
  IF p_key IS NULL OR trim(p_key) = '' THEN
    RAISE EXCEPTION 'Rate limit key cannot be empty';
  END IF;

  -- Server-side bounds enforcement: do not trust client thresholds
  v_max_attempts := LEAST(GREATEST(COALESCE(p_max_attempts, 5), 1), 10);
  v_lockout_seconds := LEAST(GREATEST(COALESCE(p_lockout_seconds, 900), 30), 3600);

  SELECT * INTO v_record FROM public.rate_limits WHERE key = p_key FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (key, failed_attempts, first_attempt_at, updated_at)
    VALUES (p_key, 1, v_now, v_now)
    RETURNING * INTO v_record;
    RETURN jsonb_build_object('allowed', true, 'remaining_attempts', v_max_attempts - 1, 'retry_after_seconds', 0);
  END IF;

  IF v_record.locked_until IS NOT NULL AND v_now < v_record.locked_until THEN
    v_retry_after := CEIL(EXTRACT(EPOCH FROM (v_record.locked_until - v_now)));
    RETURN jsonb_build_object('allowed', false, 'remaining_attempts', 0, 'retry_after_seconds', v_retry_after);
  END IF;

  IF v_record.locked_until IS NOT NULL AND v_now >= v_record.locked_until THEN
    UPDATE public.rate_limits 
    SET failed_attempts = 1, locked_until = NULL, first_attempt_at = v_now, updated_at = v_now
    WHERE key = p_key;
    RETURN jsonb_build_object('allowed', true, 'remaining_attempts', v_max_attempts - 1, 'retry_after_seconds', 0);
  END IF;

  v_record.failed_attempts := v_record.failed_attempts + 1;
  IF v_record.failed_attempts >= v_max_attempts THEN
    v_record.locked_until := v_now + (v_lockout_seconds || ' seconds')::interval;
    v_retry_after := v_lockout_seconds;
    v_locked := true;
  END IF;

  UPDATE public.rate_limits 
  SET failed_attempts = v_record.failed_attempts, locked_until = v_record.locked_until, updated_at = v_now
  WHERE key = p_key;

  RETURN jsonb_build_object(
    'allowed', NOT v_locked,
    'remaining_attempts', GREATEST(0, v_max_attempts - v_record.failed_attempts),
    'retry_after_seconds', v_retry_after
  );
END;
$$;

-- Fix VULN-08: get_invitation_summary server-side rate limiting
CREATE OR REPLACE FUNCTION public.get_invitation_summary(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $$
DECLARE
  v_hash text;
  v_rel record;
  v_client_id text;
  v_rl jsonb;
BEGIN
  IF p_invite_code IS NULL OR trim(p_invite_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END IF;

  -- Server-side rate limit: 15 lookups per minute per client/caller
  v_client_id := 'summary:' || COALESCE(auth.uid()::text, 'anon');
  v_rl := public.check_and_record_rate_limit(v_client_id, 15, 60);
  IF v_rl->>'allowed' = 'false' THEN
    RAISE EXCEPTION 'Too many invitation lookups. Please retry later.';
  END IF;

  v_hash := encode(extensions.digest(upper(trim(p_invite_code))::bytea, 'sha256'), 'hex');

  SELECT r.id, r.elder_id, r.status, r.expires_at, r.relationship_type, p.full_name
  INTO v_rel
  FROM public.care_relationships r
  LEFT JOIN public.profiles p ON p.id = r.elder_id
  WHERE (r.invite_code = v_hash OR r.invite_code = p_invite_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END IF;

  IF v_rel.status <> 'pending' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END IF;

  IF v_rel.expires_at IS NOT NULL AND v_rel.expires_at < now() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'status', 'expired',
      'elder_name', COALESCE(v_rel.full_name, 'Elder'),
      'relationship_type', v_rel.relationship_type,
      'expires_at', v_rel.expires_at
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'status', 'pending',
    'elder_name', COALESCE(v_rel.full_name, 'Elder'),
    'relationship_type', v_rel.relationship_type,
    'expires_at', v_rel.expires_at
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. P3: Database Least Privilege Table Grants
-- ----------------------------------------------------------------------------
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Ensure execute grants on RPCs are restricted
REVOKE ALL ON FUNCTION public.reset_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_rate_limit(text) TO service_role;

REVOKE ALL ON FUNCTION public.claim_elder_invitation(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_elder_invitation(text, text) TO authenticated, service_role;
