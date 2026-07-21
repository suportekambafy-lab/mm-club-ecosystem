
DELETE FROM public.mm_studio_assets WHERE id='8fc85e0c-612f-41c9-8c70-77800aa51db6';
SELECT public.mm_studio_refund_credits('e78f7368-de84-4550-aefc-1d5c41192c86'::uuid, 250, 'stuck_video_manual_refund');
