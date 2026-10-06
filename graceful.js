const logger=require("./logger"); const {markShuttingDown}=require("./monitoring");
function installGracefulShutdown({server,pool,redisClient}){
  let done=false;
  async function shutdown(signal){if(done)return;done=true;markShuttingDown();logger.info({signal},"graceful shutdown started");
    const force=setTimeout(()=>process.exit(1),15000); force.unref();
    try{await new Promise(resolve=>server.close(resolve));}catch(err){logger.error({err},"http server close failed");}
    try{await pool.end();}catch(err){logger.error({err},"database pool close failed");}
    if(redisClient){try{await redisClient.quit();}catch(err){logger.error({err},"redis close failed");}}
    clearTimeout(force);process.exit(0);
  }
  process.on("SIGTERM",()=>shutdown("SIGTERM")); process.on("SIGINT",()=>shutdown("SIGINT"));
  process.on("uncaughtException",err=>{logger.fatal({err},"uncaught exception");shutdown("uncaughtException");});
  process.on("unhandledRejection",err=>{logger.fatal({err},"unhandled rejection");shutdown("unhandledRejection");});
}
module.exports={installGracefulShutdown};
