# PFC 管理 PWA

毎食ごとに P（たんぱく質）/ F（脂質）/ C（炭水化物）/ kcal を記録して、
日次の残量と週次の達成度を一目で確認できる PWA。
体重・筋肉量・体脂肪率も合わせて管理可能。

## 構成
- フロント: バニラ HTML/CSS/JS の PWA
- 一次保存: localStorage
- 同期（任意）: Google Apps Script + スプレッドシート

## ローカル起動
```powershell
Set-Location 'C:\Users\keita.isaka\calorie-pwa'
python -m http.server 8000
# → http://localhost:8000/
```
※ 修正後は **Shift+F5** または DevTools > Application > Service Workers > Update で SW を更新

## GAS セットアップ
1. 新規 Google スプレッドシート作成
2. 拡張機能 → Apps Script を開き、`gas/Code.gs` の内容を貼り付けて保存
3. （推奨）プロジェクト設定 → スクリプトプロパティ で `SHARED_SECRET` を任意の文字列で登録
4. デプロイ → ウェブアプリ → 自分として実行 / 全員アクセス可能 → URL をコピー
5. PWA の「設定」タブで URL と共有シークレットを入力

## ファイル構成
```
calorie-pwa/
├── index.html       # 3 タブ (入力 / グラフ / 設定) + 入力モーダル
├── style.css        # デザイントークン（インディゴ基調）
├── app.js           # state, render, グラフ描画, GAS 同期
├── manifest.json    # PWA マニフェスト
├── sw.js            # Service Worker
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── make_icons.py
└── gas/Code.gs      # GAS API（meals/weights 2 シート、SHARED_SECRET 認証）
```

## データ
- `cal_meals`: `[{id, ts, date, meal, note, protein, fat, carb, kcal}]`
- `cal_weights`: `[{id, ts, date, weight, muscle, bodyFat}]`
- `cal_targets`: `{daily_kcal, daily_protein, daily_fat, daily_carb, target_weight, target_muscle, target_body_fat}`
- `cal_gas_url`, `cal_gas_token`: GAS 設定
- `cal_pending_sync`: オフライン時の同期キュー
