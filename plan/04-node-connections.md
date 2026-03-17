# PLAN: ノード接続システム（矢印）
日時: 2026-03-17

## GOAL
- ノード間をベジェ曲線の矢印で接続できるシステムを実装する

## PURPOSE
- ノード間のデータフロー・関係性を視覚化し、将来のAIエージェント連携の基盤とする

## MILESTONE

### MILESTONE 01 - 接続ポート表示 + SVGレイヤー + 接続データモデル
Scope（この段階で何をやるか）
- node-base.jsのcreateNodeElement内で、各ノードに上下左右の接続ポート（丸ドット）を追加。選択時のみ表示
- canvas-container内にSVG要素を追加（全接続線の描画レイヤー）
- ワークスペースデータに`connections`配列を追加（未保存のワークスペースでも空配列で初期化）
- connection-manager.jsを新規作成: 接続の追加・削除・描画・更新を管理するモジュール
- ベジェ曲線パスの計算関数: ポートの位置（top/bottom/left/right）に応じて制御点を自動算出
- 全接続線のSVG描画関数: pathエレメントにd属性を設定
- ノード移動・リサイズ時に接続線を再描画するフック

Key files/modules（触るファイル・ディレクトリ）
- src/renderer/canvas/connection-manager.js（新規）
- src/renderer/canvas/node-base.js（ポートDOM追加）
- src/renderer/canvas/canvas.js（SVGレイヤー初期化、保存/読込にconnections含める）
- src/renderer/styles/canvas.css（ポート・接続線スタイル）
- src/renderer/index.html（script追加）

Acceptance criteria（完了の定義）
- 選択中ノードの上下左右に水色の丸ドットが表示される
- canvas-container内にSVG要素が存在する
- ワークスペースJSONにconnections配列が保存される
- ConnectionManager.renderAll()で既存接続をベジェ曲線として描画できる

Verification commands（確認用コマンド）
- `npm start` → ノード選択 → 4つのポートドット表示確認

### MILESTONE 02 - 接続の作成インタラクション
Scope（この段階で何をやるか）
- 接続ポートのmousedownでドラッグ開始→マウス位置までベジェ曲線プレビュー
- マウス移動中、別ノードの接続ポート付近（20px以内）でスナップハイライト
- ドロップで接続確定: connections配列にエントリ追加→SVG再描画→自動保存
- ポート外ドロップで接続キャンセル（プレビュー線を除去）
- 同じノードへの自己接続をブロック
- 既に同じsource/targetポートの接続が存在する場合は上書き（重複防止）
- ActionHistoryにconnection-add型を追加

Key files/modules（触るファイル・ディレクトリ）
- src/renderer/canvas/connection-manager.js（ドラッグ接続ロジック）
- src/renderer/canvas/node-base.js（ポートイベントバインド）
- src/renderer/canvas/action-history.js（connection-add/delete型追加）

Acceptance criteria（完了の定義）
- ポートからドラッグするとベジェ曲線のプレビューが表示される
- 別ノードのポート付近でスナップし、ドロップで接続が確定する
- 接続線が矢印（三角形マーカー）付きで表示される
- ポート外ドロップでプレビューが消える
- 自己接続がブロックされる
- 接続がワークスペース保存・復元で維持される

Verification commands（確認用コマンド）
- `npm start` → ノード2つ作成 → 1つ目のポートからドラッグ → 2つ目のポートにドロップ → 矢印接続確認

### MILESTONE 03 - 接続の選択・削除・向き反転・Undo
Scope（この段階で何をやるか）
- SVGパス要素にクリックイベントバインド（ヒット判定用に太めの透明ストロークを重ねる）
- 選択された接続線のハイライト表示（色を濃くする、太くする）
- Delete/Backspaceで選択中接続を削除
- 右クリックメニュー: 「向きを反転」「削除」
- 向き反転: source/targetのノードID・ポートを入れ替え、再描画
- ノード削除時に関連接続を自動削除（deleteNode内にフック）
- ActionHistoryにconnection-delete, connection-reverse型を追加
- キャンバスクリックで接続の選択解除

Key files/modules（触るファイル・ディレクトリ）
- src/renderer/canvas/connection-manager.js（選択・削除・反転・メニュー）
- src/renderer/canvas/node-base.js（deleteNodeに接続削除フック）
- src/renderer/canvas/canvas.js（接続選択解除、キーボードショートカット）
- src/renderer/canvas/action-history.js（connection型の追加）
- src/renderer/styles/canvas.css（選択ハイライト、メニュー）

Acceptance criteria（完了の定義）
- 接続線をクリックで選択でき、ハイライトされる
- Deleteで選択中の接続が削除される
- 右クリック→「向きを反転」で矢印の方向が逆になる
- ノード削除時に関連接続も自動削除される
- Cmd+Zで接続の追加・削除・反転を取り消せる

Verification commands（確認用コマンド）
- `npm start` → 接続作成 → クリック選択 → Delete削除 → Cmd+Z復元 → 右クリック→反転

## ARCHITECTURE OVERVIEW
- ConnectionManager: 接続データの管理・SVG描画・インタラクションを担当する独立モジュール
- SVGレイヤー: canvas-container内に配置、CSSのtransformで自然にパン・ズーム追従
- データ: workspace.connectionsに配列として保存。ノードとは独立した存在
- ベジェ曲線: ポート方向に応じた制御点で自然なカーブを実現（例: topポートなら制御点はy方向に-80px）

## IMPLEMENTATION NOTE & DECISION LOG
- マイルストーンごとに、行動時にぶつかった悩みどころと最終的な判断はこの`PLAN.md`をベースとした計画実行中に随時以下に記載すること。（この記載は削除しないでください）
- PLAN作成時は以下の項目はこのまま記載をしておくこと。

- MILESTONE 01
  - SVGレイヤーをcanvas-containerの最初の子要素として配置。overflow:visibleでキャンバス範囲外の接続線も描画可能に
  - 接続ポートはDOMのdiv要素で実装（SVG circleではなく）。CSS transform translate(-50%,-50%)で辺の中央に正確に配置
  - ポートのpointer-eventsは選択時のみautoに。非選択時はnoneで通常操作を妨げない
- MILESTONE 02
  - ドラッグプレビューはstroke-dasharrayで点線表示し、確定済み接続と視覚的に区別
  - スナップ判定は20px以内。スナップ時にターゲットポートにsnap-highlightクラスを付与してスケールアップ
  - 自己接続防止: startDragのsourceNodeIdとスナップターゲットのnodeIdを比較
- MILESTONE 03
  - クリック判定用にstroke-width:14pxの透明パスを重ねるヒットエリア方式。SVGのpointer-events:strokeで精度良く判定
  - 3マイルストーンを一括実装（全機能が密接に関連するため分割せず実装）
  - ドラッグ中のリアルタイム追従: mousemove内でConnectionManager.renderAll()を呼ぶ方式。ノード数が少ない前提で十分な性能

## POST-RELEASE UPDATES

### SVG描画修正
- SVGのwidth:0/height:0ではElectronでオーバーフロー描画が機能しない → width=1/height=1 + overflow:visibleに変更
- canvas-nodeのoverflow:hiddenが接続ポートをクリップしていた → overflow:visibleに変更、node-contentでコンテンツのクリップを維持
- リサイズハンドル(z-index:10)が接続ポートを覆っていた → ポートのz-indexを15に

### ポートドラッグのイベント処理
- 個別ポート要素のmousedownハンドラがbindSelect/bindDragとの伝播衝突で発火しない問題 → viewportレベルのmousedownで`.connection-port`を最初に検出する方式に全面変更
- 先端ドラッグでの繋ぎ直し時にアプリがフリーズする問題 → `_reconnecting`フラグでviewportのmousemove/mouseupが処理するように修正

### カーブ・スタイル調整
- ベジェ制御点を固定80pxから距離の35%に比例（30-150pxクランプ）に変更。自然なカーブに
- 線の太さ: 1.8px（選択時2.5px）、点線スタイル
- 矢印マーカー: markerUnits=userSpaceOnUseで固定サイズ化

### ズーム適応
- スナップ距離がズームに反比例（100%で25px、25%で100px）
- 線の太さがズームアウト時に√補正で太くなる（50%以下で見えづらい問題の解消）
- 接続ポートドットもズーム補正で拡大、updatePortSizes()でズーム変更時に動的更新
- 1ポートから複数接続可能に（完全同一ペアのみブロック）
