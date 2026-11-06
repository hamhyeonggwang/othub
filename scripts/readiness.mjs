import fs from 'node:fs';
import vm from 'node:vm';
const launch=JSON.parse(fs.readFileSync('ops/launch.json','utf8'));
const ctx=vm.createContext({window:{}});vm.runInContext(fs.readFileSync('supabase-config.js','utf8'),ctx,{timeout:1000});
const cfg=ctx.window.OT_HUB_SUPABASE||{};
const checks=[
 ['운영 도메인 지정',launch.productionOrigin==='https://www.othub.kr'&&launch.entryOrigin==='https://othub.kr'],
 ['관리자 대상 계정 지정',launch.adminEmail==='h2g0614@gmail.com'],
 ['공개 인증 설정',/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url||'')&&!!cfg.anonKey],
 ['서버 SUPABASE_URL',process.env.SUPABASE_URL===cfg.url],
 ['서버 SERVICE_ROLE_KEY',!!process.env.SUPABASE_SERVICE_ROLE_KEY],
 ['서버 IP 해시 키',process.env.OT_ANALYTICS_HASH_SECRET?.length>=32],
 ['서버 운영 도메인 허용',(process.env.OT_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).includes(launch.productionOrigin)],
 ['통계 DB 마이그레이션 파일',fs.existsSync('supabase/migrations/202609200002_server_intake.sql')],
 ['이메일 확인 기반 관리자 등록 SQL',fs.existsSync('supabase/register-admin.sql')]
];
for(const [name,ready]of checks)console.log(`${ready?'준비':'미설정'} · ${name}`);
console.log('별도 확인 · 운영 DB 적용, 관리자 권한, 인증 리디렉션, 삭제 작업, 스테이징, 정책/문의 창구, 실제 배포');
console.log('이 검사는 비밀 값을 출력하지 않으며 운영 DB 적용 여부를 보증하지 않습니다.');
if(process.argv.includes('--strict')&&checks.some(([,ok])=>!ok))process.exitCode=1;
