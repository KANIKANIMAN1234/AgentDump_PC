# AgentDump PC

転職エージェント向け業務管理アプリ（PC Web版 / LINE LIFF）。

## 機能

- サイドバー型管理 UI（採用企業・転職者・タスク・気づき・設定）
- Google Drive 連携（気づき CSV・転職者 PDF）
- B2B マルチテナント（BrainDump 基盤）

## セットアップ

```bash
npm install
npx vercel dev
```

ブラウザ: `http://localhost:3000/app/`

## 環境変数

`.env.example` を参照。

## Supabase SQL

`02_app/SQL/` の以下を順に実行:

1. `phase1_multi_tenant.sql`
2. `phase2_org_hierarchy.sql`
3. `agentdump_domain.sql`

## デプロイ

Vercel に本リポジトリを連携。LIFF エンドポイント URL を `/app/` に設定。
