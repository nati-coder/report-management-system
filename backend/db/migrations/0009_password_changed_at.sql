-- ============================================================================
-- Migration: 0009_password_changed_at.sql
--
-- Remember when a user's password last changed (by themselves or an admin reset).
-- A JWT issued before that moment is rejected, so a stolen or forgotten session
-- stops working as soon as the password is changed. NULL = never changed (all
-- existing tokens stay valid).
-- ============================================================================
BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_changed_at timestamp with time zone;

COMMIT;
