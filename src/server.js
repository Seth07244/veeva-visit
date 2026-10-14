import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb, pool } from './db.js';
import { registerRoutes } from './routes.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
registerRoutes(app, pool);

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
app.use(express.static(publicDir));

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    res.status(400).json({ error: '请求体不是有效的 JSON' });
    return;
  }
  if (err.status) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

const port = Number(process.env.PORT || 8090);

initDb()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`访核已启动 http://127.0.0.1:${port}`);
    });
  })
  .catch((error) => {
    console.error('启动失败', error);
    process.exit(1);
  });
