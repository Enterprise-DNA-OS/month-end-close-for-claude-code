-- Month-End Close for Claude Code: entities, their ledger accounts and trial balances, the close
-- checklist, balance sheet reconciliations with their reconciling items, manual journals,
-- variance (flux) explanations and the auditor's request list.
-- Amounts are in the entity's currency (NZD for NZ, AUD for AU). Balances are debit minus credit:
-- a liability or income balance is negative. Balance sheet accounts hold the closing balance;
-- income and expense accounts hold the month's movement.
create function touch_updated() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;

create table entities (
 id uuid primary key default gen_random_uuid(), name text not null unique check(length(trim(name))>0),
 country text not null default 'NZ' check(country in ('NZ','AU')),
 currency text generated always as (case country when 'AU' then 'AUD' else 'NZD' end) stored,
 gst_frequency text not null default 'monthly' check(gst_frequency in ('monthly','two-monthly','quarterly','six-monthly')),
 gst_anchor_month int not null default 3 check(gst_anchor_month between 1 and 12),
 materiality numeric(14,2) not null default 100 check(materiality>=0),
 flux_amount numeric(14,2) not null default 5000 check(flux_amount>=0),
 flux_pct numeric(6,2) not null default 10 check(flux_pct>=0),
 close_target_days int not null default 5 check(close_target_days between 1 and 30),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table accounts (
 id uuid primary key default gen_random_uuid(), entity_id uuid not null references entities(id),
 code text not null, name text not null check(length(trim(name))>0),
 kind text not null check(kind in ('asset','liability','equity','income','expense')),
 risk text not null default 'normal' check(risk in ('high','normal','low')),
 frequency text not null default 'monthly' check(frequency in ('monthly','quarterly','none')),
 due_day int not null default 5 check(due_day between 1 and 30),
 gst_control boolean not null default false, owner text not null default '', reviewer text not null default '',
 active boolean not null default true, source_id text unique, source_snapshot jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(entity_id,code)
);
create table periods (
 id uuid primary key default gen_random_uuid(), entity_id uuid not null references entities(id),
 period_end date not null check(period_end=(date_trunc('month',period_end)+interval '1 month')::date-1),
 state text not null default 'open' check(state in ('open','closed')),
 closed_by text, closed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(entity_id,period_end), check(state='open' or (closed_by is not null and closed_at is not null))
);
create table balances (
 id uuid primary key default gen_random_uuid(), period_id uuid not null references periods(id), account_id uuid not null references accounts(id),
 balance numeric(16,2) not null, source text not null default 'manual',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(period_id,account_id)
);
create table close_templates (
 id uuid primary key default gen_random_uuid(), entity_id uuid not null references entities(id),
 name text not null, owner text not null, reviewer text, due_day int not null check(due_day between -5 and 30), sort int not null default 100,
 source_id text unique, source_snapshot jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(entity_id,name), check(reviewer is null or lower(reviewer)<>lower(owner))
);
create table tasks (
 id uuid primary key default gen_random_uuid(), period_id uuid not null references periods(id),
 name text not null, owner text not null, reviewer text, due_day int not null check(due_day between -5 and 30), sort int not null default 100,
 state text not null default 'todo' check(state in ('todo','done','signed-off')),
 done_by text, done_at timestamptz, signed_off_by text, signed_off_at timestamptz, note text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(period_id,name),
 check(state='todo' or done_by is not null),
 check(state<>'signed-off' or (signed_off_by is not null and lower(signed_off_by)<>lower(done_by)))
);
create table reconciliations (
 id uuid primary key default gen_random_uuid(), period_id uuid not null references periods(id), account_id uuid not null references accounts(id),
 ledger_balance numeric(16,2) not null, supporting_balance numeric(16,2) not null, evidence text,
 state text not null default 'prepared' check(state in ('prepared','reviewed','rejected')),
 prepared_by text not null, prepared_at timestamptz not null default now(),
 reviewed_by text, reviewed_at timestamptz, reject_reason text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(period_id,account_id),
 check(state<>'reviewed' or (reviewed_by is not null and lower(reviewed_by)<>lower(prepared_by))),
 check(state<>'rejected' or length(trim(reject_reason))>0)
);
create table recon_items (
 id uuid primary key default gen_random_uuid(), reconciliation_id uuid not null references reconciliations(id),
 description text not null check(length(trim(description))>0), amount numeric(16,2) not null check(amount<>0),
 kind text not null default 'timing' check(kind in ('timing','adjustment')), dated date not null,
 cleared_on date, added_by text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table journals (
 id uuid primary key default gen_random_uuid(), period_id uuid not null references periods(id),
 reference text not null, description text not null check(length(trim(description))>0),
 kind text not null default 'accrual' check(kind in ('accrual','prepayment','reclass','correction','reversal')),
 reverses_next boolean not null default false, reverses_id uuid references journals(id), evidence text,
 state text not null default 'draft' check(state in ('draft','approved','posted','cancelled')),
 prepared_by text not null, approved_by text, approved_at timestamptz, ledger_ref text, posted_at timestamptz, cancel_reason text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(period_id,reference),
 check(state in ('draft','cancelled') or (approved_by is not null and lower(approved_by)<>lower(prepared_by))),
 check(state<>'posted' or length(trim(ledger_ref))>0), check(state<>'cancelled' or length(trim(cancel_reason))>0)
);
create table journal_lines (
 id uuid primary key default gen_random_uuid(), journal_id uuid not null references journals(id), account_id uuid not null references accounts(id),
 amount numeric(16,2) not null check(amount<>0), memo text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table flux_notes (
 id uuid primary key default gen_random_uuid(), period_id uuid not null references periods(id), account_id uuid not null references accounts(id),
 explanation text not null check(length(trim(explanation))>0), written_by text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(period_id,account_id)
);
create table pbc_items (
 id uuid primary key default gen_random_uuid(), entity_id uuid not null references entities(id), year_end date not null,
 reference text not null, request text not null, owner text not null, due date not null,
 state text not null default 'requested' check(state in ('requested','provided','accepted')),
 evidence text, provided_on date, accepted_by text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(entity_id,reference), check(state='requested' or (provided_on is not null and length(trim(evidence))>0))
);
create table notes (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references accounts(id), actor text not null, body text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table history (
 id uuid primary key default gen_random_uuid(), actor text not null, operation text not null, record_id uuid, detail jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
do $$ declare t text; begin foreach t in array array['entities','accounts','periods','balances','close_templates','tasks','reconciliations','recon_items','journals','journal_lines','flux_notes','pbc_items','notes','history'] loop
 execute format('create trigger touch before update on %I for each row execute function touch_updated()',t);
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
 end loop; end $$;
create index on accounts(entity_id);
create index on balances(account_id);
create index on tasks(period_id,state);
create index on reconciliations(account_id);
create index on recon_items(reconciliation_id);
create index on journals(period_id,state);
create index on journal_lines(journal_id);

-- The nth business day after a date (Monday to Friday; public holidays are not counted out).
create function business_day(p_from date,n int) returns date language sql immutable as $$
 select case when n<=0 then p_from+n else (select d::date from generate_series((p_from+1)::timestamp,(p_from+n*2+14)::timestamp,interval '1 day') d
  where extract(isodow from d)<6 order by d offset n-1 limit 1) end
$$;
-- Business days from a date to today.
create function business_days_since(p_from date) returns int language sql stable as $$
 select count(*)::int from generate_series((p_from+1)::timestamp,current_date::timestamp,interval '1 day') d where extract(isodow from d)<6
$$;
-- When the GST return for a period ending on p_end is due. See docs/compliance.md.
create function gst_due(p_country text,p_frequency text,p_end date) returns date language sql immutable as $$
 select case
  when p_country='NZ' and extract(month from p_end)=3 then make_date(extract(year from p_end)::int,5,7)
  when p_country='NZ' and extract(month from p_end)=11 then make_date(extract(year from p_end)::int+1,1,15)
  when p_country='NZ' then (date_trunc('month',p_end)+interval '1 month')::date+27
  when p_frequency='monthly' then (date_trunc('month',p_end)+interval '1 month')::date+20
  when extract(month from p_end)=12 then make_date(extract(year from p_end)::int+1,2,28)
  else (date_trunc('month',p_end)+interval '1 month')::date+27 end
$$;
create function is_gst_period_end(p_frequency text,p_anchor int,p_end date) returns boolean language sql immutable as $$
 select ((extract(month from p_end)::int-p_anchor+12)%case p_frequency when 'monthly' then 1 when 'two-monthly' then 2 when 'quarterly' then 3 else 6 end)=0
$$;

create view period_list as
 select p.id,p.entity_id,e.name as entity,e.currency,p.period_end,to_char(p.period_end,'YYYY-MM') as month,
  e.name||' '||to_char(p.period_end,'YYYY-MM') as label,p.state,p.closed_by,p.closed_at,
  business_day(p.period_end,e.close_target_days) as target_close,
  case when p.closed_at is not null then (select count(*)::int from generate_series((p.period_end+1)::timestamp,(p.closed_at::date)::timestamp,interval '1 day') d where extract(isodow from d)<6) end as days_to_close
 from periods p join entities e on e.id=p.entity_id;

-- Each account's balance with last month's beside it.
create view balance_movement as
 select pl.id as period_id,pl.label as period,pl.entity,pl.currency,a.id as account_id,a.code,a.name as account,a.kind,b.balance,
  pb.balance as prior_balance,b.balance-coalesce(pb.balance,0) as change,
  case when coalesce(pb.balance,0)<>0 then round(100*(b.balance-pb.balance)/abs(pb.balance),1) end as change_pct
 from balances b join period_list pl on pl.id=b.period_id join accounts a on a.id=b.account_id
 left join periods pp on pp.entity_id=pl.entity_id and pp.period_end=(date_trunc('month',pl.period_end)::date-1)
 left join balances pb on pb.period_id=pp.id and pb.account_id=a.id;

-- Every reconciliation an open or closed period needs: active balance sheet accounts, monthly ones
-- every month and quarterly ones at quarter end, when the balance is not zero or the account is high risk.
create view recon_status as
 select pl.id as period_id,pl.label as period,pl.entity,pl.currency,pl.state as period_state,a.id as account_id,a.code,a.name as account,a.risk,
  a.owner,a.reviewer,coalesce(b.balance,0) as balance,r.id as reconciliation_id,r.ledger_balance,r.supporting_balance,
  coalesce((select sum(i.amount) from recon_items i where i.reconciliation_id=r.id and i.cleared_on is null),0) as open_items,
  case when r.id is not null then r.ledger_balance-r.supporting_balance-coalesce((select sum(i.amount) from recon_items i where i.reconciliation_id=r.id and i.cleared_on is null),0) end as unexplained,
  r.id is not null and r.ledger_balance<>coalesce(b.balance,0) as balance_moved,
  coalesce(r.state,'not started') as state,r.prepared_by,r.reviewed_by,r.evidence,
  business_day(pl.period_end,a.due_day) as due,a.gst_control,(select materiality from entities where id=pl.entity_id) as materiality
 from period_list pl join accounts a on a.entity_id=pl.entity_id
 left join balances b on b.period_id=pl.id and b.account_id=a.id
 left join reconciliations r on r.period_id=pl.id and r.account_id=a.id
 where a.active and a.kind in ('asset','liability','equity') and a.frequency<>'none'
  and (a.frequency='monthly' or extract(month from pl.period_end)::int in (3,6,9,12))
  and (coalesce(b.balance,0)<>0 or a.risk='high' or r.id is not null);

create view recs_due as
 select period,entity,code,account,risk,owner,reviewer,balance,state,unexplained,balance_moved,due,
  case when due<current_date then business_days_since(due) else 0 end as days_late
 from recon_status where period_state='open' and (state<>'reviewed' or balance_moved);

create view tasks_due as
 select t.id,pl.label as period,t.name as task,t.owner,t.reviewer,t.state,business_day(pl.period_end,t.due_day) as due,
  case when business_day(pl.period_end,t.due_day)<current_date then business_days_since(business_day(pl.period_end,t.due_day)) else 0 end as days_late
 from tasks t join period_list pl on pl.id=t.period_id
 where pl.state='open' and (t.state='todo' or (t.state='done' and t.reviewer is not null));

-- Unexplained differences, balances that moved after preparation, and reconciling items older than 60 days.
create view differences as
 select period,entity,code,account,'Unexplained difference' as issue,unexplained as amount,state,null::date as dated
 from recon_status where unexplained is not null and abs(unexplained)>0.005
 union all
 select period,entity,code,account,'Ledger balance moved since it was reconciled',balance-ledger_balance,state,null
 from recon_status where balance_moved
 union all
 select rs.period,rs.entity,rs.code,rs.account,'Reconciling item open '||(current_date-i.dated)||' days: '||i.description,i.amount,i.kind,i.dated
 from recon_status rs join recon_items i on i.reconciliation_id=rs.reconciliation_id
 where i.cleared_on is null and i.dated<current_date-60 and rs.period_state='open';

create view flux as
 select bm.period,bm.entity,bm.currency,bm.code,bm.account,bm.kind,bm.prior_balance,bm.balance,bm.change,bm.change_pct,f.explanation,f.written_by,
  (bm.prior_balance is not null and abs(bm.change)>=e.flux_amount and (bm.change_pct is null or abs(bm.change_pct)>=e.flux_pct)) as needs_explaining
 from balance_movement bm join entities e on e.name=bm.entity left join flux_notes f on f.period_id=bm.period_id and f.account_id=bm.account_id
 where bm.prior_balance is not null or bm.balance<>0;

create view journal_status as
 select j.id,pl.label as period,j.reference,j.kind,j.description,j.state,j.prepared_by,j.approved_by,j.ledger_ref,
  coalesce((select sum(case when l.amount>0 then l.amount end) from journal_lines l where l.journal_id=j.id),0) as debits,
  coalesce((select sum(l.amount) from journal_lines l where l.journal_id=j.id),0) as out_of_balance,
  j.reverses_next,j.evidence,pl.state as period_state,pl.entity_id,pl.period_end
 from journals j join period_list pl on pl.id=j.period_id;

-- Posted accruals marked to reverse whose reversal has not been entered in the next period.
create view reversals_due as
 select js.id,js.period,js.reference,js.description,js.debits,pn.label as reverse_in
 from journal_status js join period_list pn on pn.entity_id=js.entity_id and pn.period_end=(date_trunc('month',js.period_end)+interval '2 months')::date-1
 where js.reverses_next and js.state='posted' and not exists(select 1 from journals r where r.reverses_id=js.id and r.state<>'cancelled');

create view pbc_status as
 select p.id,e.name as entity,p.year_end,p.reference,p.request,p.owner,p.due,p.state,p.provided_on,p.accepted_by,
  case when p.state='requested' and p.due<current_date then current_date-p.due else 0 end as days_overdue
 from pbc_items p join entities e on e.id=p.entity_id;

create view close_status as
 select pl.label as period,pl.state,pl.target_close,business_days_since(pl.period_end) as business_days_in,
  (select count(*) from tasks t where t.period_id=pl.id)::int as tasks,
  (select count(*) from tasks t where t.period_id=pl.id and (t.state='signed-off' or (t.state='done' and t.reviewer is null)))::int as tasks_finished,
  (select count(*) from recon_status r where r.period_id=pl.id)::int as recs_needed,
  (select count(*) from recon_status r where r.period_id=pl.id and r.state='reviewed' and not r.balance_moved)::int as recs_reviewed,
  (select count(*) from journals j where j.period_id=pl.id and j.state not in ('posted','cancelled'))::int as journals_unposted,
  (select count(*) from flux f join period_list x on x.label=f.period where x.id=pl.id and f.needs_explaining and f.explanation is null)::int as flux_unexplained,
  pl.days_to_close,pl.closed_by
 from period_list pl;

-- Rules with sources in docs/compliance.md. Prompts for a person to check, not legal or tax advice.
create view compliance_gaps as
 select 'RECORDS-EXPLAIN' as rule,rs.entity,rs.period,rs.code||' '||rs.account as record,
  case when rs.state='not started' then 'Period closed with this balance never reconciled' else 'Period closed with this reconciliation '||rs.state end as issue,
  case e.country when 'AU' then 'https://www.legislation.gov.au/C2004A00818/latest/text' else 'https://www.legislation.govt.nz/act/public/1993/0105/latest/whole.html' end as source
 from recon_status rs join entities e on e.name=rs.entity where rs.period_state='closed' and rs.state<>'reviewed'
 union all
 select 'RECORDS-EVIDENCE',rs.entity,rs.period,rs.code||' '||rs.account,'Reviewed with no supporting evidence recorded',
  case e.country when 'AU' then 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/record-keeping-for-business' else 'https://www.ird.govt.nz/managing-my-tax/record-keeping' end
 from recon_status rs join entities e on e.name=rs.entity where rs.state='reviewed' and coalesce(trim(rs.evidence),'')=''
 union all
 select 'RECORDS-EXPLAIN',rs.entity,rs.period,rs.code||' '||rs.account,'Reviewed with '||rs.unexplained||' unexplained, above materiality of '||rs.materiality,
  case e.country when 'AU' then 'https://www.legislation.gov.au/C2004A00818/latest/text' else 'https://www.legislation.govt.nz/act/public/1993/0105/latest/whole.html' end
 from recon_status rs join entities e on e.name=rs.entity where rs.state='reviewed' and abs(rs.unexplained)>rs.materiality
 union all
 select 'GST-RETURN',e.name,pl.label,rs.code||' '||rs.account,
  case when gst_due(e.country,e.gst_frequency,pl.period_end)<current_date then 'Return was due '||gst_due(e.country,e.gst_frequency,pl.period_end)||' and the GST control account is not reconciled'
   else 'Return due '||gst_due(e.country,e.gst_frequency,pl.period_end)||' ('||(gst_due(e.country,e.gst_frequency,pl.period_end)-current_date)||' days); GST control account not reconciled' end,
  case e.country when 'AU' then 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/business-activity-statements-bas/due-dates-for-lodging-and-paying-your-bas' else 'https://www.ird.govt.nz/gst/filing-and-paying-gst-and-refunds/filing-gst' end
 from period_list pl join entities e on e.id=pl.entity_id join recon_status rs on rs.period_id=pl.id and rs.gst_control
 where is_gst_period_end(e.gst_frequency,e.gst_anchor_month,pl.period_end) and (rs.state<>'reviewed' or rs.balance_moved)
  and gst_due(e.country,e.gst_frequency,pl.period_end)>=current_date-90;

-- How long each period's close records must be kept. See docs/compliance.md.
create view retention as
 select pl.label as period,e.country,pl.state,
  case e.country when 'AU' then (pl.period_end+interval '7 years')::date
   else (make_date(extract(year from pl.period_end)::int+case when extract(month from pl.period_end)>3 then 1 else 0 end,3,31)+interval '7 years')::date end as keep_until,
  case e.country when 'AU' then 'Corporations Act 2001 s286: 7 years after the transactions; ATO: at least 5 years' else 'Tax Administration Act 1994 s22: 7 years from the end of the income year (31 March assumed)' end as rule,
  (select count(*) from reconciliations r where r.period_id=pl.id)::int as reconciliations,
  (select count(*) from journals j where j.period_id=pl.id)::int as journals
 from period_list pl join entities e on e.id=pl.entity_id;

revoke all on period_list,balance_movement,recon_status,recs_due,tasks_due,differences,flux,journal_status,reversals_due,pbc_status,close_status,compliance_gaps,retention from public;
