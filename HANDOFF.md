# 《萬靈山海煉妖錄》維護交接

更新時間：2026-07-30（Asia/Taipei）

## 專案狀態

- 正式名稱：《萬靈山海煉妖錄》
- GitHub repository：<https://github.com/prayer168/Demon-Refining>
- GitHub Pages：<https://prayer168.github.io/Demon-Refining/>
- 部署分支：`main`
- 執行方式：純靜態 HTML／CSS／JavaScript，可直接開啟 `index.html`，不需要 API Key、後端或資料庫。

## 完成內容

- 36 種原創妖怪＋60 種《山海經》異獸，共 96 種。
- 100 組可到達配方、14 處探索、八卷山海卷軸、25 項任務與成就。
- 九大底部導覽：煉妖房、妖怪庫、妖怪圖鑑、山海圖鑑、配方圖鑑、山海卷軸、探索、任務與成就、遊戲說明。
- 96／96 種妖怪均有獨立 512×512 WebP；`monster-images.js` 恰有 96 筆唯一映射，正式資料不會觸發程序 SVG 回退。
- LocalStorage 自動存檔、JSON 匯出／匯入、存檔驗證、二次確認重置、響應式版面與鍵盤操作。

## 圖像資產

- 正式遊戲圖：`assets/monsters/*.webp`，共 96 張。
- ID 映射：`monster-images.js`。
- 原始生成 PNG：`assets/monsters/source/`，由 `.gitignore` 排除，不放入發布 ZIP；本機原圖與內建 Image 生成目錄均保留。
- WebP 規格：512×512、RGB、quality 88、method 6；來源圖以 NEAREST 縮放。
- 每隻山海異獸皆依資料檔 `appearance`、`plain`、`behavior`、`art` 與精確部位數量人工驗收；不合格版本未接入。

## 驗證方式

```powershell
node tests\validate-data.js
node tests\validate-images.js
```

- `validate-data.js`：68／68 通過。
- `validate-images.js`：108／108 通過。
- 圖像測試驗證 96 個 ID、96 筆唯一映射、96 張 WebP、檔案存在、無多餘檔案、WebP 標頭、逐檔 512×512 與內容不重複。
- 瀏覽器驗證：九頁籤、36 張一般圖鑑卡、60 筆山海圖鑑、96 張 HTTP 圖像、JSON 匯入、桌機與 390×844 手機版面均通過；主控台與頁面錯誤為零。
- 詳細證據見 `docs/TEST_REPORT.md`。

## 發布與打包

- 根目錄 `index.html` 為 GitHub Pages 入口；相對路徑可在 repository 子路徑運作。
- 靜態資源查詢版本已提升為 `v=2.0.0`，避免舊版映射快取。
- 最終 ZIP：`萬靈山海煉妖錄.zip`；包含完整遊戲與 96 張 WebP，不包含 `.git/`、原始 PNG、測試截圖或既有 ZIP。
- v2.0.0 已推送並完成 GitHub Pages 建置；公開首頁、九頁籤、手機版面與 96／96 張圖像均已複驗通過。

## 後續維護注意

- 新增妖怪時必須同步加入資料檔、配方／取得路徑、`monster-images.js` 與對應 WebP，並重跑兩支測試。
- 不要改動既有穩定 ID，否則舊存檔會失去對應。
- 《山海經》內容需繼續區分【古籍記載】【白話轉譯】【合理推測】【遊戲設定】，來源以篇章直接連結為準。
- 已知產品邊界與瀏覽器差異見 `docs/KNOWN_LIMITATIONS.md`。
