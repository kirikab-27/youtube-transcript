# YouTube文字起こしツール

YouTube動画のURLを入力すると、字幕（自動生成含む）を取得して表示するWebツールです。
テキストをコピーしたり、タイムスタンプ付きで出力できます。

## 機能

- 🎥 YouTube URL入力による字幕取得
- 📝 字幕の表示・検索・フィルタリング
- ⏱️ タイムスタンプ表示の切り替え
- 📋 テキスト全文コピー（複数形式対応）
- 🌐 多言語対応（日本語/英語など）
- 🌙 ダークモード対応
- 💾 ローカルストレージによる履歴保存
- 📱 レスポンシブデザイン

## 技術スタック

- **フレームワーク**: Next.js 15 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS + shadcn/ui
- **データベース**: Prisma + SQLite
- **状態管理**: Zustand
- **データフェッチング**: TanStack Query

## セットアップ

### 必要な環境

- Node.js 18以上
- npm または yarn または pnpm

### インストール手順

1. 依存関係のインストール:
```bash
npm install
```

2. データベースの初期化:
```bash
npm run prisma:generate
npm run prisma:migrate
```

3. 開発サーバーの起動:
```bash
npm run dev
```

4. ブラウザで http://localhost:3000 を開く

## 使い方

1. YouTube動画のURLを入力フィールドに貼り付け
2. 「取得」ボタンをクリック
3. 字幕が表示される
4. 必要に応じて：
   - 言語を切り替え
   - タイムスタンプ表示をON/OFF
   - テキストを検索
   - 全文をコピー
   - 形式を選択してダウンロード

## スクリプト

- `npm run dev` - 開発サーバー起動
- `npm run build` - プロダクションビルド
- `npm run start` - プロダクションサーバー起動
- `npm run lint` - ESLint実行
- `npm run prisma:generate` - Prismaクライアント生成
- `npm run prisma:migrate` - データベースマイグレーション
- `npm run prisma:studio` - Prisma Studio起動

## ディレクトリ構造

```
youtube-transcript/
├── app/                  # Next.js App Router
│   ├── api/             # APIエンドポイント
│   ├── layout.tsx       # ルートレイアウト
│   └── page.tsx         # ホームページ
├── components/          # Reactコンポーネント
│   ├── features/        # 機能別コンポーネント
│   ├── layouts/         # レイアウトコンポーネント
│   ├── providers/       # コンテキストプロバイダー
│   └── ui/              # UIコンポーネント
├── hooks/               # カスタムフック
├── lib/                 # ユーティリティ関数
├── prisma/              # Prismaスキーマ
├── types/               # TypeScript型定義
└── public/              # 静的ファイル
```

## 環境変数

`.env.local`ファイルを作成し、必要に応じて以下の環境変数を設定:

```
# YouTube API Key (オプション)
YOUTUBE_API_KEY=your_api_key_here

# Database URL (デフォルト: SQLite)
DATABASE_URL="file:./dev.db"
```

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## 作者

YouTube文字起こしプロジェクト