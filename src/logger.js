const pino=require("pino");
module.exports=pino({
  level:process.env.LOG_LEVEL||"info", base:null, timestamp:pino.stdTimeFunctions.isoTime,
  redact:{paths:["req.headers.authorization","req.headers.cookie","password","passwordHash","secret","serverKey","accessKeyId","secretAccessKey"],censor:"[REDACTED]"}
});
