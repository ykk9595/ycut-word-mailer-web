# YCut 物件明細表網站

GitHub Pages 靜態網站：貼上 YCut 案件網址後，在瀏覽器內產生固定格式 Word，立即下載並透過 FormSubmit 寄送附件。

## 功能

- 直接讀取 YCut 公開案件頁內嵌資料（案件頁支援跨來源讀取）。
- 使用內建空白母版，只修改 `word/document.xml` 文字內容。
- 將 YCut 的朝向、登記用途與物件型態轉成母版對應欄位及代碼。
- 將 YCut「房屋描述」逐行填入 Word「物件特性」，最多五行；不足五行時保留空白編號。
- Word 會先下載到本機，即使寄信服務失敗也不會遺失文件。
- 收件信箱固定在程式設定中，網站畫面不顯示信箱輸入欄位。
- 使用 FormSubmit 官方支援的原生 `multipart/form-data` 表單寄送 Word 附件。
- Word 表頭與寄信主旨使用每個 YCut 案件自己的完整案件名稱。
- 下載檔名使用完整案件名稱，並自動替換 Windows 不允許的檔名字元。
- 固定填入開發人員比例、開發銷售比例與外商圈說明書簽名。
- 不在網站中保存 Gmail 密碼或其他郵件憑證。

## 第一次啟用寄信

FormSubmit 第一次收到網站提交時，會寄一封啟用信到預設收件信箱。點擊信中的確認連結後，再提交一次即可收到 Word 附件。

## 本機預覽

必須使用 HTTP 伺服器開啟，不能直接雙擊 `index.html`。例如：

```powershell
python -m http.server 8080
```

再開啟 `http://localhost:8080/`。

## 第三方元件

本專案包含 JSZip 3.10.1，授權內容位於 `vendor/JSZIP-LICENSE.md`。
