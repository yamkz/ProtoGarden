# PLAN: ProtoGarden Canvas Tool
日時: 2026-03-16

## GOAL
- UIプロトタイプ比較用の無限キャンバスMacアプリ「ProtoGarden」を開発する

## PURPOSE
- 複数のUI/UXプロトタイプを一画面で自由に並べて比較したい。操作可能な状態で。

## MILESTONE

### MILESTONE 01 - Electronシェル + ストレージ設定 + ギャラリー画面
Scope（この段階で何をやるか）
- Electronプロジェクト初期化（package.json, 依存関係）
- メインプロセス: ウィンドウ作成、セキュリティ設定（nodeIntegration:false, contextIsolation:true）、preloadスクリプト
- ストレージ設定フロー: 初回起動時にウェルカム画面→「フォルダを選択」ボタン→dialog.showOpenDialogでフォルダ選択→パスをapp.getPath('userData')/config.jsonに保存
- proto-garden://カスタムプロトコル登録（プレースホルダ）
- ギャラリー画面: ストレージフォルダからワークスペース一覧表示、新規作成（名前入力）、名前変更（インライン編集）、削除（確認ダイアログ）
- ワークスペースクリックで空のキャンバスページへ遷移（ノード機能はまだなし）
- CSS: クリーンでミニマルなダークテーマ、CSSカスタムプロパティ

Key files/modules（触るファイル・ディレクトリ）
- package.json
- src/main/main.js
- src/main/storage.js
- src/main/ipc-handlers.js
- src/renderer/index.html
- src/renderer/preload.js
- src/renderer/app.js
- src/renderer/gallery/gallery.js
- src/renderer/styles/main.css
- src/renderer/styles/gallery.css
- src/shared/constants.js

Acceptance criteria（完了の定義）
- `npm start`でElectronアプリが起動する
- 初回起動でウェルカム画面が表示され、フォルダ選択が可能
- フォルダパスが再起動後も保持される
- ギャラリーでワークスペースの作成/名前変更/削除が可能
- ワークスペースクリックで空のキャンバスページに遷移し、「ギャラリーに戻る」ボタンがある
- 選択フォルダ内にワークスペースの.jsonファイルが生成される

Verification commands（確認用コマンド）
- `cd /Users/yamakaz/Dropbox/2025/APPDEV/ProtoGarden && npm start`
- ストレージフォルダ内の.jsonファイルを確認: `ls [選択フォルダ]/workspaces/`

### MILESTONE 02 - 無限キャンバス（パン・ズーム）
Scope（この段階で何をやるか）
- キャンバスのビューポート/コンテナdiv構造（CSS transformベース）
- パン: Space+左クリックドラッグ、中ボタンドラッグ
- ズーム: スクロールホイール（Ctrl/ピンチ検出）、0.1x〜5xクランプ、カーソル位置中心
- ツールバー: 戻るボタン、ワークスペース名、ズーム率表示（クリックで100%リセット）、ノード追加ボタン（プレースホルダ）
- ビューポート状態（panX, panY, zoom）のワークスペースJSONへの保存・復元

Key files/modules（触るファイル・ディレクトリ）
- src/renderer/canvas/canvas.js
- src/renderer/canvas/toolbar.js
- src/renderer/styles/canvas.css

Acceptance criteria（完了の定義）
- Space+ドラッグでキャンバスがスムーズにパンする
- スクロールホイールでカーソル位置を中心にズームする
- ズームインジケーターが現在のズーム率を表示する
- ワークスペースを離れて再度開いた際、ビューポート状態が復元される

Verification commands（確認用コマンド）
- `npm start` → ワークスペースに入る → パン・ズーム操作 → 戻って再度入る → ビューポート復元確認

### MILESTONE 03 - ノードシステム（テキスト + 画像）
Scope（この段階で何をやるか）
- ノードベースモジュール: ドラッグ移動、リサイズハンドル（4隅+4辺）、削除ボタン（右上X、最近10件のUndo対応）、z-index管理（右クリックメニュー: 最前面/最背面）
- テキストノード: キャンバス空白部分ダブルクリックで作成、contenteditable div、クリックで選択・ダブルクリックで編集、内容をnode dataにプレーンテキスト/HTMLとして保存
- 画像ノード:
  - Cmd+Vペースト: pasteイベントでクリップボードから画像読み取り→ストレージに保存
  - ドラッグ&ドロップ: dropイベントでファイル読み取り→ストレージに保存
  - ファイルピッカー: ツールバーボタン→dialog.showOpenDialog（画像フィルタ）
- 自動保存: ノード変更（移動/リサイズ/編集/追加/削除）後500msデバウンス
- カスタムプロトコルでの画像ファイル配信

Key files/modules（触るファイル・ディレクトリ）
- src/renderer/canvas/node-base.js
- src/renderer/canvas/node-text.js
- src/renderer/canvas/node-image.js
- src/main/file-manager.js
- src/main/ipc-handlers.js（新しいIPCチャネル追加）

Acceptance criteria（完了の定義）
- キャンバスダブルクリックでテキストノードが作成され、インライン編集可能
- 画像がペースト/D&D/ファイルピッカーの3方法で追加可能
- 全ノードがドラッグ移動、リサイズ、削除可能
- Z-indexレイヤリングが機能する（最前面/最背面）
- 変更が自動保存され、ワークスペース再読込で全ノードが正しい位置に復元される
- 画像ファイルがストレージフォルダのassets/{workspaceId}/images/に存在する

Verification commands（確認用コマンド）
- `npm start` → テキスト/画像ノードを複数作成 → 配置変更 → アプリ再起動 → 復元確認
- `ls [ストレージフォルダ]/assets/*/images/` で画像ファイル確認

### MILESTONE 04 - HTMLノード + URLノード
Scope（この段階で何をやるか）
- HTMLノード:
  - ツールバーの「HTML追加」ボタン→ファイルピッカー（.htmlフィルタ）
  - メインプロセスで選択ファイルの親ディレクトリ全体をassets/{workspaceId}/html/{nodeId}/にコピー
  - proto-garden://プロトコルでストレージからファイル配信
  - iframe表示: `<iframe src="proto-garden://..." sandbox="allow-scripts allow-same-origin">`
  - インタラクトモード: 透明オーバーレイでドラッグ/移動、ダブルクリックまたはトグルボタンでインタラクトモード（オーバーレイ除去、iframe操作可能）、外クリックで解除
- URLノード:
  - ツールバーの「URL追加」ボタン→テキスト入力ダイアログ
  - URL形式の基本バリデーション
  - iframe表示: `<iframe src="https://...">`
  - HTMLノードと同様のインタラクトモード切替
  - ノードフレームにURL表示ラベル

Key files/modules（触るファイル・ディレクトリ）
- src/renderer/canvas/node-html.js
- src/renderer/canvas/node-url.js
- src/main/file-manager.js（ディレクトリコピーロジック追加）
- src/main/main.js（プロトコル登録の実装）

Acceptance criteria（完了の定義）
- HTMLファイルがiframe内で正しく表示される（CSS/JS/画像含む）
- HTMLノードがインタラクトモードで操作可能
- URLノードが外部URLを読み込む、ブロックされるサイトは適切なエラーメッセージ表示
- 両ノードタイプでドラッグ/リサイズ/削除/z-indexが他ノードと同様に機能
- 自動保存が両ノードタイプで機能

Verification commands（確認用コマンド）
- `npm start` → CSS/JSを含むHTMLプロトタイプを追加 → 正しくレンダリングされるか確認
- URLノードでhttps://example.comを追加 → 表示確認
- `ls [ストレージフォルダ]/assets/*/html/` でコピーファイル確認

### MILESTONE 05 - ポリッシュ + .appビルド + 配布
Scope（この段階で何をやるか）
- electron-builderのmacOS .appバンドル設定
- アプリアイコン（シンプルなデザイン）
- ウィンドウタイトル、メニューバーカスタマイズ（File, Edit, Window, Help）
- キーボードショートカット: Cmd+N（新規ワークスペース）、Delete/Backspace（ノード削除）、Cmd+Z（Undo）、Cmd+0（ズームリセット）、Cmd+/Cmd-（ズームイン/アウト）
- エッジケース: ストレージフォルダ消失時の再選択、破損JSON対応、大画像のリサイズ（4096px超）
- パフォーマンス: requestAnimationFrameでパン/ズームイベントスロットリング
- ビジュアルポリッシュ: ノード選択ハイライト、スムーズズームトランジション、カーソル変更（grab/grabbing, リサイズカーソル）
- エンドツーエンドテスト: 初回起動→フォルダ選択→ワークスペース作成→4種ノード追加→再配置→閉じる→再開→復元確認

Key files/modules（触るファイル・ディレクトリ）
- electron-builder.yml
- package.json（ビルドスクリプト追加）
- src/main/main.js（メニューバー）
- 全rendererファイル（ポリッシュパス）

Acceptance criteria（完了の定義）
- `npm run build`でdist/に動作する.appバンドルが生成される
- .appをダブルクリックでProtoGardenがターミナルなしで起動する
- ビルドされたアプリで全機能が動作する
- ストレージフォルダ消失時にアプリが再選択を促す

Verification commands（確認用コマンド）
- `npm run build` → dist/内の.appを確認
- .appを/Applications/に移動 → ダブルクリック起動 → 全ワークフロー実行
- ストレージフォルダを削除 → 再起動 → 再選択フロー確認

## ARCHITECTURE OVERVIEW
- Electron（メインプロセス + レンダラープロセス）
- メインプロセス: ファイルI/O、ストレージ管理、カスタムプロトコル、ネイティブダイアログ
- レンダラープロセス: Canvas UI、ノード管理、ユーザーインタラクション
- IPC通信: preload.jsで安全なAPI公開（contextBridge.exposeInMainWorld）
- データ: ユーザー指定フォルダにJSON + アセットファイル保存

## IMPLEMENTATION NOTE & DECISION LOG
- マイルストーンごとに、行動時にぶつかった悩みどころと最終的な判断はこの`PLAN.md`をベースとした計画実行中に随時以下に記載すること。（この記載は削除しないでください）
- PLAN作成時は以下の項目はこのまま記載をしておくこと。

- MILESTONE 01
  - `prompt()`がElectronで動作しない → カスタムモーダルダイアログを実装
  - macOSの信号ボタン（閉じる/最小化/最大化）とツールバー/ギャラリーヘッダーが重なる → 左パディング80pxで回避
  - ドットグリッドの視認性が低い → rgba(255,255,255,0.12)で明るく、32px間隔に変更
- MILESTONE 02
  - ズーム速度が速すぎる → delta係数を0.9/1.1から0.95/1.05に減速
  - ビューポートの::beforeでドットグリッドを描画していたがズーム時に振動 → canvas-container上に移動しCSS transformで自然にスケールする方式に変更
  - トラックパッド操作をFigma風に → wheelイベントでctrlKeyを判定し、ピンチズーム（ctrlKey+deltaY）と2本指パン（deltaX/deltaY）を分離
- MILESTONE 03
  - 画像のproto-garden://プロトコルURLでhostnameにworkspaceIdが入りpathnameから欠落 → `url.hostname`を`path.join`に追加して修正
  - CSPで`file://`からの画像読み込みがブロックされる → ファイルピッカー選択時にmainプロセス側でfs.readFileSync→saveImageする方式に変更（rendererからfetch不要）
  - Cmd+Vペーストが動かない → pasteイベントのリスナーをwindowからdocumentに変更
  - ギャラリーのカードが縦長 → テーブルビュー（横一列リスト）に全面変更。ユーザーの好みに合わせた
  - 「ProtoGarden」ブランディングを削除 → ギャラリーヘッダーを「Workspaces」に変更（ユーザー要望）
- MILESTONE 04
  - HTMLノードのiframeが空白表示 → `protocol.registerSchemesAsPrivileged()`をapp.ready前に呼ぶ必要があった。さらに`net.fetch`ではなく`fs.readFileSync`+`new Response`でMIMEタイプ付きレスポンスに変更
  - iframe操作のインタラクトモード（オーバーレイ+ダブルクリック切替）→ ユーザーが「常に操作可能がいい」と要望 → オーバーレイ廃止。代わりにCSS `pointer-events: none`を初期値にし、選択時のみ`pointer-events: auto`に切替える方式を採用
  - リサイズ時にiframeがマウスイベントを奪う問題 → `blockIframes()`でフルスクリーン透明オーバーレイ（z-index:99998）を表示。ただしmousedown直後に表示するとダブルクリックの2回目が吸われるバグ発生 → ドラッグ開始を「マウスが3px以上移動してから」に変更して解決
  - テキストノードのUX全面変更 → カード枠なし自由テキストに。シングルクリック=選択（移動・リサイズ可）、ダブルクリック=テキスト編集モード。pointer-events:noneで非編集時はクリック貫通
  - 右クリックメニューが一瞬で消える問題 → hideハンドラの登録を`setTimeout(200ms)`に遅延して右クリックのpointerdownとの衝突を回避
  - HTMLプリセットボタン（Mobile/Tablet/PC）が効かない → ボタンのmousedownで`e.stopPropagation()`を追加。PCサブメニューはドロップダウン方式に
  - 複数選択対応 → `selectedNodeId`（単一）を`selectedNodeIds`（Set）に変更。マーキー選択（ドラッグで青い矩形）、複数選択でのDelete/Cmd+D対応
  - **DOM状態保存機能（追加実装）**: Reactアプリのモーダル等の状態をアプリ再起動後も維持したいというユーザー要望
    - Reactの`useState`はメモリ上にしかなく永続化不可能 → DOMスナップショット方式を採用
    - HTMLファイル配信時にpostMessageリスナースクリプトを自動注入。ワークスペース離脱時にiframeにpostMessageでDOM取得→`_snapshot.html`として保存
    - 当初`mainWindow.webContents.mainFrame.frames`からフレームの`executeJavaScript`でDOM取得を試みたが、proto-garden://とfile://がクロスオリジンのため失敗 → postMessage方式に変更
    - `</body>`タグがないminified React HTMLへのスクリプト注入 → フォールバックでファイル末尾に追加
    - スナップショット読み込み後にReactが再初期化して状態がリセットされる問題 → スナップショット保存時にDOMをクローンして全`<script>`タグを除去する方式で解決
    - 変更検知: 当初はiframeフォーカス検知を試みたがクロスオリジンで不可 → 全HTMLノードを対象にスナップショット保存する方式に簡素化
- MILESTONE 05
  - electron-builderでmacOS .appバンドル生成（arm64、246MB）
  - コード署名なし（Developer ID未設定）→ 初回起動時にGatekeeperの警告が出るがControl+クリックで開ける
  - アプリアイコン未設定（Electronデフォルト）→ 必要に応じて後で追加
  - メニューバー追加: File（新規ワークスペース Cmd+N）、Edit（元に戻す Cmd+Z、カット/コピー/ペースト）、View（ズームリセット Cmd+0、DevTools）
  - ストレージフォルダ消失時のハンドリング: 起動時にworkspace.list()を試行、失敗したらウェルカム画面に戻す
  - before-quitでスナップショット保存時に二重quit防止のためisQuittingフラグを追加

## POST-RELEASE UPDATES（Task01完了後の追加実装）

### Noteノード追加
- Context/Prompt切替式のウィンドウ型テキストUI。将来のAIデザインハブ構想の基盤
- ContextモードはグレーUI、Promptモードはブルー + モデル選択（Opus 4.6/Sonnet 4.6/Haiku 4.5/GPT-4o/o3）+ Runボタン（UIのみ、AI実行は未実装）
- noteノードのtextareaにフォーカス中はCmd+C/V等のキーボードショートカットをキャンバス側でスキップし、通常のテキスト操作を優先
- textarea内スクロール時にwheelイベントがキャンバスに伝播しないようstopPropagation

### HTML/URLノード進む/戻るボタン
- ヘッダーに◀▶ナビゲーションボタン追加（iframe.contentWindow.history.back/forward）

### スナップショット独立化
- 複製ノードが同じソースHTMLを共有していてもスナップショットが独立するように、保存パスを`html/{dataNodeId}/_snapshot.html`から`snapshots/{canvasNodeId}.html`に変更
- ギャラリーへの戻り遅延問題: saveAllSnapshotsのpostMessageタイムアウトを3s→0.8sに短縮、unloadをtry-catchで囲んでエラー時も確実に遷移
