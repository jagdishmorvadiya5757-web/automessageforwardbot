-- Seeds the single bypass admin account used by the direct sign-in flow.
-- The UUID must match DIRECT_ADMIN_USER_ID in src/lib/direct-auth.server.ts.

DO $$
DECLARE
  _uid uuid := '11111111-1111-4111-8111-111111111111';
  _email text := 'jagdishmorvadiya5757@gmail.com';
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            _email, now(), '{"provider":"direct","providers":["direct"]}'::jsonb,
            '{"display_name":"Admin"}'::jsonb, now(), now())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();
  END IF;

  INSERT INTO public.profiles (id, display_name)
  VALUES (_uid, 'Admin')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'admin'), (_uid, 'user')
  ON CONFLICT DO NOTHING;

  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    INSERT INTO public.subscriptions (user_id, plan, is_active, subscription_ends_at)
    VALUES (_uid, 'business', true, null)
    ON CONFLICT (user_id) DO UPDATE SET plan = 'business', is_active = true,
      subscription_ends_at = null;
  END IF;

  IF to_regclass('public.wallets') IS NOT NULL THEN
    INSERT INTO public.wallets (user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  END IF;
END $$;
