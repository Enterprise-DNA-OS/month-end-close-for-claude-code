import {readFileSync} from 'node:fs';
import path from 'node:path';
import {getDb,REPO_ROOT} from './lib/db.mjs';
const db=await getDb();
try{await db.exec('BEGIN');await db.exec(readFileSync(path.join(REPO_ROOT,'supabase/seed.sql'),'utf8'));await db.exec('COMMIT');console.log('Seeded two fictional entities with a closed month and a close in progress.');}
catch(e){await db.exec('ROLLBACK');throw e;}finally{await db.close();}
