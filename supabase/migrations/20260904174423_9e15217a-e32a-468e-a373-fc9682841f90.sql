ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS external_recording_url text;

UPDATE public.lives
SET external_recording_url = 'https://vz-5c879716-268.b-cdn.net/c43467cc-9ef3-4818-8cfd-07301a1bdd87/playlist.m3u8',
    status = 'published'
WHERE id = '2c94af6a-19ce-4727-ab77-9e96e23871f3';