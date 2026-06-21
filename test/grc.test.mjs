import * as B from '/home/claude/raqib-saas/api/_lib/grc.js';
let pass=0, fail=0; const fails=[];
const t=(name,fn)=>{ try{ const r=fn(); if(r===false) throw new Error('returned false'); pass++; }catch(e){ fail++; fails.push(`${name}: ${e.message}`); } };
const ta=async(name,fn)=>{ try{ await fn(); pass++; }catch(e){ fail++; fails.push(`${name}: ${e.message}`); } };
const eq=(a,b)=>{ if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error(`got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };

/* ── i18n parity ── */
const keyset=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&!Array.isArray(v)?keyset(v,`${p}${k}.`):[`${p}${k}`]);
t('i18n: en/ar key parity', ()=>{ 
  const en=keyset(B.STR.en).sort(), ar=keyset(B.STR.ar).sort();
  const miss=en.filter(k=>!ar.includes(k)), extra=ar.filter(k=>!en.includes(k));
  if(miss.length||extra.length) throw new Error(`ar missing:[${miss}] ar extra:[${extra}]`);
});
t('i18n: tt vars + fallback', ()=>{ eq(B.tt('en','countsLine',{t:5,c:2,g:1}),'5 controls · 2 compliant · 1 gaps'); eq(B.tt('ar','nonexistent_key'),'nonexistent_key'); });
t('i18n: ar statusLabels Arabic', ()=>{ if(!B.hasArabic(B.STR.ar.statusLabels.compliant)) throw new Error('not arabic'); });
t('i18n: tt object passthrough (nav/roles/evQuality)', ()=>{ 
  if(typeof B.tt('ar','nav')!=='object') throw new Error('nav not object');
  if(!B.tt('en','roles').admin||!B.tt('ar','roles').admin) throw new Error('roles');
  if(!B.tt('ar','evQuality').strong) throw new Error('evQuality');
});

/* ── RBAC ── */
t('rbac: matrix covers all PERMS for every role', ()=>{ for(const r of B.ROLES) for(const p of B.PERMS) if(B.ROLE_MATRIX[r][p]===undefined) throw new Error(`${r}.${p} undefined`); });
t('rbac: admin all-true', ()=>{ for(const p of B.PERMS) if(!B.can('admin',p)) throw new Error(p); });
t('rbac: viewer read-only except advisor', ()=>{ if(B.can('viewer','assess')||B.can('viewer','evidence')||B.can('viewer','exportData')||B.can('viewer','bulk')) throw new Error('viewer too strong'); if(!B.can('viewer','advisor')) throw new Error('viewer needs advisor'); });
t('rbac: assessor assess+evidence, no approve/import/scope', ()=>{ if(!B.can('assessor','assess')||!B.can('assessor','evidence')||!B.can('assessor','bulk')) throw new Error('missing'); if(B.can('assessor','approve')||B.can('assessor','importData')||B.can('assessor','manageScope')) throw new Error('too strong'); });
t('rbac: manager approves/imports, no users/reset', ()=>{ if(!B.can('manager','approve')||!B.can('manager','importData')||!B.can('manager','refetch')) throw new Error('missing'); if(B.can('manager','manageUsers')||B.can('manager','resetData')) throw new Error('too strong'); });
t('rbac: unknown role denied', ()=> !B.can('ghost','assess'));

/* ── auth ── */
await ta('auth: hash deterministic per salt, salted', async()=>{
  const h1=await B.hashPassword('Str0ngPass!','aabb'), h2=await B.hashPassword('Str0ngPass!','aabb'), h3=await B.hashPassword('Str0ngPass!','ccdd');
  if(h1!==h2) throw new Error('non-deterministic'); if(h1===h3) throw new Error('salt ignored'); if(!/^[0-9a-f]{64}$/.test(h1)) throw new Error('not sha256 hex');
});
await ta('auth: verifyPassword true/false', async()=>{
  const s=B.randomSalt(); const h=await B.hashPassword('correct horse',s);
  if(!await B.verifyPassword('correct horse',s,h)) throw new Error('should pass');
  if(await B.verifyPassword('wrong',s,h)) throw new Error('should fail');
});
t('auth: randomSalt 32-hex unique', ()=>{ const a=B.randomSalt(),b=B.randomSalt(); if(!/^[0-9a-f]{32}$/.test(a)) throw new Error('format'); if(a===b) throw new Error('collision'); });
t('auth: normEmail', ()=> { eq(B.normEmail('  A.B@X.COM '),'a.b@x.com'); eq(B.normEmail(null),''); });

/* ── parseLooseJSON (regression set) ── */
t('json: plain', ()=>eq(B.parseLooseJSON('{"a":1}').a,1));
t('json: fenced', ()=>eq(B.parseLooseJSON('```json\n{"a":2}\n```').a,2));
t('json: preamble', ()=>eq(B.parseLooseJSON('Here you go:\n{"a":3}').a,3));
t('json: truncated mid-string repairs to last complete', ()=>{
  const r=B.parseLooseJSON('{"subdomains":[{"id":"1-1","controls":[{"id":"1-1-1","t":"a"},{"id":"1-1-2","t":"tru');
  eq(r.subdomains[0].controls.length,1); eq(r.subdomains[0].controls[0].id,'1-1-1');
});
t('json: truncated, zero closes → tail repair keeps values', ()=>{ const r=B.parseLooseJSON('{"a":[1,2,3'); eq(r.a,[1,2,3]); });
t('json: truncated mid-value-string → dangling key stripped', ()=>{ const r=B.parseLooseJSON('{"a":1,"b":"unfinish'); eq(r,{a:1}); });
t('json: truncated after colon', ()=>{ const r=B.parseLooseJSON('{"a":1,"b":'); eq(r,{a:1}); });
t('json: escaped quotes inside strings', ()=>eq(B.parseLooseJSON('{"t":"say \\"hi\\""}').t,'say "hi"'));
t('json: array root', ()=>eq(B.parseLooseJSON('[{"x":1}]')[0].x,1));
t('json: garbage throws', ()=>{ try{B.parseLooseJSON('no json here');}catch{return true;} throw new Error('should throw'); });

/* ── CSV parse ── */
t('csv: basic + CRLF + trailing newline', ()=>eq(B.parseCSV('a,b\r\n1,2\n3,4\n'),[['a','b'],['1','2'],['3','4']]));
t('csv: quoted commas + escaped quotes', ()=>eq(B.parseCSV('id,note\n"1-1-1","hello, ""world"""'),[['id','note'],['1-1-1','hello, "world"']]));
t('csv: multiline quoted field', ()=>eq(B.parseCSV('a\n"line1\nline2"')[1][0],'line1\nline2'));
t('csv: BOM stripped', ()=>eq(B.parseCSV('\uFEFFa,b\n1,2')[0],['a','b']));
t('csv: empty lines skipped', ()=>eq(B.parseCSV('a\n\n1\n\n').length,2));

/* ── statusFromLabel ── */
t('status: keys pass through', ()=>{ for(const k of ['compliant','partial','gap','na','unassessed']) eq(B.statusFromLabel(k),k); });
t('status: english labels', ()=>{ eq(B.statusFromLabel('Compliant'),'compliant'); eq(B.statusFromLabel('Partially compliant'),'partial'); eq(B.statusFromLabel('Non-compliant'),'gap'); eq(B.statusFromLabel('Not applicable'),'na'); eq(B.statusFromLabel('not assessed'),'unassessed'); });
t('status: arabic labels', ()=>{ eq(B.statusFromLabel('ملتزم'),'compliant'); eq(B.statusFromLabel('غير ملتزم'),'gap'); eq(B.statusFromLabel('لا ينطبق'),'na'); });
t('status: aliases + unknown', ()=>{ eq(B.statusFromLabel('N/A'),'na'); eq(B.statusFromLabel('noncompliant'),'gap'); eq(B.statusFromLabel('weird'),null); eq(B.statusFromLabel(''),null); eq(B.statusFromLabel(undefined),null); });

/* ── buildImport ── */
const kbc=new Map([['1-1-1',['ncaecc:1-1-1']],['3.3.5',['samacsf:3.3.5']],['2-1',['ncaecc:2-1']]]);
t('import: missing control_id column errors', ()=>{ const r=B.buildImport([['status'],['compliant']],kbc); if(!r.error) throw new Error('no error'); });
t('import: matches + maps fields', ()=>{
  const rows=[['control_id','status','owner','due','evidence_note'],['1-1-1','Compliant','IT Sec','2026-07-01','policy v3'],['9-9-9','gap','','',''],['3.3.5','ملتزم','GRC','bad-date','x']];
  const r=B.buildImport(rows,kbc);
  eq(r.skipped,1); eq(r.matched,2);
  eq(r.updates[0],{key:'ncaecc:1-1-1',s:'compliant',owner:'IT Sec',due:'2026-07-01',note:'policy v3'});
  const u2=r.updates[1]; eq(u2.key,'samacsf:3.3.5'); eq(u2.s,'compliant'); eq(u2.due,undefined); eq(u2.owner,'GRC');
});
t('import: row with no usable fields skipped', ()=>{ const r=B.buildImport([['control_id','status'],['1-1-1','???']],kbc); eq(r.matched,0); eq(r.skipped,1); });
t('import: control_id-only header, owner-only update', ()=>{ const r=B.buildImport([['control_id','owner'],['2-1','CISO']],kbc); eq(r.updates[0],{key:'ncaecc:2-1',owner:'CISO'}); });

/* ── approval transitions ── */
const assessor={id:'u2',name:'Sara',role:'assessor'}, manager={id:'u1',name:'Adel',role:'manager'};
t('approve: assessor status change → pending + prevS', ()=>{
  const rec=B.makeRecord({s:'gap'},{s:'compliant',note:'fixed'},assessor);
  eq(rec.review,'pending'); eq(rec.prevS,'gap'); eq(rec.s,'compliant'); eq(rec.by,'Sara');
});
t('approve: assessor same-status edit keeps prior review', ()=>{
  const rec=B.makeRecord({s:'gap',review:'approved'},{s:'gap',note:'more notes'},assessor);
  eq(rec.review,'approved'); if('prevS' in rec && rec.prevS!==undefined) throw new Error('prevS leaked');
});
t('approve: manager change auto-approved, prevS cleared', ()=>{
  const rec=B.makeRecord({s:'gap',prevS:'unassessed',review:'pending'},{s:'compliant'},manager);
  eq(rec.review,'approved'); if(rec.prevS!==undefined) throw new Error('prevS not cleared');
});
t('approve: from unassessed default', ()=>{ const rec=B.makeRecord(undefined,{s:'partial'},assessor); eq(rec.prevS,'unassessed'); eq(rec.review,'pending'); });
t('approve: approveRecord clears prevS, stamps reviewer', ()=>{
  const rec=B.approveRecord({s:'compliant',prevS:'gap',review:'pending'},manager);
  eq(rec.review,'approved'); eq(rec.reviewBy,'Adel'); if(rec.prevS!==undefined) throw new Error('prevS');
});
t('approve: rejectRecord reverts status', ()=>{
  const rec=B.rejectRecord({s:'compliant',prevS:'gap',review:'pending'},manager);
  eq(rec.s,'gap'); eq(rec.review,'rejected'); eq(rec.reviewBy,'Adel');
});
t('approve: reject without prevS falls to unassessed', ()=>{ eq(B.rejectRecord({s:'compliant',review:'pending'},manager).s,'unassessed'); });

/* ── normalizeEvidence ── */
const vk={ncaecc:new Set(['ncaecc:1-1-1','ncaecc:2-3-1']),samacsf:new Set(['samacsf:3.3.5'])};
t('evidence: maps + filters + strips prefixes + dedupes', ()=>{
  const ev=B.normalizeEvidence({summary:'IAM policy v2 approved by CISO',quality:'strong',control_ids:['1-1-1','ECC 2-3-1','9-9-9','3.3.5','1-1-1'],doc_type:'policy'},vk,{name:'iam.pdf',kind:'pdf',size:1024},'Sara');
  eq(ev.controls.sort(),['ncaecc:1-1-1','ncaecc:2-3-1','samacsf:3.3.5']);
  eq(ev.quality,'strong'); eq(ev.docType,'policy'); eq(ev.by,'Sara'); eq(ev.fileType,'pdf');
});
t('evidence: bad quality/docType fall back', ()=>{
  const ev=B.normalizeEvidence({summary:'x',quality:'amazing',control_ids:[],doc_type:'meme'},vk,{name:'a.txt',kind:'text'},'U');
  eq(ev.quality,'adequate'); eq(ev.docType,'other'); eq(ev.controls,[]);
});
t('evidence: non-array control_ids tolerated', ()=>{ eq(B.normalizeEvidence({summary:'x',quality:'weak',control_ids:'1-1-1'},vk,{name:'a',kind:'text'},'U').controls,[]); });
t('evidence: summary capped at 500', ()=>{ if(B.normalizeEvidence({summary:'x'.repeat(900)},vk,{name:'a',kind:'text'},'U').summary.length!==500) throw new Error('cap'); });

/* ── metrics ── */
const cat={ncaecc:{version:'ECC-2:2024',domains:[{n:1,en:'Gov',ar:'حوكمة',subdomains:[{id:'1-1',en:'Strategy',ar:'استراتيجية',controls:[{id:'1-1-1',t:'A'},{id:'1-1-2',t:'B'}]},{id:'1-2',en:'Policy',ar:'سياسة',controls:[{id:'1-2-1',t:'C'}]}]}]},samacsf:{version:'v1.0 (May 2017)',domains:[{n:1,en:'Lead',ar:'قيادة',subdomains:[{id:'3.1.1',en:'Gov',ar:'حوكمة',controls:[{id:'3.1.1.a',t:'D'}]}]}]}};
const rows=B.flattenControls(cat,['ncaecc','samacsf']);
t('flatten: rows + keys', ()=>{ eq(rows.length,4); eq(rows[0].key,'ncaecc:1-1-1'); eq(rows[3].fw,'samacsf'); });
t('score: weights + na excluded', ()=>{
  const s=B.scoreOf(rows,{'ncaecc:1-1-1':{s:'compliant'},'ncaecc:1-1-2':{s:'partial'},'ncaecc:1-2-1':{s:'na'},'samacsf:3.1.1.a':{s:'gap'}});
  eq(s.denom,3); eq(s.pct,50); eq(s.counts.na,1);
});
t('score: empty assess → 0%, all unassessed', ()=>{ const s=B.scoreOf(rows,{}); eq(s.pct,0); eq(s.counts.unassessed,4); });
t('evCoverage: counts compliant/partial with links', ()=>{
  const assess={'ncaecc:1-1-1':{s:'compliant'},'ncaecc:1-1-2':{s:'partial'},'ncaecc:1-2-1':{s:'gap'}};
  const evid={e1:{controls:['ncaecc:1-1-1','ncaecc:1-2-1']}};
  const c=B.evidenceCoverage(rows,assess,evid);
  eq(c.need,2); eq(c.have,1); eq(c.pct,50); eq(c.linkedTotal,2);
});
t('evCoverage: zero-need → 0', ()=>{ eq(B.evidenceCoverage(rows,{},{}) .pct,0); });
t('maturity: average 1dp, null when none', ()=>{
  eq(B.avgMaturity(rows,{'ncaecc:1-1-1':{m:3},'ncaecc:1-1-2':{m:4}}),3.5);
  eq(B.avgMaturity(rows,{}),null);
  eq(B.avgMaturity(rows,{'ncaecc:1-1-1':{m:0}}),0);
});
t('posture summary includes versions + gaps', ()=>{
  const s=B.buildPostureSummary(rows,{'ncaecc:1-1-1':{s:'gap'}},['ncaecc','samacsf'],{ncaecc:'ECC-2:2024',samacsf:'v1.0 (May 2017)'});
  if(!s.includes('ECC-2:2024')||!s.includes('1-1-1')) throw new Error(s.slice(0,120));
});
t('posture summary: unknown fw key safe', ()=>{ B.buildPostureSummary(rows,{},['ghost'],{}) ; });

/* ── csv export ── */
t('csvLines: 14 cols, BOM, escaping, maturity+review', ()=>{
  const lines=B.csvLines(rows,{'ncaecc:1-1-1':{s:'compliant',owner:'IT "Sec"',m:4,review:'approved',by:'Sara',t:1700000000000}},(s)=>s);
  if(!lines[0].startsWith('\uFEFF')) throw new Error('no BOM');
  eq(lines[0].replace('\uFEFF','').split(',').length,14);
  if(!lines[1].includes('"IT ""Sec"""')) throw new Error('escape');
  if(!lines[1].includes('"4"')||!lines[1].includes('"approved"')||!lines[1].includes('"Sara"')) throw new Error('new cols');
  eq(lines.length,5);
});

/* ── report ── */
t('reportHTML: smoke en + rtl ar', ()=>{
  const args={org:'Acme Bank',lang:'en',selected:['ncaecc'],versions:{ncaecc:'ECC-2:2024'},overall:{pct:72},perFw:[{fw:'ncaecc',pct:72}],domainRows:[{full:'NCA ECC — Gov',pct:72,gaps:1}],gaps:[{id:'1-1-1',t:'A',owner:'IT',due:'2026-07-01'}],evCov:{pct:50},evCount:3,maturity:null,generatedBy:'Adel'};
  const h=B.reportHTML(args);
  if(!h.includes('Acme Bank')||!h.includes('72%')||!h.includes('dir="ltr"')||!h.includes('1-1-1')) throw new Error('en smoke');
  const ha=B.reportHTML({...args,lang:'ar',maturity:3.2});
  if(!ha.includes('dir="rtl"')||!ha.includes('3.2/5')) throw new Error('ar smoke');
});

/* ── prompts ── */
t('prompts: meta forbids memory, demands JSON', ()=>{ const p=B.metaPrompt('ncaecc'); if(!p.includes('nca.gov.sa')||!p.includes('Do not rely on memory')) throw new Error('meta'); });
t('prompts: catalog carries version + domain', ()=>{ const p=B.catalogPrompt('samacsf',{n:3,en:'Ops'},'v1.0 (May 2017)'); if(!p.includes('v1.0 (May 2017)')||!p.includes('rulebook.sama.gov.sa')) throw new Error('cat'); });
t('prompts: evidence schema + scope', ()=>{ const p=B.evidencePrompt(['ncaecc','samacsf'],{ncaecc:'ECC-2:2024',samacsf:'v1.0'}); if(!p.includes('control_ids')||!p.includes('ECC-2:2024')||!p.includes('strong|adequate|weak')) throw new Error('ev'); });

/* ── normalizers ── */
t('normMeta: valid', ()=>{ const m=B.normalizeMeta({version:'ECC-2:2024',domains:[{n:2,en:'B',ar:'ب'},{n:1,en:'A',ar:'أ'}]},'ncaecc'); eq(m.version,'ECC-2:2024'); eq(m.domains[0].n,1); });
t('normMeta: rejects 1 domain / missing version', ()=>{ if(B.normalizeMeta({version:'x',domains:[{n:1,en:'A'}]},'ncaecc')!==null) throw new Error('1dom'); if(B.normalizeMeta({domains:[{n:1,en:'A'},{n:2,en:'B'}]},'ncaecc')!==null) throw new Error('nover'); });
t('normDomain: drops empty subdomains/bad controls', ()=>{
  const d=B.normalizeDomain({subdomains:[{id:'1-1',en:'S',ar:'س',controls:[{id:'1-1-1',t:'ok'},{bad:1}]},{id:'1-2',controls:[]}]},{n:1,en:'Gov',ar:'حوكمة'});
  eq(d.subdomains.length,1); eq(d.subdomains[0].controls.length,1);
});

/* ── CID detection ── */
t('cid: matches ECC + SAMA styles', ()=>{ for(const s of ['1-1-1','2-3','ECC 2-3-1','3.3.5','3.1.1.a']) if(!B.isCid(s)) throw new Error(s); });
t('cid: rejects words/dates', ()=>{ for(const s of ['hello','2026-07-01','v1.0']) if(B.isCid(s)) throw new Error(s); });
t('cid: global split stateless across calls', ()=>{ const a='see 1-1-1 and 3.3.5'.split(B.CID_SPLIT).filter(x=>x); const b='see 1-1-1 and 3.3.5'.split(B.CID_SPLIT).filter(x=>x); eq(a,b); if(a.filter(B.isCid).length!==2) throw new Error('detect'); });

/* ── pool ── */
await ta('pool: runs all, respects concurrency', async()=>{
  let live=0,max=0; const order=[];
  const mk=(i)=>async()=>{ live++; max=Math.max(max,live); await new Promise(r=>setTimeout(r,5)); order.push(i); live--; };
  await B.runPool([0,1,2,3,4,5].map(mk),3);
  if(order.length!==6) throw new Error('not all ran'); if(max>3) throw new Error(`concurrency ${max}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
if(fails.length){ console.log(fails.map(f=>'  ✗ '+f).join('\n')); process.exit(1); }
