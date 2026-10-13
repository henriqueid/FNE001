import path from "node:path";
import { loadEnvFile } from "node:process";
import { startProdServer } from "vinext/server/prod-server";

try {
  loadEnvFile(".env");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return process.argv.find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

const host = argument("--hostname") ?? argument("--host") ?? process.env.HOST ?? "0.0.0.0";
const port = Number(argument("--port") ?? process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Porta de produção inválida.");

await startProdServer({
  host,
  port,
  outDir: path.resolve(process.cwd(), "dist"),
});
