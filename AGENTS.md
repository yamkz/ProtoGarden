# 前提条件
- 1番最初にWORKLOG.mdを確認し、作業状態を確認してください。
- どれだけ小さな実装依頼（その場で作る）でも以下のWORKLOG/TASK/PLANを用いた状態記録プロセスを行うこと

## それぞれのファイルに関する説明
- WORKLOG.md: TASK.md/PLAN.mdの状態を随時記録する場所
- TASK.md(task/{number}-{taskname}.md): AIエージェントが読む前提で構築された何をするかまとめた書
- PLAN.md(plan/{number}-{planname}.md): AIエージェントが読む前提で構築された実行計画書
(それぞれのフォルダにテンプレートが存在しているので作成する際は参照/その指示に従ってください)

# 動作ルール
## if: ユーザーから新しいタスクの依頼があった場合
STEP1
- WORKLOG.mdを確認し、テンプレートに沿って新しいTASK.mdを作成するためにTASKファイル作成のために、足りない情報を全て埋めるまでユーザーと打ち合わせをしてください。ユーザーがそれでいいというまで、TASK.mdは作成せず、対話で擦り合わせを続けること。
STEP2
- TASK.mdを作成を完了したら、WORKLOG.mdの該当のTASKの箇所をplannedに変更する（該当箇所がなければ追記すること)
STEP3
- TASK.mdの作成が完了したら、それに沿ったPLAN.mdを作成し、ユーザーにPLAN.mdの全体像を対話でわかりやすく伝えること。この際、いきなり実装へは移動しない。
- PLAN.mdの設定を完了した際は、随時WORKLOG.mdの該当のMILESTONEの箇所をplannedに変更する（該当箇所がなければ追記すること)

## if: ユーザーから実行中のタスクを進めて欲しいと言われた場合
- WORKLOG.mdを確認し、進行中のTASK.md/PLAN.mdを読み、それらのファイルの通り実装を完了してください。

## if: TASK.md, PLAN.mdに沿って行動する場合
- WORKLOG.mdの該当のTASK, MILESTONEの箇所をin-progressに変更する
- PlANのマイルストーンが完了するたび、completeへ変更する。
- すべてのPLANが完了後、それと紐づいたTASKの箇所もcompleteへ変更する。
- もし途中でタスク/計画が変更・破棄になった場合、該当のTASK, MILESTONEの箇所をrejectedへ変更する。

## if: プランに沿って行動中に、悩みにぶつかり最終的な判断を決定した場合
- 現在沿って行動している元のPLAN.mdの「IMPLEMENTATION NOTE & DECISION LOG」の箇所に「行動時にぶつかった悩みどころと最終的な判断」を記録する。

# 禁止事項
- テンプレートの上書きは禁止。
- TASK.md, PLAN.mdへの曖昧な指示の禁止。具体的で明示的な記載をお願いします。
- TASK, PLAN.mdへのWORKLOG/TASK/PLANの運用の記載は禁止。