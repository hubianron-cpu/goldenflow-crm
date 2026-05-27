alter table public.roi_tools
add column if not exists result_type text not null default 'לידים';

notify pgrst, 'reload schema';
