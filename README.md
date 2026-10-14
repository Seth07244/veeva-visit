# 访核

医药代表学术拜访管理。代表预约医生，到院签到，完成学术沟通后签退，再补谈话要点和资料派发情况。签退时系统核算这次拜访是否合规。

产品名称是练习用的虚构药品，不对应真实品种。

## 合规规则

签退时同时检查三件事：

- 停留时长 **少于 5 分钟**
- 签到坐标距医院基准点 **超过 500 米**
- 签退坐标距医院基准点 **超过 500 米**

任一成立即标为异常，可以同时记下多条原因。正好 5 分钟、正好 500 米仍算合规。距离用球面距离（地球半径 6371 公里）。

签到时如果人已经不在医院范围内，会先标成异常；人在范围内则保持「待核算」，因为时长还不知道。签退会按上面三条重新结算，不以签到时的临时结果为准。

月度看板把拜访计进 **计划时间** 所在月份（东八区，左闭右开）。已完成指状态为已签退或已提交记录。

## 启动

需要 Docker Desktop。

```powershell
cd D:\code\veeva-visit
docker compose up --build
```

浏览器打开 http://127.0.0.1:8090

数据库映射在本机 `54329` 端口，账号密码都是 `veeva`，库名 `veeva_visit`。要清空演示数据重新灌入：

```powershell
docker compose down -v
docker compose up --build
```

只跑测试，不需要数据库：

```powershell
npm install
npm test
```

只想本机起服务、数据库仍用容器：

```powershell
docker compose up db -d
npm start
```

## 页面

- **拜访**：列表可按状态和合规结果筛选。点「处理」进入这一次拜访。
- **新建拜访**：选代表、医院、科室、医生、产品和计划时间。
- **签到 / 签退**：纬度经度手工输入，用来模拟手机定位。可以一键填入医院坐标，或向北偏移约 800 米。签退时间可以改成签到后 20 分钟或 3 分钟。
- **学术沟通与记录**：学术内容、谈话要点、医生反馈、是否派发文献复印件。
- **月度看板**：按产品看当月计划、完成、合规和异常次数。

预置了 2026 年 10 月的样本，里面有合规拜访、时长不足、签到偏离、签到签退都偏离，以及尚未签退、尚未写记录的拜访。

## 接口

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/api/meta` | 代表、医院、科室、医生、产品和规则阈值 |
| GET | `/api/visits` | 拜访列表。可选 `month`、`status`、`compliance`、`productId` |
| POST | `/api/visits` | 创建拜访计划 |
| GET | `/api/visits/:id` | 拜访详情 |
| POST | `/api/visits/:id/check-in` | 签到。`latitude`、`longitude`，可选 `checkedInAt` |
| POST | `/api/visits/:id/check-out` | 签退。`latitude`、`longitude`，可选 `checkedOutAt` |
| POST | `/api/visits/:id/report` | 提交拜访记录 |
| GET | `/api/dashboard?month=2026-10` | 按产品统计该月拜访 |

创建拜访示例：

```json
{
  "repId": 1,
  "hcpId": 1,
  "productId": 1,
  "plannedAt": "2026-10-21T09:30:00+08:00",
  "objective": "沟通最新临床数据"
}
```

状态只能按 `planned → checked_in → checked_out → reported` 向前走。

## 代码

- `src/schema.sql`：表结构
- `src/compliance.js`：距离、时长和异常判定
- `src/visit-rules.js`：状态流转和表单校验
- `src/month.js`：看板月份边界
- `src/*.test.js`：上面三块的单元测试
- `public/`：桌面端页面

按练习要求，没有做登录和权限。

## 练习交付物

- [AI 协同开发报告](docs/AI协同开发报告.md)：关键 Prompt、纠偏案例
- [全程会话导出](docs/AI会话导出.md)
- [Demo 录屏](docs/demo.webm)
- git history：在仓库根目录执行 `git log`
