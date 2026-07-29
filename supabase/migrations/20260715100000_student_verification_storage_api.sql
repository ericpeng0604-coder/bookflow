-- Student verification review must use the Storage API for object deletion.

create or replace function public.review_student_verification(
  target_id uuid,
  decision text,
  note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target public.student_verifications;
begin
  if not public.is_moderator() then
    raise exception 'Moderator permission required';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Invalid student verification decision';
  end if;

  select * into target
  from public.student_verifications
  where id = target_id and status = 'pending'
  for update;
  if target.id is null then
    raise exception 'Pending student verification required';
  end if;

  update public.student_verifications
  set status = decision,
      review_note = left(coalesce(note, ''), 1000),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      image_path = '',
      ocr_text = '',
      quality_flags = '{}'::jsonb,
      sensitive_data_deleted_at = now(),
      updated_at = now()
  where id = target.id;

  insert into public.student_verification_audit_logs (verification_id, actor_id, action)
  values (target.id, auth.uid(), decision);
end;
$$;

create or replace function public.withdraw_student_verification(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target public.student_verifications;
begin
  select * into target
  from public.student_verifications
  where id = target_id and user_id = auth.uid() and status = 'pending'
  for update;
  if target.id is null then
    raise exception 'Pending student verification required';
  end if;

  update public.student_verifications
  set status = 'withdrawn',
      image_path = '',
      ocr_text = '',
      quality_flags = '{}'::jsonb,
      sensitive_data_deleted_at = now(),
      updated_at = now()
  where id = target.id;

  insert into public.student_verification_audit_logs (verification_id, actor_id, action)
  values (target.id, auth.uid(), 'withdrawn');
end;
$$;
