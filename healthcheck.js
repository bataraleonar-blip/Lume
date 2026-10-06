const http=require("http"); const port=Number(process.env.PORT||3000);
const req=http.get({hostname:"127.0.0.1",port,path:process.env.HEALTHCHECK_PATH||"/readyz",timeout:4000},res=>{res.resume();process.exit(res.statusCode>=200&&res.statusCode<300?0:1)});
req.on("timeout",()=>{req.destroy();process.exit(1)});req.on("error",()=>process.exit(1));
