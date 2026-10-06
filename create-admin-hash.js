const crypto = require("crypto");
const readline = require("readline");

const rl = readline.createInterface({input:process.stdin,output:process.stdout,terminal:true});
rl.question("New Admin password: ", password => {
  if (!password || password.length < 12) {
    console.error("Password must be at least 12 characters.");
    rl.close();
    process.exit(1);
  }
  const salt = crypto.randomBytes(16);
  crypto.scrypt(password, salt, 64, {N:32768,r:8,p:1}, (err,key) => {
    if (err) { console.error(err.message); process.exit(1); }
    console.log(`ADMIN_PASSWORD_HASH=scrypt$32768$8$1$${salt.toString("base64")}$${key.toString("base64")}`);
    rl.close();
  });
});
