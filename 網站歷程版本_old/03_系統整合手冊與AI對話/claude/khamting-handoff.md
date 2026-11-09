# 專案交接：基隆鮮物．崁仔頂小商人 khàm-tíng

整理日期：2026-10-31｜用途：貼進新對話，接續上線與後續開發

## 1. 專案目標

單一檔案 Web 應用程式，結合崁仔頂現流搶購與電商購物車：Google 登入、冷凍商品直接購物、每日 12:00 現流限量解鎖並防超賣、單張訂單獨立對帳、同一人當週併單與運費計算、開箱影音、Q&A、CSV 報表、營運管理後台。

品牌色：深海靛藍 #082f49、珊瑚紅 #ff4d4d、琥珀金 #f59e0b。Logo 為珊瑚紅幾何魚 SVG。版面：左 2/3（現流區＋影音區）、右 1/3（冷凍商品區），手機版底部導覽列。

## 2. 已確認的營運決策

- 現流每日 12:00 開賣，庫存即時扣減，搶完顯示「已搶完」。
- 運費採「請顧客補匯」：訂單金額不含運費，出貨前依當週併單金額計算，通知顧客補匯，收到後才出貨。
- 運費階梯（當週已核銷合計）：滿 $3,000 免運；$2,000～2,999 運費 $60；未滿 $2,000 運費 $130。併單歸戶鍵為「買家暱稱＋手機末 4 碼」，週期為週一至週日。
- 對帳採手動「核算確認」：管理員輸入網銀實收金額與入帳後 5 碼，與訂單金額、顧客回填後 5 碼相符才能放行；不符須填備註才能強制放行。放行後狀態為「已對帳核銷」，訂單才算成立。
- 銀行帳號不放在網站上，只出現在 Email 訂單確認信中（用 EmailJS 寄送，帳號寫在 EmailJS 模板內）。核銷後另寄不含帳號的「已收款通知」。
- Q&A 共 10 題（含 6 小時內拍照反映品質異常、生鮮不接受無條件退換貨、LINE 官方帳號 @kanziding、發票以收據為主、備註欄可註明統編）。
- 管理員信箱：twvisa2009@gmail.com。

## 3. 交付物

| 項目 | 說明 |
|---|---|
| khamting.html / 展示版頁面 | 純前端展示版，資料存在各人瀏覽器 localStorage，不能收真實訂單。連結：https://claude.ai/artifact/QPgc76CCALuvQFTBbAkYVE |
| khamting-deploy.zip | 正式上線包，解壓縮為 khamting 資料夾 |
| ├ public/index.html | 已整合 Firebase（Auth、Firestore）與 EmailJS 的正式版 |
| ├ firestore.rules | 安全規則，管理員以 Custom Claims 判斷 |
| ├ firebase.json | Hosting 與 Firestore 規則部署設定 |
| └ setAdmin.js | 一次性程式，替管理員信箱設定 admin claim |
| 上線指南文件（Claude Doc） | https://claude.ai/artifact/FfRyAR18tjuPiggSWf2w6L 。注意：其中的程式碼段落是舊版（信箱寫死在規則、含銀行帳號），已被 zip 取代，管理者手冊部分仍可參考 |

## 4. 技術架構（正式版）

- 前端：單一 HTML，Firebase compat SDK 10.12.2（app、auth、firestore）、EmailJS browser SDK 4.4.1（版本號為撰寫時範例，請對照官方文件）。
- Firestore 集合：
  - `stock/{商品ID}`：`{stock:int}`。現流 f1、f2；冷凍 z1～z8。任何人可讀，登入者只能「減少」，管理員可寫。
  - `orders/{單號}`：`id, uid, nick, phone, name, addr, email, items[], amt, note, last5, status('pending'|'ok'), ts`，核銷後新增 `paid, paid5, recNote, okAt`。顧客只能讀自己的訂單、只能改自己訂單的 `last5`；管理員可讀寫全部；禁止刪除。
  - `ship/{編碼後的 週一日期|暱稱｜末4碼}`：`{key, ok}`，記錄運費是否已補匯，僅管理員可讀寫。
- 下單用 Firestore transaction 檢查並扣庫存，防超賣。單號格式 `KT` + 年月日 + 4 碼隨機。
- 管理員判斷：登入後讀 `getIdTokenResult().claims.admin === true`。
- 主要函式：`submitO`（下單＋寄確認信）、`vRec / recChk / confirmRec`（核算確認）、`groups / fee / weekKey / shipOk / setShip / shipCell`（併單與運費）、`printShip`（只列入已核銷且已補匯的客戶）、`csvO / csvC`（UTF-8 BOM）、`rQA`（Q&A 由 QA 陣列產生）。
- 模擬時間按鈕（`#simb`）正式版只有管理員看得到，供測試現流開賣。

## 5. 上線前要填的佔位符（public/index.html）

- Firebase：`YOUR_API_KEY`、`YOUR_AUTH_DOMAIN`、`YOUR_PROJECT_ID`、`YOUR_APP_ID`
- EmailJS：`YOUR_EMAILJS_PUBLIC_KEY`、`YOUR_SERVICE_ID`、`YOUR_ORDER_TEMPLATE_ID`、`YOUR_PAID_TEMPLATE_ID`
- 影片：程式內 `VIDS` 陣列目前三個按鈕都是同一支示範影片，需換成實際 YouTube 影片 ID
- 商品名稱、價格、庫存為範例資料（`FRESH`、`FRZ` 陣列與 Firestore `stock`）

## 6. 部署流程摘要

1. 建立 Firebase 專案 → 註冊網頁應用取得設定值 → 啟用 Google 登入 → 建立 Firestore（asia-east1、正式版模式）。
2. 填入 Firebase 設定值；完成 EmailJS 設定（Gmail 服務、兩個模板）並填入。
3. `npm install -g firebase-tools` → `firebase login` → `cd khamting` → `firebase use --add` → `firebase deploy`。
4. 用管理員 Gmail 登入網站一次 → 下載服務帳戶金鑰存為 serviceAccountKey.json → `npm install firebase-admin` → `node setAdmin.js` → **立刻刪除金鑰檔** → 登出再登入。
5. 管理員在瀏覽器 Console 執行 seed 程式建立初始庫存：`Object.entries({f1:20,f2:30,z1:50,z2:40,z3:35,z4:20,z5:40,z6:15,z7:60,z8:60}).forEach(([id,n])=>db.collection('stock').doc(id).set({stock:n}))`。

## 7. 上線測試清單

1. 一般帳號登入，沒有「👑 營運後台」。
2. 一般帳號下單，庫存減少並即時同步到另一瀏覽器，且收到含匯款帳號的確認信。
3. 兩邊同時搶最後 1 份，只有一人成功。
4. 一般帳號在「訂單查詢」回填後 5 碼。
5. 管理員核算確認輸入錯誤金額，顯示不符，沒填備註不能放行。
6. 輸入正確金額與後 5 碼放行，狀態變「已對帳核銷」，顧客收到不含帳號的已收款通知。
7. 併單表勾「已補匯」後列印，只列入已補匯客戶。
8. 匯出兩份 CSV，Excel 開啟無亂碼。
9. 一般帳號 Console 讀取全部訂單、修改核銷狀態，都應回傳 `permission-denied`。
10. 手機下單與登入彈窗正常。
11. 網頁原始碼搜尋不到銀行帳號數字。

開店前：刪除測試訂單與 `ship` 測試資料，庫存改回真實數量，管理員 Gmail 開兩步驟驗證，EmailJS 後台限制允許網域，自訂網域要加進 Firebase 已授權網域。

## 8. 已知限制與風險

- 價格由前端送出，可被竄改；惡意登入者可亂扣庫存。核銷時務必比對實收金額。根治需 Cloud Functions 後端下單（需 Blaze 付費方案）。
- 現流 12:00 解鎖看的是顧客裝置時鐘，庫存仍由後端控管。
- EmailJS 免費額度有限（我記得約每月 200 封，請以官網為準），每張訂單最多兩封信；Public Key 在網頁中可見，務必限制網域。
- 確認信若寄不出或進垃圾信匣，顧客看不到帳號，目前沒有「重寄確認信」按鈕，只能手動寄。
- 取消訂單目前沒有後台按鈕，須到 Firestore 主控台手動刪除並加回庫存。
- 沒有商品圖片、商品管理頁面。

## 9. 待辦與可能的下一步

1. 使用者實際部署與測試（尚未確認進度）。
2. 後台加「重寄確認信」按鈕。
3. 後台商品管理頁（改價格、庫存、上下架），目前需改程式或進 Firestore 主控台。
4. 更新上線指南文件，移除舊程式碼段落與銀行帳號。
5. 取消訂單功能（含庫存回補）。
6. 後端下單（Cloud Functions）以根治金額竄改。
7. 食品業者登錄、退換貨條款、隱私權政策等行政事項（需向主管機關或專業人士確認）。
8. 評估 Claude Code：可直接改本機 khamting 資料夾並執行部署，適合日後常改版；金鑰檔用完必須刪除。

## 10. 給新對話的起始 prompt

見聊天回覆中的 prompt，連同本檔與 khamting-deploy.zip 一起貼入、上傳。
