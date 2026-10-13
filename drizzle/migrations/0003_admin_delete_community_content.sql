CREATE POLICY "Admins delete any post" ON public.community_posts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete any comment" ON public.community_comments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete any chat message" ON public.community_chat_messages FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete any short comment" ON public.mm_short_comments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));