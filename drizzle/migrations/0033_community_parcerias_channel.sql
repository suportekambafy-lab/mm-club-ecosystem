INSERT INTO public.community_categories (slug, name, description, sort_order)
VALUES ('parcerias', 'Parcerias', 'Procura sócios, fornecedores e colaborações.', 6)
ON CONFLICT (slug) DO NOTHING;