import http from "node:http";
import { spawn } from "node:child_process";

const child = spawn(
  "D:/claudecode/node.exe",
  ["node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", "3000"],
  { cwd: "D:/couple-points", stdio: ["ignore", "pipe", "pipe"] }
);

child.stdout.on("data", (data) => process.stdout.write(data));
child.stderr.on("data", (data) => process.stderr.write(data));

function postJoin() {
  const request = http.request(
    {
      hostname: "127.0.0.1",
      port: 3000,
      path: "/api/join",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    },
    (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        console.log("JOIN_STATUS", response.statusCode);
        console.log(body.replace(/"id":"[^"]+"/, '"id":"<space-id>"'));
        child.kill();
      });
    }
  );

  request.on("error", () => {
    setTimeout(postJoin, 1000);
  });
  request.write(JSON.stringify({ inviteCode: "love-0525" }));
  request.end();
}

setTimeout(postJoin, 5000);
setTimeout(() => child.kill(), 25000);
