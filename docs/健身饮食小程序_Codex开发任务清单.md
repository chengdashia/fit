# 健身与饮食记录微信小程序  
# Codex 可执行开发任务清单

## 0. 项目技术栈约定

### 前端

- 微信小程序原生开发
- WXML + WXSS + JavaScript
- 使用微信小程序原生路由和生命周期
- 不引入复杂前端框架

### 后端

- 本机conda 的 gym 环境中的Python 3.11+
- FastAPI
- SQLAlchemy
- Pydantic
- MySQL
- JWT 登录态
- Alembic 可选，用于数据库迁移

### 数据库

- MySQL 8.x
- 所有业务表使用 `user_id` 做用户隔离
- 所有表包含 `created_at`、`updated_at`
- 删除类操作优先软删除

---

# 第一阶段：项目基础框架

## Task 1：初始化 FastAPI 后端项目结构

### 目标

创建 FastAPI 后端基础项目结构，为后续接口开发做准备。

### 需要创建目录

```text
backend/
  app/
    main.py
    api/
    core/
    models/
    schemas/
    services/
    repositories/
    adapters/
    utils/
  requirements.txt
  README.md
```

### 具体要求

1. 创建 FastAPI 应用入口 `app/main.py`。
2. 配置 CORS。
3. 创建统一健康检查接口：

```http
GET /api/health
```

返回：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "status": "ok"
  }
}
```

4. 创建统一响应格式工具。
5. 创建统一异常处理。

### 验收标准

1. 可以启动 FastAPI 服务。
2. 访问 `/api/health` 返回成功。
3. 项目目录结构清晰。
4. 后续模块可以直接在 `api/services/models/schemas` 中扩展。

---

## Task 2：配置 MySQL 数据库连接

### 目标

完成 FastAPI 与 MySQL 的连接配置。

### 需要实现

1. `app/core/config.py`
2. `app/core/database.py`

### 具体要求

1. 使用 SQLAlchemy 连接 MySQL。
2. 数据库连接信息从环境变量读取：

```text
MYSQL_HOST
MYSQL_PORT
MYSQL_USER
MYSQL_PASSWORD
MYSQL_DATABASE
```

3. 创建数据库 Session 依赖：

```python
get_db()
```

4. 所有后续接口可以通过依赖注入获取数据库会话。

### 验收标准

1. 后端启动时不报数据库连接错误。
2. 可以通过 SQLAlchemy 创建表。
3. 接口中可以正常获取数据库 session。

---

## Task 3：初始化微信小程序前端项目结构

### 目标

创建微信小程序前端基础目录。

### 需要创建目录

```text
miniprogram/
  app.js
  app.json
  app.wxss
  utils/
    request.js
    auth.js
    time.js
  pages/
    login/
    onboarding/
    home/
    diet/
    diet-record/
    diet-result/
    food-search/
    frequent-food/
    custom-food/
    weight/
    training/
    training-template-edit/
    training-session/
    training-rest/
    training-history/
    profile/
```

### 具体要求

1. 配置 `app.json` 页面路由。
2. 封装请求工具 `utils/request.js`。
3. 请求工具自动携带 token。
4. 请求失败时统一 toast 提示。
5. 配置基础全局样式。

### 验收标准

1. 小程序可以启动。
2. 首页路由可以正常打开。
3. 请求工具可以调用后端 `/api/health`。
4. token 可以从本地缓存读取并放入请求头。

---

# 第二阶段：用户登录与目标设置

## Task 4：创建用户相关数据库模型

### 目标

实现用户账户、用户资料、用户目标三张表。

### 需要创建模型

1. `user_account`
2. `user_profile`
3. `user_goal`

### 字段要求

#### user_account

```text
id
user_id
openid
unionid
status
last_login_at
created_at
updated_at
```

#### user_profile

```text
id
user_id
nickname
avatar_url
gender
birth_year
height_cm
current_weight_kg
created_at
updated_at
```

#### user_goal

```text
id
user_id
goal_stage
calorie_target
protein_target
target_weight_kg
goal_status
created_at
updated_at
```

### 验收标准

1. 数据库中成功生成三张表。
2. `openid` 唯一。
3. `user_id` 可用于关联所有业务数据。
4. `user_goal` 支持 `fat_loss` 和 `muscle_gain`。

---

## Task 5：实现微信登录接口

### 接口

```http
POST /api/auth/wechat-login
```

### 请求

```json
{
  "code": "微信登录code"
}
```

### 返回

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "token": "jwt_token",
    "user_id": "user_id",
    "has_goal": true,
    "has_profile": true
  }
}
```

### 具体要求

1. 接收小程序传来的 `code`。
2. 调用微信登录换取 `openid`。
3. 如果当前 `openid` 不存在，创建用户。
4. 如果用户已存在，更新 `last_login_at`。
5. 生成 JWT token。
6. 返回是否已经设置目标。

### MVP 简化要求

开发阶段如果没有微信 appid 和 secret，可以先 mock openid，但代码结构必须预留真实微信登录逻辑。

### 验收标准

1. 首次登录可创建用户。
2. 再次登录不会重复创建用户。
3. 返回 token。
4. 后续接口可通过 token 识别当前用户。

---

## Task 6：实现登录鉴权依赖

### 目标

所有业务接口通过 token 获取当前用户。

### 需要实现

1. JWT 生成函数。
2. JWT 解析函数。
3. FastAPI 依赖：

```python
get_current_user()
```

### 具体要求

1. 从请求头读取：

```text
Authorization: Bearer <token>
```

2. 解析 token 得到 `user_id`。
3. 查询用户状态。
4. 用户不存在或 token 无效时返回 401。

### 验收标准

1. 未登录访问业务接口返回 401。
2. token 有效时可以获取当前用户。
3. 接口不信任前端传入的 `user_id`。

---

## Task 7：实现用户基础信息接口

### 接口

```http
GET /api/user/profile
PUT /api/user/profile
```

### PUT 请求示例

```json
{
  "nickname": "Geekey",
  "avatar_url": "",
  "gender": "unknown",
  "birth_year": 1995,
  "height_cm": 175,
  "current_weight_kg": 75.6
}
```

### 具体要求

1. 查询当前用户资料。
2. 如果用户资料不存在，返回空字段。
3. 更新资料时自动创建或更新。
4. 字段校验：
   - height_cm 范围 100–250
   - current_weight_kg 范围 20–300
   - birth_year 不允许大于当前年份

### 验收标准

1. 用户可以保存个人资料。
2. 用户只能访问自己的资料。
3. 非法字段返回参数错误。

---

## Task 8：实现目标设置接口

### 接口

```http
GET /api/user/goal
PUT /api/user/goal
```

### PUT 请求示例

```json
{
  "goal_stage": "fat_loss",
  "calorie_target": 1800,
  "protein_target": 130,
  "target_weight_kg": 70.0,
  "sync_weight_record": true
}
```

### 具体要求

1. 每个用户 MVP 阶段只维护一个 active 目标。
2. 如果没有目标，PUT 时创建。
3. 如果已有目标，PUT 时更新。
4. 校验：
   - `goal_stage` 只能是 `fat_loss` 或 `muscle_gain`
   - `calorie_target` 范围 800–6000
   - `protein_target` 范围 20–400
   - `target_weight_kg` 范围 20–300
5. 如果 `sync_weight_record = true` 且传入当前体重，后续可同步生成体重记录；MVP 可以预留字段。

### 验收标准

1. 用户可以创建目标。
2. 用户可以修改目标。
3. 首页可读取目标。
4. 修改目标不影响历史记录。

---

## Task 9：实现小程序登录与首次目标设置页面

### 页面

```text
pages/login
pages/onboarding
```

### 登录流程

1. 小程序启动。
2. 调用 `wx.login` 获取 code。
3. 调用后端 `/api/auth/wechat-login`。
4. 保存 token。
5. 判断 `has_goal`：
   - false：跳转目标设置页；
   - true：跳转首页。

### 目标设置页字段

1. 当前阶段：减脂 / 增肌；
2. 当前体重；
3. 目标体重；
4. 每日热量目标；
5. 每日蛋白质目标；
6. 身高，可选；
7. 性别，可选；
8. 出生年份，可选。

### 验收标准

1. 首次用户进入目标设置页。
2. 目标设置完成后进入首页。
3. 已设置目标的用户直接进入首页。
4. token 正确保存到本地。

---

# 第三阶段：首页看板

## Task 10：实现首页聚合接口

### 接口

```http
GET /api/home/dashboard?date=2026-07-05
```

### 返回结构

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "date": "2026-07-05",
    "goal": {
      "goal_stage": "fat_loss",
      "calorie_target": 1800,
      "protein_target": 130,
      "target_weight_kg": 70.0
    },
    "diet_summary": {
      "calorie_intake": 0,
      "protein_intake": 0,
      "carb_intake": 0,
      "fat_intake": 0
    },
    "training_summary": {
      "today_status": "not_started",
      "weekly_training_count": 0,
      "unfinished_session_id": null
    },
    "weight_summary": {
      "latest_weight_kg": null,
      "latest_record_time": null,
      "target_diff_kg": null
    }
  }
}
```

### 统计规则

1. 饮食只统计 `meal_record.status = confirmed`。
2. 训练状态根据当天训练会话判断。
3. 本周训练次数统计 `completed` 和 `interrupted_saved`。
4. 体重优先取当天最新，其次取历史最新。
5. 所有数据只统计当前用户。

### 验收标准

1. 未记录数据时返回默认空状态。
2. 有饮食记录时正确统计热量和蛋白质。
3. 有体重记录时返回最新体重。
4. 有未完成训练时返回 `unfinished_session_id`。
5. 首页只需要调用这一个接口即可展示核心数据。

---

## Task 11：实现微信小程序首页页面

### 页面

```text
pages/home
```

### 首页组件

1. 今日饮食卡片；
2. 今日训练卡片；
3. 体重卡片；
4. 快捷操作区。

### 饮食卡片展示

1. 今日热量 / 目标热量；
2. 剩余或超出热量；
3. 今日蛋白质 / 蛋白质目标；
4. 蛋白质还差多少；
5. 按钮：记录饮食。

### 训练卡片展示

1. 今日训练状态；
2. 本周训练次数；
3. 按钮：
   - 开始训练；
   - 继续训练；
   - 查看训练记录。

### 体重卡片展示

1. 最新体重；
2. 目标体重；
3. 距离目标；
4. 按钮：记录体重。

### 具体要求

1. 页面 `onShow` 时调用首页聚合接口。
2. 点击“记录饮食”跳转饮食记录页。
3. 点击“开始训练”跳转训练模板页。
4. 点击“记录体重”打开体重记录页或弹窗。
5. 如果存在未完成训练，点击训练卡片展示处理弹窗。

### 验收标准

1. 首页可以正常加载。
2. 页面返回首页时自动刷新数据。
3. 三个快捷入口都可跳转。
4. 空状态展示正确。

---

# 第四阶段：饮食模块

## Task 12：创建饮食相关数据库模型

### 表

1. `meal_record`
2. `meal_food_item`
3. `frequent_food`
4. `food_database`

### 具体要求

按前文数据库字段创建模型。

### 关键枚举

#### meal_type

```text
breakfast
lunch
dinner
snack
```

#### source_type

```text
photo_ai
manual_search
frequent_food
custom
```

#### meal_record.status

```text
draft
confirmed
revoked
deleted
```

### 验收标准

1. 表结构创建成功。
2. 饮食记录支持一条主记录多条明细。
3. 所有表带 `user_id`。
4. 删除使用软删除。

---

## Task 13：实现食物搜索接口

### 接口

```http
GET /api/diet/foods/search?keyword=鸡胸肉
```

### 搜索范围

1. 标准食物库 `food_database`；
2. 当前用户常吃食物 `frequent_food`。

### 返回字段

```json
{
  "list": [
    {
      "id": "food_id",
      "food_name": "鸡胸肉",
      "category": "肉类",
      "calorie_per_100g": 165,
      "protein_per_100g": 31,
      "carb_per_100g": 0,
      "fat_per_100g": 3.6,
      "source": "standard_db"
    }
  ]
}
```

### 验收标准

1. 输入关键词可搜索标准库。
2. 可搜索当前用户常吃食物。
3. 不返回其他用户常吃食物。
4. 无结果时返回空列表。

---

## Task 14：实现 AI 食物识别适配接口

### 接口

```http
POST /api/diet/recognize
```

### 目标

先完成接口结构，AI 服务可 mock。

### 请求

multipart/form-data：

```text
image_file
meal_type
record_time
```

### 返回成功示例

```json
{
  "recognize_id": "rec_xxx",
  "status": "success",
  "candidates": [
    {
      "food_name": "米饭",
      "portion_desc": "1碗",
      "weight_g": 180,
      "calorie": 210,
      "protein": 4,
      "carb": 46,
      "fat": 0.5,
      "confidence": 0.86
    }
  ]
}
```

### 返回失败示例

```json
{
  "recognize_id": "rec_xxx",
  "status": "failed",
  "candidates": [],
  "message": "识别失败"
}
```

### 具体要求

1. 后端接收图片。
2. 图片仅临时处理，不长期保存。
3. 创建 `FoodRecognitionAdapter`。
4. MVP 阶段可以返回 mock 数据。
5. 接口失败时前端进入兜底流程。

### 验收标准

1. 前端可以上传图片。
2. 后端可以返回结构化识别结果。
3. 识别失败时返回 failed。
4. 不直接生成饮食记录。

---

## Task 15：实现确认饮食记录接口

### 接口

```http
POST /api/diet/records/confirm
```

### 请求示例

```json
{
  "meal_type": "lunch",
  "record_time": "2026-07-05T12:30:00+09:00",
  "source_type": "photo_ai",
  "save_as_frequent": false,
  "food_items": [
    {
      "food_name": "米饭",
      "portion_desc": "1碗",
      "weight_g": 180,
      "calorie": 210,
      "protein": 4,
      "carb": 46,
      "fat": 0.5
    }
  ]
}
```

### 后端逻辑

1. 获取当前用户。
2. 创建 `meal_record`。
3. 创建多条 `meal_food_item`。
4. 汇总总热量、蛋白质、碳水、脂肪。
5. `meal_record.status = confirmed`。
6. 如果 `save_as_frequent = true`，创建常吃食物。
7. 返回本次记录汇总和今日累计数据。

### 验收标准

1. 可以保存一条饮食记录。
2. 可以保存多个食物明细。
3. 汇总字段计算正确。
4. 首页饮食统计更新。
5. 未确认的识别结果不计入统计。

---

## Task 16：实现查询某日饮食记录接口

### 接口

```http
GET /api/diet/records?date=2026-07-05
```

### 返回内容

1. 日期；
2. 当日总热量；
3. 当日总蛋白质；
4. 当日总碳水；
5. 当日总脂肪；
6. 按早餐、午餐、晚餐、加餐分组的记录。

### 验收标准

1. 只返回当前用户数据。
2. 不返回 deleted / revoked / draft。
3. 餐次分组正确。
4. 总营养统计正确。

---

## Task 17：实现饮食编辑、删除、撤销接口

### 接口

```http
PUT /api/diet/records/{record_id}
DELETE /api/diet/records/{record_id}
POST /api/diet/records/{record_id}/revoke
```

### 编辑要求

1. 可修改餐次。
2. 可修改记录时间。
3. 可修改食物明细。
4. 修改后重新计算总营养。

### 删除要求

1. 设置 `status = deleted`。
2. 不参与统计。

### 撤销要求

1. 设置 `status = revoked`。
2. 不参与统计。
3. 用于最近一次记录。

### 验收标准

1. 编辑后首页统计更新。
2. 删除后首页统计更新。
3. 撤销后首页统计更新。
4. 不能操作其他用户记录。

---

## Task 18：实现常吃食物接口

### 接口

```http
GET /api/diet/frequent-foods
POST /api/diet/frequent-foods
DELETE /api/diet/frequent-foods/{food_id}
```

### 具体要求

1. 查询当前用户常吃食物。
2. 新增常吃食物。
3. 删除常吃食物时软删除。
4. 常吃食物只对当前用户可见。

### 验收标准

1. 用户可以创建常吃食物。
2. 用户可以删除常吃食物。
3. 饮食记录页可以选择常吃食物。
4. 不返回其他用户数据。

---

## Task 19：实现小程序饮食记录页面

### 页面

```text
pages/diet
pages/diet-record
pages/diet-result
pages/food-search
pages/frequent-food
pages/custom-food
```

### 需要实现

#### diet 页面

1. 日期切换；
2. 今日汇总；
3. 餐次分组；
4. 记录饮食按钮。

#### diet-record 页面

选择记录方式：

1. 拍照识别；
2. 手动搜索；
3. 常吃食物；
4. 自定义食物。

#### diet-result 页面

展示 AI 识别结果：

1. 食物列表；
2. 编辑；
3. 删除；
4. 保存为常吃；
5. 确认记录。

#### food-search 页面

1. 搜索食物；
2. 选择食物；
3. 输入份量和克数；
4. 确认记录。

#### frequent-food 页面

1. 常吃食物列表；
2. 选择常吃食物；
3. 修改份量；
4. 确认记录。

#### custom-food 页面

1. 输入食物名称；
2. 输入克数；
3. 输入热量；
4. 输入蛋白质、碳水、脂肪；
5. 可保存为常吃；
6. 确认记录。

### 验收标准

1. 拍照识别流程可跑通。
2. 手动搜索流程可跑通。
3. 常吃食物流程可跑通。
4. 自定义食物流程可跑通。
5. 确认记录后首页更新。
6. 用户可以编辑、删除、撤销记录。

---

# 第五阶段：体重模块

## Task 20：创建体重记录数据库模型

### 表

```text
weight_record
```

### 字段

```text
id
user_id
weight_kg
record_time
record_date
note
status
created_at
updated_at
```

### 验收标准

1. 表创建成功。
2. 支持同一天多条记录。
3. 支持软删除。

---

## Task 21：实现体重记录接口

### 接口

```http
POST /api/weight/records
GET /api/weight/records
PUT /api/weight/records/{record_id}
DELETE /api/weight/records/{record_id}
```

### 新增请求

```json
{
  "weight_kg": 75.6,
  "record_time": "2026-07-05T08:10:00+09:00",
  "note": "早晨空腹"
}
```

### 校验规则

1. 体重范围 20–300kg。
2. 最多一位小数。
3. 不允许未来时间。

### 验收标准

1. 用户可以新增体重。
2. 用户可以编辑体重。
3. 用户可以删除体重。
4. 同一天可多次记录。
5. 不能访问其他用户体重记录。

---

## Task 22：实现体重趋势接口

### 接口

```http
GET /api/weight/trend?range=7d
GET /api/weight/trend?range=30d
```

### 统计规则

1. 查询当前用户体重记录。
2. 每天取最新一条。
3. 无记录日期不补点。
4. deleted 不参与统计。

### 返回示例

```json
{
  "range": "7d",
  "points": [
    {
      "date": "2026-07-05",
      "weight_kg": 75.6,
      "record_time": "2026-07-05T08:10:00+09:00"
    }
  ]
}
```

### 验收标准

1. 7 天趋势正确。
2. 30 天趋势正确。
3. 同一天多条记录取最新。
4. 删除记录后趋势重新计算。

---

## Task 23：实现小程序体重页面

### 页面

```text
pages/weight
```

### 页面组件

1. 最新体重卡片；
2. 目标体重；
3. 距离目标；
4. 7 天趋势；
5. 30 天趋势；
6. 历史列表；
7. 记录体重按钮。

### 新增体重弹窗

字段：

1. 体重；
2. 日期；
3. 时间；
4. 备注。

### 验收标准

1. 可以新增体重。
2. 可以编辑体重。
3. 可以删除体重。
4. 首页显示最新体重。
5. 趋势图或趋势列表展示正确。

---

# 第六阶段：训练模板模块

## Task 24：创建训练模板数据库模型

### 表

1. `training_template`
2. `training_template_unit`

### training_template 字段

```text
id
user_id
template_name
description
goal_type
status
created_at
updated_at
```

### training_template_unit 字段

```text
id
template_id
user_id
unit_type
unit_name
sort_order
config_json
created_at
updated_at
```

### 验收标准

1. 可以保存训练模板。
2. 可以保存普通动作、超级组、递减组。
3. 模板单元按 sort_order 排序。
4. 删除模板使用软删除。

---

## Task 25：实现训练模板 CRUD 接口

### 接口

```http
POST /api/training/templates
GET /api/training/templates
GET /api/training/templates/{template_id}
PUT /api/training/templates/{template_id}
DELETE /api/training/templates/{template_id}
```

### 创建模板请求示例

```json
{
  "template_name": "胸肩三头",
  "description": "推类训练",
  "goal_type": "muscle_gain",
  "units": [
    {
      "unit_type": "normal",
      "unit_name": "卧推",
      "sort_order": 1,
      "config": {
        "exercise_name": "卧推",
        "sets": [
          {
            "set_index": 1,
            "target_weight": 60,
            "target_reps": 12,
            "target_rest_seconds": 180
          },
          {
            "set_index": 2,
            "target_weight": 70,
            "target_reps": 10,
            "target_rest_seconds": 180
          }
        ]
      }
    }
  ]
}
```

### 验收标准

1. 可以创建普通动作模板。
2. 可以创建超级组模板。
3. 可以创建递减组模板。
4. 可以编辑模板。
5. 可以删除模板。
6. 删除模板不影响历史训练记录。

---

## Task 26：实现小程序训练模板列表页

### 页面

```text
pages/training
```

### 页面组件

1. 模板列表；
2. 创建模板按钮；
3. 复制上次训练按钮；
4. 每个模板展示：
   - 模板名称；
   - 最近使用时间；
   - 开始训练；
   - 编辑；
   - 复制；
   - 删除。

### 验收标准

1. 可以查看模板列表。
2. 可以进入创建模板页。
3. 可以点击开始训练。
4. 可以编辑、复制、删除模板。

---

## Task 27：实现训练模板编辑页

### 页面

```text
pages/training-template-edit
```

### 需要支持

1. 输入模板名称；
2. 添加普通动作；
3. 添加超级组；
4. 添加递减组；
5. 调整训练单元顺序；
6. 保存模板。

### 普通动作编辑

1. 动作名称；
2. 多组；
3. 每组重量；
4. 每组次数；
5. 每组休息时间。

### 超级组编辑

1. 超级组名称；
2. 轮数；
3. 动作列表；
4. 每个动作重量和次数；
5. 统一休息时间。

### 递减组编辑

1. 动作名称；
2. 轮数；
3. 重量段列表；
4. 每段重量和次数；
5. 每轮休息时间。

### 验收标准

1. 可以创建三种训练单元。
2. 保存后后端数据结构正确。
3. 编辑模板后再次打开数据正确回显。

---

# 第七阶段：训练执行模块

## Task 28：创建训练执行相关数据库模型

### 表

1. `training_session`
2. `training_session_unit`
3. `training_session_item`
4. `training_rest_record`

### 具体要求

按前文定义创建字段和枚举。

### 验收标准

1. 可以创建训练会话。
2. 可以保存训练快照单元。
3. 可以保存训练执行项。
4. 可以保存休息记录。

---

## Task 29：实现开始训练接口

### 接口

```http
POST /api/training/sessions/start
```

### 请求

```json
{
  "template_id": "template_id",
  "start_time": "2026-07-05T18:00:00+09:00"
}
```

### 后端逻辑

1. 检查当前用户是否存在未完成训练。
2. 查询模板。
3. 创建 `training_session`。
4. 复制模板单元到 `training_session_unit`。
5. 将模板配置拆解为 `training_session_item`。
6. 设置第一个 item 为当前项。
7. 返回 session 和当前训练项。

### 验收标准

1. 可以基于模板开始训练。
2. 训练开始后生成快照。
3. 修改模板不影响当前训练快照。
4. 返回当前训练项。

---

## Task 30：实现查询未完成训练接口

### 接口

```http
GET /api/training/sessions/unfinished
```

### 规则

未完成训练状态包括：

1. draft；
2. in_progress；
3. resting。

返回：

1. session_id；
2. session_status；
3. 当前训练项；
4. 是否休息中；
5. 休息目标结束时间。

### 验收标准

1. 存在未完成训练时返回数据。
2. 不存在时返回 null。
3. 首页可以据此展示继续训练。

---

## Task 31：实现训练会话详情接口

### 接口

```http
GET /api/training/sessions/{session_id}
```

### 用途

1. 训练执行页初始化；
2. 中断恢复；
3. 休息倒计时校准。

### 返回

1. session 基础信息；
2. units；
3. items；
4. 当前 item；
5. 当前 rest 信息。

### 验收标准

1. 可以恢复训练状态。
2. 可以判断当前是否休息中。
3. 可以根据 rest_target_end_time 校准倒计时。

---

## Task 32：实现完成当前训练项接口

### 接口

```http
POST /api/training/sessions/{session_id}/items/{item_id}/complete
```

### 请求

```json
{
  "actual_weight": 70,
  "actual_reps": 8,
  "completed_at": "2026-07-05T18:20:00+09:00"
}
```

### 后端逻辑

1. 校验当前用户和 session。
2. 更新 item：
   - actual_weight；
   - actual_reps；
   - status = completed；
   - completed_at。
3. 判断是否需要休息。
4. 如果需要休息，创建 rest_record。
5. 更新 session_status：
   - resting；
   - 或 in_progress。
6. 返回下一状态。

### 验收标准

1. 普通动作完成一组后可进入休息。
2. 超级组按动作顺序推进。
3. 递减组按重量段顺序推进。
4. 完成数据正确保存。

---

## Task 33：实现跳过训练项接口

### 接口

```http
POST /api/training/sessions/{session_id}/items/{item_id}/skip
```

### 后端逻辑

1. 设置 item.status = skipped。
2. 不删除 item。
3. 推进到下一训练项或休息状态。

### 验收标准

1. 普通组可跳过。
2. 超级组动作可跳过。
3. 递减组重量段可跳过。
4. 历史记录中保留 skipped 状态。

---

## Task 34：实现休息相关接口

### 接口

```http
POST /api/training/sessions/{session_id}/rest/start
POST /api/training/sessions/{session_id}/rest/{rest_id}/skip
POST /api/training/sessions/{session_id}/rest/{rest_id}/extend
```

### start 逻辑

1. 创建休息记录。
2. 保存 rest_start_time。
3. 保存 rest_target_end_time。
4. session_status = resting。

### skip 逻辑

1. 设置 rest_actual_end_time。
2. 计算 actual_rest_seconds。
3. end_type = skipped。
4. 进入下一训练项。

### extend 逻辑

1. 增加 rest_target_end_time。
2. end_type 可标记 extended。
3. 返回新的结束时间。

### 验收标准

1. 完成一组后能进入休息。
2. 可以跳过休息。
3. 可以延长休息。
4. 小程序重新进入后可以根据时间戳校准。

---

## Task 35：实现临时加组接口

### 接口

```http
POST /api/training/sessions/{session_id}/items/add-temp-set
```

### 请求

```json
{
  "session_unit_id": "unit_id",
  "based_on_item_id": "item_id",
  "target_weight": 75,
  "target_reps": 8,
  "target_rest_seconds": 180
}
```

### 规则

1. 仅支持普通动作。
2. 基于上一组生成新组。
3. `is_temporary_added = true`。
4. 不修改原模板。

### 验收标准

1. 训练中可以临时加组。
2. 临时加组进入当前训练记录。
3. 原模板不变化。

---

## Task 36：实现结束训练接口

### 接口

```http
POST /api/training/sessions/{session_id}/finish
```

### 请求

```json
{
  "finish_type": "completed",
  "end_time": "2026-07-05T19:20:00+09:00"
}
```

### finish_type

```text
completed
interrupted_saved
abandoned
```

### 规则

1. completed：正常完成，进入训练历史。
2. interrupted_saved：保存已完成内容，进入训练历史。
3. abandoned：放弃训练，不计入历史和统计。

### 验收标准

1. 正常完成训练保存历史。
2. 中断保存进入历史。
3. 放弃训练不进入历史。
4. 首页训练状态更新。

---

## Task 37：实现训练历史接口

### 接口

```http
GET /api/training/sessions/history
GET /api/training/sessions/{session_id}/history-detail
```

### 历史列表展示

1. 训练日期；
2. 模板名称；
3. 训练状态；
4. 训练时长；
5. 完成组数；
6. 跳过组数。

### 详情展示

1. 训练单元；
2. 动作；
3. 目标重量；
4. 实际重量；
5. 目标次数；
6. 实际次数；
7. 休息时间；
8. 跳过项；
9. 临时加组。

### 验收标准

1. 可以查询训练历史。
2. 可以查看训练详情。
3. skipped、temporary_added 状态展示正确。

---

## Task 38：实现小程序训练执行页

### 页面

```text
pages/training-session
pages/training-rest
```

### 训练执行页展示

1. 当前模板名称；
2. 当前训练单元；
3. 当前动作；
4. 当前组数或轮次；
5. 目标重量；
6. 目标次数；
7. 实际重量输入；
8. 实际次数输入；
9. 下一项预告；
10. 完成本组按钮；
11. 跳过按钮；
12. 临时加组按钮；
13. 结束训练按钮。

### 休息页展示

1. 大字号倒计时；
2. 已完成内容；
3. 下一项；
4. 跳过休息；
5. 延长休息；
6. 结束训练。

### 中断恢复

1. 页面 `onShow` 时查询 session 详情。
2. 如果休息中，根据当前时间和 `rest_target_end_time` 计算剩余时间。
3. 如果已超过结束时间，提示休息已结束。
4. 前台倒计时仅作为 UI 展示。

### 验收标准

1. 普通训练可完整执行。
2. 超级组可完整执行。
3. 递减组可完整执行。
4. 完成后自动休息。
5. 休息可跳过和延长。
6. 退出再进入可以恢复训练。

---

# 第八阶段：联调与测试

## Task 39：接口权限测试

### 目标

确保用户不能访问其他用户数据。

### 测试范围

1. 饮食记录；
2. 常吃食物；
3. 体重记录；
4. 训练模板；
5. 训练会话；
6. 用户目标。

### 验收标准

1. 使用 A 用户 token 不能访问 B 用户数据。
2. 伪造 record_id 返回无权限或数据不存在。
3. 未登录访问业务接口返回 401。

---

## Task 40：首页联动测试

### 测试场景

1. 新增饮食记录：首页热量更新。
2. 删除饮食记录：首页热量更新。
3. 新增体重：首页体重更新。
4. 删除最新体重：首页回退上一条。
5. 开始训练：首页显示进行中。
6. 完成训练：首页显示已完成。
7. 修改目标：首页按新目标展示。

### 验收标准

首页展示与后端数据一致。

---

## Task 41：饮食完整流程测试

### 测试流程

1. 拍照识别返回 mock 食物。
2. 删除一个识别结果。
3. 修改克数。
4. 确认入库。
5. 首页更新。
6. 保存为常吃。
7. 通过常吃食物再次记录。
8. 编辑记录。
9. 删除记录。
10. 撤销最近一次记录。

### 验收标准

所有流程可跑通，统计正确。

---

## Task 42：训练完整流程测试

### 测试流程

1. 创建普通动作模板。
2. 创建超级组模板。
3. 创建递减组模板。
4. 开始训练。
5. 完成普通组。
6. 自动进入休息。
7. 跳过休息。
8. 完成超级组。
9. 完成递减组。
10. 临时加组。
11. 中断退出。
12. 重新进入恢复。
13. 完成训练。
14. 查看训练历史。

### 验收标准

1. 训练流程不中断。
2. 休息倒计时正确。
3. 训练历史完整。
4. 模板修改不影响历史记录。

---

## Task 43：体重完整流程测试

### 测试流程

1. 新增体重。
2. 同一天新增第二条。
3. 首页展示当天最新。
4. 查询 7 天趋势。
5. 查询 30 天趋势。
6. 编辑体重。
7. 删除最新体重。
8. 首页回退上一条。

### 验收标准

体重数据展示和统计规则正确。

---

# 第九阶段：MVP 最终验收

## Task 44：MVP 功能验收清单

### 用户与目标

- [ ] 用户可以微信登录
- [ ] 首次登录进入目标设置
- [ ] 可设置减脂 / 增肌阶段
- [ ] 可设置每日热量目标
- [ ] 可设置每日蛋白质目标
- [ ] 可设置目标体重
- [ ] 可修改目标

### 首页

- [ ] 展示今日热量
- [ ] 展示今日蛋白质
- [ ] 展示今日训练状态
- [ ] 展示本周训练次数
- [ ] 展示最新体重
- [ ] 展示目标体重差距
- [ ] 有记录饮食入口
- [ ] 有开始训练入口
- [ ] 有记录体重入口

### 饮食

- [ ] 支持拍照识别
- [ ] 支持识别失败兜底
- [ ] 支持手动搜索
- [ ] 支持自定义食物
- [ ] 支持常吃食物
- [ ] 支持确认后入库
- [ ] 支持编辑
- [ ] 支持删除
- [ ] 支持撤销
- [ ] 首页统计同步更新

### 体重

- [ ] 支持新增体重
- [ ] 支持同一天多条
- [ ] 支持编辑
- [ ] 支持删除
- [ ] 支持 7 天趋势
- [ ] 支持 30 天趋势
- [ ] 首页展示最新体重

### 训练

- [ ] 支持创建训练模板
- [ ] 支持普通动作
- [ ] 支持超级组
- [ ] 支持递减组
- [ ] 支持开始训练生成快照
- [ ] 支持修改实际重量和次数
- [ ] 支持完成当前项
- [ ] 支持自动休息
- [ ] 支持跳过休息
- [ ] 支持延长休息
- [ ] 支持临时加组
- [ ] 支持跳过训练项
- [ ] 支持中断恢复
- [ ] 支持结束并保存
- [ ] 支持放弃训练
- [ ] 支持训练历史

---

# 第十阶段：建议投喂 Codex 的顺序

## 第 1 批

```text
请根据以下技术栈初始化 FastAPI + MySQL 后端项目结构，并实现健康检查接口、统一响应格式、数据库连接和基础异常处理。
```

对应任务：

- Task 1
- Task 2

---

## 第 2 批

```text
请实现用户账户、用户资料、用户目标三张表，以及微信登录 mock 接口、JWT 鉴权、用户资料接口和目标设置接口。
```

对应任务：

- Task 4
- Task 5
- Task 6
- Task 7
- Task 8

---

## 第 3 批

```text
请实现微信小程序基础项目结构、登录流程、首次目标设置页面和首页页面，前端通过 request 工具调用后端接口。
```

对应任务：

- Task 3
- Task 9
- Task 11

---

## 第 4 批

```text
请实现首页聚合接口，统计当前用户的目标、今日饮食、训练状态、本周训练次数和最新体重。
```

对应任务：

- Task 10

---

## 第 5 批

```text
请实现饮食模块后端，包括饮食记录表、饮食明细表、常吃食物表、食物库表、食物搜索、AI 识别 mock、确认记录、查询记录、编辑、删除、撤销和常吃食物接口。
```

对应任务：

- Task 12
- Task 13
- Task 14
- Task 15
- Task 16
- Task 17
- Task 18

---

## 第 6 批

```text
请实现微信小程序饮食模块页面，包括饮食列表、记录方式选择、拍照识别结果页、食物搜索页、常吃食物页和自定义食物页。
```

对应任务：

- Task 19

---

## 第 7 批

```text
请实现体重模块后端和前端，包括体重记录表、新增、查询、编辑、删除、7天趋势、30天趋势，以及微信小程序体重页面。
```

对应任务：

- Task 20
- Task 21
- Task 22
- Task 23

---

## 第 8 批

```text
请实现训练模板模块后端和前端，包括训练模板表、训练模板单元表、普通动作、超级组、递减组的创建、编辑、复制、删除和列表展示。
```

对应任务：

- Task 24
- Task 25
- Task 26
- Task 27

---

## 第 9 批

```text
请实现训练执行模块后端，包括训练会话、训练快照、训练执行明细、休息记录、开始训练、完成当前项、跳过当前项、休息开始、跳过休息、延长休息、临时加组、结束训练、未完成训练查询和训练历史接口。
```

对应任务：

- Task 28
- Task 29
- Task 30
- Task 31
- Task 32
- Task 33
- Task 34
- Task 35
- Task 36
- Task 37

---

## 第 10 批

```text
请实现微信小程序训练执行页面和训练历史页面，包括当前训练项展示、实际重量次数修改、完成当前项、休息倒计时、跳过休息、延长休息、中断恢复、结束训练和训练历史详情展示。
```

对应任务：

- Task 38

---

## 第 11 批

```text
请根据以下验收清单进行接口权限测试、首页联动测试、饮食流程测试、训练流程测试和体重流程测试，并修复发现的问题。
```

对应任务：

- Task 39
- Task 40
- Task 41
- Task 42
- Task 43
- Task 44
