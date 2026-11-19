import { redirect } from '@tanstack/react-router';
import { accessToken } from '@/lib/supabase';

export async function redirectIfLoggedIn() {
  if (await accessToken()) throw redirect({ to: '/' });
}
