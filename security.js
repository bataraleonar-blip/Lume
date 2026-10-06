const crypto=require("crypto");
const {authenticator}=require("otplib");
const {createClient}=require("redis");

const useRedis=!!process.env.REDIS_URL;
let redis=null,redisReady=false;

if(useRedis){
  redis=createClient({url:process.env.REDIS_URL,socket:{connectTimeout:10000,reconnectStrategy:r=>Math.min(r*250,5000)}});
  redis.on("error",e=>console.error("Redis error:",e.message));
  redis.connect().then(()=>{redisReady=true;console.log("Redis session store connected")}).catch(e=>console.error("Redis connect failed:",e.message));
}

const adminSessions=new Map(),accessSessions=new Map();
const now=()=>Date.now();
function hashPassword(p){const salt=crypto.randomBytes(16),h=crypto.scryptSync(String(p),salt,64,{N:16384,r:8,p:1});return salt.toString("hex")+":"+h.toString("hex")}
function verifyPassword(p,s){const [a,b]=String(s||"").split(":");if(!a||!b)return false;const exp=Buffer.from(b,"hex"),got=crypto.scryptSync(String(p),Buffer.from(a,"hex"),exp.length,{N:16384,r:8,p:1});return exp.length===got.length&&crypto.timingSafeEqual(exp,got)}

async function create(map,ttl,data={}){
  const token=crypto.randomBytes(32).toString("base64url");
  const value={...data,expiresAt:now()+ttl,csrf:crypto.randomBytes(32).toString("base64url")};
  if(redisReady){
    await redis.set(`lume:session:${token}`,JSON.stringify(value),{PX:ttl});
  }else map.set(token,value);
  return token;
}
async function get(map,t){
  if(!t)return null;
  if(redisReady){
    const raw=await redis.get(`lume:session:${t}`);
    if(!raw)return null;
    const s=JSON.parse(raw);
    if(now()>s.expiresAt){await redis.del(`lume:session:${t}`);return null}
    return s;
  }
  const s=map.get(t);if(!s)return null;
  if(now()>s.expiresAt){map.delete(t);return null}
  return s;
}
async function destroy(map,t){if(!t)return;if(redisReady)await redis.del(`lume:session:${t}`);else map.delete(t)}
async function csrf(map,t){const s=await get(map,t);return s?.csrf||null}
async function validCsrf(map,t,c){const s=await get(map,t);if(!s||!c)return false;const a=Buffer.from(s.csrf),b=Buffer.from(String(c));return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function verifyTotp(c,s){return !!s&&authenticator.check(String(c||"").replace(/\s/g,""),s)}

module.exports={
  hashPassword,verifyPassword,verifyTotp,
  sessionBackend:()=>redisReady?"redis":"memory",
  createAdminSession:()=>create(adminSessions,8*3600000),
  getAdminSession:t=>get(adminSessions,t),
  destroyAdminSession:t=>destroy(adminSessions,t),
  adminCsrf:t=>csrf(adminSessions,t),
  validAdminCsrf:(t,c)=>validCsrf(adminSessions,t,c),
  createAccessSession:c=>create(accessSessions,30*86400000,{contact:c}),
  getAccessSession:t=>get(accessSessions,t),
  destroyAccessSession:t=>destroy(accessSessions,t),
  accessCsrf:t=>csrf(accessSessions,t),
  validAccessCsrf:(t,c)=>validCsrf(accessSessions,t,c)
};
