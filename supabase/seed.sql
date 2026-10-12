-- Fictional demo data. Dates move with today: the close in progress is last month, the one before is closed.
insert into entities(id,name,country,gst_frequency,gst_anchor_month,materiality,flux_amount,flux_pct,close_target_days) values
 ('e0000000-0000-0000-0000-000000000001','Kauri Foods Ltd','NZ','monthly',3,100,5000,10,5),
 ('e0000000-0000-0000-0000-000000000002','Kauri Foods Pty Ltd','AU','quarterly',3,100,5000,10,6)
 on conflict do nothing;
insert into accounts(id,entity_id,code,name,kind,risk,frequency,due_day,gst_control,owner,reviewer) values
 ('a0000000-0000-0000-0000-000000000101','e0000000-0000-0000-0000-000000000001','1000','ANZ operating account','asset','high','monthly',2,false,'Mere','Tom'),
 ('a0000000-0000-0000-0000-000000000102','e0000000-0000-0000-0000-000000000001','1100','Trade debtors','asset','high','monthly',3,false,'Mere','Tom'),
 ('a0000000-0000-0000-0000-000000000103','e0000000-0000-0000-0000-000000000001','1200','Inventory','asset','normal','monthly',5,false,'Sione','Tom'),
 ('a0000000-0000-0000-0000-000000000104','e0000000-0000-0000-0000-000000000001','1300','Prepayments','asset','low','monthly',6,false,'Sione','Tom'),
 ('a0000000-0000-0000-0000-000000000105','e0000000-0000-0000-0000-000000000001','2000','Trade creditors','liability','high','monthly',3,false,'Sione','Tom'),
 ('a0000000-0000-0000-0000-000000000106','e0000000-0000-0000-0000-000000000001','2100','Accrued expenses','liability','normal','monthly',4,false,'Sione','Tom'),
 ('a0000000-0000-0000-0000-000000000107','e0000000-0000-0000-0000-000000000001','2200','GST control','liability','high','monthly',3,true,'Mere','Tom'),
 ('a0000000-0000-0000-0000-000000000108','e0000000-0000-0000-0000-000000000001','2300','PAYE payable','liability','normal','monthly',4,false,'Mere','Tom'),
 ('a0000000-0000-0000-0000-000000000109','e0000000-0000-0000-0000-000000000001','2500','Westpac term loan','liability','normal','monthly',5,false,'Tom','Ana'),
 ('a0000000-0000-0000-0000-000000000110','e0000000-0000-0000-0000-000000000001','4000','Sales','income','normal','none',5,false,'Tom','Ana'),
 ('a0000000-0000-0000-0000-000000000111','e0000000-0000-0000-0000-000000000001','5000','Cost of sales','expense','normal','none',5,false,'Tom','Ana'),
 ('a0000000-0000-0000-0000-000000000112','e0000000-0000-0000-0000-000000000001','6100','Wages','expense','normal','none',5,false,'Tom','Ana'),
 ('a0000000-0000-0000-0000-000000000113','e0000000-0000-0000-0000-000000000001','6200','Freight','expense','normal','none',5,false,'Tom','Ana'),
 ('a0000000-0000-0000-0000-000000000114','e0000000-0000-0000-0000-000000000001','6300','Power and utilities','expense','normal','none',5,false,'Tom','Ana'),
 ('a0000000-0000-0000-0000-000000000201','e0000000-0000-0000-0000-000000000002','1000','CBA business account','asset','high','monthly',2,false,'Priya','Tom'),
 ('a0000000-0000-0000-0000-000000000202','e0000000-0000-0000-0000-000000000002','1100','Trade debtors','asset','high','monthly',3,false,'Priya','Tom'),
 ('a0000000-0000-0000-0000-000000000203','e0000000-0000-0000-0000-000000000002','2000','Trade creditors','liability','normal','monthly',4,false,'Priya','Tom'),
 ('a0000000-0000-0000-0000-000000000204','e0000000-0000-0000-0000-000000000002','2200','GST payable','liability','high','monthly',3,true,'Priya','Tom'),
 ('a0000000-0000-0000-0000-000000000205','e0000000-0000-0000-0000-000000000002','4000','Sales','income','normal','none',5,false,'Tom','Ana'),
 ('a0000000-0000-0000-0000-000000000206','e0000000-0000-0000-0000-000000000002','5000','Cost of sales','expense','normal','none',5,false,'Tom','Ana')
 on conflict do nothing;
insert into periods(id,entity_id,period_end,state,closed_by,closed_at) values
 ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001',(date_trunc('month',current_date)-interval '1 month')::date-1,'closed','Tom',((date_trunc('month',current_date)-interval '1 month')::date+8)::timestamptz),
 ('f0000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000001',date_trunc('month',current_date)::date-1,'open',null,null),
 ('f0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000002',(date_trunc('month',current_date)-interval '1 month')::date-1,'closed','Tom',((date_trunc('month',current_date)-interval '1 month')::date+6)::timestamptz),
 ('f0000000-0000-0000-0000-000000000004','e0000000-0000-0000-0000-000000000002',date_trunc('month',current_date)::date-1,'open',null,null)
 on conflict do nothing;
-- Trial balances. Last month (closed) then this close.
insert into balances(id,period_id,account_id,balance,source)
select gen_random_uuid(),v.p::uuid,v.a::uuid,v.b,'demo' from (values
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000101',182450.20),
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000102',412880.00),
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000103',655300.00),
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000104',24000.00),
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000105',-298410.55),
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000106',-61200.00),
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000107',-38912.40),
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000108',-22180.00),
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000109',-400000.00),
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000110',-1020000.00),
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000111',612000.00),
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000112',188000.00),
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000113',41500.00),
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000114',9120.00),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000101',96215.75),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000102',468120.40),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000103',702950.00),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000104',21000.00),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000105',-341775.10),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000106',-48600.00),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000107',-44307.85),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000108',-23045.00),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000109',-395000.00),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000110',-1108400.00),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000111',671300.00),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000112',189250.00),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000113',63900.00),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000114',9480.00),
 ('f0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000201',64300.00),
 ('f0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000202',88450.00),
 ('f0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000203',-41200.00),
 ('f0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000204',-9870.00),
 ('f0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000205',-150000.00),
 ('f0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000206',92000.00),
 ('f0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000201',71880.60),
 ('f0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000202',95210.00),
 ('f0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000203',-38950.00),
 ('f0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000204',-12446.30),
 ('f0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000205',-158300.00),
 ('f0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000206',97100.00)
) v(p,a,b) on conflict (period_id,account_id) do nothing;

-- The close checklist each month, per entity.
insert into close_templates(id,entity_id,name,owner,reviewer,due_day,sort) values
 ('b0000000-0000-0000-0000-000000000101','e0000000-0000-0000-0000-000000000001','Bank feeds coded to month end','Mere',null,1,10),
 ('b0000000-0000-0000-0000-000000000102','e0000000-0000-0000-0000-000000000001','Debtors aged and bad debts reviewed','Mere','Tom',2,20),
 ('b0000000-0000-0000-0000-000000000103','e0000000-0000-0000-0000-000000000001','Supplier invoices cut off','Sione','Tom',2,30),
 ('b0000000-0000-0000-0000-000000000104','e0000000-0000-0000-0000-000000000001','Payroll and PAYE accrued','Mere','Tom',2,40),
 ('b0000000-0000-0000-0000-000000000105','e0000000-0000-0000-0000-000000000001','Stocktake variance posted','Sione','Tom',3,50),
 ('b0000000-0000-0000-0000-000000000106','e0000000-0000-0000-0000-000000000001','Accrual and prepayment journals','Sione','Tom',3,60),
 ('b0000000-0000-0000-0000-000000000107','e0000000-0000-0000-0000-000000000001','GST return prepared','Mere','Tom',4,70),
 ('b0000000-0000-0000-0000-000000000108','e0000000-0000-0000-0000-000000000001','Variance commentary written','Tom','Ana',5,80),
 ('b0000000-0000-0000-0000-000000000109','e0000000-0000-0000-0000-000000000001','Management accounts to the board','Tom','Ana',6,90),
 ('b0000000-0000-0000-0000-000000000201','e0000000-0000-0000-0000-000000000002','Bank feeds coded to month end','Priya',null,1,10),
 ('b0000000-0000-0000-0000-000000000202','e0000000-0000-0000-0000-000000000002','BAS worksheet prepared','Priya','Tom',4,20),
 ('b0000000-0000-0000-0000-000000000203','e0000000-0000-0000-0000-000000000002','Management accounts to the board','Tom','Ana',6,30)
 on conflict do nothing;
insert into tasks(id,period_id,name,owner,reviewer,due_day,sort,state,done_by,done_at,signed_off_by,signed_off_at)
select ('c0000000-0000-0000-0000-'||lpad(p.n||t.sort::text,12,'0'))::uuid,p.id,t.name,t.owner,t.reviewer,t.due_day,t.sort,
 case when p.n='1' or p.n='3' then case when t.reviewer is null then 'done' else 'signed-off' end else s2.state end,
 case when p.n in ('1','3') or s2.state<>'todo' then t.owner end,
 case when p.n in ('1','3') or s2.state<>'todo' then now() end,
 case when (p.n in ('1','3') and t.reviewer is not null) or s2.state='signed-off' then t.reviewer end,
 case when (p.n in ('1','3') and t.reviewer is not null) or s2.state='signed-off' then now() end
from (values ('1','f0000000-0000-0000-0000-000000000001'::uuid,'e0000000-0000-0000-0000-000000000001'::uuid),('2','f0000000-0000-0000-0000-000000000002'::uuid,'e0000000-0000-0000-0000-000000000001'::uuid),
 ('3','f0000000-0000-0000-0000-000000000003'::uuid,'e0000000-0000-0000-0000-000000000002'::uuid),('4','f0000000-0000-0000-0000-000000000004'::uuid,'e0000000-0000-0000-0000-000000000002'::uuid)) p(n,id,entity_id)
join close_templates t on t.entity_id=p.entity_id
left join (values ('Bank feeds coded to month end','done'),('Debtors aged and bad debts reviewed','done'),('Supplier invoices cut off','signed-off'),('Payroll and PAYE accrued','signed-off')) s(name,state) on s.name=t.name
cross join lateral (select coalesce(s.state,'todo') as state) s2
on conflict do nothing;

-- Reconciliations. Last month: everything reviewed except the term loan, and PAYE with no evidence.
insert into reconciliations(id,period_id,account_id,ledger_balance,supporting_balance,evidence,state,prepared_by,reviewed_by,reviewed_at)
select ('d0000000-0000-0000-0000-'||lpad(substr(p.id::text,36,1)||substr(a.id::text,34,3),12,'0'))::uuid,p.id,a.id,b.balance,b.balance,
 case when a.code='2300' and p.entity_id='e0000000-0000-0000-0000-000000000001' then null else 'demo://evidence/'||a.code||'-'||to_char(p.period_end,'YYYY-MM')||'.pdf' end,
 'reviewed',a.owner,a.reviewer,now()
from periods p join accounts a on a.entity_id=p.entity_id join balances b on b.period_id=p.id and b.account_id=a.id
where p.state='closed' and a.kind in ('asset','liability') and a.code<>'2500'
on conflict do nothing;
-- This close: bank and loan reviewed, debtors with a difference, inventory waiting on review,
-- creditors reconciled before a late invoice moved the balance, GST prepared but not reviewed.
insert into reconciliations(id,period_id,account_id,ledger_balance,supporting_balance,evidence,state,prepared_by,reviewed_by,reviewed_at) values
 ('d0000000-0000-0000-0000-000000002101','f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000101',96215.75,98915.75,'demo://evidence/anz-statement.pdf','reviewed','Mere','Tom',now()),
 ('d0000000-0000-0000-0000-000000002102','f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000102',468120.40,467870.40,'demo://evidence/aged-debtors.xlsx','prepared','Mere',null,null),
 ('d0000000-0000-0000-0000-000000002103','f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000103',702950.00,702950.00,'demo://evidence/stocktake.xlsx','prepared','Sione',null,null),
 ('d0000000-0000-0000-0000-000000002105','f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000105',-339575.10,-338375.10,'demo://evidence/aged-creditors.xlsx','prepared','Sione',null,null),
 ('d0000000-0000-0000-0000-000000002107','f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000107',-44307.85,-44307.85,'demo://evidence/gst-workpaper.xlsx','prepared','Mere',null,null),
 ('d0000000-0000-0000-0000-000000002109','f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000109',-395000.00,-395000.00,'demo://evidence/westpac-loan-statement.pdf','reviewed','Tom','Ana',now()),
 ('d0000000-0000-0000-0000-000000004201','f0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000201',71880.60,71880.60,'demo://evidence/cba-statement.pdf','reviewed','Priya','Tom',now()),
 ('d0000000-0000-0000-0000-000000004202','f0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000202',95210.00,95210.00,'demo://evidence/au-aged-debtors.xlsx','prepared','Priya',null,null)
 on conflict do nothing;
insert into recon_items(id,reconciliation_id,description,amount,kind,dated,added_by) values
 ('d1000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000002101','Unpresented cheque 004512, Harbour Packaging',-2700.00,'timing',date_trunc('month',current_date)::date-4,'Mere'),
 ('d1000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000002105','Disputed freight invoice 88213, Coastline Carriers',-1200.00,'timing',date_trunc('month',current_date)::date-96,'Sione')
 on conflict do nothing;

-- Variance commentary: the bank movement is explained, the rest of this close is not yet.
insert into flux_notes(id,period_id,account_id,explanation,written_by) values
 ('d2000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000101','Paid provisional tax and the spring stock order in the last week of the month.','Tom')
 on conflict do nothing;

-- Manual journals. Last month's power accrual was posted to reverse and has not been reversed yet.
insert into journals(id,period_id,reference,description,kind,reverses_next,evidence,state,prepared_by,approved_by,approved_at,ledger_ref,posted_at) values
 ('d3000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','ACC-PWR','Power accrual, bill arrives after month end','accrual',true,'demo://evidence/meridian-estimate.pdf','posted','Sione','Tom',now(),'MJ-1188',now()),
 ('d3000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000002','ACC-PWR','Power accrual, bill arrives after month end','accrual',true,'demo://evidence/meridian-estimate.pdf','draft','Sione',null,null,null,null),
 ('d3000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-000000000002','RCL-FRT','Inbound freight coded to cost of sales moved to freight','reclass',false,'demo://evidence/freight-coding.xlsx','approved','Sione','Tom',now(),null,null),
 ('d3000000-0000-0000-0000-000000000004','f0000000-0000-0000-0000-000000000002','PRE-INS','Annual insurance premium to prepayments','prepayment',false,null,'draft','Sione',null,null,null,null)
 on conflict do nothing;
insert into journal_lines(id,journal_id,account_id,amount,memo) values
 ('d4000000-0000-0000-0000-000000000001','d3000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000114',3120.00,'Estimated power'),
 ('d4000000-0000-0000-0000-000000000002','d3000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000106',-3120.00,''),
 ('d4000000-0000-0000-0000-000000000003','d3000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000114',3450.00,'Estimated power'),
 ('d4000000-0000-0000-0000-000000000004','d3000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000106',-3450.00,''),
 ('d4000000-0000-0000-0000-000000000005','d3000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000113',1800.00,''),
 ('d4000000-0000-0000-0000-000000000006','d3000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000111',-1800.00,''),
 ('d4000000-0000-0000-0000-000000000007','d3000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000104',6000.00,'Twelve months cover'),
 ('d4000000-0000-0000-0000-000000000008','d3000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000105',-5000.00,'')
 on conflict do nothing;

-- The auditor's request list for the last 31 March year end.
insert into pbc_items(id,entity_id,year_end,reference,request,owner,due,state,evidence,provided_on,accepted_by) values
 ('d5000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001',make_date(extract(year from current_date-interval '3 months')::int,3,31),'PBC-01','Bank confirmation authority signed','Mere',current_date-20,'accepted','demo://pbc/bank-authority.pdf',current_date-22,'Auditor'),
 ('d5000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000001',make_date(extract(year from current_date-interval '3 months')::int,3,31),'PBC-02','Fixed asset register and depreciation schedule','Tom',current_date-6,'requested',null,null,null),
 ('d5000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000001',make_date(extract(year from current_date-interval '3 months')::int,3,31),'PBC-03','Year-end stocktake count sheets','Sione',current_date+10,'requested',null,null,null),
 ('d5000000-0000-0000-0000-000000000004','e0000000-0000-0000-0000-000000000001',make_date(extract(year from current_date-interval '3 months')::int,3,31),'PBC-04','Loan agreement and covenant calculation','Tom',current_date-14,'provided','demo://pbc/westpac-covenants.xlsx',current_date-15,null)
 on conflict do nothing;
insert into notes(id,account_id,actor,body) values
 ('d6000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000102','Mere','Fresh Choice Glen Eden short-paid by 250; remittance query sent.')
 on conflict do nothing;
