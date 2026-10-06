const os=require("os");
const logger=require("./logger");
const state={startedAt:new Date(),shuttingDown:false};
function basicStatus(){return {ok:!state.shuttingDown,version:"4.1.0",uptimeSeconds:Math.floor(process.uptime()),startedAt:state.startedAt.toISOString(),node:process.version,hostname:os.hostname()};}
async function readiness(pool,redisClient,config){
  let db={ok:false},redis={ok:true,configured:false},r2={ok:config.r2Configured,configured:config.r2Configured};
  try{await pool.query("SELECT 1");db={ok:true};}catch(err){logger.error({err},"database readiness check failed");}
  if(redisClient){try{redis={ok:(await redisClient.ping())==="PONG",configured:true};}catch(err){redis={ok:false,configured:true};logger.error({err},"redis readiness check failed");}}
  const ok=!state.shuttingDown&&db.ok&&redis.ok&&r2.ok&&config.midtransConfigured;
  return {ok,version:"4.1.0",checks:{database:db,redis,r2,midtrans:{ok:config.midtransConfigured,configured:config.midtransConfigured}}};
}
function markShuttingDown(){state.shuttingDown=true;}
module.exports={basicStatus,readiness,markShuttingDown,state};
