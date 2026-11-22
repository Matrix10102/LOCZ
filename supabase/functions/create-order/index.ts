import { handleOrderRequest } from './handler.mjs';

Deno.serve(request => handleOrderRequest(request, {
  SUPABASE_URL: Deno.env.get('SUPABASE_URL') || '',
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  BREVO_API_KEY: Deno.env.get('BREVO_API_KEY') || '',
  LOCZ_FROM_EMAIL: Deno.env.get('LOCZ_FROM_EMAIL') || '',
  LOCZ_FROM_NAME: Deno.env.get('LOCZ_FROM_NAME') || 'LOCZ Orders',
  LOCZ_NOTIFICATION_EMAIL: Deno.env.get('LOCZ_NOTIFICATION_EMAIL') || 'loczqatar@gmail.com',
  ALLOWED_ORIGINS: Deno.env.get('ALLOWED_ORIGINS') || ''
}));
