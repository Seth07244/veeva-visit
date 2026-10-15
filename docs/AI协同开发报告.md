# AI 协同开发报告

项目：访核（医药代表学术拜访管理）  
代码目录：`D:\code\veeva-visit`  
配套材料：本文、`docs/AI会话导出.md`、`docs/demo.webm`，以及仓库 git history。

## 1. 关键 Prompt 记录

实际任务入口是这一段：

> 把 `Veeva Technical Exercise, 2026.pdf` 的需求做成一个新项目。
>
> 业务是医药代表学术拜访：计划、现场签到（GPS + 进入时间）、学术沟通、签退（离开时间与停留时长）、拜访记录。
>
> 后端要设计数据库 Schema，并实现创建拜访、签到、签退、拜访记录。核心逻辑：拜访时长不足 5 分钟，或地点偏离医院 500 米以上，自动标记异常。
>
> 前端是桌面 Web。表单提交数据。签到/签退坐标由前端手工输入，模拟手机采集。做一个按产品统计月度拜访次数的看板。不要完整认证和权限。
>
> 工程上要有核心业务逻辑的单元测试，以及 `docker-compose.yaml` 一键部署。题目没写死的细节自行设计。

题目没写死的部分，在第一次提交代码时定下来，对应关系如下。

| 问题 | 决定 | 位置 |
| --- | --- | --- |
| 500 米和谁比，边界算不算异常 | 和医院基准坐标比；正好 500 米、正好 300 秒合规 | `src/compliance.js`，提交 `eee05de` |
| 签到时能不能标合规 | 人在院内只标 `pending`；签退用存下的坐标和时间重算 | 同上 |
| 医生、医院、科室怎么约束 | 医生指向医院和科室，拜访写入当时的医院和科室 | `src/schema.sql`，提交 `eee05de` |
| 原因怎么存 | JSONB 数组，不使用逗号分隔字符串 | 同上 |
| 非法月份两个接口是否一致 | 列表和看板都把 `monthRange` 的错误收成 400 | `src/routes.js`，提交 `170c12d` |
| 医院下拉改变后医生列表 | 医院变化后重建科室，再重建医生 | `public/app.js`，提交 `91f2a00` |
| 看板归哪个月 | 按计划时间的东八区月份，左闭右开 | `src/month.js`，提交 `eee05de` |

## 2. AI 纠偏案例

仓库里没有单独的纠错提交，所以不写成「先错后改」。这次最容易走偏的是签退的覆盖：覆盖的是结果，不是证据。第一版就把这条定下来，没有留下错误版本。

### 2.1 容易写错的代码

签到只算了位置，就把人在院内直接写成「合规」：

```javascript
const offsite = checkInDistanceMeters > 500;
return {
  checkInDistanceMeters,
  complianceStatus: offsite ? 'abnormal' : 'normal',
  reasons: offsite ? ['CHECK_IN_OFFSITE'] : [],
};
```

签退看起来做了覆盖，其实只重算了时长和签退坐标。签到坐标不在输入里。签到偏离过，签退回到院内、停留也够时，新算出的原因是空的，于是整段结论被写成 `normal`，`CHECK_IN_OFFSITE` 被清掉。

### 2.2 为什么难发现

三条原因一起命中的测试看不出这个问题。全程合规的测试也看不出。只有一条不对称样本会暴露：签到在院外约 800 米，签退回到医院坐标，停留 20 分钟。界面显示「合规」，库里的签到距离仍是 799.1 米。

另一头也一样。人在院内签到、还没签退，看板的「合规」已经加 1。时长还没发生，系统却提前给了结论。

### 2.3 怎么定下来

签退不许读上一次的状态或原因码。用留下的签到坐标、签退坐标和两段时间整段重算，结果覆盖状态字段。签到偏离过，重算时 `CHECK_IN_OFFSITE` 仍要命中。人在院内签到只能写 `pending`，不能写 `normal`。

### 2.4 落在仓库里

实现和测试都在提交 `eee05de`：

- 实现：`src/compliance.js` 的 `evaluateCheckIn`、`evaluateCompliance`
- 测试：`src/compliance.test.js` 的「签到只结算位置」和「签退同时核算时长和两处位置」

种子里林可拜访韩淑君、舒糖达就是这条不对称样本：签到偏离、签退在院内、停留 20 分钟，最终是 `abnormal`，原因只有 `CHECK_IN_OFFSITE`。正好 300 秒、正好 500 米的边界没有放宽。

## 3. 全程会话导出和 git 提交

会话记录在 [AI会话导出.md](./AI会话导出.md)，只包括已经进仓库的问题和决定。

下面是 `git log` 里的全部提交，从早到晚。哈希、时间和说明都以仓库为准。

| 提交 | 时间 | 说明 | 主要文件 |
| --- | --- | --- | --- |
| `eee05de` | 2026-10-14 12:49 | 把合规规则做成纯函数，方便单独验证时长和距离边界。 | `src/compliance.js`、`src/compliance.test.js`、`src/month.js`、`src/month.test.js`、`src/schema.sql`、`src/visit-rules.js`、`src/visit-rules.test.js` |
| `170c12d` | 2026-10-14 12:49 | 把计划、签到、签退和拜访记录接成一条会校验状态的接口。 | `src/routes.js`、`src/server.js`、`src/db.js`、`src/present.js`、`src/seed.js`、`package.json` |
| `91f2a00` | 2026-10-14 12:49 | 加上桌面页面，用手工坐标模拟签到签退，并按产品看月度次数。 | `public/app.js`、`public/index.html`、`public/styles.css` |
| `3e6db43` | 2026-10-14 12:49 | 用 docker compose 把 Postgres 和应用一起启动。 | `docker-compose.yaml`、`Dockerfile`、`README.md`、`.dockerignore`、`.env.example`、`.gitignore` |
| `09aa057` | 2026-10-15 19:38 | 补上与现有提交一致的报告、会话记录和演示录屏。安装过程、交付说明，以及仓库里没有对应错误版本的纠偏故事不再写入。 | `docs/AI协同开发报告.md`、`docs/AI会话导出.md`、`docs/demo.webm`、`.gitignore` |

在仓库根目录可以再核对：

```powershell
git log --oneline
git log -p --stat
```

## 4. 应用 Demo 录屏

录屏文件：[demo.webm](./demo.webm)，约 40 秒。

画面顺序：

1. 打开拜访列表，看到 2026 年 10 月的预置数据。
2. 筛选「异常」，打开何清和那次清肺安拜访，同时看到时长不足、签到偏离、签退偏离。
3. 新建一次中山医院心内科、维妥宁的拜访。
4. 用医院坐标签到。
5. 签退改成签到后 3 分钟，并把坐标向北偏移约 800 米。
6. 页面标成异常，原因是时长不足和签退偏离。
7. 提交学术内容和文献复印件。
8. 打开月度看板，按产品看到次数、合规和异常。

播放可以用浏览器直接打开该文件，或用 VLC。
