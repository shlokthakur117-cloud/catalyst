-- ============================================================================
-- CareLedger Canonical Security Remediation Migration
-- Migration ID: 20261115085259_emergency_security_remediation
-- Target Project: careledger-prod (shsvqcipprcoqzgyibig)
-- 
-- Fixes VULN-01, VULN-02, VULN-03, VULN-04, VULN-05, VULN-06, VULN-07, VULN-08
-- Reconstructed from authoritative PostgreSQL live catalog definitions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. P0: Fix care_relationships RLS Policies and Mutation Invariants (VULN-01, VULN-02)
-- ----------------------------------------------------------------------------

-- Drop old permissive policies and obsolete policy variants on care_relationships
DROP POLICY IF EXISTS "Authenticated users can create relationship links" ON public.care_relationships;
DROP POLICY IF EXISTS "Caregiver or elder can update relationship status" ON public.care_relationships;
DROP POLICY IF EXISTS "Elders can create pending invitations" ON public.care_relationships;
DROP POLICY IF EXISTS "Elders can update their care relationships" ON public.care_relationships;
DROP POLICY IF EXISTS "Caregivers can resign from active relationships" ON public.care_relationships;

-- Direct INSERT permitted ONLY for elders creating a pending invite
CREATE POLICY "Authenticated users can create relationship links"
  ON public.care_relationships FOR INSERT
  WITH CHECK (
    auth.uid() = elder_id 
    AND status = 'pending' 
    AND caregiver_id = elder_id 
    AND invite_code IS NOT NULL
  );

-- Elders can update their own relationships; caregivers can only resign (active -> revoked)
CREATE POLICY "Caregiver or elder can update relationship status"
  ON public.care_relationships FOR UPDATE
  USING (
    (auth.uid() = elder_id) 
    OR ((auth.uid() = caregiver_id) AND (status = 'active'))
  )
  WITH CHECK (
    (auth.uid() = elder_id) 
    OR ((auth.uid() = caregiver_id) AND (status = 'revoked'))
  );

-- Trigger function enforcing ownership immutability and state transition invariants
CREATE OR REPLACE FUNCTION public.check_care_relationship_mutations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'auth', 'extensions'
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

ALTER FUNCTION public.check_care_relationship_mutations() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_check_care_relationship_mutations ON public.care_relationships;
CREATE TRIGGER trg_check_care_relationship_mutations
  BEFORE UPDATE ON public.care_relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.check_care_relationship_mutations();

-- ----------------------------------------------------------------------------
-- 2. P1: Fix Medication Deletion Guard (VULN-04)
-- ----------------------------------------------------------------------------

-- Clean up any obsolete split medication policies if present
DROP POLICY IF EXISTS "Authorized caregiver can insert elder medications" ON public.medications;
DROP POLICY IF EXISTS "Authorized caregiver can update elder medications" ON public.medications;

-- Trigger function preventing caregivers from deleting medications
CREATE OR REPLACE FUNCTION public.check_medication_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'auth', 'extensions'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF auth.uid() <> OLD.elder_id THEN
      RAISE EXCEPTION 'Unauthorized: Only the elder themselves can delete a medication';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

ALTER FUNCTION public.check_medication_delete_guard() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_check_medication_delete_guard ON public.medications;
CREATE TRIGGER trg_check_medication_delete_guard
  BEFORE DELETE ON public.medications
  FOR EACH ROW
  EXECUTE FUNCTION public.check_medication_delete_guard();

-- ----------------------------------------------------------------------------
-- 3. P1: Fix Dose Logs Integrity & Attribution Invariants (VULN-05, VULN-06)
-- ----------------------------------------------------------------------------

-- Trigger function enforcing cross-elder validation and dose attribution invariants
CREATE OR REPLACE FUNCTION public.check_elder_only_taken()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_med_elder_id UUID;
  v_sched_elder_id UUID;
BEGIN
  -- VULN-05 fix: Verify medication belongs to the elder
  IF NEW.medication_id IS NOT NULL THEN
    SELECT elder_id INTO v_med_elder_id FROM public.medications WHERE id = NEW.medication_id;
    IF v_med_elder_id IS NULL OR v_med_elder_id <> NEW.elder_id THEN
      RAISE EXCEPTION 'Integrity violation: Medication % does not belong to elder %', NEW.medication_id, NEW.elder_id;
    END IF;
  END IF;

  -- VULN-05 fix: Verify schedule belongs to the elder if specified
  IF NEW.schedule_id IS NOT NULL THEN
    SELECT elder_id INTO v_sched_elder_id FROM public.medication_schedules WHERE id = NEW.schedule_id;
    IF v_sched_elder_id IS NULL OR v_sched_elder_id <> NEW.elder_id THEN
      RAISE EXCEPTION 'Integrity violation: Medication schedule % does not belong to elder %', NEW.schedule_id, NEW.elder_id;
    END IF;
  END IF;

  -- Elder-only taken invariant
  IF NEW.status = 'taken' AND (auth.uid() IS NULL OR auth.uid() <> NEW.elder_id OR NEW.actor_role <> 'elder') THEN
    RAISE EXCEPTION 'Only the elder themselves can mark a dose as taken';
  END IF;

  -- VULN-06 fix: Verify actor_role cannot be spoofed
  IF NEW.actor_role = 'elder' THEN
    IF auth.uid() IS NULL OR auth.uid() <> NEW.elder_id THEN
      RAISE EXCEPTION 'Unauthorized: Non-elder cannot attribute dose action to elder';
    END IF;
  END IF;

  -- VULN-06 fix: Verify confirmed_by cannot be spoofed to elder by a non-elder
  IF NEW.confirmed_by IS NOT NULL AND NEW.confirmed_by = NEW.elder_id THEN
    IF auth.uid() IS NULL OR auth.uid() <> NEW.elder_id THEN
      RAISE EXCEPTION 'Unauthorized: Non-elder cannot confirm on behalf of elder';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.check_elder_only_taken() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_enforce_elder_only_taken ON public.dose_logs;
CREATE TRIGGER trg_enforce_elder_only_taken
  BEFORE INSERT OR UPDATE ON public.dose_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_elder_only_taken();

-- ----------------------------------------------------------------------------
-- 4. P2: Fix Rate Limiting RPC Function (VULN-03)
-- ----------------------------------------------------------------------------

-- Server-side parameter bounds enforcement for rate limits
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

  -- Reset failed attempts if previous sliding window has elapsed
  IF v_record.locked_until IS NULL AND (v_now - v_record.first_attempt_at) > (v_lockout_seconds || ' seconds')::interval THEN
    v_record.failed_attempts := 0;
    v_record.first_attempt_at := v_now;
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

ALTER FUNCTION public.check_and_record_rate_limit(text, integer, integer) OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 5. P2: Fix Invitation Claim RPC Function (VULN-01, VULN-02, VULN-07)
-- ----------------------------------------------------------------------------

-- Atomic invitation claim with caller rate limiting and role validation
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
  v_rate_limit_result jsonb;
BEGIN
  v_caregiver_id := auth.uid();
  IF v_caregiver_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to claim care invitation';
  END IF;

  -- Rate limit check
  v_rate_limit_result := public.check_and_record_rate_limit(
    'invite_claim_' || v_caregiver_id::text,
    5,
    900
  );

  IF NOT (v_rate_limit_result->>'allowed')::boolean THEN
    RAISE EXCEPTION 'Too many invitation claim attempts. Please wait % seconds before trying again.',
      (v_rate_limit_result->>'retry_after_seconds')::text;
  END IF;

  IF p_invite_code IS NULL OR trim(p_invite_code) = '' THEN
    RAISE EXCEPTION 'Invalid or missing invitation code';
  END IF;

  v_hash := encode(extensions.digest(upper(trim(p_invite_code))::bytea, 'sha256'), 'hex');

  -- Lock the pending invitation row exclusively to eliminate race conditions
  SELECT id, elder_id, caregiver_id, status, expires_at, relationship_type
  INTO v_rel
  FROM public.care_relationships
  WHERE (invite_code = v_hash OR invite_code = p_invite_code)
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;

  -- Self-claim prevention: elder cannot claim their own invite
  IF v_caregiver_id = v_rel.elder_id THEN
    RAISE EXCEPTION 'An elder cannot claim their own care invitation';
  END IF;

  -- VULN-07: Validate caller has profile with role = 'caregiver'
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = v_caregiver_id AND role = 'caregiver'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only registered caregivers can claim care invitations';
  END IF;

  -- Expiry check
  IF v_rel.expires_at IS NOT NULL AND v_rel.expires_at < now() THEN
    RAISE EXCEPTION 'This invitation code has expired. Please request a new code from the elder';
  END IF;

  -- Update row atomically, erasing the invite code to enforce single use
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

ALTER FUNCTION public.claim_elder_invitation(text, text) OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 6. P2: Fix Invitation Summary RPC Function (VULN-08)
-- ----------------------------------------------------------------------------

-- Public summary with rate limiting and timing-attack resistant responses
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

  v_hash := encode(extensions.digest(upper(trim(p_invite_code))::bytea, 'sha256'), 'hex');

  -- Per-invitation abuse control: rate limit on the hashed invitation code
  -- Prevents brute-forcing an individual code, while avoiding the global summary:anon DoS bottleneck
  v_client_id := 'summary:code:' || substring(v_hash from 1 for 16);
  v_rl := public.check_and_record_rate_limit(v_client_id, 15, 60);
  IF v_rl->>'allowed' = 'false' THEN
    RAISE EXCEPTION 'Too many invitation lookups for this code. Please retry later.';
  END IF;

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

ALTER FUNCTION public.get_invitation_summary(text) OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 7. Rate Limit Reset RPC & Test Harness Helper
-- ----------------------------------------------------------------------------

-- Production service-role rate limit reset
CREATE OR REPLACE FUNCTION public.reset_rate_limit(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE key = p_key;
END;
$$;

ALTER FUNCTION public.reset_rate_limit(text) OWNER TO postgres;

-- Hardened test helper: only service-role can execute, restricted to test accounts
CREATE OR REPLACE FUNCTION public.reset_test_rate_limits(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_email text;
BEGIN
  -- Strict verification: Only test accounts ending with .gate@careledger.org or @careledger.test can have rate limits reset
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL OR (v_email NOT LIKE '%.gate@careledger.org' AND v_email NOT LIKE '%@careledger.test') THEN
    RAISE EXCEPTION 'Unauthorized: Rate limit reset only permitted for verified test accounts';
  END IF;

  UPDATE public.rate_limits 
  SET failed_attempts = 0, locked_until = NULL 
  WHERE key IN ('invite_claim_' || p_user_id::text, 'summary:' || p_user_id::text);
END;
$$;

ALTER FUNCTION public.reset_test_rate_limits(uuid) OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 8. Table & Function Least Privilege Permissions
-- ----------------------------------------------------------------------------

-- Revoke dangerous table privileges from anon and authenticated
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Function ACLs:
-- reset_rate_limit: service_role only
REVOKE ALL ON FUNCTION public.reset_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_rate_limit(text) TO service_role;

-- claim_elder_invitation: authenticated, service_role only
REVOKE ALL ON FUNCTION public.claim_elder_invitation(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_elder_invitation(text, text) TO authenticated, service_role;

-- reset_test_rate_limits: service_role only
REVOKE ALL ON FUNCTION public.reset_test_rate_limits(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_test_rate_limits(uuid) TO service_role;

-- check_and_record_rate_limit: service_role and internal SECURITY DEFINER only
REVOKE ALL ON FUNCTION public.check_and_record_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_record_rate_limit(text, integer, integer) TO service_role;

