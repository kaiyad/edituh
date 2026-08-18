const { app, BrowserWindow, clipboard, dialog, Menu, nativeImage, Notification, shell, Tray } = require("electron");
const { spawn } = require("node:child_process");
const net = require("node:net");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

let serverProc = null;
let port = null;
let mainWindow = null;
let tray = null;

function apiUrl(p) {
  return `http://127.0.0.1:${port}${p}`;
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 4000 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
  });
}

function todayTitle() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function findDocIdByTitle(title) {
  try {
    const { documents } = await httpGetJson(apiUrl("/api/docs"));
    const t = title.trim().toLowerCase();
    const found = (documents || []).find((doc) => String(doc.title || "").trim().toLowerCase() === t);
    return found ? found.id : null;
  } catch {
    return null;
  }
}

async function createDoc(title) {
  const res = await fetch(apiUrl("/api/docs"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("create failed");
  return (await res.json()).id;
}

async function appendBlocks(docId, blocks) {
  const res = await fetch(apiUrl(`/api/docs/${docId}`));
  if (!res.ok) throw new Error("fetch doc failed");
  const { doc } = await res.json();
  doc.blocks = doc.blocks.concat(blocks);
  await fetch(apiUrl(`/api/docs/${docId}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc }),
  });
}

async function todayDocId() {
  const title = todayTitle();
  const existing = await findDocIdByTitle(title);
  return existing || createDoc(title);
}

function openInWindow(urlPath) {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.loadURL(apiUrl(urlPath));
}

async function captureClipboardImage() {
  try {
    const image = clipboard.readImage();
    if (image.isEmpty()) {
      new Notification({ title: "Edituh", body: "Clipboard contains no image." }).show();
      return;
    }
    const png = image.toPNG();
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), `clipboard-${Date.now()}.png`);
    const res = await fetch(apiUrl("/api/media"), { method: "POST", body: form });
    if (!res.ok) throw new Error("upload failed");
    const { url } = await res.json();
    const id = await todayDocId();
    await appendBlocks(id, [{ id: null, type: "image", data: { src: url, caption: "" } }]);
    new Notification({ title: "Edituh", body: "Clipboard image added to today's note." }).show();
    openInWindow(`#/doc/${encodeURIComponent(todayTitle())}`);
  } catch (err) {
    new Notification({ title: "Edituh", body: `Capture failed: ${err.message}` }).show();
  }
}

function rebuildTrayMenu() {
  if (!tray) return;
  const recent = [];
  httpGetJson(apiUrl("/api/docs"))
    .then(({ documents }) => {
      const items = (documents || []).slice(0, 8).map((doc) => ({
        label: `${doc.title || "Untitled"}`,
        click: () => openInWindow(`#/doc/${encodeURIComponent(doc.title || "Untitled")}`),
      }));
      const menu = Menu.buildFromTemplate([
        { label: "Open Edituh", click: () => openInWindow("") },
        { type: "separator" },
        { label: "Open today's note", click: () => openInWindow(`#/doc/${encodeURIComponent(todayTitle())}`) },
        { label: "Quick capture", click: () => openInWindow("#/capture") },
        { label: "Paste clipboard image → today's note", click: () => captureClipboardImage() },
        { type: "separator" },
        { label: "Recent pages", enabled: false },
        ...items,
        { type: "separator" },
        { label: "Quit Edituh", role: "quit" },
      ]);
      tray.setContextMenu(menu);
      tray.setToolTip(`Edituh — ${documents ? documents.length : 0} pages`);
    })
    .catch(() => {});
}

function createTray() {
  let icon = null;
  const dev = !!process.env.EDITUH_DEV;
  const candidates = [
    path.join(process.resourcesPath, "icon.png"),
    path.join(__dirname, dev ? "build" : "build", "icon.png"),
    path.join(__dirname, "..", "web", "public", "icons", "icon-192.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      icon = nativeImage.createFromPath(p);
      if (!icon.isEmpty()) break;
    }
  }
  if (!icon || icon.isEmpty()) icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  rebuildTrayMenu();
  tray.on("click", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  setInterval(rebuildTrayMenu, 30000);
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const found = srv.address().port;
      srv.close(() => resolve(found));
    });
  });
}

function waitForHealth(targetPort, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err) => {
      if (!settled) {
        settled = true;
        err ? reject(err) : resolve();
      }
    };
    const tick = () => {
      const req = http.get({ host: "127.0.0.1", port: targetPort, path: "/api/health", timeout: 1500 }, (res) => {
        res.resume();
        if (res.statusCode === 200) return done();
        retry();
      });
      req.on("error", retry);
      req.on("timeout", () => req.destroy());
    };
    const retry = () => {
      if (Date.now() > deadline) return done(new Error("Server did not start in time"));
      setTimeout(tick, 250);
    };
    tick();
  });
}

function resolvePaths() {
  const dev = !!process.env.EDITUH_DEV;
  const root = dev ? path.join(__dirname, "..") : process.resourcesPath;
  const exe = process.platform === "win32" ? "edituh-server.exe" : "edituh-server";
  return {
    dev,
    serverBin: path.join(root, dev ? "server-bin" : "server", exe),
    staticDir: path.join(root, dev ? "web" : "", "dist"),
  };
}

async function startServer() {
  const { dev, serverBin, staticDir } = resolvePaths();
  port = await findFreePort();

  const args = ["--port", String(port), "--host", "127.0.0.1"];
  const stdio = { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] };

  if (dev && !fs.existsSync(serverBin)) {
    serverProc = spawn(
      "uv",
      ["run", "python", "server.py", ...args, ...(fs.existsSync(staticDir) ? ["--static-dir", staticDir] : ["--no-static"])],
      { ...stdio, cwd: path.join(__dirname, "..") }
    );
  } else {
    if (!fs.existsSync(serverBin)) {
      dialog.showErrorBox(
        "Edituh",
        `Server binary not found:\n${serverBin}\n\nRun \`npm run build:server\` inside desktop/ first.`
      );
      app.quit();
      return false;
    }
    serverProc = spawn(serverBin, [...args, ...(fs.existsSync(staticDir) ? ["--static-dir", staticDir] : ["--no-static"])], stdio);
  }

  serverProc.on("error", (err) => {
    dialog.showErrorBox("Edituh", `Failed to start the editor server:\n${err.message}`);
    app.quit();
  });
  serverProc.stderr.on("data", (d) => console.error("[server]", String(d).trim()));
  serverProc.on("exit", (code) => {
    if (code !== 0) console.error("[server] exited with code", code);
  });

  try {
    await waitForHealth(port);
  } catch (err) {
    dialog.showErrorBox("Edituh", `Could not reach the editor server:\n${err.message}`);
    app.quit();
    return false;
  }
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    title: "Edituh",
    backgroundColor: "#0e1117",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadURL(`http://127.0.0.1:${port}`);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  app.setName("Edituh");
  const ok = await startServer();
  if (!ok) return;
  createTray();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // keep running in the tray
});

app.on("before-quit", () => {
  if (serverProc) {
    serverProc.kill();
    serverProc = null;
  }
});