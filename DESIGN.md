# YouTube文字起こしツール - システム設計書

## 1. システムアーキテクチャ

### 1.1 アーキテクチャ概要
- **アーキテクチャパターン**: クリーンアーキテクチャ + マイクロフロントエンド
- **デプロイメント**: JAMstack（静的サイト + サーバーレス関数）
- **データフロー**: イベント駆動型アーキテクチャ

### 1.2 システム構成

```
┌─────────────────────────────────────────────────────────┐
│                    クライアント層                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │               Next.js (React) + TypeScript         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │  │
│  │  │URL入力UI  │  │字幕表示UI │  │設定UI     │      │  │
│  │  └──────────┘  └──────────┘  └──────────┘      │  │
│  │  ┌────────────────────────────────────────┐      │  │
│  │  │         状態管理 (Zustand)               │      │  │
│  │  └────────────────────────────────────────┘      │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│                      API層                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Next.js API Routes (Edge Runtime)       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │  │
│  │  │Transcript │  │Language  │  │Format    │      │  │
│  │  │   API     │  │   API    │  │   API    │      │  │
│  │  └──────────┘  └──────────┘  └──────────┘      │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│                    サービス層                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │                 ビジネスロジック                     │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │  │
│  │  │YouTube    │  │Text      │  │Cache     │      │  │
│  │  │Service    │  │Processor │  │Service   │      │  │
│  │  └──────────┘  └──────────┘  └──────────┘      │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│                   データアクセス層                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │  │
│  │  │YouTube    │  │Redis     │  │IndexedDB │      │  │
│  │  │Transcript │  │(Cache)   │  │(Local)   │      │  │
│  │  │   API     │  │          │  │          │      │  │
│  │  └──────────┘  └──────────┘  └──────────┘      │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 1.3 主要コンポーネント

#### フロントエンド
- **URLパーサー**: YouTube URLの検証と動画ID抽出
- **字幕ビューア**: タイムスタンプ付き/なしの表示切替
- **検索エンジン**: 全文検索と引用生成
- **フォーマッター**: 複数形式でのエクスポート
- **テーママネージャー**: ダーク/ライトモード切替

#### バックエンド
- **字幕取得サービス**: YouTube API経由での字幕取得
- **テキスト処理エンジン**: 段落化、句読点補正、整形
- **キャッシュマネージャー**: 取得済み字幕の一時保存
- **エラーハンドラー**: 字幕取得失敗時の代替提案

## 2. データベーススキーマ

### 2.1 データストレージ戦略
- **プライマリ**: IndexedDB（ブラウザローカル）
- **キャッシュ**: Redis（サーバーサイド、オプション）
- **セッション**: LocalStorage（設定保存）

### 2.2 スキーマ定義

#### IndexedDB Schema

```typescript
// transcripts ストア
interface TranscriptRecord {
  id: string;                    // 動画ID
  url: string;                   // YouTube URL
  title: string;                 // 動画タイトル
  duration: number;              // 動画の長さ（秒）
  languages: Language[];         // 利用可能な言語
  transcripts: TranscriptData[]; // 字幕データ
  fetchedAt: Date;              // 取得日時
  expiresAt: Date;              // 有効期限（24時間）
}

interface Language {
  code: string;        // 言語コード（ja, en等）
  name: string;        // 言語名
  type: 'manual' | 'auto' | 'translated'; // 字幕タイプ
  isDefault: boolean;  // デフォルト言語フラグ
}

interface TranscriptData {
  languageCode: string;
  segments: Segment[];
  formattedText: string;  // 整形済みテキスト
  rawText: string;        // 生テキスト
}

interface Segment {
  start: number;     // 開始時間（秒）
  duration: number;  // 継続時間（秒）
  text: string;      // テキスト
}

// history ストア
interface HistoryRecord {
  id: string;         // UUID
  videoId: string;    // 動画ID
  url: string;        // YouTube URL
  title: string;      // 動画タイトル
  thumbnail: string;  // サムネイルURL
  viewedAt: Date;     // 閲覧日時
  lastPosition?: number; // 最後に閲覧した位置
}

// settings ストア
interface Settings {
  theme: 'light' | 'dark' | 'system';
  defaultLanguage: string;
  timestampFormat: 'mm:ss' | 'hh:mm:ss' | 'seconds';
  copyFormat: 'plain' | 'timestamp' | 'markdown' | 'srt';
  autoSave: boolean;
  maxHistoryItems: number;
  shortcuts: KeyboardShortcuts;
}

interface KeyboardShortcuts {
  search: string;       // デフォルト: '/'
  copy: string;         // デフォルト: 'c'
  toggleTimestamp: string; // デフォルト: 't'
  toggleTheme: string;  // デフォルト: 'd'
}
```

#### Redis Cache Schema (オプション)

```typescript
// キャッシュキー構造
// transcript:{videoId}:{languageCode}
interface CachedTranscript {
  data: TranscriptData;
  ttl: number; // 3600秒（1時間）
}

// rate-limit:{ip}
interface RateLimitRecord {
  count: number;
  resetAt: Date;
}
```

## 3. API設計

### 3.1 RESTful API エンドポイント

#### 字幕取得
```typescript
POST /api/transcript/fetch
Request:
{
  url: string;              // YouTube URL
  language?: string;        // 言語コード（オプション）
  preferredType?: 'manual' | 'auto' | 'any'; // 字幕タイプ優先度
}

Response:
{
  success: boolean;
  data?: {
    videoId: string;
    title: string;
    duration: number;
    languages: Language[];
    transcript: TranscriptData;
  };
  error?: {
    code: string;
    message: string;
    suggestion?: string;
  };
}
```

#### 利用可能言語取得
```typescript
GET /api/transcript/languages/{videoId}
Response:
{
  success: boolean;
  data?: {
    languages: Language[];
    default: string;
  };
  error?: ErrorResponse;
}
```

#### テキストフォーマット変換
```typescript
POST /api/format/convert
Request:
{
  transcript: TranscriptData;
  fromFormat: 'raw';
  toFormat: 'plain' | 'timestamp' | 'markdown' | 'srt' | 'vtt' | 'csv';
  options?: {
    timestampFormat?: string;
    includeHeader?: boolean;
    paragraphize?: boolean;
  };
}

Response:
{
  success: boolean;
  data?: {
    formatted: string;
    mimeType: string;
    filename?: string;
  };
  error?: ErrorResponse;
}
```

#### 検索と引用生成
```typescript
POST /api/search
Request:
{
  transcript: TranscriptData;
  query: string;
  options?: {
    caseSensitive?: boolean;
    contextLines?: number;  // 前後の行数
    maxResults?: number;
  };
}

Response:
{
  success: boolean;
  data?: {
    results: SearchResult[];
    total: number;
  };
  error?: ErrorResponse;
}

interface SearchResult {
  segment: Segment;
  match: {
    start: number;
    end: number;
  };
  context: {
    before: Segment[];
    after: Segment[];
  };
  citation: string; // フォーマット済み引用文
}
```

### 3.2 WebSocket API（リアルタイム機能用）

```typescript
// 接続
ws://localhost:3000/api/ws/transcript

// メッセージタイプ
interface WSMessage {
  type: 'progress' | 'partial' | 'complete' | 'error';
  data: any;
}

// 進捗通知
{
  type: 'progress',
  data: {
    phase: 'fetching' | 'processing' | 'formatting';
    progress: number; // 0-100
  }
}
```

## 4. ディレクトリ構造

```
youtube-transcript/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API Routes
│   │   │   ├── transcript/
│   │   │   │   ├── fetch/
│   │   │   │   │   └── route.ts
│   │   │   │   └── languages/
│   │   │   │       └── [videoId]/
│   │   │   │           └── route.ts
│   │   │   ├── format/
│   │   │   │   └── convert/
│   │   │   │       └── route.ts
│   │   │   └── search/
│   │   │       └── route.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   │
│   ├── components/             # UIコンポーネント
│   │   ├── common/
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   └── Toast/
│   │   ├── features/
│   │   │   ├── URLInput/
│   │   │   ├── TranscriptViewer/
│   │   │   ├── LanguageSelector/
│   │   │   ├── SearchBar/
│   │   │   ├── FormatSelector/
│   │   │   └── ThemeToggle/
│   │   └── layouts/
│   │       ├── Header/
│   │       ├── Footer/
│   │       └── Container/
│   │
│   ├── lib/                    # ビジネスロジック
│   │   ├── services/
│   │   │   ├── youtube.service.ts
│   │   │   ├── transcript.service.ts
│   │   │   ├── formatter.service.ts
│   │   │   └── cache.service.ts
│   │   ├── utils/
│   │   │   ├── url-parser.ts
│   │   │   ├── text-processor.ts
│   │   │   ├── time-formatter.ts
│   │   │   └── error-handler.ts
│   │   ├── validators/
│   │   │   └── youtube-url.ts
│   │   └── constants/
│   │       ├── formats.ts
│   │       └── languages.ts
│   │
│   ├── hooks/                  # カスタムフック
│   │   ├── useTranscript.ts
│   │   ├── useSearch.ts
│   │   ├── useTheme.ts
│   │   ├── useKeyboard.ts
│   │   └── useLocalStorage.ts
│   │
│   ├── store/                  # 状態管理
│   │   ├── transcript.store.ts
│   │   ├── settings.store.ts
│   │   └── history.store.ts
│   │
│   ├── types/                  # TypeScript型定義
│   │   ├── transcript.types.ts
│   │   ├── api.types.ts
│   │   └── settings.types.ts
│   │
│   └── styles/                 # スタイル
│       ├── themes/
│       │   ├── light.ts
│       │   └── dark.ts
│       └── breakpoints.ts
│
├── public/                     # 静的ファイル
│   ├── icons/
│   ├── images/
│   └── manifest.json          # PWA設定
│
├── tests/                      # テスト
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/                       # ドキュメント
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── CONTRIBUTING.md
│
├── scripts/                    # ビルド・デプロイスクリプト
│   ├── build.sh
│   └── deploy.sh
│
├── .github/                    # GitHub Actions
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── .env.example               # 環境変数サンプル
├── .eslintrc.json            # ESLint設定
├── .prettierrc               # Prettier設定
├── next.config.js            # Next.js設定
├── tailwind.config.js        # Tailwind CSS設定
├── tsconfig.json             # TypeScript設定
├── package.json
├── pnpm-lock.yaml
└── README.md
```

## 5. 技術スタック

### 5.1 フロントエンド
- **フレームワーク**: Next.js 15 (App Router)
- **言語**: TypeScript 5.6
- **UIライブラリ**: React 19
- **スタイリング**: Tailwind CSS 3.4 + shadcn/ui
- **状態管理**: Zustand 5.0
- **データフェッチ**: TanStack Query v5
- **フォーム**: React Hook Form + Zod
- **アニメーション**: Framer Motion
- **アイコン**: Lucide React
- **検索**: Fuse.js（クライアントサイド全文検索）

### 5.2 バックエンド
- **ランタイム**: Node.js 22 (Edge Runtime優先)
- **API**: Next.js API Routes
- **YouTube API**: youtube-transcript（npm package）
- **キャッシュ**: Redis (Upstash) - オプション
- **レート制限**: upstash/ratelimit
- **バリデーション**: Zod
- **エラーハンドリング**: カスタムエラークラス

### 5.3 開発ツール
- **パッケージマネージャー**: pnpm
- **リンター**: ESLint + Prettier
- **テスト**: Vitest (unit) + Playwright (E2E)
- **ビルドツール**: Turbopack (Next.js built-in)
- **型チェック**: TypeScript strict mode
- **Git Hooks**: Husky + lint-staged
- **CI/CD**: GitHub Actions

### 5.4 インフラ・デプロイ
- **ホスティング**: Vercel (推奨) or Netlify
- **CDN**: Vercel Edge Network
- **モニタリング**: Vercel Analytics + Sentry
- **ドメイン**: カスタムドメイン対応
- **SSL**: 自動SSL証明書

### 5.5 追加ライブラリ
- **日時処理**: date-fns
- **UUID生成**: uuid
- **クリップボード**: react-copy-to-clipboard
- **PWA**: next-pwa
- **SEO**: next-seo
- **国際化**: next-intl（将来対応用）

## 6. セキュリティ・パフォーマンス考慮事項

### 6.1 セキュリティ
- XSS対策: React自動エスケープ + CSP設定
- CSRF対策: SameSite Cookie + トークン検証
- レート制限: IP単位で1分間10リクエストまで
- 入力検証: Zodによる厳密な型チェック
- HTTPS必須: SSL/TLS暗号化通信
- データプライバシー: 個人情報非保存、24時間でキャッシュ自動削除

### 6.2 パフォーマンス
- コード分割: Dynamic imports使用
- 画像最適化: Next.js Image component
- キャッシュ戦略: SWR + IndexedDB + CDN
- バンドルサイズ: Tree shaking + 圧縮
- Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- PWA対応: オフライン表示可能

## 7. 今後の拡張可能性

### Phase 2（3-6ヶ月後）
- Chrome拡張機能版の開発
- 音声ファイルからの文字起こし（Whisper API）
- AI要約機能（OpenAI/Claude API）
- 複数動画の一括処理

### Phase 3（6-12ヶ月後）
- モバイルアプリ（React Native）
- 共同編集機能
- プレミアムプラン（広告なし、無制限利用）
- APIの外部公開（開発者向け）