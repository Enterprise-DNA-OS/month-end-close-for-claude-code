#!/usr/bin/env node
// The one CLI. Every slash command in .claude/commands runs one of these.
//   npm run close -- <command> [--field=value ...] [--json]
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv,pick,yesNo} from './lib/csv.mjs';
import {table} from './lib/format.mjs';

export const reads={
 'entities':['List entities with their currency, GST cycle and close settings','select id,name,country,currency,gst_frequency,gst_anchor_month,materiality,flux_amount,flux_pct,close_target_days from entities order by name'],
 'accounts':['List ledger accounts with owner, reviewer, risk and how often they are reconciled',"select a.id,e.name as entity,a.code,a.name,a.kind,a.risk,a.frequency,a.due_day,a.owner,a.reviewer,case when a.gst_control then 'yes' else '' end as gst_control from accounts a join entities e on e.id=a.entity_id where a.active order by e.name,a.code"],
 'periods':['List every period, open or closed, with its target close date','select label as period,state,target_close,days_to_close,closed_by from period_list order by entity,period_end desc'],
 'templates':['List the close checklist each entity copies into a new period','select t.id,e.name as entity,t.sort,t.name,t.owner,t.reviewer,t.due_day from close_templates t join entities e on e.id=t.entity_id order by e.name,t.sort'],
 'close-status':['How far through the close every open period is','select period,business_days_in,target_close,tasks_finished||\'/\'||tasks as tasks,recs_reviewed||\'/\'||recs_needed as reconciliations,journals_unposted,flux_unexplained from close_status where state=\'open\' order by period'],
 'tasks-due':['Close tasks not finished, with due date and business days late','select period,task,owner,reviewer,state,due,days_late from tasks_due order by days_late desc,due,period'],
 'recs-due':['Reconciliations not yet reviewed, or whose balance moved after review','select * from recs_due order by days_late desc,risk,code'],
 'differences':['Unexplained differences, balances that moved, and reconciling items older than 60 days','select * from differences order by entity,code'],
 'flux':['Balance movements over the threshold this close, with the explanation or the gap',"select f.period,f.code,f.account,f.prior_balance,f.balance,f.change,f.change_pct,coalesce(f.explanation,'(needs explaining)') as explanation from flux f join period_list p on p.label=f.period where p.state='open' and (f.needs_explaining or f.explanation is not null) order by f.period,abs(f.change) desc"],
 'journals':['Manual journals in open periods: draft, approved or posted',"select period,reference,kind,description,state,prepared_by,approved_by,ledger_ref,debits,out_of_balance from journal_status where period_state='open' order by period,state,reference"],
 'reversals-due':['Accruals posted to reverse whose reversal has not been entered','select * from reversals_due order by period'],
 'pbc':['The auditor request list: what is outstanding, provided and accepted','select entity,year_end,reference,request,owner,due,state,provided_on,days_overdue from pbc_status order by state,due'],
 'compliance':['Check the close records against the cited rules','select * from compliance_gaps order by rule,period'],
 'retention':['How long each period\'s close records must be kept','select * from retention order by period'],
 'owner-load':['What each person still has to do in the open close',"select person,sum(case when what='task' then 1 else 0 end)::int as tasks,sum(case when what='sign-off' then 1 else 0 end)::int as sign_offs,sum(case when what='prepare' then 1 else 0 end)::int as recs_to_prepare,sum(case when what='review' then 1 else 0 end)::int as recs_to_review,sum(case when what='journal' then 1 else 0 end)::int as journals_open from (select owner as person,'task' as what from tasks_due where state='todo' union all select reviewer,'sign-off' from tasks_due where state='done' union all select owner,'prepare' from recs_due where state in ('not started','rejected') or balance_moved union all select reviewer,'review' from recs_due where state='prepared' and not balance_moved union all select coalesce(approved_by,prepared_by),'journal' from journal_status where period_state='open' and state not in ('posted','cancelled')) x group by person order by person"],
 'close-trend':['Business days each closed period took against the target','select entity,month,target_close,days_to_close,(select close_target_days from entities e where e.name=entity) as target_days,state from period_list order by entity,period_end'],
 'attention':['What needs doing now: late tasks and reconciliations, differences, variances, journals, reversals, auditor requests and rule checks',
  "select kind,period,item,detail from (select 1 as o,'task' as kind,period,task as item,owner||', '||days_late||' business days late' as detail from tasks_due where days_late>0 union all select 2,'reconcile',period,code||' '||account,owner||', '||state||case when balance_moved then ', balance moved' else '' end||case when days_late>0 then ', '||days_late||' business days late' else '' end from recs_due where days_late>0 or balance_moved union all select 3,'difference',period,code||' '||account,issue||' ('||amount||')' from differences where issue not like 'Ledger balance moved%' union all select 4,'variance',f.period,f.code||' '||f.account,'Moved '||f.change||' with no explanation' from flux f join period_list p on p.label=f.period where p.state='open' and f.needs_explaining and f.explanation is null union all select 5,'journal',period,reference,state||case when out_of_balance<>0 then ', out of balance by '||out_of_balance else '' end from journal_status where period_state='open' and state not in ('posted','cancelled') union all select 6,'reversal',reverse_in,reference,'Posted in '||period||' to reverse; no reversal entered' from reversals_due union all select 7,'auditor',entity,reference,request||', '||days_overdue||' days overdue' from pbc_status where days_overdue>0 union all select 8,'rule',period,record,issue from compliance_gaps) x order by o,period,item"],
 'history':['Read the last 100 changes and who made them','select * from history order by created_at desc,id limit 100']
};
export const usage={
 account:'--account=... (one account: balances, reconciliations, notes)',
 period:'--period=... (one period: status, tasks, reconciliations, journals)',
 'trial-balance':'--period=... (every balance with last month and its reconciliation state)',
 search:'--text=...',
 add:'--type=entity|account|template|balance|pbc --actor=... (fields: see README)',
 'open-period':'--entity=... --month=YYYY-MM --actor=... (creates the period and copies the checklist)',
 complete:'--task=... [--period=...] [--note=...] --actor=...',
 'sign-off':'--task=... [--period=...] --actor=... (a different person from whoever completed it)',
 reconcile:'--account=... [--period=...] --supporting=amount --evidence=... --actor=...',
 'add-item':'--account=... [--period=...] --description=... --amount=... --dated=YYYY-MM-DD [--kind=timing|adjustment] --actor=...',
 'clear-item':'--item=... --actor=...',
 review:'--account=... [--period=...] --actor=... (a different person from the preparer)',
 reject:'--account=... [--period=...] --reason=... --actor=...',
 journal:'--period=... --reference=... --description=... --kind=accrual|prepayment|reclass|correction --lines="code:amount;code:amount" [--reverses-next] [--evidence=...] --actor=...',
 reverse:'--journal=... --actor=... (drafts the reversal of a posted accrual in the next period)',
 'approve-journal':'--journal=... --actor=... (a different person from the preparer; must balance)',
 'post-journal':'--journal=... --ledger-ref=... --actor=...',
 'cancel-journal':'--journal=... --reason=... --actor=... (a draft or approved journal that will not be posted)',
 explain:'--account=... [--period=...] --text=... --actor=...',
 'close-period':'--period=... --actor=...',
 'pbc-provide':'--item=... --evidence=... --actor=...',
 'pbc-accept':'--item=... --actor=...',
 log:'--account=... --note=... --actor=...',
 import:'trial-balance --entity=... --month=YYYY-MM --file=tb.csv | blackline --object=accounts|tasks --entity=... --file=export.csv; --actor=... [--mapping=file.json] [--dry-run]',
 export:'--out=exports/backup.json',
 'weekly-review':'Write the close review to drafts/',
 'draft-close-report':'--period=... (the close summary for the finance lead or board, to drafts/)',
 'draft-flux-commentary':'--period=... (variance commentary for the management accounts, to drafts/)',
 'draft-auditor-update':'--entity=... (where the auditor request list stands, to drafts/)',
 help:'Show commands'
};
export const commands=[...Object.keys(reads),...Object.keys(usage)];
const allowed={account:['account'],period:['period'],'trial-balance':['period'],search:['text'],
 add:['type','name','country','gst-frequency','gst-anchor-month','materiality','flux-amount','flux-pct','close-target-days','entity','code','kind','risk','frequency','due-day','gst-control','owner','reviewer','sort','account','period','balance','year-end','reference','request','due','actor'],
 'open-period':['entity','month','actor'],complete:['task','period','note','actor'],'sign-off':['task','period','actor'],
 reconcile:['account','period','supporting','evidence','actor'],'add-item':['account','period','description','amount','dated','kind','actor'],'clear-item':['item','actor'],
 review:['account','period','actor'],reject:['account','period','reason','actor'],
 journal:['period','reference','description','kind','lines','reverses-next','evidence','actor'],reverse:['journal','actor'],
 'approve-journal':['journal','actor'],'post-journal':['journal','ledger-ref','actor'],'cancel-journal':['journal','reason','actor'],explain:['account','period','text','actor'],
 'close-period':['period','actor'],'pbc-provide':['item','evidence','actor'],'pbc-accept':['item','actor'],
 log:['account','note','actor'],import:['entity','month','file','object','actor','mapping','dry-run'],export:['out'],
 'draft-close-report':['period'],'draft-flux-commentary':['period'],'draft-auditor-update':['entity']};
const flags=['json','dry-run','reverses-next'];
const periodLabel="(select e.name from entities e where e.id=entity_id)||' '||to_char(period_end,'YYYY-MM')";
const lookups={
 entity:['entities','name'],
 account:['accounts',"(select e.name from entities e where e.id=entity_id)||' '||code||' '||name",'active'],
 period:['periods',periodLabel],
 task:['tasks',"name||' '||(select label from period_list p where p.id=period_id)","(select state from periods p where p.id=period_id)='open'"],
 journal:['journals',"reference||' '||(select label from period_list p where p.id=period_id)"],
 item:['recon_items','description','cleared_on is null'],
 pbc:['pbc_items',"reference||' '||request"]
};
const allTables=['entities','accounts','periods','balances','close_templates','tasks','reconciliations','recon_items','journals','journal_lines','flux_notes','pbc_items','notes','history'];

function req(o,k){if(typeof o[k]!=='string'||!o[k].trim())throw Error(`Required --${k}`);return o[k].trim();}
function date(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw Error(`Expected a real YYYY-MM-DD date, got ${s}`);return s;}
function month(s){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(s))throw Error(`Expected --month=YYYY-MM, got ${s}`);const [y,m]=s.split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);}
function num(s,k,{min=-Infinity}={}){const t=String(s).trim().replace(/[$,\s]/g,'').replace(/^\((.*)\)$/,'-$1');const n=Number(t);if(t===''||!Number.isFinite(n)||n<min)throw Error(`--${k} must be a number${min>-Infinity?` of at least ${min}`:''}`);return Math.round(n*100)/100;}
function choice(s,a,k){if(!a.includes(s))throw Error(`--${k} must be one of: ${a.join(', ')}`);return s;}
function parse(args){const o={};for(const arg of args.filter(x=>x.startsWith('--'))){const i=arg.indexOf('='),k=arg.slice(2,i<0?undefined:i);if(k in o)throw Error(`Duplicate --${k}`);o[k]=i<0?true:arg.slice(i+1);}return o;}

// Exact name or id first, then a part of the name or the start of the id. More than one match lists them and fails.
export async function resolve(db,type,value,lock=false,extra=''){
 const [tableName,label,where]=lookups[type];
 const cond=[where,extra].filter(Boolean).map(c=>` and ${c}`).join('');
 let rows=await db.query(`select *,${label} as label from ${tableName} where (lower(${label})=lower($1) or id::text=lower($1))${cond} order by 1${lock?' for update':''}`,[value]);
 if(!rows.length)rows=await db.query(`select *,${label} as label from ${tableName} where (strpos(lower(${label}),lower($1))>0 or starts_with(id::text,lower($1)))${cond} order by 1${lock?' for update':''}`,[value]);
 if(rows.length!==1)throw Error(`${type} ${rows.length?'is ambiguous':'not found'}: ${value}\n${rows.map(r=>`  ${r.id}  ${r.label}`).join('\n')||`  Run the ${type==='entity'?'entities':type==='pbc'?'pbc':type+'s'} command to see the list.`}`);
 return rows[0];
}
// The period an account command means: --period if given, else the entity's one open period.
async function periodFor(db,account,o){
 if(o.period){const p=await resolve(db,'period',o.period);if(p.entity_id!==account.entity_id)throw Error(`${p.label} belongs to another entity`);return p;}
 const rows=await db.query(`select *,${periodLabel} as label from periods where entity_id=$1 and state='open' order by period_end`,[account.entity_id]);
 if(rows.length!==1)throw Error(rows.length?`More than one open period: ${rows.map(r=>r.label).join(', ')}. Add --period`:'No open period. Run open-period first');
 return rows[0];
}
function render(rows){
 if(!Array.isArray(rows))return JSON.stringify(rows,null,2);
 if(!rows.length)return '  (none)';
 return table(rows,Object.keys(rows[0]).map(key=>({key,label:key,align:/^-?\d+(\.\d+)?$/.test(String(rows[0][key]??''))?'right':'left',format:v=>v&&typeof v==='object'?JSON.stringify(v):v})));
}
function draft(name,body){const dir=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,`${name}-${new Date().toISOString().slice(0,10)}-${randomUUID().slice(0,8)}.md`);fs.writeFileSync(file,body,{flag:'wx'});return {file};}
async function insert(db,t,f){const k=Object.keys(f);const [row]=await db.query(`insert into ${t}(${k.join(',')}) values(${k.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,Object.values(f));return row;}
async function ensurePeriod(db,entityId,end){
 const [p]=await db.query('select * from periods where entity_id=$1 and period_end=$2',[entityId,end]);if(p)return {period:p,created:false};
 return {period:await insert(db,'periods',{entity_id:entityId,period_end:end}),created:true};
}

// Account type words from Xero, MYOB, BlackLine and most ledgers.
const kindOf=(type,code)=>{const s=String(type||'').toLowerCase();
 if(/equity|retained|capital/.test(s))return 'equity';
 if(/liabilit|payable|creditor|gst|provision/.test(s))return 'liability';
 if(/asset|bank|inventory|prepayment|receivable|debtor/.test(s))return 'asset';
 if(/revenue|income|sales/.test(s))return 'income';
 if(/expense|cost|overhead|depreciation/.test(s))return 'expense';
 const d=String(code||'').trim()[0];return {1:'asset',2:'liability',3:'equity',4:'income'}[d]||(/[5-9]/.test(d||'')?'expense':null);};
const riskOf=v=>{const s=String(v||'').toLowerCase();return s.startsWith('h')?'high':s.startsWith('l')?'low':'normal';};
const freqOf=v=>{const s=String(v||'').toLowerCase();return !s||s.startsWith('m')?'monthly':s.startsWith('n')?'none':'quarterly';};
const importers={
 'trial-balance':{fields:{code:['Account Code','Code','Account Number','*AccountCode'],name:['Account Name','Account','Name'],type:['Account Type','Type'],debit:['Debit','Debit - Year to date'],credit:['Credit','Credit - Year to date'],ytd_debit:['YTD Debit','Debit - YTD'],ytd_credit:['YTD Credit','Credit - YTD'],balance:['Balance','Closing Balance','Net']},required:['code']},
 accounts:{fields:{code:['Account Number','Account','Account Code'],name:['Account Name','Account Description','Description'],type:['Account Type','Type'],risk:['Risk Rating','Risk'],frequency:['Frequency','Reconciliation Frequency'],owner:['Preparer','Owner'],reviewer:['Reviewer','Approver'],due_day:['Due Day','Preparer Due Day']},required:['code','name']},
 tasks:{fields:{name:['Task Name','Task','Name'],owner:['Assignee','Preparer','Owner'],reviewer:['Approver','Reviewer'],due_day:['Due Day','Day','Due Date Offset'],sort:['Order','Sequence','Task Number']},required:['name','owner','due_day']}
};
function mapRow(spec,mapping,src,i){
 const v=Object.fromEntries(Object.keys(spec.fields).map(k=>[k,pick(src,...(mapping[k]?[mapping[k]]:spec.fields[k])).trim()]));
 for(const k of spec.required)if(!v[k])throw Error(`Row ${i+2}: no ${k}. Map the heading with --mapping`);return v;
}
async function importFile(db,o,pos){
 const what=pos[0]==='trial-balance'?'trial-balance':choice(req(o,'object'),['accounts','tasks'],'object');
 const spec=importers[what];const e=await resolve(db,'entity',req(o,'entity'));
 const rows=parseCsv(fs.readFileSync(path.resolve(req(o,'file')),'utf8'));if(!rows.length)throw Error('No rows in that file');
 const mapping=o.mapping?JSON.parse(fs.readFileSync(path.resolve(o.mapping),'utf8')):{};
 for(const [k,v] of Object.entries(mapping))if(!(k in spec.fields)||typeof v!=='string'||!v.trim())throw Error(`Mapping key ${k} is not a field of ${what}: ${Object.keys(spec.fields).join(', ')}`);
 let inserted=0,updated=0,skipped=0,accountsAdded=0;const seen=new Set();
 if(what==='trial-balance'){
  const end=month(req(o,'month'));const {period,created}=await ensurePeriod(db,e.id,end);
  if(period.state==='closed')throw Error(`${e.name} ${o.month} is closed. Its balances are not changed by import`);
  for(const [i,src] of rows.entries()){
   const v=mapRow(spec,mapping,src,i);if(/^total/i.test(v.code)||/^total/i.test(v.name))continue;
   if(seen.has(v.code))throw Error(`Row ${i+2}: account ${v.code} appears twice`);seen.add(v.code);
   let [a]=await db.query('select * from accounts where entity_id=$1 and code=$2',[e.id,v.code]);
   if(!a){const kind=kindOf(v.type,v.code);if(!kind)throw Error(`Row ${i+2}: cannot tell what kind of account ${v.code} is. Add an Account Type column`);if(!v.name)throw Error(`Row ${i+2}: new account ${v.code} needs a name`);
    a=await insert(db,'accounts',{entity_id:e.id,code:v.code,name:v.name,kind,frequency:['income','expense','equity'].includes(kind)?'none':'monthly'});accountsAdded++;}
   const amt=x=>x?num(x,'amount'):0;const bs=['asset','liability','equity'].includes(a.kind);
   const bal=v.balance?num(v.balance,'balance'):bs&&(v.ytd_debit||v.ytd_credit)?amt(v.ytd_debit)-amt(v.ytd_credit):amt(v.debit)-amt(v.credit);
   const [old]=await db.query('select balance from balances where period_id=$1 and account_id=$2',[period.id,a.id]);
   if(old&&Number(old.balance)===Math.round(bal*100)/100){skipped++;continue;}
   await db.query("insert into balances(period_id,account_id,balance,source) values($1,$2,$3,'import') on conflict(period_id,account_id) do update set balance=excluded.balance,source='import'",[period.id,a.id,bal]);
   old?updated++:inserted++;
  }
  return {entity:e.name,month:o.month,period_created:created,accounts_added:accountsAdded,inserted,updated,skipped,dry_run:!!o['dry-run'],note:'A changed balance is updated; any reconciliation already done on it shows as balance moved. open-period adds the checklist to a new period.'};
 }
 for(const [i,src] of rows.entries()){
  const v=mapRow(spec,mapping,src,i);const key=what==='accounts'?v.code:v.name;
  if(seen.has(key.toLowerCase()))throw Error(`Row ${i+2}: ${key} appears twice`);seen.add(key.toLowerCase());
  const sourceId=`blackline:${e.id.slice(0,8)}:${what}:${key}`;
  if(what==='accounts'){
   const kind=kindOf(v.type,v.code);if(!kind)throw Error(`Row ${i+2}: cannot tell what kind of account ${v.code} is. Map an Account Type column`);
   const f={risk:riskOf(v.risk),frequency:freqOf(v.frequency),owner:v.owner,reviewer:v.reviewer,due_day:v.due_day?num(v.due_day,'due_day',{min:1}):5};
   const [a]=await db.query('select id from accounts where entity_id=$1 and code=$2',[e.id,v.code]);
   if(a){await db.query('update accounts set risk=$2,frequency=$3,owner=$4,reviewer=$5,due_day=$6,source_id=coalesce(source_id,$7),source_snapshot=$8::jsonb where id=$1',[a.id,f.risk,f.frequency,f.owner,f.reviewer,f.due_day,sourceId,JSON.stringify(src)]);updated++;}
   else{await insert(db,'accounts',{entity_id:e.id,code:v.code,name:v.name,kind,...f,source_id:sourceId,source_snapshot:JSON.stringify(src)});inserted++;}
  }else{
   const [t]=await db.query('select id from close_templates where entity_id=$1 and lower(name)=lower($2)',[e.id,v.name]);if(t){skipped++;continue;}
   if(v.reviewer&&v.reviewer.toLowerCase()===v.owner.toLowerCase())throw Error(`Row ${i+2}: ${v.name} has the same person as assignee and approver`);
   await insert(db,'close_templates',{entity_id:e.id,name:v.name,owner:v.owner,reviewer:v.reviewer||null,due_day:Math.round(num(v.due_day,'due_day',{min:-5})),sort:v.sort?Math.round(num(v.sort,'sort')):(i+1)*10,source_id:sourceId,source_snapshot:JSON.stringify(src)});inserted++;
  }
 }
 return {object:what,entity:e.name,inserted,updated,skipped,dry_run:!!o['dry-run'],note:what==='accounts'?'Owners, reviewers, risk and frequency are updated on accounts already here. Annual accounts come in as quarterly; change that with /customise if it matters.':'Templates already here by name are skipped. They apply to the next open-period.'};
}

async function periodDetail(db,p){
 return {status:(await db.query('select * from close_status where period=$1',[p.label]))[0],
  tasks:await db.query('select name,owner,reviewer,state,done_by,signed_off_by,business_day((select period_end from periods where id=$1),due_day) as due from tasks where period_id=$1 order by sort,name',[p.id]),
  reconciliations:await db.query('select code,account,balance,state,unexplained,balance_moved,prepared_by,reviewed_by from recon_status where period_id=$1 order by code',[p.id]),
  journals:await db.query('select reference,kind,state,debits,out_of_balance from journal_status where period=$1 order by reference',[p.label])};
}

export async function run(db,args){
 const cmd=args[0]||'help',o=parse(args.slice(1)),pos=args.slice(1).filter(x=>!x.startsWith('--'));
 if(!commands.includes(cmd))throw Error(`Unknown command: ${cmd}. Run help for the list`);
 for(const k of Object.keys(o))if(!['json',...(allowed[cmd]||[])].includes(k))throw Error(`Unknown --${k} for ${cmd}`);
 for(const k of flags)if(k in o&&o[k]!==true)throw Error(`Use --${k} without a value`);
 if(pos.length&&!(cmd==='import'&&pos.length===1&&['trial-balance','blackline'].includes(pos[0])))throw Error('Unexpected argument. Use --field=value');
 if(reads[cmd])return db.query(reads[cmd][1]);
 if(cmd==='help')return commands.map(command=>({command,usage:reads[command]?.[0]||usage[command]}));
 if(cmd==='search')return db.query("select 'account' as kind,a.id,e.name||' '||a.code||' '||a.name as name from accounts a join entities e on e.id=a.entity_id where strpos(lower(a.code||' '||a.name),lower($1))>0 union all select 'task',t.id,t.name||' '||p.label from tasks t join period_list p on p.id=t.period_id where strpos(lower(t.name),lower($1))>0 union all select 'journal',j.id,j.reference||' '||j.description from journals j where strpos(lower(j.reference||' '||j.description),lower($1))>0 union all select 'auditor request',id,reference||' '||request from pbc_items where strpos(lower(reference||' '||request),lower($1))>0 union all select 'note',n.id,n.body from notes n where strpos(lower(n.body),lower($1))>0 order by kind,name",[req(o,'text')]);
 if(cmd==='account'){
  const a=await resolve(db,'account',req(o,'account'));delete a.label;delete a.source_snapshot;
  return {account:a,balances:await db.query('select period,balance,prior_balance,change from balance_movement where account_id=$1 order by period desc limit 13',[a.id]),
   reconciliations:await db.query('select period,state,ledger_balance,supporting_balance,unexplained,prepared_by,reviewed_by,evidence from recon_status where account_id=$1 and reconciliation_id is not null order by period desc',[a.id]),
   notes:await db.query('select actor,body,created_at from notes where account_id=$1 order by created_at desc',[a.id])};
 }
 if(cmd==='period'){const p=await resolve(db,'period',req(o,'period'));return {period:p.label,state:p.state,...await periodDetail(db,p)};}
 if(cmd==='trial-balance'){const p=await resolve(db,'period',req(o,'period'));
  return db.query("select bm.code,bm.account,bm.kind,bm.prior_balance,bm.balance,bm.change,coalesce(rs.state,'') as reconciliation from balance_movement bm left join recon_status rs on rs.period_id=bm.period_id and rs.account_id=bm.account_id where bm.period_id=$1 order by bm.code",[p.id]);}
 if(cmd==='export'){
  const backup={format:'close-backup-v1',exported_at:new Date().toISOString(),records:{}};
  await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');try{for(const t of allTables)backup.records[t]=await db.query(`select * from ${t} order by id`);await db.exec('COMMIT');}catch(e){await db.exec('ROLLBACK');throw e;}
  const file=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,req(o,'out'));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(backup,null,2)+'\n',{flag:'wx'});
  return {file,counts:Object.fromEntries(Object.entries(backup.records).map(([k,v])=>[k,v.length]))};
 }
 if(cmd==='weekly-review'||cmd.startsWith('draft-')){
  let body=`# ${cmd}\n\nDRAFT. Check the figures before anyone sees this. Nothing has been sent.\n\n`;
  if(cmd==='weekly-review')for(const c of ['close-status','attention','owner-load','pbc'])body+=`## ${c}\n\n${render(await run(db,[c]))}\n\n`;
  else if(cmd==='draft-close-report'){
   const p=await resolve(db,'period',req(o,'period'));const d=await periodDetail(db,p);const s=d.status;
   body+=`# Close report: ${p.label}\n\nState: ${p.state}. Business days since month end: ${s.business_days_in}. Target close: ${s.target_close}${s.days_to_close!=null?`. Closed in ${s.days_to_close} business days`:''}.\n\n- Checklist: ${s.tasks_finished} of ${s.tasks} finished\n- Reconciliations: ${s.recs_reviewed} of ${s.recs_needed} reviewed\n- Journals not posted: ${s.journals_unposted}\n- Variances still to explain: ${s.flux_unexplained}\n\n## Reconciliations\n\n${render(d.reconciliations)}\n\n## Open items\n\n${render(await db.query('select issue,code,account,amount from differences where period=$1',[p.label]))}\n\n## Rule checks\n\n${render(await db.query('select rule,record,issue from compliance_gaps where period=$1',[p.label]))}\n`;
  }else if(cmd==='draft-flux-commentary'){
   const p=await resolve(db,'period',req(o,'period'));const rows=await db.query('select code,account,prior_balance,balance,change,change_pct,explanation from flux where period=$1 and (needs_explaining or explanation is not null) order by abs(change) desc',[p.label]);
   body+=`# Variance commentary: ${p.label}\n\nMovements over the entity's threshold against last month. Balances are debit minus credit, so income and liabilities show as negative.\n\n${rows.map(r=>`- **${r.code} ${r.account}** moved ${r.change}${r.change_pct!=null?` (${r.change_pct}%)`:''}, from ${r.prior_balance} to ${r.balance}. ${r.explanation||'NOT YET EXPLAINED: ask the account owner before this goes out.'}`).join('\n')||'No movements over the threshold.'}\n`;
  }else{
   const e=await resolve(db,'entity',req(o,'entity'));const rows=await db.query('select reference,request,owner,due,state,provided_on,days_overdue from pbc_status where entity=$1 order by state,due',[e.name]);
   const out=rows.filter(r=>r.state==='requested');
   body+=`To: [auditor]\nSubject: ${e.name}: audit request list update\n\nProvided or accepted: ${rows.length-out.length} of ${rows.length}.\n\n${rows.filter(r=>r.state!=='requested').map(r=>`- ${r.reference} ${r.request}: ${r.state} ${r.provided_on}`).join('\n')}\n\nStill to come:\n\n${out.map(r=>`- ${r.reference} ${r.request} (${r.owner}, due ${r.due})`).join('\n')||'- Nothing outstanding.'}\n`;
  }
  return draft(cmd,body);
 }

 const actor=req(o,'actor');await db.exec('BEGIN');
 try{
  let row,result;
  if(cmd==='add'){
   const type=choice(req(o,'type'),['entity','account','template','balance','pbc'],'type');
   if(type==='entity'){const f={name:req(o,'name'),country:choice(o.country||'NZ',['NZ','AU'],'country'),gst_frequency:choice(o['gst-frequency']||'monthly',['monthly','two-monthly','quarterly','six-monthly'],'gst-frequency')};
    for(const [k,c] of [['gst-anchor-month','gst_anchor_month'],['materiality','materiality'],['flux-amount','flux_amount'],['flux-pct','flux_pct'],['close-target-days','close_target_days']])if(o[k])f[c]=num(o[k],k,{min:0});
    row=await insert(db,'entities',f);}
   else if(type==='account'){const e=await resolve(db,'entity',req(o,'entity'));
    row=await insert(db,'accounts',{entity_id:e.id,code:req(o,'code'),name:req(o,'name'),kind:choice(req(o,'kind'),['asset','liability','equity','income','expense'],'kind'),risk:choice(o.risk||'normal',['high','normal','low'],'risk'),frequency:choice(o.frequency||'monthly',['monthly','quarterly','none'],'frequency'),due_day:o['due-day']?num(o['due-day'],'due-day',{min:1}):5,gst_control:yesNo(o['gst-control']),owner:o.owner||'',reviewer:o.reviewer||''});}
   else if(type==='template'){const e=await resolve(db,'entity',req(o,'entity'));
    row=await insert(db,'close_templates',{entity_id:e.id,name:req(o,'name'),owner:req(o,'owner'),reviewer:o.reviewer||null,due_day:Math.round(num(req(o,'due-day'),'due-day',{min:-5})),sort:o.sort?Math.round(num(o.sort,'sort')):100});}
   else if(type==='balance'){const a=await resolve(db,'account',req(o,'account'));const p=await periodFor(db,a,o);if(p.state==='closed')throw Error(`${p.label} is closed`);
    [row]=await db.query("insert into balances(period_id,account_id,balance,source) values($1,$2,$3,'manual') on conflict(period_id,account_id) do update set balance=excluded.balance,source='manual' returning *",[p.id,a.id,num(req(o,'balance'),'balance')]);}
   else{const e=await resolve(db,'entity',req(o,'entity'));
    row=await insert(db,'pbc_items',{entity_id:e.id,year_end:date(req(o,'year-end')),reference:req(o,'reference'),request:req(o,'request'),owner:req(o,'owner'),due:date(req(o,'due'))});}
  }else if(cmd==='open-period'){
   const e=await resolve(db,'entity',req(o,'entity'));const end=month(req(o,'month'));
   const [had]=await db.query('select id from periods where entity_id=$1 and period_end=$2',[e.id,end]);
   if(had&&(await db.query('select 1 from tasks where period_id=$1',[had.id])).length)throw Error(`${e.name} ${o.month} is already open with its checklist`);
   const {period}=await ensurePeriod(db,e.id,end);if(period.state==='closed')throw Error(`${e.name} ${o.month} is closed`);
   const tasks=await db.query('insert into tasks(period_id,name,owner,reviewer,due_day,sort) select $1,name,owner,reviewer,due_day,sort from close_templates where entity_id=$2 returning id',[period.id,e.id]);
   row=period;result={period:`${e.name} ${o.month}`,tasks:tasks.length,target_close:(await db.query('select target_close from period_list where id=$1',[period.id]))[0].target_close};
  }else if(cmd==='complete'||cmd==='sign-off'){
   const tp=o.period?await resolve(db,'period',o.period):null;
   const t=await resolve(db,'task',req(o,'task'),true,tp?`period_id='${tp.id}'`:'');
   if(cmd==='complete'){if(t.state!=='todo')throw Error(`Task is already ${t.state}`);[row]=await db.query("update tasks set state='done',done_by=$2,done_at=now(),note=coalesce($3,note) where id=$1 returning *",[t.id,actor,o.note||null]);}
   else{if(t.state!=='done')throw Error(t.state==='todo'?'Complete the task before it is signed off':'Task is already signed off');if(!t.reviewer)throw Error('This task has no reviewer; completing it finishes it');
    if(t.done_by.toLowerCase()===actor.toLowerCase())throw Error('Sign-off must be by a different person from whoever completed it');
    [row]=await db.query("update tasks set state='signed-off',signed_off_by=$2,signed_off_at=now() where id=$1 returning *",[t.id,actor]);}
  }else if(['reconcile','add-item','review','reject','explain'].includes(cmd)){
   const a=await resolve(db,'account',req(o,'account'));const p=await periodFor(db,a,o);if(p.state==='closed')throw Error(`${p.label} is closed`);
   const [r]=await db.query('select * from reconciliations where period_id=$1 and account_id=$2 for update',[p.id,a.id]);
   const [st]=await db.query('select * from recon_status where period_id=$1 and account_id=$2',[p.id,a.id]);
   if(cmd==='explain'){[row]=await db.query('insert into flux_notes(period_id,account_id,explanation,written_by) values($1,$2,$3,$4) on conflict(period_id,account_id) do update set explanation=excluded.explanation,written_by=excluded.written_by returning *',[p.id,a.id,req(o,'text'),actor]);}
   else if(cmd==='reconcile'){
    if(!['asset','liability','equity'].includes(a.kind))throw Error('Only balance sheet accounts are reconciled. Use explain for income and expense movements');
    const [b]=await db.query('select balance from balances where period_id=$1 and account_id=$2',[p.id,a.id]);if(!b)throw Error(`No balance for ${a.code} in ${p.label}. Import the trial balance first`);
    if(r&&r.state==='reviewed'&&!st.balance_moved)throw Error('Already reviewed. Nothing has moved since');
    const f=[p.id,a.id,b.balance,num(req(o,'supporting'),'supporting'),req(o,'evidence'),actor];
    [row]=r?await db.query("update reconciliations set ledger_balance=$3,supporting_balance=$4,evidence=$5,prepared_by=$6,prepared_at=now(),state='prepared',reviewed_by=null,reviewed_at=null,reject_reason=null where period_id=$1 and account_id=$2 returning *",f)
     :await db.query('insert into reconciliations(period_id,account_id,ledger_balance,supporting_balance,evidence,prepared_by) values($1,$2,$3,$4,$5,$6) returning *',f);
    const [s2]=await db.query('select unexplained from recon_status where reconciliation_id=$1',[row.id]);row.unexplained=s2.unexplained;
   }else{
    if(!r)throw Error(`${a.code} ${a.name} has not been reconciled for ${p.label}. Run reconcile first`);
    if(cmd==='add-item'){if(r.state==='reviewed')throw Error('Already reviewed. Reconcile again to change it');
     row=await insert(db,'recon_items',{reconciliation_id:r.id,description:req(o,'description'),amount:num(req(o,'amount'),'amount'),kind:choice(o.kind||'timing',['timing','adjustment'],'kind'),dated:date(req(o,'dated')),added_by:actor});
     row.unexplained=(await db.query('select unexplained from recon_status where reconciliation_id=$1',[r.id]))[0].unexplained;}
    else if(cmd==='review'){
     if(r.state!=='prepared')throw Error(`Reconciliation is ${r.state}. ${r.state==='rejected'?'It needs preparing again':'Nothing to review'}`);
     if(st.balance_moved)throw Error(`The ledger balance moved since it was prepared (now ${st.balance}). Reconcile again`);
     if(r.prepared_by.toLowerCase()===actor.toLowerCase())throw Error('The reviewer must be a different person from the preparer');
     if(Math.abs(Number(st.unexplained))>Number(st.materiality))throw Error(`${st.unexplained} is unexplained, above materiality of ${st.materiality}. Add a reconciling item or fix the ledger first`);
     if(!String(r.evidence||'').trim())throw Error('No supporting evidence recorded. Reconcile again with --evidence');
     [row]=await db.query("update reconciliations set state='reviewed',reviewed_by=$2,reviewed_at=now() where id=$1 returning *",[r.id,actor]);}
    else{if(r.state==='rejected')throw Error('Already rejected');[row]=await db.query("update reconciliations set state='rejected',reviewed_by=null,reviewed_at=null,reject_reason=$2 where id=$1 returning *",[r.id,req(o,'reason')]);}
   }
  }else if(cmd==='clear-item'){
   const i=await resolve(db,'item',req(o,'item'),true);const [r]=await db.query('select state from reconciliations where id=$1',[i.reconciliation_id]);
   if(r.state==='reviewed')throw Error('That reconciliation is reviewed. Reconcile again to change it');
   [row]=await db.query('update recon_items set cleared_on=current_date where id=$1 returning *',[i.id]);
  }else if(cmd==='journal'){
   const p=await resolve(db,'period',req(o,'period'));if(p.state==='closed')throw Error(`${p.label} is closed`);
   const lines=req(o,'lines').split(';').map(s=>s.trim()).filter(Boolean).map(s=>{const m=s.match(/^([^:]+):(.+)$/);if(!m)throw Error(`Line "${s}" should be code:amount`);return {code:m[1].trim(),amount:num(m[2],'lines')};});
   if(lines.length<2)throw Error('A journal needs at least two lines');
   row=await insert(db,'journals',{period_id:p.id,reference:req(o,'reference'),description:req(o,'description'),kind:choice(req(o,'kind'),['accrual','prepayment','reclass','correction'],'kind'),reverses_next:!!o['reverses-next'],evidence:o.evidence||null,prepared_by:actor});
   for(const l of lines){const [a]=await db.query('select id from accounts where entity_id=$1 and code=$2',[p.entity_id,l.code]);if(!a)throw Error(`No account ${l.code} in ${p.label}`);await insert(db,'journal_lines',{journal_id:row.id,account_id:a.id,amount:l.amount});}
   row.out_of_balance=lines.reduce((s,l)=>s+l.amount,0).toFixed(2);
  }else if(cmd==='reverse'){
   const j=await resolve(db,'journal',req(o,'journal'),true);if(j.state!=='posted'||!j.reverses_next)throw Error('Only a posted journal marked to reverse can be reversed');
   const [rd]=await db.query('select * from reversals_due where id=$1',[j.id]);if(!rd)throw Error('Its reversal is already entered, or the next period is not open yet');
   const [np]=await db.query('select id from period_list where label=$1',[rd.reverse_in]);
   row=await insert(db,'journals',{period_id:np.id,reference:`REV-${j.reference}`,description:`Reversal of ${j.reference}: ${j.description}`,kind:'reversal',reverses_id:j.id,evidence:j.evidence,prepared_by:actor});
   await db.query('insert into journal_lines(journal_id,account_id,amount,memo) select $1,account_id,-amount,memo from journal_lines where journal_id=$2',[row.id,j.id]);
  }else if(cmd==='cancel-journal'){
   const j=await resolve(db,'journal',req(o,'journal'),true);if(!['draft','approved'].includes(j.state))throw Error(`Journal is ${j.state}; only a draft or approved journal can be cancelled`);
   [row]=await db.query("update journals set state='cancelled',cancel_reason=$2 where id=$1 returning *",[j.id,req(o,'reason')]);
  }else if(cmd==='approve-journal'||cmd==='post-journal'){
   const j=await resolve(db,'journal',req(o,'journal'),true);const [s]=await db.query('select * from journal_status where id=$1',[j.id]);
   if(s.period_state==='closed')throw Error(`${s.period} is closed`);
   if(cmd==='approve-journal'){if(j.state!=='draft')throw Error(`Journal is already ${j.state}`);if(Number(s.out_of_balance)!==0)throw Error(`Out of balance by ${s.out_of_balance}`);
    if(j.prepared_by.toLowerCase()===actor.toLowerCase())throw Error('The approver must be a different person from the preparer');
    [row]=await db.query("update journals set state='approved',approved_by=$2,approved_at=now() where id=$1 returning *",[j.id,actor]);}
   else{if(j.state!=='approved')throw Error(j.state==='draft'?'Approve the journal before posting it':'Journal is already posted');
    [row]=await db.query("update journals set state='posted',ledger_ref=$2,posted_at=now() where id=$1 returning *",[j.id,req(o,'ledger-ref')]);}
  }else if(cmd==='close-period'){
   const p=await resolve(db,'period',req(o,'period'),true);if(p.state==='closed')throw Error(`${p.label} is already closed`);
   const [s]=await db.query('select * from close_status where period=$1',[p.label]);const open=[];
   if(s.tasks_finished<s.tasks)open.push(`${s.tasks-s.tasks_finished} checklist task(s)`);
   if(s.recs_reviewed<s.recs_needed)open.push(`${s.recs_needed-s.recs_reviewed} reconciliation(s)`);
   if(s.journals_unposted)open.push(`${s.journals_unposted} journal(s) not posted`);
   if(s.flux_unexplained)open.push(`${s.flux_unexplained} variance(s) not explained`);
   if(open.length)throw Error(`${p.label} cannot close yet: ${open.join(', ')}`);
   [row]=await db.query("update periods set state='closed',closed_by=$2,closed_at=now() where id=$1 returning *",[p.id,actor]);
  }else if(cmd==='pbc-provide'||cmd==='pbc-accept'){
   const i=await resolve(db,'pbc',req(o,'item'),true);
   if(cmd==='pbc-provide'){if(i.state!=='requested')throw Error(`Already ${i.state}`);[row]=await db.query("update pbc_items set state='provided',evidence=$2,provided_on=current_date where id=$1 returning *",[i.id,req(o,'evidence')]);}
   else{if(i.state!=='provided')throw Error(i.state==='requested'?'Provide it before it is accepted':'Already accepted');[row]=await db.query("update pbc_items set state='accepted',accepted_by=$2 where id=$1 returning *",[i.id,actor]);}
  }else if(cmd==='log'){
   const a=await resolve(db,'account',req(o,'account'));row=await insert(db,'notes',{account_id:a.id,actor,body:req(o,'note')});
  }else if(cmd==='import'){
   if(!pos[0])throw Error('Use: import trial-balance ... or import blackline --object=accounts|tasks ...');result=await importFile(db,o,pos);
  }
  if(row){delete row.label;delete row.source_snapshot;}
  await db.query('insert into history(actor,operation,record_id,detail) values($1,$2,$3,$4::jsonb)',[actor,cmd,row?.id||null,JSON.stringify(result||row)]);
  await db.exec(o['dry-run']?'ROLLBACK':'COMMIT');return result||row;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try{db=await getDb();const data=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(data,null,2):render(data));}
 catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}
}
