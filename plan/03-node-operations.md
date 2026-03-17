# PLAN: ノード操作拡張（コピペ・ロック・グループ化）
日時: 2026-03-17

## GOAL
- ワークスペース間コピペ、ロック/アンロック、グループ化/解除を実装する

## PURPOSE
- ノード操作の利便性と安全性を向上させ、複雑なレイアウト作業を効率化する

## MILESTONE

### MILESTONE 01 - ロック/アンロック機能
Scope（この段階で何をやるか）
- ノードデータに`locked`プロパティ（boolean、デフォルトfalse）を追加
- node-base.jsのbindDrag: lockedノードはドラッグ開始をブロック
- node-base.jsのbindResize: lockedノードはリサイズ開始をブロック
- node-base.jsのdeleteNode: lockedノードは削除をブロック（無視する）
- node-text.jsのenterTextEdit: lockedノードはテキスト編集をブロック
- node-note.js: lockedノードはtextareaをreadonly化
- ロック中の表示: ノード右下に小さな鍵アイコン（🔒）、ノードにopacity:0.85を適用、リサイズハンドルを非表示
- キーボードショートカット: Cmd+L で選択中ノードのlockedをトグル
- 右クリックメニューに「ロック/アンロック」項目を追加
- ActionHistoryにnode-lock型のアクション追加（undo/redo対応）

Key files/modules（触るファイル・ディレクトリ）
- src/renderer/canvas/node-base.js（lock判定、メニュー追加）
- src/renderer/canvas/node-text.js（編集ブロック）
- src/renderer/canvas/node-note.js（textarea readonly）
- src/renderer/canvas/canvas.js（Cmd+Lショートカット）
- src/renderer/canvas/action-history.js（node-lock型追加）
- src/renderer/styles/canvas.css（ロック表示スタイル）

Acceptance criteria（完了の定義）
- Cmd+Lでノードのロック/アンロックがトグルされる
- ロック中のノードに鍵アイコンが表示される
- ロック中は移動・リサイズ・削除・テキスト編集が全てブロックされる
- ロック状態がワークスペース保存・復元で維持される
- Cmd+Zでロック/アンロック操作を取り消せる

Verification commands（確認用コマンド）
- `npm start` → ノード選択→Cmd+L→鍵表示確認→ドラッグ不可確認→Cmd+L→解除確認

### MILESTONE 02 - ワークスペース間コピー&ペースト
Scope（この段階で何をやるか）
- Canvas.clipboardにコピー元ワークスペースIDを記録: `{ sourceWorkspaceId, nodes: [...] }`
- pasteNode()でsourceWorkspaceIdが現在のワークスペースと異なる場合、アセットコピー処理を実行
- メインプロセスにIPCチャネル追加: `file:copy-assets-between-workspaces`
  - 画像ノード: images/{nodeId}.{ext} をコピー先ワークスペースにコピー
  - HTMLノード: html/{nodeId}/ ディレクトリをコピー先ワークスペースにコピー
  - スナップショット: snapshots/{canvasNodeId}.html をコピー先ワークスペースにコピー
- コピー元ノードのデータを更新（新ノードIDに合わせてアセットパスを再マッピング）
- 画像・HTMLがない単純なノード（テキスト・URL・Note）はアセットコピー不要

Key files/modules（触るファイル・ディレクトリ）
- src/renderer/canvas/canvas.js（clipboard構造変更、pasteNode拡張）
- src/main/ipc-handlers.js（file:copy-assets-between-workspaces追加）
- src/main/file-manager.js（copyAssetsBetweenWorkspaces関数追加）
- src/renderer/preload.js（API追加）
- src/shared/constants.js（チャネル追加）

Acceptance criteria（完了の定義）
- ワークスペースAで画像・HTMLノードをCmd+C → ワークスペースBでCmd+V → ノードが正しく表示される
- コピー先ワークスペースのassets/に画像・HTMLファイルがコピーされている
- スナップショットも引き継がれる
- テキスト・URL・Noteノードのワークスペース間コピーも正常動作

Verification commands（確認用コマンド）
- `npm start` → ワークスペースAで全種類ノード作成→Cmd+C→ギャラリーに戻る→ワークスペースBを開く→Cmd+V→全ノード表示確認

### MILESTONE 03 - グループ化/解除
Scope（この段階で何をやるか）
- 新しいノードタイプ「group」を追加。データ構造: `{ type: 'group', childIds: [nodeId, ...], ... }`
- グループ作成（Cmd+G）: 選択中の複数ノードのバウンディングボックスを計算→groupノードを作成→子ノードのgroupIdプロパティを設定→子ノードの座標をグループ相対座標に変換
- グループ表示: 子ノード群を囲む薄いボーダー枠。グループノード自体がcanvas-nodeとしてレンダリングされ、子ノードはその内部に配置
- グループのドラッグ: グループノードをドラッグすると子ノードも一緒に移動（相対位置維持）
- グループのリサイズ: バウンディングボックスのリサイズで子ノードを比率スケール
- グループのz-index: グループノードに1つのzIndexを持ち、子ノードは内部的に相対zIndexを維持
- グループ内編集（Figma方式）:
  - グループをダブルクリック → 「グループ内編集モード」に入る（Canvas.editingGroupId = groupNodeId）
  - グループ内編集モード中: グループ外はグレーアウト、子ノードの個別選択・編集が可能
  - グループ外をクリック → グループ内編集モードを抜ける
- グループ解除（Cmd+Shift+G）: 子ノードの座標をグループ絶対座標に戻す→groupノードを削除→子ノードのgroupIdをクリア
- グループ削除: グループノード削除時に子ノードも全て削除
- 1階層制限: グループ内のノードは追加のグループ化を不可にする（Cmd+G時に既にグループ内のノードが含まれていたら無視）
- ActionHistoryにgroup/ungroup型のアクション追加（undo/redo対応）
- node-group.jsを新規作成（レンダリング・グループ操作ロジック）

Key files/modules（触るファイル・ディレクトリ）
- src/renderer/canvas/node-group.js（新規: グループノードのレンダリング・操作）
- src/renderer/canvas/node-base.js（グループ判定、グループ内編集モード対応）
- src/renderer/canvas/canvas.js（Cmd+G/Cmd+Shift+G、editingGroupId管理、レンダリング更新）
- src/renderer/canvas/action-history.js（group/ungroup型追加）
- src/renderer/styles/canvas.css（グループ枠スタイル、グレーアウト）
- src/renderer/index.html（node-group.jsのscriptタグ追加）

Acceptance criteria（完了の定義）
- 複数ノード選択→Cmd+Gでグループ化され、枠で囲まれる
- グループをドラッグすると子ノードが一緒に移動する
- グループをリサイズすると子ノードが比率を保ってスケールする
- グループをダブルクリックで内部に入り、個別ノードを編集できる
- グループ外クリックで編集モードを抜ける
- Cmd+Shift+Gでグループ解除され、子ノードが独立する
- グループ削除時に子ノードも削除される
- Cmd+Zでグループ化/解除/削除を取り消せる
- ネストしたグループ化はブロックされる

Verification commands（確認用コマンド）
- `npm start` → 複数ノード作成→選択→Cmd+G→グループ化確認→ドラッグ→ダブルクリックで内部編集→外クリック→Cmd+Shift+G→解除確認

## ARCHITECTURE OVERVIEW
- ロック: ノードデータの`locked`フラグで制御。UI層で操作をブロック
- ワークスペース間コピペ: clipboardにsourceWorkspaceIdを含め、ペースト時にメインプロセスでアセットをコピー
- グループ: 新しいノードタイプ「group」で子ノードIDを管理。子ノードはgroupIdで所属を把握。グループ内編集はCanvas.editingGroupIdで状態管理

## IMPLEMENTATION NOTE & DECISION LOG
- マイルストーンごとに、行動時にぶつかった悩みどころと最終的な判断はこの`PLAN.md`をベースとした計画実行中に随時以下に記載すること。（この記載は削除しないでください）
- PLAN作成時は以下の項目はこのまま記載をしておくこと。

- MILESTONE 01
  - ロック判定はbindDrag/bindResize/deleteNode/enterTextEditの各エントリポイントでreturnする方式。UI層での一括制御で十分なのでデータモデル側にバリデーションは不要と判断
  - ロックアイコンはUnicodeの🔒を使用。カスタムSVGアイコンも検討したがファイル依存を増やさないため絵文字で統一
  - NoteノードのtextareaはreadOnlyプロパティで制御。contentEditableのテキストノードはenterTextEditのガードで制御
- MILESTONE 02
  - clipboardの構造を `{ sourceWorkspaceId, nodes }` に変更。旧形式（配列直接）との互換性チェックをpasteで追加
  - アセットコピーはメインプロセス側で実行。画像はnodeIdプレフィックスでファイルをフィルタ、HTMLはnodeIdディレクトリごとコピー
  - スナップショットのコピーは旧canvasNodeId→新canvasNodeIdでリネームコピー
- MILESTONE 03
  - グループノードは通常のノードとして`type: 'group'`で管理。子ノードはgroupIdプロパティで所属を表現
  - グループの座標はバウンディングボックス+16pxパディング。リサイズ時は子ノードも比率スケール
  - グループ内編集はCanvas.editingGroupIdで状態管理。グループ外ノードにgroup-dimmedクラスを付与してグレーアウト
  - ドラッグ時に子ノードも含めてcollectDragNodes()で位置を収集。グループノードのドラッグで自動的に子ノードも移動
  - ネスト防止: createGroupでgroupId付きノードやgroupタイプのノードが含まれていたらreturn
