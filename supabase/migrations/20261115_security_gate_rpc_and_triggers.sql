-- Migration: 20261115_security_gate_rpc_and_triggers
-- Implements atomic invitation claiming with row-level locks, secure metadata summary,
-- and database-level trigger enforcing that only elders can mark doses as taken.

-- 1. Atomic invitation claim RPC
CREATE OR REPLACE FUNCTION public.claim_elder_invitation(
  p_invite_code text,
  p_relationship_type text DEFAULT 'family'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
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
    RAISE EXCEPTION 'Unauthorized: An elder cannot claim their own care invitation';
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

-- 2. Non-sensitive invitation summary RPC
CREATE OR REPLACE FUNCTION public.get_invitation_summary(
  p_invite_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_hash text;
  v_rel record;
BEGIN
  IF p_invite_code IS NULL OR trim(p_invite_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
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

-- 3. Database-level trigger enforcing elder-only taken invariant
CREATE OR REPLACE FUNCTION public.check_elder_only_taken()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NEW.status = 'taken' THEN
    -- If request is from an authenticated user (via PostgREST/Supabase Auth JWT)
    IF auth.uid() IS NOT NULL AND auth.uid() <> NEW.elder_id THEN
      RAISE EXCEPTION 'Unauthorized: Only the elder themselves can mark a dose as taken (attempted by %)', auth.uid();
    END IF;

    -- If confirmed_by is set and not matching elder_id
    IF NEW.confirmed_by IS NOT NULL AND NEW.confirmed_by <> NEW.elder_id THEN
      RAISE EXCEPTION 'Unauthorized: Confirmed_by for a taken dose must match the elder ID';
    END IF;

    -- If actor_role is set and not elder
    IF NEW.actor_role IS NOT NULL AND NEW.actor_role <> 'elder' THEN
      RAISE EXCEPTION 'Unauthorized: Actor role for taken dose must be elder';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_elder_only_taken ON public.dose_logs;
CREATE TRIGGER trg_enforce_elder_only_taken
  BEFORE INSERT OR UPDATE ON public.dose_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_elder_only_taken();

-- 4. Security Hardening on RPC Functions
REVOKE ALL ON FUNCTION public.reset_rate_limit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_rate_limit(text) TO service_role;

REVOKE ALL ON FUNCTION public.claim_elder_invitation(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_elder_invitation(text, text) TO authenticated, service_role;
