const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const net = require("node:net");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

let serverProc = null;
let port = null;

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
  const win = new BrowserWindow({
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
  win.loadURL(`http://127.0.0.1:${port}`);
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(async () => {
  app.setName("Edituh");
  const ok = await startServer();
  if (!ok) return;
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProc) {
    serverProc.kill();
    serverProc = null;
  }
});