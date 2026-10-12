// npm test: a temporary database, migrate twice, seed twice, then every command.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {run,commands,reads} from './close.mjs';
import {parseCsv} from './lib/csv.mjs';
import {page,table as htmlTable} from './lib/render.mjs';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'close-test-'));
process.env.DATA_DIR=path.join(temp,'db');process.env.OUTPUT_DIR=temp;
// Ignore real credentials; PostgreSQL CI supplies a disposable database.
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL||'';
const db=await getDb(),seen=new Set();let rejections=0;
const call=async(cmd,...flags)=>{seen.add(cmd);return run(db,[cmd,...flags]);};
const fails=async(cmd,flags,pattern)=>{seen.add(cmd);await assert.rejects(()=>run(db,[cmd,...flags]),pattern);rejections++;};
const mere='--actor=Mere',tom='--actor=Tom',sione='--actor=Sione',ana='--actor=Ana';
const one=async(sql,p=[])=>(await db.query(sql,p))[0];
try{
 if(db.mode==='postgres'){const [r]=await db.query("select count(*)::int as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'");assert.equal(r.n,0,'TEST_DATABASE_URL must point at a fresh empty database');}
 await migrate(db);assert.equal((await migrate(db)).ran.length,0);
 const seed=fs.readFileSync(path.join(REPO_ROOT,'supabase/seed.sql'),'utf8');await db.exec(seed);await db.exec(seed);
 for(const cmd of Object.keys(reads))assert.ok(Array.isArray(await call(cmd)),cmd);
 assert.equal((await call('help')).length,commands.length);
 assert.equal((await call('entities')).length,2);
 assert.equal((await call('close-status')).length,2);
 assert.equal((await call('reversals-due')).length,1);
 assert.equal((await call('differences')).length,3);
 assert.equal((await call('pbc')).filter(r=>r.days_overdue>0).length,1);

 // The date rules, checked by hand.
 assert.equal((await one("select business_day('2026-10-09',1) as d")).d,'2026-10-12');
 assert.equal((await one("select business_day('2026-09-30',5) as d")).d,'2026-10-07');
 for(const [c,f,end,due] of [['NZ','monthly','2026-03-31','2026-05-07'],['NZ','two-monthly','2026-11-30','2027-01-15'],['NZ','monthly','2026-06-30','2026-07-28'],['AU','quarterly','2026-12-31','2027-02-28'],['AU','quarterly','2026-09-30','2026-10-28'],['AU','monthly','2026-07-31','2026-08-21']])
  assert.equal((await one('select gst_due($1,$2,$3::date) as d',[c,f,end])).d,due,`${c} ${f} ${end}`);

 // Rule checks on the demo data. The AU check depends on whether last month ended a GST quarter.
 const rules=await call('compliance');
 assert.ok(rules.some(r=>r.rule==='RECORDS-EXPLAIN'&&r.record==='2500 Westpac term loan'));
 assert.ok(rules.some(r=>r.rule==='RECORDS-EVIDENCE'&&r.record==='2300 PAYE payable'));
 assert.ok(rules.some(r=>r.rule==='GST-RETURN'&&r.entity==='Kauri Foods Ltd'));
 const auQuarter=(await one("select is_gst_period_end('quarterly',3,date_trunc('month',current_date)::date-1) as q")).q;
 assert.equal(rules.some(r=>r.rule==='GST-RETURN'&&r.entity==='Kauri Foods Pty Ltd'),auQuarter);
 assert.ok((await call('attention')).length>=20);

 // Lookups: case-insensitive names, partial ids, ambiguity lists the candidates.
 assert.equal((await call('account','--account=kauri foods ltd 1100')).notes.length,1);
 await fails('account',['--account=Trade debtors'],/ambiguous[\s\S]*Kauri Foods Pty Ltd 1100/);
 await fails('account',['--account=Nobody'],/not found/);
 await fails('period',['--period=Kauri Foods'],/ambiguous/);
 await fails('period',['--period=e0000000'],/not found/);
 assert.equal((await call('period','--period=f0000000-0000-0000-0000-000000000002')).tasks.length,9);
 const cur=(await call('periods')).find(p=>p.state==='open'&&p.period.startsWith('Kauri Foods Ltd ')).period;
 const prev=(await call('periods')).find(p=>p.state==='closed'&&p.period.startsWith('Kauri Foods Ltd ')).period;
 assert.equal((await call('period',`--period=${cur}`)).tasks.length,9);
 assert.equal((await call('trial-balance',`--period=${cur}`)).length,14);
 assert.ok((await call('search','--text=freight')).length>=2);

 // Bad input is refused before anything is written.
 await fails('reconcile',['--account=Kauri Foods Ltd 4000','--supporting=1','--evidence=x',mere],/Only balance sheet/);
 await fails('reconcile',['--account=Kauri Foods Ltd 1300','--supporting=abc','--evidence=x',sione],/must be a number/);
 await fails('reconcile',['--account=Kauri Foods Ltd 1300','--supporting=21000',sione],/Required --evidence/);
 await fails('reconcile',['--account=Kauri Foods Ltd 1300','--supporting=21000','--evidence=x'],/Required --actor/);
 await fails('reconcile',['--account=Kauri Foods Ltd 1300','--supporting=21000','--evidence=x',sione,'--typo=1'],/Unknown --typo/);
 await fails('add-item',['--account=Kauri Foods Ltd 1100','--description=x','--amount=5','--dated=2026-02-30',mere],/real YYYY/);

 // Debtors: 250 unexplained blocks review until it is explained; the preparer cannot review.
 await fails('review',['--account=Kauri Foods Ltd 1100',tom],/250.00 is unexplained/);
 const it=await call('add-item','--account=Kauri Foods Ltd 1100','--description=Fresh Choice Glen Eden short payment','--amount=250','--kind=adjustment',`--dated=${cur.slice(-7)}-28`,mere);
 assert.equal(Number(it.unexplained),0);
 await fails('review',['--account=Kauri Foods Ltd 1100',mere],/different person/);
 assert.equal((await call('review','--account=Kauri Foods Ltd 1100',tom)).state,'reviewed');
 await fails('add-item',['--account=Kauri Foods Ltd 1100','--description=late','--amount=5','--dated=2026-01-01',mere],/Already reviewed/);
 // Creditors: the balance moved after preparation, so it is reconciled again.
 await fails('review',['--account=Kauri Foods Ltd 2000',tom],/balance moved/);
 const cr=await call('reconcile','--account=Kauri Foods Ltd 2000','--supporting=-340575.10','--evidence=demo://aged-creditors-v2.xlsx',sione);assert.equal(Number(cr.unexplained),0);
 await call('review','--account=Kauri Foods Ltd 2000',tom);
 await fails('reconcile',['--account=Kauri Foods Ltd 2000','--supporting=1','--evidence=x',sione],/Already reviewed/);
 // Reject, then prepare again.
 await fails('reject',['--account=Kauri Foods Ltd 1200',tom],/Required --reason/);
 assert.equal((await call('reject','--account=Kauri Foods Ltd 1200','--reason=Count sheets not attached',tom)).state,'rejected');
 await fails('review',['--account=Kauri Foods Ltd 1200',tom],/needs preparing again/);
 await call('reconcile','--account=Kauri Foods Ltd 1200','--supporting=702950','--evidence=demo://stocktake-signed.pdf',sione);
 for(const [code,sup,who] of [['1200',null,null],['1300','21000',sione],['2100','-48600',sione],['2200',null,null],['2300','-23045',mere]]){
  if(sup)await call('reconcile',`--account=Kauri Foods Ltd ${code}`,`--supporting=${sup}`,`--evidence=demo://${code}.pdf`,who);
  await call('review',`--account=Kauri Foods Ltd ${code}`,tom);
 }
 assert.ok(!(await call('compliance')).some(r=>r.rule==='GST-RETURN'&&r.entity==='Kauri Foods Ltd'));
 await fails('clear-item',[`--item=disputed freight`,sione],/reviewed/);

 // Checklist: complete, then sign off by someone else. Names shared across entities need --period.
 await fails('sign-off',['--task=Stocktake variance posted',tom],/Complete the task/);
 await call('complete','--task=Stocktake variance posted','--note=Shrinkage 0.4%',sione);
 await fails('complete',['--task=Stocktake variance posted',sione],/already done/);
 await fails('sign-off',['--task=Stocktake variance posted',sione],/different person/);
 assert.equal((await call('sign-off','--task=Stocktake variance posted',tom)).state,'signed-off');
 await fails('complete',['--task=Management accounts to the board',tom],/ambiguous/);

 // Journals: balanced, approved by a second person, posted with the ledger reference.
 await fails('approve-journal',[`--journal=PRE-INS ${cur}`,tom],/Out of balance by 1000/);
 await call('cancel-journal',`--journal=PRE-INS ${cur}`,'--reason=Keyed wrong; re-entered',sione);
 await fails('cancel-journal',[`--journal=PRE-INS ${cur}`,'--reason=again',sione],/only a draft or approved/);
 await fails('journal',[`--period=${cur}`,'--reference=PRE-INS2','--description=Insurance','--kind=prepayment','--lines=1300:6000',sione],/at least two lines/);
 await fails('journal',[`--period=${cur}`,'--reference=PRE-INS2','--description=Insurance','--kind=prepayment','--lines=9999:6000;2000:-6000',sione],/No account 9999/);
 const pj=await call('journal',`--period=${cur}`,'--reference=PRE-INS2','--description=Annual insurance premium to prepayments','--kind=prepayment','--lines=1300:6000; 2000:-6000','--evidence=demo://invoice.pdf',sione);
 assert.equal(pj.out_of_balance,'0.00');
 await fails('approve-journal',['--journal=PRE-INS2',sione],/different person/);
 await fails('post-journal',['--journal=PRE-INS2','--ledger-ref=MJ-1',tom],/Approve the journal/);
 await call('approve-journal','--journal=PRE-INS2',tom);
 await fails('post-journal',['--journal=PRE-INS2',tom],/Required --ledger-ref/);
 assert.equal((await call('post-journal','--journal=PRE-INS2','--ledger-ref=MJ-1201',sione)).state,'posted');
 await call('approve-journal',`--journal=ACC-PWR ${cur}`,tom);await call('post-journal',`--journal=ACC-PWR ${cur}`,'--ledger-ref=MJ-1202',sione);
 await call('post-journal','--journal=RCL-FRT','--ledger-ref=MJ-1203',sione);
 // Last month's accrual reverses into this month.
 const rev=await call('reverse',`--journal=ACC-PWR ${prev}`,sione);assert.equal(rev.reference,'REV-ACC-PWR');
 assert.equal(Number((await one('select sum(amount) as s from journal_lines where journal_id=$1',[rev.id])).s),0);
 assert.equal((await call('reversals-due')).length,0);
 await fails('reverse',[`--journal=ACC-PWR ${prev}`,sione],/already entered/);
 await call('approve-journal','--journal=REV-ACC-PWR',tom);await call('post-journal','--journal=REV-ACC-PWR','--ledger-ref=MJ-1204',sione);

 // Close: refused while anything is open, then closed once it is all done.
 await fails('close-period',[`--period=${cur}`,tom],/cannot close yet: 5 checklist task\(s\), 5 variance\(s\) not explained/);
 for(const t of (await call('tasks-due')).filter(t=>t.period===cur)){
  if(t.state==='todo')await call('complete',`--task=${t.task}`,`--period=${cur}`,`--actor=${t.owner}`);
  if(t.reviewer)await call('sign-off',`--task=${t.task}`,`--period=${cur}`,`--actor=${t.reviewer}`);
 }
 for(const code of ['1100','2000','2100','2200','6200'])await call('explain',`--account=Kauri Foods Ltd ${code}`,'--text=Seasonal stock build ahead of summer; checked with the account owner.',tom);
 assert.equal((await call('flux')).filter(f=>f.period===cur&&f.explanation==='(needs explaining)').length,0);
 const closed=await call('close-period',`--period=${cur}`,tom);assert.equal(closed.state,'closed');
 await fails('close-period',[`--period=${cur}`,tom],/already closed/);
 await fails('reconcile',['--account=Kauri Foods Ltd 1300','--period='+cur,'--supporting=1','--evidence=x',sione],/is closed/);
 assert.ok(!(await call('compliance')).some(r=>r.period===cur));
 assert.equal((await call('close-trend')).find(r=>`${r.entity} ${r.month}`===cur).state,'closed');
 assert.ok(!(await call('close-status')).some(r=>r.period===cur));

 // Next month opens with the checklist; it cannot be opened twice.
 const nextMonth=new Date(Date.UTC(Number(cur.slice(-7,-3)),Number(cur.slice(-2)),1)).toISOString().slice(0,7);
 const op=await call('open-period','--entity=Kauri Foods Ltd',`--month=${nextMonth}`,tom);assert.equal(op.tasks,9);
 await fails('open-period',['--entity=Kauri Foods Ltd',`--month=${nextMonth}`,tom],/already open/);
 await fails('open-period',['--entity=Kauri Foods Ltd','--month=2026-13',tom],/YYYY-MM/);

 // Auditor requests: provided, then accepted.
 await fails('pbc-accept',['--item=PBC-03','--actor=Auditor'],/Provide it/);
 await fails('pbc-provide',['--item=PBC-02',tom],/Required --evidence/);
 await call('pbc-provide','--item=PBC-02','--evidence=demo://fixed-assets.xlsx',tom);
 assert.equal((await call('pbc-accept','--item=PBC-02','--actor=Auditor')).state,'accepted');

 // Set-up records.
 const e=await call('add','--type=entity','--name=Tui Logistics Ltd','--country=NZ','--gst-frequency=two-monthly','--gst-anchor-month=2','--materiality=50',tom);assert.equal(e.currency,'NZD');
 await fails('add',['--type=entity','--name=Bad Co','--country=UK',tom],/must be one of/);
 await call('add','--type=account','--entity=Tui Logistics Ltd','--code=1050','--name=Petty cash','--kind=asset','--risk=low','--gst-control=no',tom);
 await call('add','--type=template','--entity=Tui Logistics Ltd','--name=Petty cash counted','--owner=Hemi','--reviewer=Grace','--due-day=2',tom);
 await fails('add',['--type=template','--entity=Tui Logistics Ltd','--name=Bad','--owner=Hemi','--reviewer=hemi','--due-day=2',tom],/check/i);
 await call('add','--type=pbc','--entity=Kauri Foods Ltd','--year-end=2026-03-31','--reference=PBC-05','--request=Related party list','--owner=Tom',`--due=${new Date().toISOString().slice(0,10)}`,tom);
 await call('log','--account=Kauri Foods Ltd 2500','--note=Covenant test passed for the quarter',tom);

 // Import a ledger trial balance and a BlackLine export: dry run writes nothing, repeats skip, changes update.
 const ex=(...f)=>path.join(REPO_ROOT,'examples',...f);const tb=ex('trial-balance','trial-balance.csv');
 const hist=(await call('history')).length;
 const dry=await call('import','trial-balance','--entity=Tui Logistics Ltd','--month=2026-09',`--file=${tb}`,tom,'--dry-run');
 assert.equal(dry.inserted,7);assert.equal(dry.accounts_added,7);
 assert.equal((await call('history')).length,hist);assert.equal((await db.query("select count(*)::int as n from periods p join entities e on e.id=p.entity_id where e.name='Tui Logistics Ltd'"))[0].n,0);
 assert.equal((await call('import','trial-balance','--entity=Tui Logistics Ltd','--month=2026-09',`--file=${tb}`,tom)).inserted,7);
 const bank=await one("select b.balance,a.kind from balances b join accounts a on a.id=b.account_id where a.code='1000' and a.name='BNZ cheque account'");assert.equal(Number(bank.balance),142880.15);
 const fuel=await one("select b.balance from balances b join accounts a on a.id=b.account_id where a.name='Fuel'");assert.equal(Number(fuel.balance),21870.30);
 assert.equal((await call('import','trial-balance','--entity=Tui Logistics Ltd','--month=2026-09',`--file=${tb}`,tom)).skipped,7);
 const bad=path.join(temp,'bad.csv');
 fs.writeFileSync(bad,fs.readFileSync(tb,'utf8').replace('142880.15','143000.00'));
 assert.equal((await call('import','trial-balance','--entity=Tui Logistics Ltd','--month=2026-09',`--file=${bad}`,tom)).updated,1);
 fs.writeFileSync(bad,'Account Code,Account,Account Type,Debit,Credit\nX1,Mystery,Odd,1,\n');
 await fails('import',['trial-balance','--entity=Tui Logistics Ltd','--month=2026-09',`--file=${bad}`,tom],/cannot tell what kind/);
 fs.writeFileSync(bad,'Acct No,Description,Class,Closing\n1500,Vehicles,Fixed Asset,"(1,200.00)"\n');
 const mapped=await call('import','trial-balance','--entity=Tui Logistics Ltd','--month=2026-09',`--file=${bad}`,tom,`--mapping=${ex('column-mapping.json')}`);
 assert.equal(mapped.inserted,1);assert.equal(Number((await one("select balance from balances b join accounts a on a.id=b.account_id where a.name='Vehicles'")).balance),-1200);
 fs.writeFileSync(bad,'{"bogus":"x"}');await fails('import',['trial-balance','--entity=Tui Logistics Ltd','--month=2026-09',`--file=${tb}`,tom,`--mapping=${bad}`],/not a field/);
 await fails('import',['trial-balance','--entity=Kauri Foods Ltd',`--month=${cur.slice(-7)}`,`--file=${tb}`,tom],/is closed/);
 const ba=await call('import','blackline','--object=accounts','--entity=Tui Logistics Ltd',`--file=${ex('blackline','accounts.csv')}`,tom);assert.equal(ba.updated,4);
 assert.equal((await one("select owner,risk from accounts where name='Accounts payable'")).owner,'Hemi');
 assert.equal((await call('import','blackline','--object=tasks','--entity=Tui Logistics Ltd',`--file=${ex('blackline','tasks.csv')}`,tom)).inserted,4);
 assert.equal((await call('import','blackline','--object=tasks','--entity=Tui Logistics Ltd',`--file=${ex('blackline','tasks.csv')}`,tom)).skipped,4);
 assert.equal((await call('open-period','--entity=Tui Logistics Ltd','--month=2026-09',tom)).tasks,5);
 assert.equal((await call('recs-due')).filter(r=>r.entity==='Tui Logistics Ltd').length,5);
 assert.throws(()=>parseCsv('A,A\n1,2'),/unique/);assert.throws(()=>parseCsv('A,B\n1'),/expected/);assert.throws(()=>parseCsv('A\n"oops'),/unclosed/);
 await call('add','--type=balance','--account=Tui Logistics Ltd 1050','--balance=200',tom);
 assert.equal((await call('recs-due')).filter(r=>r.entity==='Tui Logistics Ltd').length,6);

 // Drafts, backups, escaped HTML.
 for(const [cmd,flags] of [['weekly-review',[]],['draft-close-report',[`--period=${cur}`]],['draft-flux-commentary',[`--period=${cur}`]],['draft-auditor-update',['--entity=Kauri Foods Ltd']]]){
  const d=await call(cmd,...flags);assert.match(fs.readFileSync(d.file,'utf8'),/Nothing has been sent/);
 }
 assert.match(fs.readFileSync((await call('draft-flux-commentary',`--period=${cur}`)).file,'utf8'),/6200 Freight\*\* moved 22400.00 \(54.0%\)/);
 const exp=await call('export','--out=exports/backup.json');const backup=JSON.parse(fs.readFileSync(exp.file,'utf8'));
 assert.equal(Object.keys(backup.records).length,14);assert.ok(backup.records.history.length>40);
 await fails('export',['--out=exports/backup.json'],/EEXIST/);
 const html=page({title:'<script>x</script>',sections:[{title:'Rows',html:htmlTable([{name:'<script>x</script>'}])}]});assert.ok(!html.includes('<script>x'));
 assert.deepEqual(commands.filter(c=>!seen.has(c)),[],'every command exercised');
 await db.close();

 for(const file of ['view.mjs','docs.mjs']){const c=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts',file)],{env:process.env,encoding:'utf8',cwd:REPO_ROOT});assert.equal(c.status,0,c.stderr);}
 assert.ok(fs.existsSync(path.join(temp,'views/close.html')));
 assert.ok(fs.readdirSync(path.join(temp,'docs-out/reconciliation')).length>=20);
 assert.ok(fs.readdirSync(path.join(temp,'docs-out/close-report')).length>=5);
 const amb=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts/close.mjs'),'account','--account=trade debtors'],{env:process.env,encoding:'utf8'});
 assert.equal(amb.status,1);assert.match(amb.stderr,/ambiguous/);
 const json=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts/close.mjs'),'close-trend','--json'],{env:process.env,encoding:'utf8'});
 assert.equal(json.status,0,json.stderr);assert.ok(JSON.parse(json.stdout).length>=5);
 console.log(`PASS: all ${commands.length} commands, ${rejections} refused inputs, the GST and business-day dates checked by hand, review and sign-off by a second person, balanced journals and reversals, a full close, three cited rules, trial balance and BlackLine import with repeats and mapping, drafts, backups, views and documents (${db.mode}, ${process.platform}).`);
}finally{try{await db.close();}catch{}fs.rmSync(temp,{recursive:true,force:true});}
