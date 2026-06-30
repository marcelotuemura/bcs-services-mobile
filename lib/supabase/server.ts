import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

type CreateClientOptions = {
  onCookieSet?: (event: {
    success: boolean;
    count: number;
    errorMessage?: string;
  }) => void;
};

export async function createClient(options?: CreateClientOptions) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          let count = 0;

          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              count += 1;
            });

            options?.onCookieSet?.({
              success: true,
              count
            });
          } catch (error) {
            options?.onCookieSet?.({
              success: false,
              count,
              errorMessage:
                error instanceof Error ? error.message : 'Unknown cookie error'
            });
          }
        }
      }
    }
  );
}
