const { getConfig } = require('./src/config');
const logger = require('./src/logger');
const pinoHttp = require('pino-http');
const { basicStatus, readiness } = require('./src/monitoring');
const { installGracefulShutdown } = require('./src/graceful');
const { inc, snapshot } = require('./src/metrics');
const { getDiagnostics } = require('./src/diagnostics');
const { runIntegrityJobs, getJobStatus } = require('./src/jobs');
const { inspectIntegrity } = require('./src/integrity');
const { recordSecurityEvent, getSecuritySummary } = require('./src/adminSecurity');
const express=require("express"),crypto=require("crypto"),helmet=require("helmet"),rateLimit=require("express-rate-limit");
const {Pool}=require("pg");
const {key,uploadUrl,downloadUrl}=require("./src/r2");
const {createSnapTransaction,verifyLegacyNotification,paid,failed}=require("./src/midtrans");
const S=require("./src/security");
const app=express(),pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  max:Number(process.env.PG_POOL_MAX||10),
  idleTimeoutMillis:30000,
  connectionTimeoutMillis:10000
});

app.disable("x-powered-by");
app.set("trust proxy", Number(process.env.TRUST_PROXY||1));

app.get('/healthz', (req, res) => {
  const status = basicStatus();
  res.status(status.ok ? 200 : 503).json(status);
});

app.get('/readyz', async (req, res) => {
  try {
    const result = await readiness(pool, redisClient, CONFIG);
    res.status(result.ok ? 200 : 503).json(result);
  } catch (err) {
    logger.error({ err }, "readiness endpoint failed");
    res.status(503).json({ ok: false, version: "4.1.0" });
  }
});

app.use(helmet({
  contentSecurityPolicy:false,
  crossOriginEmbedderPolicy:false,
  referrerPolicy:{policy:"strict-origin-when-cross-origin"}
}));
app.use((req,res,next)=>{
  res.setHeader("Cache-Control","no-store");
  next();
});
const loginLimiter=rateLimit({
  windowMs:15*60*1000,max:10,standardHeaders:true,legacyHeaders:false,
  message:{error:"Terlalu banyak percobaan login. Coba lagi nanti."}
});
const checkoutLimiter=rateLimit({
  windowMs:10*60*1000,max:20,standardHeaders:true,legacyHeaders:false,
  message:{error:"Terlalu banyak permintaan checkout."}
});
const activationLimiter=rateLimit({
  windowMs:15*60*1000,max:10,standardHeaders:true,legacyHeaders:false,
  message:{error:"Terlalu banyak percobaan aktivasi."}
});
app.use(express.json({limit:"100kb"}));
app.use(require("cookie-parser")());
app.use(express.static("public"));
const MEMBER_PRICE=Number(process.env.MEMBER_PRICE_IDR||99000);
const MAX=Number(process.env.MAX_MEDIA_BYTES||250*1024*1024);
const MAX_CONTACT=120, MAX_TITLE=180, MAX_BIO=1000;
const cleanText=(v,max)=>String(v??"").trim().slice(0,max);
const isValidContact=v=>/^[^\\s]{1,120}$/.test(String(v||"")) && (String(v).includes("@") || /^[+0-9()\- .]{7,30}$/.test(String(v)));
const sameOrigin=(req)=>{
  const origin=req.get("origin");
  if(!origin)return true;
  try{return new URL(origin).host===req.get("host")}catch{return false}
};
const TYPES=new Set(["image/jpeg","image/png","image/webp","video/mp4","video/webm"]);
const json=(res,status,data)=>res.status(status).json(data);
const admin=async(req,res,next)=>{
  try{
    const token=req.cookies.lume_admin_session,session=await S.getAdminSession(token);
    if(!session)return json(res,401,{error:"Login admin diperlukan"});
    if(!["GET","HEAD","OPTIONS"].includes(req.method)){
      const csrf=req.get("x-csrf-token");
      if(!await S.validAdminCsrf(token,csrf))return json(res,403,{error:"CSRF token tidak valid"});
    }
    next();
  }catch(e){json(res,500,{error:"Session service unavailable"})}
};
const access=req=>S.getAccessSession(req.cookies.lume_access);
const requireAccessCsrf=async(req,res,next)=>{
  try{
    const token=req.cookies.lume_access,session=await S.getAccessSession(token);
    if(!token||!session)return json(res,401,{error:"Akses tidak aktif"});
    if(!["GET","HEAD","OPTIONS"].includes(req.method)){
      const csrf=req.get("x-csrf-token");
      if(!await S.validAccessCsrf(token,csrf))return json(res,403,{error:"CSRF token tidak valid"});
    }
    next();
  }catch(e){json(res,500,{error:"Session service unavailable"})}
};
const setCookie=(res,name,val,maxAge)=>res.cookie(name,val,{
  httpOnly:true,
  secure:process.env.NODE_ENV==="production",
  sameSite:"lax",
  maxAge,
  path:"/"
});
const setCsrf=(res,name,token)=>res.cookie(name,token,{
  httpOnly:false,
  secure:process.env.NODE_ENV==="production",
  sameSite:"lax",
  maxAge:8*3600000,
  path:"/"
});
const requireSameOrigin=(req,res,next)=>{
  if(["GET","HEAD","OPTIONS"].includes(req.method)||sameOrigin(req))return next();
  return json(res,403,{error:"Origin tidak diizinkan"});
};
app.use(requireSameOrigin);
const audit=(a,m)=>pool.query(`INSERT INTO admin_audit(action,actor,metadata,created_at) VALUES($1,'admin',$2,NOW())`,[a,JSON.stringify(m)]).catch(()=>{});

app.get("/health",async(_,res)=>res.json({ok:true,version:"3.9.0",sessionBackend:S.sessionBackend()}));

/* PUBLIC */
app.get("/api/creators",async(_,res)=>{try{res.json((await pool.query(`SELECT id,name,handle,bio FROM creators WHERE active=true ORDER BY created_at DESC`)).rows)}catch(e){json(res,500,{error:"Gagal memuat kreator"})}});
app.get("/api/creators/:handle",async(req,res)=>{try{
 const c=await pool.query(`SELECT id,name,handle,bio FROM creators WHERE handle=$1 AND active=true LIMIT 1`,[req.params.handle]);if(!c.rowCount)return json(res,404,{error:"Kreator tidak ditemukan"});
 const p=await pool.query(`SELECT id,title,media_type,access_type,price_idr,created_at FROM posts WHERE creator_id=$1 AND active=true ORDER BY created_at DESC`,[c.rows[0].id]);res.json({creator:c.rows[0],posts:p.rows});
}catch(e){json(res,500,{error:"Gagal memuat profil"})}});

/* ACCESS + MEMBER PORTAL */
app.get("/api/access/csrf",async(req,res)=>{
  const token=req.cookies.lume_access;
  if(!await S.getAccessSession(token))return json(res,401,{error:"Akses tidak aktif"});
  res.json({csrf:await S.accessCsrf(token)});
});
app.get("/api/access/me",async(req,res)=>{try{
 const s=access(req);if(!s)return res.json({authenticated:false});
 const m=await pool.query(`SELECT expires_at FROM memberships WHERE contact=$1 AND active=true AND expires_at>NOW() ORDER BY expires_at DESC LIMIT 1`,[s.contact]);
 const p=await pool.query(`SELECT p.id,p.title,p.media_type,p.price_idr,p.created_at,ca.post_id FROM content_access ca JOIN posts p ON p.id=ca.post_id WHERE ca.contact=$1 AND p.active=true ORDER BY ca.created_at DESC`,[s.contact]);
 res.json({authenticated:true,member:!!m.rowCount,memberExpires:m.rowCount?m.rows[0].expires_at:null,purchases:p.rows});
}catch(e){json(res,500,{error:"Gagal memuat akses"})}});
app.post("/api/access/activate",activationLimiter,async(req,res)=>{try{
 const c=cleanText(req.body?.contact,MAX_CONTACT);if(!isValidContact(c))return json(res,400,{error:"WhatsApp/email tidak valid"});
 const q=await pool.query(`SELECT 1 FROM purchases WHERE contact=$1 AND status='paid' LIMIT 1`,[c]);if(!q.rowCount)return json(res,403,{error:"Belum ditemukan pembayaran berhasil"});
 const token=await S.createAccessSession(c);
setCookie(res,"lume_access",token,30*86400000);
setCsrf(res,"lume_access_csrf",await S.accessCsrf(token));
res.json({ok:true});
}catch(e){json(res,500,{error:"Aktivasi gagal"})}});
app.post("/api/access/logout",requireAccessCsrf,async(req,res)=>{await S.destroyAccessSession(req.cookies.lume_access);res.clearCookie("lume_access",{path:"/"});res.json({ok:true})});
app.get("/api/content/:id/access",async(req,res)=>{try{
 const p=(await pool.query(`SELECT id,media_key,media_type,access_type FROM posts WHERE id=$1 AND active=true`,[req.params.id])).rows[0];if(!p)return json(res,404,{error:"Konten tidak ditemukan"});
 if(p.access_type==="free")return res.json({ok:true,url:await downloadUrl(p.media_key),mediaType:p.media_type,expiresIn:300});
 const s=access(req);if(!s)return json(res,401,{error:"Aktifkan akses terlebih dahulu"});
 let ok=false;
 if(p.access_type==="member")ok=!!(await pool.query(`SELECT 1 FROM memberships WHERE contact=$1 AND active=true AND expires_at>NOW() LIMIT 1`,[s.contact])).rowCount;
 else ok=!!(await pool.query(`SELECT 1 FROM content_access WHERE contact=$1 AND post_id=$2 LIMIT 1`,[s.contact,p.id])).rowCount;
 if(!ok)return json(res,403,{error:"Akses tidak tersedia"});
 res.json({ok:true,url:await downloadUrl(p.media_key),mediaType:p.media_type,expiresIn:300});
}catch(e){json(res,500,{error:"Gagal membuka konten"})}});

/* CHECKOUT */
app.post("/api/checkout",checkoutLimiter,async(req,res)=>{try{
 const {kind,postId,contact}=req.body||{},buyer=cleanText(contact,MAX_CONTACT);
if(!isValidContact(buyer))return json(res,400,{error:"WhatsApp/email tidak valid"});
if(!["member","premium"].includes(kind))return json(res,400,{error:"Checkout tidak valid"});
 let amount,planId=null,name;
 if(kind==="member"){amount=MEMBER_PRICE;name="Lume Member 30 Hari";const q=await pool.query(`SELECT id FROM plans WHERE active=true AND duration_days=30 ORDER BY price_idr LIMIT 1`);planId=q.rowCount?q.rows[0].id:(await pool.query(`INSERT INTO plans(id,name,price_idr,duration_days,active) VALUES($1,$2,$3,30,true) RETURNING id`,[crypto.randomUUID(),name,amount])).rows[0].id}
 else if(kind==="premium"){const q=await pool.query(`SELECT title,price_idr FROM posts WHERE id=$1 AND active=true AND access_type='premium'`,[postId]);if(!q.rowCount)return json(res,404,{error:"Premium tidak ditemukan"});amount=Number(q.rows[0].price_idr);name="Lume Premium: "+(q.rows[0].title||"Konten")}
 else return json(res,400,{error:"Checkout tidak valid"});
 const order="LUME-"+Date.now()+"-"+crypto.randomBytes(4).toString("hex").toUpperCase(),pid=crypto.randomUUID();
 const existing=await pool.query(
  `SELECT order_id FROM purchases
   WHERE contact=$1 AND status='pending' AND created_at>NOW()-INTERVAL '30 minutes'
   AND ((plan_id IS NOT DISTINCT FROM $2) AND (post_id IS NOT DISTINCT FROM $3))
   ORDER BY created_at DESC LIMIT 1`,
  [buyer,planId,kind==="premium"?postId:null]
);
if(existing.rowCount){
  return json(res,409,{error:"Masih ada order pending untuk pembelian ini",orderId:existing.rows[0].order_id});
}
await pool.query(
  `INSERT INTO purchases(id,order_id,contact,plan_id,post_id,amount_idr,status,created_at)
   VALUES($1,$2,$3,$4,$5,$6,'pending',NOW())`,
  [pid,order,buyer,planId,kind==="premium"?postId:null,amount]
);
 const tx=await createSnapTransaction({transaction_details:{order_id:order,gross_amount:amount},item_details:[{id:planId||postId||"member",price:amount,quantity:1,name:name.slice(0,50)}],customer_details:{
  first_name:"Lume Member",
  ...(buyer.includes("@")?{email:buyer}:{phone:buyer})
}});
 res.json({orderId:order,redirectUrl:tx.redirect_url});
}catch(e){json(res,500,{error:e.message||"Checkout gagal"})}});

/* WEBHOOK */
app.post("/api/webhooks/midtrans",async(req,res)=>{
  try{
    const n=req.body||{};
    const orderId=String(n.order_id||"").trim();
    const statusCode=String(n.status_code||"").trim();
    const gross=String(n.gross_amount||"").trim();
    if(!orderId||!statusCode||!gross)
      return json(res,400,{error:"Notification tidak lengkap"});

    /*
     * Current code accepts the legacy signature_key notification format.
     * If the merchant account is configured for BI-SNAP/X-SIGNATURE,
     * replace this verification with the exact current Midtrans method
     * before enabling production.
     */
    if(process.env.MIDTRANS_NOTIFICATION_MODE==="legacy"){
      if(!verifyLegacyNotification(n))
        return json(res,401,{error:"signature invalid"});
    }else{
      return json(res,503,{error:"MIDTRANS_NOTIFICATION_MODE belum dikonfigurasi secara aman"});
    }

    const c=await pool.connect();
    try{
      await c.query("BEGIN");

      const q=await c.query(
        `SELECT * FROM purchases WHERE order_id=$1 FOR UPDATE`,
        [orderId]
      );
      if(!q.rowCount){
        await c.query("ROLLBACK");
        return json(res,404,{error:"order tidak ditemukan"});
      }

      const p=q.rows[0];
      const notificationAmount=Math.round(Number(gross));
      if(!Number.isFinite(notificationAmount)||notificationAmount!==Number(p.amount_idr)){
        await c.query("ROLLBACK");
        return json(res,400,{error:"nominal transaksi tidak cocok"});
      }

      /*
       * Idempotency: if already paid, acknowledge without creating
       * another membership/content access record.
       */
      if(paid(n.transaction_status)){
        let accounting={gross:0,creator:0,platform:0};
        if(p.post_id){
          const cr=await c.query(`
            SELECT c.commission_percent
            FROM posts po JOIN creators c ON c.id=po.creator_id
            WHERE po.id=$1
          `,[p.post_id]);
          if(cr.rowCount){
            const gross=Number(p.amount_idr);
            const creator=Math.round(gross*Number(cr.rows[0].commission_percent)/100);
            accounting={gross,creator,platform:gross-creator};
          }
        }else{
          accounting={gross:Number(p.amount_idr),creator:0,platform:Number(p.amount_idr)};
        }

        if(p.status!=="paid"){
          await c.query(
            `UPDATE purchases
             SET status='paid',
                 provider_transaction_id=$1,
                 paid_at=COALESCE(paid_at,NOW()),
                 creator_gross_idr=$2,
                 creator_earning_idr=$3,
                 platform_fee_idr=$4
             WHERE id=$5`,
            [n.transaction_id||null,accounting.gross,accounting.creator,accounting.platform,p.id]
          );
        }else if(Number(p.creator_gross_idr||0)===0){
          await c.query(
            `UPDATE purchases
             SET creator_gross_idr=$1,creator_earning_idr=$2,platform_fee_idr=$3
             WHERE id=$4`,
            [accounting.gross,accounting.creator,accounting.platform,p.id]
          );
        }

        if(p.plan_id){
          await c.query(
            `INSERT INTO memberships
             (id,contact,plan_id,purchase_id,starts_at,expires_at,active)
             VALUES($1,$2,$3,$4,NOW(),NOW()+INTERVAL '30 days',true)
             ON CONFLICT (purchase_id) DO NOTHING`,
            [crypto.randomUUID(),p.contact,p.plan_id,p.id]
          );
        }

        if(p.post_id){
          await c.query(
            `INSERT INTO content_access
             (id,contact,post_id,purchase_id,expires_at,created_at)
             VALUES($1,$2,$3,$4,NULL,NOW())
             ON CONFLICT (purchase_id) DO NOTHING`,
            [crypto.randomUUID(),p.contact,p.post_id,p.id]
          );
        }
      }else if(failed(n.transaction_status)){
        /*
         * Do not downgrade a previously successful payment because a
         * later unrelated/duplicate notification says failure.
         */
        if(p.status!=="paid"){
          await c.query(
            `UPDATE purchases SET status=$1 WHERE id=$2 AND status='pending'`,
            [String(n.transaction_status).toLowerCase(),p.id]
          );
        }
      }else{
        /*
         * Keep unknown/intermediate states pending. Do not grant access.
         */
        if(p.status==="pending"){
          await c.query(
            `UPDATE purchases SET status=$1 WHERE id=$2`,
            [String(n.transaction_status||"pending").toLowerCase(),p.id]
          );
        }
      }

      await c.query("COMMIT");
    }catch(e){
      await c.query("ROLLBACK");
      throw e;
    }finally{
      c.release();
    }

    res.json({ok:true});
  }catch(e){
    console.error("Midtrans webhook error:",e);
    json(res,500,{error:"Webhook gagal"});
  }
});

/* ADMIN */
app.post("/api/admin/login",loginLimiter,async(req,res)=>{if(!process.env.ADMIN_PASSWORD_HASH||!process.env.ADMIN_TOTP_SECRET)return json(res,503,{error:"Admin security belum dikonfigurasi"});if(!S.verifyPassword(req.body?.password,process.env.ADMIN_PASSWORD_HASH))return json(res,401,{error:"Password salah"});if(!S.verifyTotp(req.body?.code,process.env.ADMIN_TOTP_SECRET))return json(res,401,{error:"Kode 2FA salah"});setCookie(res,"lume_admin_session",await S.createAdminSession(),8*3600000);res.json({ok:true})});
app.post("/api/admin/logout",admin,async(req,res)=>{await S.destroyAdminSession(req.cookies.lume_admin_session);res.clearCookie("lume_admin_session",{path:"/"});res.json({ok:true})});
app.get("/api/admin/me",admin,(_,res)=>res.json({authenticated:true}));
app.get("/api/admin/csrf",admin,async(req,res)=>{
  const token=req.cookies.lume_admin_session;
  res.json({csrf:await S.adminCsrf(token)});
});
app.get("/api/admin/summary",admin,async(_,res)=>{try{
 const [a,b,c,d,e]=await Promise.all([
  pool.query(`SELECT COUNT(*)::int n FROM creators WHERE active=true`),pool.query(`SELECT COUNT(*)::int n FROM posts WHERE active=true`),
  pool.query(`SELECT COUNT(*)::int n FROM purchases WHERE status='paid'`),pool.query(`SELECT COALESCE(SUM(amount_idr),0)::bigint n FROM purchases WHERE status='paid'`),
  pool.query(`SELECT COUNT(*)::int n FROM memberships WHERE active=true AND expires_at>NOW()`)]);
 res.json({creators:a.rows[0].n,posts:b.rows[0].n,transactions:c.rows[0].n,revenue:Number(d.rows[0].n),activeMembers:e.rows[0].n})
}catch(e){json(res,500,{error:"Summary gagal"})}});


/* RECONCILIATION */
async function expireMemberships(){
  await pool.query(`UPDATE memberships SET active=false WHERE active=true AND expires_at<=NOW()`);
}
function calcRefundAllocation(gross,creatorEarned,refundAmount){
  if(gross<=0)return {creator:0,platform:refundAmount};
  const creator=Math.min(creatorEarned,Math.round(refundAmount*creatorEarned/gross));
  return {creator,platform:refundAmount-creator};
}

app.post("/api/admin/reconcile/run",admin,async(req,res)=>{
  try{
    await expireMemberships();
    const r=await pool.query(`
      SELECT p.id,p.amount_idr,p.status,p.creator_gross_idr,p.creator_earning_idr,
             p.platform_fee_idr,p.refunded_idr,p.refund_status,
             p.post_id,po.creator_id
      FROM purchases p
      LEFT JOIN posts po ON po.id=p.post_id
      WHERE p.status='paid'
      ORDER BY p.created_at DESC
    `);
    let checked=0,issues=0;
    for(const p of r.rows){
      checked++;
      const expectedGross=Number(p.amount_idr);
      const refunded=Math.min(Number(p.refunded_idr||0),expectedGross);
      const creator=Math.max(0,Number(p.creator_earning_idr||0));
      const platform=Math.max(0,expectedGross-creator);
      if(Number(p.creator_gross_idr||0)!==expectedGross ||
         Number(p.platform_fee_idr||0)!==platform ||
         refunded>expectedGross){
        issues++;
        await pool.query(`
          UPDATE purchases
          SET creator_gross_idr=$1,
              platform_fee_idr=$2,
              refunded_idr=LEAST($3,amount_idr),
              reconciled_at=NOW()
          WHERE id=$4
        `,[expectedGross,platform,refunded,p.id]);
      }else{
        await pool.query(`UPDATE purchases SET reconciled_at=NOW() WHERE id=$1`,[p.id]);
      }
    }
    await audit("financial_reconciliation",{checked,issues});
    res.json({ok:true,checked,issues,membershipsExpired:true});
  }catch(e){console.error(e);json(res,500,{error:"Rekonsiliasi gagal"})}
});

app.get("/api/admin/reconciliation",admin,async(req,res)=>{
  try{
    await expireMemberships();
    const [refunds,issues,members]=await Promise.all([
      pool.query(`
        SELECT p.order_id,p.contact,p.amount_idr,p.refunded_idr,p.refund_status,
               p.paid_at,p.created_at
        FROM purchases p
        WHERE p.refunded_idr>0 OR p.refund_status<>'none'
        ORDER BY p.created_at DESC LIMIT 100
      `),
      pool.query(`
        SELECT p.order_id,p.amount_idr,p.creator_gross_idr,p.creator_earning_idr,
               p.platform_fee_idr,p.reconciled_at
        FROM purchases p
        WHERE p.status='paid'
          AND (p.creator_gross_idr<>p.amount_idr
               OR p.platform_fee_idr<>(p.amount_idr-p.creator_earning_idr)
               OR p.reconciled_at IS NULL)
        ORDER BY p.created_at DESC LIMIT 100
      `),
      pool.query(`
        SELECT COUNT(*) FILTER (WHERE active=true AND expires_at>NOW())::int active,
               COUNT(*) FILTER (WHERE expires_at<=NOW())::int expired
        FROM memberships
      `)
    ]);
    res.json({
      refunds:refunds.rows.map(x=>({...x,amount_idr:Number(x.amount_idr),refunded_idr:Number(x.refunded_idr)})),
      issues:issues.rows.map(x=>({...x,amount_idr:Number(x.amount_idr),creator_gross_idr:Number(x.creator_gross_idr),creator_earning_idr:Number(x.creator_earning_idr),platform_fee_idr:Number(x.platform_fee_idr)})),
      memberships:members.rows[0]
    });
  }catch(e){json(res,500,{error:"Rekonsiliasi gagal"})}
});

app.post("/api/admin/refunds",admin,async(req,res)=>{
  const orderId=String(req.body?.orderId||"").trim();
  const refundAmount=Math.floor(Number(req.body?.amountIdr));
  const note=String(req.body?.note||"").slice(0,500);
  if(!orderId||!Number.isFinite(refundAmount)||refundAmount<=0)return json(res,400,{error:"Refund tidak valid"});
  const c=await pool.connect();
  try{
    await c.query("BEGIN");
    const q=await c.query(`SELECT * FROM purchases WHERE order_id=$1 FOR UPDATE`,[orderId]);
    if(!q.rowCount){await c.query("ROLLBACK");return json(res,404,{error:"Order tidak ditemukan"})}
    const p=q.rows[0];
    if(p.status!=="paid"){await c.query("ROLLBACK");return json(res,400,{error:"Hanya transaksi paid yang dapat direfund"})}
    const remaining=Number(p.amount_idr)-Number(p.refunded_idr||0);
    if(refundAmount>remaining){await c.query("ROLLBACK");return json(res,400,{error:`Maksimal refund ${remaining}`})}

    let creatorRefund=0;
    let platformRefund=refundAmount;
    if(p.post_id){
      const alloc=calcRefundAllocation(Number(p.amount_idr),Number(p.creator_earning_idr||0),refundAmount);
      creatorRefund=alloc.creator;
      platformRefund=alloc.platform;
    }

    const totalRefunded=Number(p.refunded_idr||0)+refundAmount;
    const status=totalRefunded>=Number(p.amount_idr)?"refunded":"requested";
    await c.query(`
      UPDATE purchases
      SET refunded_idr=$1,refund_status=$2
      WHERE id=$3
    `,[totalRefunded,status,p.id]);

    if(p.post_id){
      const cr=(await c.query(`SELECT creator_id FROM posts WHERE id=$1`,[p.post_id])).rows[0];
      if(cr){
        await c.query(`
          INSERT INTO financial_adjustments
          (id,purchase_id,creator_id,type,amount_idr,note,actor)
          VALUES($1,$2,$3,'refund',$4,$5,'admin')
        `,[crypto.randomUUID(),p.id,cr.creator_id,-creatorRefund,note||"Refund creator share"]);
      }
    }
    await c.query(`
      INSERT INTO financial_adjustments
      (id,purchase_id,creator_id,type,amount_idr,note,actor)
      VALUES($1,$2,NULL,'refund',$3,$4,'admin')
    `,[crypto.randomUUID(),p.id,-platformRefund,note||"Refund platform share"]);

    if(status==="refunded"){
      if(p.post_id)await c.query(`DELETE FROM content_access WHERE purchase_id=$1`,[p.id]);
      if(p.plan_id)await c.query(`UPDATE memberships SET active=false WHERE purchase_id=$1`,[p.id]);
    }

    await c.query("COMMIT");
    await audit("refund_recorded",{orderId,refundAmount,status});
    res.json({ok:true,status,refundedIdr:totalRefunded});
  }catch(e){
    await c.query("ROLLBACK");
    console.error(e);
    json(res,500,{error:"Refund gagal"});
  }finally{c.release()}
});

/* ADMIN ANALYTICS */
app.get("/api/admin/analytics",admin,async(req,res)=>{
  try{
    const days=Math.min(Math.max(Number(req.query.days||30),7),365);
    const [daily,byType,topPosts,topCreators,members,summary]=await Promise.all([
      pool.query(`
        SELECT DATE(created_at) day,
               COUNT(*) FILTER (WHERE status='paid')::int paid_orders,
               COALESCE(SUM(amount_idr) FILTER (WHERE status='paid'),0)::bigint revenue
        FROM purchases
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
        GROUP BY DATE(created_at)
        ORDER BY day
      `,[days]),
      pool.query(`
        SELECT CASE
          WHEN plan_id IS NOT NULL THEN 'member'
          WHEN post_id IS NOT NULL THEN 'premium'
          ELSE 'other'
        END type,
        COUNT(*) FILTER (WHERE status='paid')::int orders,
        COALESCE(SUM(amount_idr) FILTER (WHERE status='paid'),0)::bigint revenue
        FROM purchases
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
        GROUP BY 1
        ORDER BY revenue DESC
      `,[days]),
      pool.query(`
        SELECT p.id,p.title,c.name creator_name,c.handle,
               COUNT(pr.id) FILTER (WHERE pr.status='paid')::int sales,
               COALESCE(SUM(pr.amount_idr) FILTER (WHERE pr.status='paid'),0)::bigint revenue
        FROM posts p
        JOIN creators c ON c.id=p.creator_id
        LEFT JOIN purchases pr ON pr.post_id=p.id
        GROUP BY p.id,c.id
        HAVING COUNT(pr.id) FILTER (WHERE pr.status='paid') > 0
        ORDER BY revenue DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT c.id,c.name,c.handle,
               COUNT(DISTINCT p.id) FILTER (WHERE p.active=true)::int active_posts,
               COUNT(pr.id) FILTER (WHERE pr.status='paid')::int sales,
               COALESCE(SUM(pr.amount_idr) FILTER (WHERE pr.status='paid'),0)::bigint revenue
        FROM creators c
        LEFT JOIN posts p ON p.creator_id=c.id
        LEFT JOIN purchases pr ON pr.post_id=p.id
        GROUP BY c.id
        ORDER BY revenue DESC
      `),
      pool.query(`
        SELECT COUNT(*) FILTER (WHERE active=true AND expires_at>NOW())::int active,
               COUNT(*)::int total
        FROM memberships
      `),
      pool.query(`
        SELECT
          COALESCE(SUM(amount_idr) FILTER (WHERE status='paid'),0)::bigint revenue_all,
          COUNT(*) FILTER (WHERE status='paid')::int paid_all,
          COUNT(*) FILTER (WHERE status='pending')::int pending_all
        FROM purchases
      `)
    ]);
    res.json({
      rangeDays:days,
      daily:daily.rows.map(x=>({...x,revenue:Number(x.revenue)})),
      byType:byType.rows.map(x=>({...x,revenue:Number(x.revenue)})),
      topPosts:topPosts.rows.map(x=>({...x,revenue:Number(x.revenue)})),
      creators:topCreators.rows.map(x=>({...x,revenue:Number(x.revenue)})),
      members:members.rows[0],
      summary:{revenueAll:Number(summary.rows[0].revenue_all),paidAll:summary.rows[0].paid_all,pendingAll:summary.rows[0].pending_all}
    });
  }catch(e){
    console.error(e);
    json(res,500,{error:"Analytics gagal"});
  }
});


/* ADMIN FINANCE */
app.get("/api/admin/finance",admin,async(req,res)=>{
  try{
    const [summary,creators,payouts]=await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(amount_idr) FILTER (WHERE status='paid'),0)::bigint gross,
          COALESCE(SUM(creator_earning_idr) FILTER (WHERE status='paid'),0)
            + COALESCE((SELECT SUM(amount_idr) FROM financial_adjustments WHERE type='refund' AND creator_id IS NOT NULL),0)::bigint creator_earnings,
          COALESCE(SUM(platform_fee_idr) FILTER (WHERE status='paid'),0)
            + COALESCE((SELECT SUM(amount_idr) FROM financial_adjustments WHERE type='refund' AND creator_id IS NULL),0)::bigint platform_revenue
        FROM purchases
      `),
      pool.query(`
        SELECT
          c.id,c.name,c.handle,c.commission_percent,
          COUNT(DISTINCT p.id) FILTER (WHERE p.status='paid')::int sales,
          COALESCE(SUM(p.amount_idr) FILTER (WHERE p.status='paid'),0)::bigint gross,
          COALESCE(SUM(p.creator_earning_idr) FILTER (WHERE p.status='paid'),0)
            + COALESCE((
              SELECT SUM(fa.amount_idr) FROM financial_adjustments fa
              WHERE fa.creator_id=c.id AND fa.type='refund'
            ),0)::bigint earned,
          COALESCE((
            SELECT SUM(po.amount_idr) FROM payouts po
            WHERE po.creator_id=c.id AND po.status='paid'
          ),0)::bigint paid_out
        FROM creators c
        LEFT JOIN posts ps ON ps.creator_id=c.id
        LEFT JOIN purchases p ON p.post_id=ps.id
        GROUP BY c.id
        ORDER BY earned DESC
      `),
      pool.query(`
        SELECT po.id,po.creator_id,c.name creator_name,po.amount_idr,po.status,
               po.reference,po.note,po.paid_at,po.created_at
        FROM payouts po JOIN creators c ON c.id=po.creator_id
        ORDER BY po.created_at DESC LIMIT 100
      `)
    ]);
    const s=summary.rows[0];
    const cr=creators.rows.map(x=>({
      ...x,
      commission_percent:Number(x.commission_percent),
      gross:Number(x.gross),
      earned:Number(x.earned),
      paid_out:Number(x.paid_out),
      balance:Math.max(0,Number(x.earned)-Number(x.paid_out))
    }));
    res.json({
      summary:{
        gross:Number(s.gross),
        creatorEarnings:Number(s.creator_earnings),
        platformRevenue:Number(s.platform_revenue),
        payoutTotal:cr.reduce((a,x)=>a+x.paid_out,0),
        creatorBalance:cr.reduce((a,x)=>a+x.balance,0)
      },
      creators:cr,
      payouts:payouts.rows.map(x=>({...x,amount_idr:Number(x.amount_idr)}))
    });
  }catch(e){console.error(e);json(res,500,{error:"Finance gagal"})}
});

app.patch("/api/admin/creators/:id/commission",admin,async(req,res)=>{
  try{
    const n=Number(req.body?.commissionPercent);
    if(!Number.isFinite(n)||n<0||n>100)return json(res,400,{error:"Komisi harus 0-100%"});
    const q=await pool.query(`UPDATE creators SET commission_percent=$1 WHERE id=$2 RETURNING id,name,commission_percent`,[n,req.params.id]);
    if(!q.rowCount)return json(res,404,{error:"Kreator tidak ditemukan"});
    await audit("update_creator_commission",{id:req.params.id,commissionPercent:n});
    res.json({ok:true,creator:q.rows[0]});
  }catch(e){json(res,500,{error:"Update komisi gagal"})}
});

app.post("/api/admin/payouts",admin,async(req,res)=>{
  try{
    const creatorId=req.body?.creatorId,amount=Math.floor(Number(req.body?.amountIdr));
    const reference=String(req.body?.reference||"").slice(0,120);
    const note=String(req.body?.note||"").slice(0,500);
    if(!creatorId||!Number.isFinite(amount)||amount<=0)return json(res,400,{error:"Nominal payout tidak valid"});
    const bal=await pool.query(`
      SELECT GREATEST(
        0,
        COALESCE((SELECT SUM(creator_earning_idr) FROM purchases p JOIN posts ps ON ps.id=p.post_id
          WHERE ps.creator_id=$1 AND p.status='paid'),0)
        - COALESCE((SELECT SUM(amount_idr) FROM payouts po WHERE po.creator_id=$1 AND po.status='paid'),0)
        + COALESCE((SELECT SUM(amount_idr) FROM financial_adjustments fa WHERE fa.creator_id=$1 AND fa.type='refund'),0)
      )::bigint balance
    `,[creatorId]);
    const balance=Number(bal.rows[0].balance);
    if(amount>balance)return json(res,400,{error:`Saldo kreator hanya ${balance}`});
    const id=crypto.randomUUID();
    await pool.query(`
      INSERT INTO payouts(id,creator_id,amount_idr,status,reference,note,paid_at,created_at)
      VALUES($1,$2,$3,'paid',$4,$5,NOW(),NOW())
    `,[id,creatorId,amount,reference,note]);
    await audit("creator_payout",{id,creatorId,amount,reference});
    res.json({ok:true,id,amountIdr:amount});
  }catch(e){json(res,500,{error:"Payout gagal"})}
});

app.get("/api/admin/export/transactions",admin,async(req,res)=>{
  try{
    const rows=(await pool.query(`
      SELECT order_id,contact,amount_idr,creator_gross_idr,creator_earning_idr,platform_fee_idr,status,provider_transaction_id,paid_at,created_at
      FROM purchases ORDER BY created_at DESC
    `)).rows;
    const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`;
    const csv=[
      ["order_id","contact","amount_idr","creator_gross_idr","creator_earning_idr","platform_fee_idr","status","provider_transaction_id","paid_at","created_at"],
      ...rows.map(x=>[x.order_id,x.contact,x.amount_idr,x.creator_gross_idr,x.creator_earning_idr,x.platform_fee_idr,x.status,x.provider_transaction_id,x.paid_at,x.created_at])
    ].map(r=>r.map(esc).join(",")).join("\n");
    res.setHeader("Content-Type","text/csv; charset=utf-8");
    res.setHeader("Content-Disposition",'attachment; filename="lume-transactions.csv"');
    res.send("\ufeff"+csv);
  }catch(e){json(res,500,{error:"Export gagal"})}
});

app.get("/api/admin/creators",admin,async(_,res)=>{try{res.json((await pool.query(`SELECT c.id,c.name,c.handle,c.bio,c.active,COUNT(p.id)::int posts FROM creators c LEFT JOIN posts p ON p.creator_id=c.id AND p.active=true GROUP BY c.id ORDER BY c.created_at DESC`)).rows)}catch(e){json(res,500,{error:"Kreator gagal"})}});
app.post("/api/admin/creators",admin,async(req,res)=>{try{const {name,handle,bio}=req.body||{};
if(!name||!handle)return json(res,400,{error:"Nama dan handle wajib"});
const id=crypto.randomUUID(),h=String(handle).replace(/^@/,"").toLowerCase().replace(/[^a-z0-9._-]/g,"").slice(0,50);
if(!h)return json(res,400,{error:"Handle tidak valid"});await pool.query(`INSERT INTO creators(id,name,handle,bio,active,created_at) VALUES($1,$2,$3,$4,true,NOW())`,[id,cleanText(name,100),h,cleanText(bio,MAX_BIO)]);await audit("create_creator",{id,handle:h});res.json({ok:true,id})}catch(e){json(res,400,{error:"Handle mungkin sudah digunakan"})}});
app.get("/api/admin/posts",admin,async(req,res)=>{try{const q=req.query.creatorId;const r=await pool.query(`SELECT p.*,c.name creator_name,c.handle FROM posts p JOIN creators c ON c.id=p.creator_id ${q?"WHERE p.creator_id=$1":""} ORDER BY p.created_at DESC`,q?[q]:[]);res.json(r.rows)}catch(e){json(res,500,{error:"Konten gagal"})}});
app.patch("/api/admin/posts/:id",admin,async(req,res)=>{try{const p=(await pool.query(`SELECT * FROM posts WHERE id=$1`,[req.params.id])).rows[0];if(!p)return json(res,404,{error:"Konten tidak ditemukan"});const t=req.body.accessType||p.access_type,price=req.body.priceIdr===undefined?p.price_idr:Number(req.body.priceIdr),title=req.body.title===undefined?p.title:req.body.title;await pool.query(`UPDATE posts SET title=$1,access_type=$2,price_idr=$3,active=$4 WHERE id=$5`,[title,t,price,req.body.active===undefined?p.active:!!req.body.active,req.params.id]);await audit("update_post",{id:req.params.id});res.json({ok:true})}catch(e){json(res,500,{error:"Update gagal"})}});
app.delete("/api/admin/posts/:id",admin,async(req,res)=>{await pool.query(`UPDATE posts SET active=false WHERE id=$1`,[req.params.id]);await audit("archive_post",{id:req.params.id});res.json({ok:true})});
app.post("/api/admin/media/upload-url",admin,async(req,res)=>{try{const {creatorId,filename,contentType,size}=req.body||{};if(!creatorId||!filename||!contentType||!Number.isFinite(Number(size)))
  return json(res,400,{error:"Data upload belum lengkap"});
if(String(filename).length>180)return json(res,400,{error:"Nama file terlalu panjang"});
if(Number(size)<=0)return json(res,400,{error:"Ukuran file tidak valid"});if(!TYPES.has(contentType))return json(res,415,{error:"Format tidak didukung"});if(Number(size)>MAX)return json(res,413,{error:"File terlalu besar"});const q=await pool.query(`SELECT 1 FROM creators WHERE id=$1 AND active=true`,[creatorId]);if(!q.rowCount)return json(res,404,{error:"Kreator tidak ditemukan"});const k=key(creatorId,filename);res.json({uploadUrl:await uploadUrl(k,contentType),mediaKey:k,expiresIn:900})}catch(e){json(res,500,{error:"Upload URL gagal"})}});
app.post("/api/admin/posts",admin,async(req,res)=>{try{const {creatorId,title,mediaKey,mediaType,accessType,priceIdr}=req.body||{};
if(!creatorId||!mediaKey)return json(res,400,{error:"Data belum lengkap"});
if(!["image","video"].includes(mediaType)||!["free","member","premium"].includes(accessType))
  return json(res,400,{error:"Jenis konten tidak valid"});const price=Math.max(0,Number.isFinite(Number(priceIdr))?Number(priceIdr):0);if(accessType==="premium"&&price<1000)return json(res,400,{error:"Premium minimal Rp1.000"});const id=crypto.randomUUID();await pool.query(`INSERT INTO posts(id,creator_id,title,media_key,media_type,access_type,price_idr,active,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,true,NOW())`,[id,creatorId,cleanText(title,MAX_TITLE),mediaKey,mediaType,accessType,price]);await audit("publish_post",{id,creatorId,accessType,price});res.json({ok:true,id})}catch(e){json(res,500,{error:"Publish gagal"})}});
app.get("/api/admin/media/preview",admin,async(req,res)=>{try{const k=String(req.query.key||"");if(!k.startsWith("creators/"))return json(res,400,{error:"Key invalid"});res.json({url:await downloadUrl(k,120)})}catch(e){json(res,500,{error:"Preview gagal"})}});
app.get("/api/admin/transactions",admin,async(_,res)=>{try{res.json((await pool.query(`SELECT order_id,contact,amount_idr,status,paid_at,created_at FROM purchases ORDER BY created_at DESC LIMIT 100`)).rows)}catch(e){json(res,500,{error:"Transaksi gagal"})}});

if(process.env.NODE_ENV==="production"&&!process.env.REDIS_URL)
  console.warn("WARNING: REDIS_URL belum diisi; session masih memakai memory fallback dan tidak aman untuk multi-instance.");
if(process.env.NODE_ENV==="production"&&process.env.MIDTRANS_NOTIFICATION_MODE!=="legacy")
  console.warn("WARNING: MIDTRANS_NOTIFICATION_MODE belum diset ke mode verifikasi yang benar. Webhook akan ditolak sampai dikonfigurasi.");
const server = app.listen(Number(process.env.PORT||3000),()=>console.log("Lume v3.6 running"));

const integrityIntervalMs = Number(process.env.LUME_INTEGRITY_INTERVAL_MS || 15 * 60 * 1000);
if (process.env.NODE_ENV !== 'test' && integrityIntervalMs > 0) {
  setTimeout(() => {
    runIntegrityJobs(pool).catch(err => logger.error({err}, "scheduled integrity job failed"));
  }, 5000);
  setInterval(() => {
    runIntegrityJobs(pool).catch(err => logger.error({err}, "scheduled integrity job failed"));
  }, integrityIntervalMs).unref();
}

installGracefulShutdown({ server, pool, redisClient });
