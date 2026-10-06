const crypto=require("crypto");

const BASE=process.env.MIDTRANS_PRODUCTION==="true"
  ?"https://app.midtrans.com"
  :"https://app.sandbox.midtrans.com";

function serverKey(){
  if(!process.env.MIDTRANS_SERVER_KEY)throw Error("MIDTRANS_SERVER_KEY belum dikonfigurasi");
  return process.env.MIDTRANS_SERVER_KEY;
}

async function createSnapTransaction(payload){
  const auth=Buffer.from(serverKey()+":").toString("base64");
  const r=await fetch(BASE+"/snap/v1/transactions",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Accept":"application/json",
      "Authorization":"Basic "+auth
    },
    body:JSON.stringify(payload)
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.error_messages?.join(", ")||d.status_message||"Midtrans error");
  return d;
}

function legacySignature(orderId,statusCode,grossAmount){
  return crypto.createHash("sha512")
    .update(String(orderId)+String(statusCode)+String(grossAmount)+serverKey())
    .digest("hex");
}

function timingSafeHex(a,b){
  if(!a||!b)return false;
  const x=Buffer.from(String(a).toLowerCase(),"utf8");
  const y=Buffer.from(String(b).toLowerCase(),"utf8");
  return x.length===y.length&&crypto.timingSafeEqual(x,y);
}

/*
 * Midtrans can use different notification/signature mechanisms depending
 * on the merchant integration. This helper supports the legacy
 * signature_key path used by the current sample server.
 *
 * For BI-SNAP/X-SIGNATURE accounts, configure and implement the exact
 * current signature verification required by the merchant account before
 * production. Never disable verification.
 */
function verifyLegacyNotification(n){
  const expected=legacySignature(n.order_id,n.status_code,n.gross_amount);
  return timingSafeHex(expected,n.signature_key);
}

const paid=s=>["settlement","capture"].includes(String(s||"").toLowerCase());
const failed=s=>["deny","cancel","expire","failure"].includes(String(s||"").toLowerCase());

module.exports={
  createSnapTransaction,
  legacySignature,
  verifyLegacyNotification,
  timingSafeHex,
  paid,
  failed
};
