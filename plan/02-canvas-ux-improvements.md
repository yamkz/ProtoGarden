# PLAN: キャンバスUX改善・基盤整備
日時: 2026-03-17

## GOAL
- ProtoGardenのキャンバス操作体験を大幅に向上させ、エディタとしての基盤機能を整備する

## PURPOSE
- ノード整列の手間を削減し、複数操作・Undo/Redo・ワークスペース共有を可能にする

## MILESTONE

### MILESTONE 01 - Undo/Redo履歴システム
Scope（この段階で何をやるか）
- 操作履歴スタック（ActionHistoryクラス）を新規作成。push/undo/redo/clearメソッド、上限50件
- アクション型の定義: node-add, node-delete, node-move, node-resize, node-edit, node-zindex, multi-node-move, multi-node-resize, multi-node-delete
- 各アクションはundo/redoに必要な情報（before/afterスナップショット）を保持
- 既存のNodeBase.deleteHistory（10件制限）を廃止し、新履歴システムに統合
- canvas.jsのキーボードハンドラを更新: Cmd+Z→undo、Cmd+Shift+Z→redo
- 各操作箇所（addNode, deleteNode, ドラッグ終了, リサイズ終了, テキスト編集確定, z-index変更）に履歴pushを組み込む

Key files/modules（触るファイル・ディレクトリ）
- src/renderer/canvas/action-history.js（新規）
- src/renderer/canvas/node-base.js（deleteHistory廃止、履歴push組み込み）
- src/renderer/canvas/canvas.js（キーボードハンドラ更新、履歴インスタンス管理）
- src/renderer/canvas/node-text.js（テキスト編集確定時の履歴push）

Acceptance criteria（完了の定義）
- Cmd+Zでノードの追加・削除・移動・リサイズ・テキスト編集・z-index変更を取り消せる
- Cmd+Shift+Zで取り消した操作をやり直せる
- 新しい操作を実行するとredo履歴が破棄される
- 51件目の操作で最古のエントリが自動破棄される
- アプリ再起動で履歴がリセットされる

Verification commands（確認用コマンド）
- `npm start` → ノードを作成→移動→リサイズ→Cmd+Z×3で全て戻る→Cmd+Shift+Z×3で全てやり直し

### MILESTONE 02 - 複数選択の一括操作
Scope（この段階で何をやるか）
- Shift+クリックによる選択追加/解除をbindSelectに実装
- 一括ドラッグ移動: bindDragで複数選択時に全selectedNodeIdsのノードを相対位置を保ったまま移動。移動開始時に全ノードの初期位置を記録し、ドラッグ終了時にmulti-node-moveアクションとして履歴に記録
- 一括リサイズ: 複数選択時のリサイズで、選択範囲のバウンディングボックスを基準に全ノードを比率を保ってスケール。リサイズ終了時にmulti-node-resizeアクションとして履歴に記録
- 一括削除は既存のdeleteSelected()を維持（M01で履歴対応済み）

Key files/modules（触るファイル・ディレクトリ）
- src/renderer/canvas/node-base.js（bindSelect, bindDrag, bindResize更新）
- src/renderer/canvas/canvas.js（マーキー選択との連携）

Acceptance criteria（完了の定義）
- Shift+クリックでノードの追加選択/選択解除ができる
- 複数選択状態で1つのノードをドラッグすると全選択ノードが一緒に動く
- 複数選択状態でリサイズすると全選択ノードが比率を保ってスケールする
- 一括移動・リサイズがCmd+Zで一括に戻せる
- マーキー選択→Shift+クリックで選択を追加/解除できる

Verification commands（確認用コマンド）
- `npm start` → 複数ノードを作成→マーキー選択→ドラッグ→全ノード移動確認→Cmd+Zで戻る確認

### MILESTONE 03 - スマートガイド（スナップ整列）
Scope（この段階で何をやるか）
- SmartGuideモジュールを新規作成。ドラッグ中のノードと他の全ノードの6つの基準線（top, bottom, left, right, centerX, centerY）を比較
- 吸着距離5px以内でスナップ発動: ドラッグ中のノード位置を吸着先にスナップ補正
- ガイドライン描画: キャンバスコンテナ上にSVGまたはdivで赤い細線（1px, #ff3366）を表示。水平・垂直それぞれ最大1本ずつ
- ガイドラインはキャンバスの端から端まで延伸
- ドラッグ終了時にガイドラインを除去
- リサイズ時にもスナップを適用（リサイズ中の辺が他ノードの辺に吸着）
- 複数選択の一括移動時はバウンディングボックスの辺・中心でスナップ判定

Key files/modules（触るファイル・ディレクトリ）
- src/renderer/canvas/smart-guide.js（新規）
- src/renderer/canvas/node-base.js（bindDrag, bindResizeにスナップ呼び出し追加）
- src/renderer/styles/canvas.css（ガイドラインスタイル追加）

Acceptance criteria（完了の定義）
- ノードを他ノードの端に近づけると赤いガイドラインが表示され、位置がスナップする
- 上下左右の端と中心線の6方向でスナップが機能する
- 水平・垂直同時にスナップできる
- リサイズ時にもスナップが機能する
- 複数選択移動時にもスナップが機能する
- ドラッグ/リサイズ終了でガイドラインが消える

Verification commands（確認用コマンド）
- `npm start` → ノード2つ作成→1つをドラッグして端を揃える→赤線表示・吸着確認

### MILESTONE 04 - ワークスペース複製
Scope（この段階で何をやるか）
- storage.jsにduplicateWorkspace(id)を追加: JSONの深コピー+新ID生成、名前に「(copy)」追加
- file-manager.jsにcopyWorkspaceAssets(srcId, dstId)を追加: assets/{srcId}/全体をassets/{dstId}/に再帰コピー
- ノードIDの再マッピング: 複製ワークスペース内の全ノードに新IDを振り、アセットパスも新IDに対応させる
- ipc-handlers.jsにworkspace:duplicateチャネルを追加
- preload.jsとconstants.jsにチャネル定義追加
- gallery.jsの各ワークスペース行に「複製」ボタンを追加（コピーアイコン）
- 複製後、ギャラリー一覧をリフレッシュ

Key files/modules（触るファイル・ディレクトリ）
- src/main/storage.js（duplicateWorkspace追加）
- src/main/file-manager.js（copyWorkspaceAssets追加）
- src/main/ipc-handlers.js（workspace:duplicateチャネル追加）
- src/renderer/preload.js（API追加）
- src/shared/constants.js（チャネル追加）
- src/renderer/gallery/gallery.js（複製ボタン追加）

Acceptance criteria（完了の定義）
- ギャラリーで複製ボタンを押すと「〇〇 (copy)」としてワークスペースが複製される
- 複製されたワークスペースを開くと全ノードが正しい位置に表示される
- 画像・HTMLアセット・スナップショットが全て複製先で正しく表示される
- 元のワークスペースに影響がない

Verification commands（確認用コマンド）
- `npm start` → 画像・HTMLノードを含むワークスペースを複製→開いて全ノード・アセット表示確認
- `ls [ストレージ]/assets/` で複製先フォルダの存在確認

### MILESTONE 05 - ワークスペースのエクスポート/インポート
Scope（この段階で何をやるか）
- エクスポート:
  - ipc-handlers.jsにworkspace:exportチャネル追加
  - dialog.showSaveDialogで保存先選択（デフォルトファイル名: {workspaceName}.protogarden.zip）
  - archiver（npm追加）でワークスペースJSON + assets/{id}/フォルダを.zipにパッケージ
  - zip内構造: workspace.json + assets/（images/, html/, snapshots/）
- インポート:
  - ipc-handlers.jsにworkspace:importチャネル追加
  - dialog.showOpenDialogで.zipファイル選択
  - adm-zip（npm追加）で展開、workspace.jsonを読み取り
  - 同名ワークスペースが存在する場合は名前に「(imported)」を付加
  - 新IDを生成し、JSONとアセットをストレージフォルダに配置
- gallery.jsにエクスポートボタン（各ワークスペース行）とインポートボタン（ヘッダー）を追加
- preload.jsとconstants.jsにチャネル定義追加
- 不正なzipや破損ファイルへのエラーハンドリング

Key files/modules（触るファイル・ディレクトリ）
- package.json（archiver, adm-zip依存追加）
- src/main/ipc-handlers.js（export/importチャネル追加）
- src/renderer/preload.js（API追加）
- src/shared/constants.js（チャネル追加）
- src/renderer/gallery/gallery.js（エクスポート/インポートボタン追加）
- src/renderer/styles/gallery.css（ボタンスタイル追加）

Acceptance criteria（完了の定義）
- エクスポートボタンで.zipファイルが生成される
- 生成されたzipを別環境（別のストレージフォルダ）でインポートしてワークスペースが正しく復元される
- 画像・HTML・スナップショットが全て正しく表示される
- 同名ワークスペース存在時に「(imported)」が付く
- 破損zipでエラーメッセージが表示される

Verification commands（確認用コマンド）
- `npm start` → ワークスペースをエクスポート→ストレージフォルダを変更→インポート→全ノード表示確認
- `unzip -l exported.zip` でzip内容確認

## ARCHITECTURE OVERVIEW
- ActionHistory: undo/redoスタックを管理する独立モジュール。Canvas初期化時にインスタンス作成、ワークスペース切替時にclear
- SmartGuide: ドラッグ/リサイズ中のスナップ計算とガイドライン描画を担当する独立モジュール。NodeBaseから呼び出し
- ワークスペース複製/エクスポート/インポート: メインプロセス側でファイル操作を完結。レンダラーはIPCで結果を受け取るだけ

## IMPLEMENTATION NOTE & DECISION LOG
- マイルストーンごとに、行動時にぶつかった悩みどころと最終的な判断はこの`PLAN.md`をベースとした計画実行中に随時以下に記載すること。（この記載は削除しないでください）
- PLAN作成時は以下の項目はこのまま記載をしておくこと。

- MILESTONE 01
  - 既存のdeleteHistory（10件）を廃止しActionHistoryに統合。deleteNodeにskipHistoryフラグを追加して、multi-node-deleteの場合に個別pushを避ける設計にした
  - テキスト編集の履歴はinputイベントごとでなく、focusで開始状態を記録しblurで差分があればpushする方式に。タイピング中に大量の履歴が溜まるのを防止
  - M1実装時にマルチ選択ドラッグも同時に実装（bindDrag内のmulti-select対応）。M2と重複するが、undo履歴に移動情報を記録する都合上、ドラッグ部分の書き換えがM1で必要だったため
- MILESTONE 02
  - Shift+クリックによるトグル選択を追加。既に複数選択中のノードをクリックした場合、deselectAllせずにそのまま維持する判定を追加（multi-dragのため）
  - マルチリサイズはバウンディングボックスの比率でスケールする方式。各ノードのBB内の相対位置を維持してリサイズ
- MILESTONE 03
  - スナップ判定は移動中のノードの6基準点（top/bottom/left/right/centerX/centerY）× 他全ノードの同6基準点で行う。計算は毎mousemoveで実行するが、ノード数が少ない前提で十分な性能
  - ガイドラインはcanvas-container内にdivとして配置。SVGも検討したがdivのほうが既存スタイルと統一しやすい
  - リサイズ時のスナップは、リサイズしている辺にのみスナップ補正を適用する設計
- MILESTONE 04
  - ワークスペース複製時、ノードIDは新IDに振り直すがdata.nodeId（アセット参照）はそのままにした。アセットフォルダを丸ごとコピーするため、元のnodeIdディレクトリ構造がそのまま使える
  - 循環参照回避のためstorage.jsからfile-managerをrequireする際、module.exports後のlazy requireにした
- MILESTONE 05
  - エクスポートはarchiverライブラリで.zip生成。圧縮レベル5（速度と圧縮率のバランス）
  - インポートはadm-zipでzip内のworkspace.jsonを読み取り、新IDを生成してストレージに配置。同名ワークスペースは「(imported)」を付加
  - エラーハンドリング: workspace.jsonがないzipはエラーダイアログを表示

## POST-RELEASE FIXES

### スナップショットの複製時リネーム修正
- 複製時にノードIDが新IDに振り直されるが、snapshots/配下のファイル名が旧IDのままだった → duplicateWorkspace内でidMapを使いスナップショットファイルをリネームする処理を追加

### ギャラリーUI改善
- 記号アイコン（&#9114;, &#8615;, &#9998;, &#10005;）がわかりづらい → 日本語テキストラベル（複製/書出/名変/削除）に変更
- インポートボタンも「インポート」→「ファイルから読込」に変更
