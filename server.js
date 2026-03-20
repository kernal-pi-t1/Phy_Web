import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const PORT = process.env.PORT || 4173;
const PUBLIC_DIR = join(process.cwd(), "public");
const OUTPUT_DIR = join(process.cwd(), "output");

mkdirSync(OUTPUT_DIR, { recursive: true });

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function generateRequestId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const token = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `RET-${y}${m}${d}-${token}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // POST /api/returns — 반품 접수 + ROS용 JSON 파일 생성
  if (req.method === "POST" && url.pathname === "/api/returns") {
    try {
      const body = await readBody(req);
      const objectName = (body.object_name || "").trim();
      const returnReason = (body.return_reason || "").trim();

      if (!objectName || objectName.length < 2) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "object_name은 2자 이상이어야 합니다." }));
        return;
      }
      if (!returnReason || returnReason.length < 10) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "return_reason은 10자 이상이어야 합니다." }));
        return;
      }

      const requestId = generateRequestId();
      const now = new Date().toISOString();

      // ROS용 JSON payload (SPEC 9.2 기반)
      const rosPayload = {
        request_id: requestId,
        object_name: objectName,
        return_reason: returnReason,
        created_at: now,
        robot_status: "PENDING",
        final_decision: null,
        decision_reason: null,
        confidence: null,
        judge_note: null,
        error_code: null,
      };

      // output/ 디렉토리에 JSON 파일 저장
      const filePath = join(OUTPUT_DIR, `${requestId}.json`);
      writeFileSync(filePath, JSON.stringify(rosPayload, null, 2), "utf-8");
      console.log(`[ROS Output] ${filePath}`);

      // 클라이언트 응답
      const response = {
        request_id: requestId,
        status: "RECEIVED",
        message: "반품 요청이 접수되었습니다.",
        created_at: now,
        output_file: `output/${requestId}.json`,
      };

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "잘못된 요청입니다." }));
    }
    return;
  }

  // 정적 파일 서빙
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, safePath);

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
  createReadStream(join(PUBLIC_DIR, "index.html")).pipe(res);
});

server.listen(PORT, () => {
  console.log(`ReturnFlow dev server running at http://localhost:${PORT}`);
});
