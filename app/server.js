// Shanti Jewellers – standalone server. No npm packages needed, only Node.js 16+.
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ADMIN_ID = process.env.ADMIN_ID || "shanti";          // change this
const ADMIN_PASS = process.env.ADMIN_PASS || "Shanti@2026";  // change this
const CATS = ["Necklace", "Earrings", "Rings", "Bangles", "Silver", "Coins"];

const DATA = path.join(__dirname, "data"), UP = path.join(DATA, "uploads");
const DB = path.join(DATA, "items.json"), PUB = path.join(__dirname, "public");
fs.mkdirSync(UP, { recursive: true });
if (!fs.existsSync(DB)) fs.writeFileSync(DB, "[]");
const readItems = () => JSON.parse(fs.readFileSync(DB, "utf8"));
const writeItems = a => { fs.writeFileSync(DB + ".tmp", JSON.stringify(a, null, 1)); fs.renameSync(DB + ".tmp", DB); };

const sessions = new Map();   // token -> expiry time
const fails = new Map();      // ip -> {n, until}
const sha = s => crypto.createHash("sha256").update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

function token(req) { const m = /(?:^|; )sj=([a-f0-9]+)/.exec(req.headers.cookie || ""); return m && m[1]; }
function isAdmin(req) { const t = token(req), e = t && sessions.get(t); if (e && e > Date.now()) return true; if (t) sessions.delete(t); return false; }
function json(res, code, obj, headers = {}) { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers }); res.end(JSON.stringify(obj)); }
function readBody(req) {
  return new Promise((ok, no) => {
    let s = "", n = 0;
    req.on("data", c => { n += c.length; if (n > 6e6) { no(new Error("File too large")); req.destroy(); } else s += c; });
    req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch (e) { no(new Error("Bad request")); } });
    req.on("error", no);
  });
}

async function api(req, res, url) {
  const ip = req.socket.remoteAddress;
  if (req.method === "GET" && url === "/api/items")
    return json(res, 200, readItems().sort((a, b) => b.t - a.t));
  if (req.method === "GET" && url === "/api/me") return json(res, 200, { admin: isAdmin(req) });

  if (req.method === "POST" && url === "/api/login") {
    const f = fails.get(ip) || { n: 0, until: 0 };
    if (f.until > Date.now()) return json(res, 429, { error: "Too many attempts. Try again after 10 minutes." });
    const b = await readBody(req);
    if (same(b.id || "", ADMIN_ID) && same(b.password || "", ADMIN_PASS)) {
      fails.delete(ip);
      const t = crypto.randomBytes(24).toString("hex");
      sessions.set(t, Date.now() + 8 * 3600e3);
      const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
      return json(res, 200, { ok: true }, { "Set-Cookie": `sj=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}` });
    }
    f.n++; if (f.n >= 5) { f.until = Date.now() + 600e3; f.n = 0; } fails.set(ip, f);
    return json(res, 401, { error: "Wrong User ID or Password." });
  }
  if (req.method === "POST" && url === "/api/logout") {
    sessions.delete(token(req));
    return json(res, 200, { ok: true }, { "Set-Cookie": "sj=; HttpOnly; Path=/; Max-Age=0" });
  }

  if (url.startsWith("/api/items")) {
    if (!isAdmin(req)) return json(res, 401, { error: "Please login as admin." });
    if (req.method === "POST" && url === "/api/items") {
      const b = await readBody(req);
      const name = String(b.name || "").trim().slice(0, 100);
      if (!name) return json(res, 400, { error: "Item name is required." });
      const id = "i" + Date.now() + crypto.randomBytes(2).toString("hex");
      let img = "";
      if (b.img) {
        const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.img);
        if (!m) return json(res, 400, { error: "Invalid photo." });
        const ext = m[1] === "jpeg" ? "jpg" : m[1];
        fs.writeFileSync(path.join(UP, id + "." + ext), Buffer.from(m[2], "base64"));
        img = "/uploads/" + id + "." + ext;
      }
      const item = { id, t: Date.now(), name, cat: CATS.includes(b.cat) ? b.cat : "Necklace", wt: String(b.wt || "").trim().slice(0, 60), img };
      const all = readItems(); all.push(item); writeItems(all);
      return json(res, 200, item);
    }
    if (req.method === "PUT") {
      const id = decodeURIComponent(url.slice("/api/items/".length));
      const b = await readBody(req);
      const all = readItems(), it = all.find(i => i.id === id);
      if (!it) return json(res, 404, { error: "Not found." });
      const name = String(b.name || "").trim().slice(0, 100);
      if (!name) return json(res, 400, { error: "Item name is required." });
      it.name = name;
      it.cat = CATS.includes(b.cat) ? b.cat : it.cat;
      it.wt = String(b.wt || "").trim().slice(0, 60);
      if (b.img) {
        const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.img);
        if (!m) return json(res, 400, { error: "Invalid photo." });
        if (it.img) fs.unlink(path.join(UP, path.basename(it.img)), () => {});
        const ext = m[1] === "jpeg" ? "jpg" : m[1];
        const fn = it.id + "-" + Date.now() + "." + ext;
        fs.writeFileSync(path.join(UP, fn), Buffer.from(m[2], "base64"));
        it.img = "/uploads/" + fn;
      }
      writeItems(all);
      return json(res, 200, it);
    }
    if (req.method === "DELETE") {
      const id = decodeURIComponent(url.slice("/api/items/".length));
      const all = readItems(), it = all.find(i => i.id === id);
      if (!it) return json(res, 404, { error: "Not found." });
      if (it.img) fs.unlink(path.join(UP, path.basename(it.img)), () => {});
      writeItems(all.filter(i => i.id !== id));
      return json(res, 200, { ok: true });
    }
  }
  json(res, 404, { error: "Not found." });
}

function serve(res, file, cache) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": cache, "X-Content-Type-Options": "nosniff" });
    res.end(buf);
  });
}

http.createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  try {
    if (url.startsWith("/api/")) return await api(req, res, req.url.split("?")[0]);
    if (url.startsWith("/uploads/")) return serve(res, path.join(UP, path.basename(url)), "public, max-age=86400");
    const f = path.normalize(path.join(PUB, url === "/" ? "index.html" : url));
    if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
    serve(res, f, "no-cache");
  } catch (e) { json(res, 400, { error: e.message }); }
}).listen(PORT, () => console.log("Shanti Jewellers running at http://localhost:" + PORT));
