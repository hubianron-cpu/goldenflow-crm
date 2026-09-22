begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Fail rather than silently create an empty table in an incompletely migrated project.
do $$
begin
  if to_regclass('public.grow_webhook_events') is null then
    raise exception 'grow_webhook_events base migration is required first';
  end if;
end $$;

-- Stage only the allowed payment fields. Everything else in the raw body is discarded.
create temp table grow_redaction_stage on commit drop as
with extracted as (
  select id,
    coalesce(
      jsonb_path_query_first(payload, '$.**.payment_date') #>> '{}',
      jsonb_path_query_first(payload, '$.**.paymentDate') #>> '{}'
    ) as raw_date,
    coalesce(
      jsonb_path_query_first(payload, '$.**.payment_sum') #>> '{}',
      jsonb_path_query_first(payload, '$.**.paymentSum') #>> '{}',
      jsonb_path_query_first(payload, '$.**.sum') #>> '{}'
    ) as raw_sum
  from public.grow_webhook_events
), cleaned as (
  select id, raw_date, raw_sum,
    btrim(raw_date) as payment_date,
    replace(btrim(raw_sum), ',', '') as payment_sum
  from extracted
)
select id, raw_date, raw_sum,
  jsonb_build_object(
    'schema_version', 1,
    'payment_date', case
      when payment_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then payment_date
      when payment_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
        then left(payment_date, 10)
      when payment_date ~ '^[0-9]{1,2}/[0-9]{1,2}/([0-9]{2}|[0-9]{4})$' then payment_date
      else null end,
    'payment_sum', case
      when payment_sum ~ '^[-+]?[0-9]{1,14}(\.[0-9]{1,4})?$'
        then payment_sum::numeric
      else null end
  ) as audit_payload
from cleaned;

-- An unparseable non-empty payment value requires investigation, not data loss.
do $$
begin
  if exists (
    select 1 from grow_redaction_stage
    where (nullif(btrim(raw_date), '') is not null and audit_payload ->> 'payment_date' is null)
       or (nullif(btrim(raw_sum), '') is not null and audit_payload ->> 'payment_sum' is null)
  ) then
    raise exception 'Unparseable Grow payment fields; no payloads changed';
  end if;
end $$;

update public.grow_webhook_events as events
set payload = stage.audit_payload
from grow_redaction_stage as stage
where events.id = stage.id
  and events.payload is distinct from stage.audit_payload;

commit;
