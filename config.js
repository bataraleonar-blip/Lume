const required = ["DATABASE_URL","R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET","MIDTRANS_SERVER_KEY","ADMIN_PASSWORD_HASH","ADMIN_TOTP_SECRET"];
function getConfig() {
  const env=process.env.NODE_ENV||"development";
  const missing=required.filter(k=>!process.env[k]);
  if(env==="production" && missing.length) throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  return {
    env, production:env==="production", port:Number(process.env.PORT||3000),
    publicBaseUrl:process.env.PUBLIC_BASE_URL||"", trustProxy:process.env.TRUST_PROXY||"",
    redisUrl:process.env.REDIS_URL||"", r2Configured:!!(process.env.R2_ACCOUNT_ID&&process.env.R2_ACCESS_KEY_ID&&process.env.R2_SECRET_ACCESS_KEY&&process.env.R2_BUCKET),
    midtransConfigured:!!process.env.MIDTRANS_SERVER_KEY, notificationMode:process.env.MIDTRANS_NOTIFICATION_MODE||"legacy",
    maxMediaBytes:Number(process.env.MAX_MEDIA_BYTES||262144000), pgPoolMax:Number(process.env.PG_POOL_MAX||10), missing
  };
}
module.exports={getConfig};
