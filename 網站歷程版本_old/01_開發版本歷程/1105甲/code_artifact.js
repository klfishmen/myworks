/**
 * ⚓ 基隆鮮物．崁仔頂小商人 (khàm-tíng) 系統後端 (2026 旗艦版)
 * 支援從 Google 試算表抓取真實訂單給後台檢視
 */

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (action === "getOrders") {
    var sheet = spreadsheet.getSheetByName("訂單紀錄");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    
    var rows = sheet.getDataRange().getValues();
    var orders = [];
    for (var i = 1; i < rows.length; i++) {
      orders.push({
        orderId: rows[i][0],
        createdAt: rows[i][1],
        userEmail: rows[i][2],
        userPhone4: rows[i][3],
        grandTotal: rows[i][4],
        remitAmount: rows[i][5],
        remitLast5: rows[i][6],
        recipientName: rows[i][7],
        recipientPhone: rows[i][8],
        store711: rows[i][9],
        storeFamily: rows[i][10],
        shippingOption: rows[i][11],
        status: rows[i][12],
        itemsStr: rows[i][14] || ""
      });
    }
    return ContentService.createTextOutput(JSON.stringify(orders)).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "active" })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    if (data.action === "updateRemittance") {
      return handleRemittanceReport(spreadsheet, data);
    } else if (data.action === "newChatBackup") {
      return handleChatBackup(spreadsheet, data);
    } else {
      return handleNewOrder(spreadsheet, data);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleNewOrder(spreadsheet, data) {
  var sheet = spreadsheet.getSheetByName("訂單紀錄");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("訂單紀錄");
    sheet.appendRow([
      "訂單編號", "下單時間", "買家Email", "手機後4碼", 
      "應付總額", "匯款金額", "匯款後5碼", "收件人姓名", 
      "收件人手機", "7-11門市", "全家門市", "出貨選項", 
      "結單狀態", "出貨狀態", "商品明細"
    ]);
  }

  var itemsStr = "";
  if (data.items && data.items.length > 0) {
    itemsStr = data.items.map(function(item) {
      return item.name + " (" + (item.spec || '標準') + ") x " + item.qty + " (NT$" + (item.price * item.qty) + ")";
    }).join(", ");
  }

  sheet.appendRow([
    data.orderId,
    data.createdAt,
    data.userEmail,
    data.userPhone4,
    data.grandTotal,
    "待填寫",
    "待填寫",
    "待填寫",
    "待填寫",
    "待填寫",
    "待填寫",
    "待選擇",
    "待確認",
    "未出貨",
    itemsStr
  ]);

  var reportUrl = "https://twvisa2009.github.io/index.html?orderId=" + encodeURIComponent(data.orderId) + "&email=" + encodeURIComponent(data.userEmail);

  var emailSubject = "【基隆鮮物．崁仔頂小商人】您的訂單已成立與匯款對帳通知 (訂單編號: " + data.orderId + ")";
  var htmlBody = 
    "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 16px; border: 1px solid #0284c7;'>" +
      "<h2 style='color: #38bdf8; text-align: center;'>⚓ 基隆鮮物．崁仔頂小商人</h2>" +
      "<p>親愛的買家 您好：</p>" +
      "<p>感謝您的熱情搶購！您的訂單已成功建立，現流漁獲為您<strong>限時保留 24 小時</strong>。</p>" +
      "<div style='background-color: #1e293b; padding: 16px; border-radius: 12px; margin: 16px 0; border-left: 4px solid #e11d48;'>" +
        "<p>📦 <strong>訂單編號：</strong>" + data.orderId + "</p>" +
        "<p>🛒 <strong>購買商品：</strong>" + itemsStr + "</p>" +
        "<h3 style='color: #fb7185; margin: 8px 0 0 0;'>💵 應付總額：NT$ " + data.grandTotal + "</h3>" +
      "</div>" +
      "<div style='text-align: center; margin: 28px 0;'>" +
        "<a href='" + reportUrl + "' target='_blank' style='background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #ffffff; padding: 16px 28px; border-radius: 12px; font-weight: bold; font-size: 16px; text-decoration: none; display: inline-block;'>👉 按此一鍵填寫匯款與門市資料 (免複製)</a>" +
      "</div>" +
    "</div>";

  if (data.userEmail && data.userEmail.includes("@")) {
    MailApp.sendEmail({ to: data.userEmail, subject: emailSubject, htmlBody: htmlBody });
  }

  return ContentService.createTextOutput(JSON.stringify({ "status": "success", "orderId": data.orderId }))
                       .setMimeType(ContentService.MimeType.JSON);
}

function handleRemittanceReport(spreadsheet, data) {
  var sheet = spreadsheet.getSheetByName("訂單紀錄");
  var rows = sheet.getDataRange().getValues();
  var found = false;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.orderId) {
      sheet.getRange(i + 1, 6).setValue("NT$" + data.remitAmount);
      sheet.getRange(i + 1, 7).setValue("'" + data.remitLast5);
      sheet.getRange(i + 1, 8).setValue(data.recipientName);
      sheet.getRange(i + 1, 9).setValue("'" + data.recipientPhone);
      sheet.getRange(i + 1, 10).setValue(data.store711);
      sheet.getRange(i + 1, 11).setValue(data.storeFamily);
      sheet.getRange(i + 1, 12).setValue(data.shippingOption);
      sheet.getRange(i + 1, 13).setValue("已結單");
      found = true;
      break;
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ "status": found ? "success" : "not_found" }))
                       .setMimeType(ContentService.MimeType.JSON);
}

function handleChatBackup(spreadsheet, data) {
  var sheet = spreadsheet.getSheetByName("對話備份");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("對話備份");
    sheet.appendRow(["時間", "姓名", "手機後4碼", "交辦/私訊內容", "處理狀態"]);
  }
  sheet.appendRow([data.date, data.name, "'" + data.phone4, data.text, "待處理"]);
  return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))
                       .setMimeType(ContentService.MimeType.JSON);
}
```[eof]

接著是為您升級、具備**防重複點擊鎖定**的 **`index.html`** 檔案：

```html:純買家購物與一鍵對帳中心:index.html
```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <title>基隆鮮物．崁仔頂小商人 khàm-tíng | 官方主頁與對帳中心</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: linear-gradient(135deg, #091e3a 0%, #0f172a 100%); color: #f1f5f9; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; }
        
        nav { background-color: #020617; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding: 14px 24px; position: sticky; top: 0; z-index: 50; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        .nav-brand { display: flex; align-items: center; gap: 12px; }
        .nav-logo { width: 40px; height: 40px; background-color: #0284c7; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .nav-title h1 { font-size: 16px; font-weight: 700; color: #e0f2fe; }
        .nav-title p { font-size: 11px; color: #38bdf8; }

        .nav-links { display: flex; gap: 16px; align-items: center; }
        .nav-links a { color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: bold; transition: color 0.2s; }
        .nav-links a:hover { color: #38bdf8; }
        @media(max-width:768px){ .nav-links { display: none; } }
        
        .nav-right-actions { display: flex; align-items: center; gap: 10px; }
        .test-unlock-btn { background-color: #f59e0b; color: #020617; border: none; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 900; cursor: pointer; box-shadow: 0 2px 10px rgba(245,158,11,0.4); }
        .test-unlock-btn.unlocked { background-color: #10b981; color: white; }

        .cart-btn { background: none; border: none; cursor: pointer; position: relative; color: #38bdf8; padding: 8px; font-size: 24px; }
        .cart-badge { position: absolute; top: 0; right: 0; background-color: #e11d48; color: white; font-size: 10px; font-weight: 700; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #020617; }

        main { max-width: 1200px; width: 100%; margin: 0 auto; padding: 24px; flex: 1; display: flex; flex-direction: column; gap: 32px; }

        .flash-sale-banner { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 14px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 8px 20px rgba(249,115,22,0.3); flex-wrap: wrap; gap: 10px; width: 100%; }
        .flash-title { font-size: 16px; font-weight: 900; color: white; display: flex; align-items: center; gap: 6px; }
        .countdown-box { display: flex; gap: 6px; align-items: center; font-size: 13px; font-weight: bold; color: white; }
        .countdown-num { background-color: #1e293b; padding: 4px 8px; border-radius: 6px; font-family: monospace; font-size: 15px; color: #fb923c; }

        .sec-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #e11d48; padding-bottom: 8px; margin-bottom: 16px; width: 100%; }
        .sec-title-wrap span { background-color: #e11d48; color: white; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
        .sec-title-wrap h2 { font-size: 18px; font-weight: 900; color: #f8fafc; margin-top: 4px; }

        .main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: start; width: 100%; }
        @media(max-width: 768px) { .main-grid { grid-template-columns: 1fr; } }

        .left-content-area { display: flex; flex-direction: column; gap: 32px; width: 100%; min-width: 0; }
        .right-sidebar { display: flex; flex-direction: column; gap: 16px; width: 100%; min-width: 0; }

        .fresh-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; width: 100%; }
        @media(max-width: 600px) { .fresh-grid { grid-template-columns: 1fr; } }

        .empty-slot-card { background: rgba(15, 23, 42, 0.6); border: 2px dashed rgba(56, 189, 248, 0.3); border-radius: 16px; padding: 30px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; min-height: 240px; color: #94a3b8; font-size: 14px; font-weight: bold; width: 100%; }

        .product-card { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; backdrop-filter: blur(8px); width: 100%; }
        .product-img { width: 100%; height: 150px; object-fit: cover; }
        .product-body { padding: 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; justify-content: space-between; }
        .product-name { font-size: 15px; font-weight: 700; color: #f8fafc; }
        .product-spec { font-size: 12px; color: #94a3b8; }
        .product-price-stock { display: flex; justify-content: space-between; align-items: center; }
        .price { font-size: 18px; font-weight: 900; color: #fb7185; }
        .huge-stock { font-size: 18px; font-weight: 900; color: #ef4444; }

        .product-actions { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
        select { background-color: #1e293b; border: 1px solid #475569; color: #f8fafc; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 700; outline: none; }
        .buy-btn { flex: 1; background-color: #e11d48; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; }
        .buy-btn:hover { background-color: #be123c; }

        .frozen-card { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; width: 100%; }
        .frozen-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; width: 100%; }
        .frozen-info { flex: 1; min-width: 0; }
        .frozen-info h4 { font-size: 14px; font-weight: 700; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .frozen-info p { font-size: 11px; color: #94a3b8; margin: 2px 0; }
        .frozen-price { font-size: 14px; font-weight: 800; color: #38bdf8; }
        .frozen-desc { font-size: 11px; color: #cbd5e1; background: rgba(15, 23, 42, 0.5); padding: 6px 8px; border-radius: 6px; }
        .frozen-bottom { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(56, 189, 248, 0.1); padding-top: 6px; }
        .frozen-buy-btn { background-color: #0284c7; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; flex-shrink: 0; }

        .section-card { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 16px; padding: 20px; backdrop-filter: blur(8px); width: 100%; }
        .video-container { position: relative; width: 100%; padding-bottom: 56.25%; height: 0; border-radius: 10px; overflow: hidden; background: #000; margin-top: 12px; }
        .video-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
        
        .qa-item { background: rgba(30, 41, 59, 0.5); padding: 12px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid #38bdf8; }
        .qa-q { font-size: 13px; font-weight: bold; color: #38bdf8; }
        .qa-a { font-size: 12px; color: #cbd5e1; margin-top: 4px; }

        .comment-tabs { display: flex; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid #1e293b; padding-bottom: 8px; }
        .tab-sub-btn { background: #334155; color: #94a3b8; border: none; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .tab-sub-btn.active { background: #047857; color: white; }

        .comment-box { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
        .comment-input { background: #1e293b; border: 1px solid #475569; color: white; padding: 10px; border-radius: 8px; font-size: 13px; outline: none; width: 100%; }
        .comment-list { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; max-height: 250px; overflow-y: auto; }
        .comment-item { background: rgba(30, 41, 59, 0.6); padding: 12px; border-radius: 8px; font-size: 12px; border-left: 3px solid #38bdf8; }
        .comment-item.private { border-left-color: #f59e0b; background: rgba(245, 158, 11, 0.1); }

        .modal-overlay { position: fixed; inset: 0; background: rgba(2, 6, 23, 0.85); z-index: 100; display: none; align-items: center; justify-content: center; padding: 16px; }
        .modal-overlay.active { display: flex; }
        .modal-box { background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 20px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; }
        .modal-header { padding: 18px 20px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { font-size: 16px; font-weight: 900; color: #f8fafc; }
        .close-btn { background: none; border: none; color: #94a3b8; font-size: 22px; cursor: pointer; }
        .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }

        .shipping-hook-box { background: rgba(2, 132, 199, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 14px; font-size: 13px; color: #e0f2fe; display: flex; flex-direction: column; gap: 8px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 12px; font-weight: 700; color: #cbd5e1; }
        .form-control { background-color: #1e293b; border: 1px solid #475569; color: white; padding: 10px; border-radius: 8px; font-size: 13px; outline: none; width: 100%; }
        .alert-box { background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 12px; padding: 12px; font-size: 12px; color: #fde68a; line-height: 1.5; }
        .modal-footer { padding: 16px 20px; border-top: 1px solid #1e293b; display: flex; justify-content: flex-end; gap: 8px; }
        .btn-secondary { background-color: #334155; color: #cbd5e1; border: none; padding: 10px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .btn-primary { background-color: #e11d48; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 12px; font-weight: 900; cursor: pointer; }
        .emap-btn { background: #0284c7; color: white; border: none; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; }
        footer { background-color: #020617; color: #64748b; font-size: 11px; padding: 24px; text-align: center; border-top: 1px solid rgba(56, 189, 248, 0.1); }
    </style>
</head>
<body>

    <nav>
        <div class="nav-brand">
            <div class="nav-logo">⚓</div>
            <div class="nav-title">
                <h1>基隆鮮物．崁仔頂小商人</h1>
                <p>週二至週六 12:00 現流漁獲開賣 ✕ 快速對帳</p>
            </div>
        </div>
        <div class="nav-links">
            <a href="#products-section">🔥 搶購專區</a>
            <a href="#video-section" id="nav-video-link">📺 崁仔頂紀實</a>
            <a href="#qa-section">❓ 常見QA</a>
            <a href="#comment-section">💬 雙軌留言板</a>
            <a href="#" onclick="app.openGuideModal(); return false;">📖 新手須知</a>
        </div>
        <div class="nav-right-actions">
            <button id="test-unlock-btn" onclick="app.toggleTestUnlock()" class="test-unlock-btn">
                🔓 測試解鎖 (關)
            </button>
            <button onclick="app.openCartModal()" class="cart-btn">
                🛒
                <span id="cart-badge" class="cart-badge">0</span>
            </button>
        </div>
    </nav>

    <main>
        <div class="flash-sale-banner">
            <div class="flash-title">
                ⚡ 每日現流漁獲直配．12:00 正式開搶
            </div>
            <div class="countdown-box">
                距離開賣還有：
                <span id="cd-hours" class="countdown-num">12</span>時
                <span id="cd-mins" class="countdown-num">59</span>分
                <span id="cd-secs" class="countdown-num">30</span>秒
            </div>
        </div>

        <div id="products-section" class="main-grid">
            <div class="left-content-area">
                <div>
                    <div class="sec-header">
                        <div class="sec-title-wrap">
                            <span id="today-day-tag">今日現流</span>
                            <h2 id="fresh-section-title">🔥 當日現流漁獲專區</h2>
                        </div>
                        <span style="font-size: 12px; color: #38bdf8;">保證當日崁仔頂直送</span>
                    </div>
                    <div id="fresh-products-container"></div>
                </div>

                <div id="video-section" class="section-card">
                    <h3 style="color: #38bdf8; font-size: 16px;">📺 崁仔頂魚市文化紀實與現流挑選指南</h3>
                    <p style="font-size: 12px; color: #94a3b8; margin-top: 4px;">帶您深入深夜 12 點的基隆崁仔頂，體驗最道地的現撈拍賣文化與海鮮處理哲學。</p>
                    <div class="video-container">
                        <iframe id="front-video-iframe" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="崁仔頂文化紀實" allowfullscreen></iframe>
                    </div>
                </div>

                <div id="qa-section" class="section-card">
                    <h3 style="color: #38bdf8; font-size: 16px; margin-bottom: 10px;">❓ 常見問題與團購 Q&A</h3>
                    <div class="qa-item">
                        <div class="qa-q">Q1: 下單後現流漁獲真的會為我保留 24 小時嗎？</div>
                        <div class="qa-a">是的！系統會為您限時保留 24 小時。請於時限內完成轉帳，並點擊 Email 內的直連按鈕回報匯款後 5 碼與雙超商門市。</div>
                    </div>
                    <div class="qa-item">
                        <div class="qa-q">Q2: 為什麼要填寫 7-11 與全家「雙超商備用門市」？</div>
                        <div class="qa-a">因為低溫冷凍物流常因季節或檔期發生單一超商冷凍庫滿載退件，填寫雙超商可確保包裹百分之百安全送達！</div>
                    </div>
                    <div class="qa-item">
                        <div class="qa-q">Q3: 運費計算規則是什麼？</div>
                        <div class="qa-a">滿 $3,000 免低溫運費；$2,000~$2,999 運費 $60；未滿 $2,000 運費 $130。</div>
                    </div>
                </div>

                <div id="comment-section" class="section-card">
                    <h3 style="color: #38bdf8; font-size: 16px; margin-bottom: 6px;">💬 雙軌留言板</h3>
                    <p style="font-size: 12px; color: #94a3b8;">切換標籤：公開討論區（如同 LINE 群組）或私人私訊與改單追蹤（僅私密給管理員，並自動同步至試算表對話備份）。</p>
                    
                    <div class="comment-tabs" style="margin-top: 12px;">
                        <button onclick="app.switchCommentTab('public')" id="tab-pub" class="tab-sub-btn active">公開討論區 (如同 LINE 群組)</button>
                        <button onclick="app.switchCommentTab('private')" id="tab-pri" class="tab-sub-btn">私人私訊與改單追蹤</button>
                    </div>

                    <div class="comment-box">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <input id="comment-name" type="text" placeholder="您的姓名 / 暱稱 *" class="comment-input">
                            <input id="comment-phone4" type="text" maxlength="4" placeholder="手機後 4 碼 (私訊改單核對用) *" class="comment-input">
                        </div>
                        <textarea id="comment-text" placeholder="發表公開討論，或私人私訊管理員進行改單/補寄追蹤..." class="comment-input" style="height: 70px; resize: none;"></textarea>
                        <button onclick="app.postComment()" class="btn-primary" style="align-self: flex-start; padding: 8px 16px;">送出留言</button>
                    </div>
                    <div id="comment-list" class="comment-list"></div>
                </div>
            </div>

            <div class="right-sidebar">
                <div class="sec-header" style="border-bottom-color: #0284c7;">
                    <div class="sec-title-wrap">
                        <span style="background-color: #0284c7;">常態嚴選</span>
                        <h2>❄️ 冷凍嚴選 (16樣)</h2>
                    </div>
                </div>
                <div id="frozen-products-list"></div>
            </div>
        </div>
    </main>

    <footer>
        <p>© 2026 基隆鮮物．崁仔頂小商人 khàm-tíng. All Rights Reserved.</p>
    </footer>

    <div id="guide-modal" class="modal-overlay">
        <div class="modal-box">
            <div class="modal-header">
                <h3 style="color: #38bdf8;">⚓ 歡迎來到基隆鮮物．崁仔頂小商人！</h3>
                <button onclick="app.closeGuideModal()" class="close-btn">&times;</button>
            </div>
            <div class="modal-body" style="font-size: 13px; line-height: 1.6; color: #cbd5e1;">
                <p>親愛的鄰居／團員 您好：</p>
                <p>小商人每天深夜親自走訪基隆崁仔頂魚市，為大家挑選當日最新鮮、非養殖的現流野生漁獲。</p>
                <div style="background: rgba(2, 132, 199, 0.15); border-left: 4px solid #38bdf8; padding: 12px; border-radius: 6px;">
                    <strong>📌 4 步輕鬆搶購指南：</strong><br>
                    1. <strong>現流與冷凍選購</strong>：現流商品每日 12:00 開賣。<br>
                    2. <strong>24hr 期限保留</strong>：下單後現流為您保留 24 小時。<br>
                    3. <strong>一鍵對帳回報</strong>：收信後點擊按鈕秒速填寫後 5 碼與雙超商門市。<br>
                    4. <strong>滿額免運</strong>：全館滿 $3,000 即享免低溫運費！
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="app.closeGuideModal()" class="btn-primary" style="width: 100%;">我知道了，開始逛海鮮！</button>
            </div>
        </div>
    </div>

    <!-- 購物車結帳 Modal (強化防重複點擊鎖定) -->
    <div id="cart-checkout-modal" class="modal-overlay">
        <div class="modal-box">
            <div class="modal-header">
                <h3>⚡ 確認購物車與填寫聯絡資料</h3>
                <button onclick="app.closeCartModal()" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div id="cart-items-summary" style="background: rgba(30, 41, 59, 0.6); padding: 12px; border-radius: 10px; font-size: 12px; display: flex; flex-direction: column; gap: 6px;"></div>
                <div id="shipping-hook-container" class="shipping-hook-box"></div>

                <div style="display: flex; flex-direction: column; gap: 12px; border-top: 1px solid #1e293b; padding-top: 12px;">
                    <h4 style="font-size: 13px; font-weight: 700; color: #f8fafc;">請填寫結帳聯絡資訊</h4>
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
                        <div class="form-group">
                            <label>電子郵件 (Email) *</label>
                            <input id="checkout-email" type="email" placeholder="example@gmail.com" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>手機後 4 碼 *</label>
                            <input id="checkout-phone4" type="text" maxlength="4" placeholder="5678" class="form-control">
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="app.closeCartModal()" class="btn-secondary">返回繼續選購</button>
                <button id="submit-order-btn" onclick="app.submitInstantOrder()" class="btn-primary">送出訂單並取得匯款信</button>
            </div>
        </div>
    </div>

    <div id="remittance-modal" class="modal-overlay">
        <div class="modal-box">
            <div class="modal-header">
                <h3 style="color: #38bdf8;">💳 買家匯款與超商收件門市回報專區</h3>
                <button onclick="app.closeRemittanceModal()" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="alert-box">
                    <strong>📌 訂單對帳填寫說明：</strong><br>
                    訂單編號：<strong id="report-target-orderid" style="color:#38bdf8;">-</strong><br>
                    請填寫以下轉帳資料與雙超商備用門市，避免冷凍庫滿載退單！
                </div>
                <div class="form-group">
                    <label>匯款金額 (NT$) *</label>
                    <input id="report-amount" type="number" placeholder="例如: 3000" class="form-control">
                </div>
                <div class="form-group">
                    <label>匯款帳號後 5 碼 *</label>
                    <input id="report-last5" type="text" maxlength="5" placeholder="例如: 12345" class="form-control">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="form-group">
                        <label>收件人姓名 *</label>
                        <input id="report-name" type="text" placeholder="王小明" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>收件人手機 *</label>
                        <input id="report-phone" type="tel" placeholder="0912345678" class="form-control">
                    </div>
                </div>
                <div class="form-group" style="background: rgba(30, 41, 59, 0.6); padding: 10px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <label>7-11 收件門市名稱/店號 *</label>
                        <a href="https://emap.pcsc.com.tw/" target="_blank" class="emap-btn">🗺️ 開啟 7-11 地圖</a>
                    </div>
                    <input id="report-711" type="text" placeholder="例如: 基隆愛興店 (123456)" class="form-control">
                </div>
                <div class="form-group" style="background: rgba(30, 41, 59, 0.6); padding: 10px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <label>全家 收件門市 (備用) *</label>
                        <a href="https://www.family.com.tw/marketing/inquiry.aspx" target="_blank" class="emap-btn" style="background:#10b981;">🗺️ 開啟全家地圖</a>
                    </div>
                    <input id="report-family" type="text" placeholder="例如: 基隆港都店 (98765)" class="form-control">
                </div>
                <div class="form-group">
                    <label>出貨選項偏好 (ABC) *</label>
                    <select id="report-shipping-option" class="form-control">
                        <option value="選項 A: 週二~週四出貨">選項 A: 週二~週四第一批直送出貨</option>
                        <option value="選項 B: 週五~週日出貨">選項 B: 週五~週日週末排程出貨</option>
                        <option value="選項 C: 配合現流齊全再出貨">選項 C: 等候所有現流漁獲補齊後再出貨</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="app.submitRemittanceReport()" class="btn-primary" style="width: 100%;">✓ 確認送出對帳與門市資料</button>
            </div>
        </div>
    </div>

    <script>
        class SeafoodIndexApp {
            constructor() {
                this.googleSheetsApiUrl = "https://script.google.com/macros/s/AKfycbz6Qbm36W0_vjIbATiAn5_5EVirP8pnu0yZFXTYYYKOq6q-yqIqVbDV2JPOsFgFfUMp/exec";
                this.cart = JSON.parse(localStorage.getItem('seafood_cart')) || [];
                
                this.comments = JSON.parse(localStorage.getItem('seafood_comments')) || [
                    { type: 'public', name: '海鮮老饕阿基', phone4: '', text: '昨天的野生透抽川燙三秒沾哇沙米，實在有夠清甜！', date: '12:30' },
                    { type: 'private', name: '陳冠宇', phone4: '678', text: 'ORD-20231105-001 想幫我改成週五出貨，謝謝小商人！', date: '2026/11/5 10:15' }
                ];
                this.currentCommentTab = 'public';

                this.isTestUnlocked = localStorage.getItem('seafood_test_unlocked') === 'true';

                const now = new Date();
                const month = now.getMonth() + 1;
                const date = now.getDate();
                const todayIndex = now.getDay();
                const daysMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
                this.todayStr = `${month}/${date} (${daysMap[todayIndex]})`;
                
                this.freshProducts = JSON.parse(localStorage.getItem('seafood_fresh')) || [
                    { id: 'f1', name: '野生現流土魠魚塊', spec: '300g±10%', price: 280, stock: 15, day: this.todayStr, desc: '肉質細緻鮮甜，崁仔頂當日現流野生直配。', img: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800' }
                ];

                this.frozenProducts = JSON.parse(localStorage.getItem('seafood_frozen')) || [
                    { id: 'fz1', name: '深海大白鯧 (真空冷凍)', spec: '500g/尾', price: 680, stock: 50, desc: '肉質細緻、油脂豐富，最適合清蒸或香煎。' },
                    { id: 'fz2', name: '日本生食級干貝 3S', spec: '250g/盒', price: 520, stock: 30, desc: '極鮮甜干貝，解凍即可生食或香煎。' },
                    { id: 'fz3', name: '澎湖鮮凍大卷', spec: '350g/包', price: 250, stock: 40, desc: '肉厚彈牙，川燙快炒最佳選擇。' },
                    { id: 'fz4', name: '北海道特級厚切鮭魚菲力', spec: '300g/包', price: 220, stock: 60, desc: '豐富Omega-3，厚切美味無刺。' },
                    { id: 'fz5', name: '基隆道地手工x燒賣', spec: '10入/盒', price: 180, stock: 25, desc: '內餡扎實，基隆在地人氣點心。' },
                    { id: 'fz6', name: '野生鮮凍黑虎草蝦', spec: '600g/盒', price: 390, stock: 20, desc: '肉質扎實Q彈，鮮甜度破表。' },
                    { id: 'fz7', name: '智利熟凍帝王蟹腳', spec: '800g/盒', price: 1580, stock: 12, desc: '頂級海味，滿滿鮮甜蟹肉。' },
                    { id: 'fz8', name: '鮮凍金目鱸魚排', spec: '400g/包', price: 190, stock: 35, desc: '無刺鮮甜鱸魚排，坐月子與日常補身首選。' },
                    { id: 'fz9', name: '特選黃金鯧魚', spec: '500g/尾', price: 320, stock: 30, desc: '象徵年年有餘，肉質鮮美細嫩。' },
                    { id: 'fz10', name: '手工蒲燒鰻魚', spec: '250g/包', price: 290, stock: 40, desc: '日式蒲燒醬汁入味，加熱即食。' },
                    { id: 'fz11', name: '嚴選生凍小卷', spec: '300g/包', price: 210, stock: 45, desc: '急速冷凍鎖住鮮甜，煮湯炒菜皆宜。' },
                    { id: 'fz12', name: '鮮甜生凍白蝦', spec: '600g/盒', price: 280, stock: 50, desc: '晶瑩剔透，肉質鮮甜Q彈。' },
                    { id: 'fz13', name: '野生石斑魚清肉切片', spec: '300g/包', price: 350, stock: 18, desc: '膠質豐富，肉質Q彈扎實。' },
                    { id: 'fz14', name: '深海圓鱈切片', spec: '250g/包', price: 450, stock: 15, desc: '入口即化，頂級宴席魚種。' },
                    { id: 'fz15', name: '嚴選味付小章魚', spec: '200g/包', price: 150, stock: 30, desc: '開胃涼拌首選，彈牙夠味。' },
                    { id: 'fz16', name: '日式照燒中卷', spec: '300g/包', price: 260, stock: 25, desc: '鹹甜照燒風味，下酒配飯良伴。' }
                ];

                this.init();
            }

            init() {
                document.getElementById('today-day-tag').innerText = `今日 ${this.todayStr} 現流`;
                this.updateTestButtonUI();
                this.renderProducts();
                this.renderComments();
                this.updateCartBadge();
                this.checkUrlParameters();
                this.startCountdown();
                this.applyVideoSettings();

                if (!localStorage.getItem('seafood_visited')) {
                    this.openGuideModal();
                    localStorage.setItem('seafood_visited', 'true');
                }
            }

            applyVideoSettings() {
                const url = localStorage.getItem('seafood_video_url') || 'https://www.youtube.com/embed/dQw4w9WgXcQ';
                const status = localStorage.getItem('seafood_video_status') !== 'false';
                const videoCard = document.getElementById('video-section');
                const iframe = document.getElementById('front-video-iframe');
                const navLink = document.getElementById('nav-video-link');

                if(iframe) iframe.src = url;
                if(videoCard) {
                    if(status) {
                        videoCard.style.display = 'block';
                        if(navLink) navLink.style.display = 'inline-block';
                    } else {
                        videoCard.style.display = 'none';
                        if(navLink) navLink.style.display = 'none';
                    }
                }
            }

            openGuideModal() { document.getElementById('guide-modal').classList.add('active'); }
            closeGuideModal() { document.getElementById('guide-modal').classList.remove('active'); }

            toggleTestUnlock() {
                this.isTestUnlocked = !this.isTestUnlocked;
                localStorage.setItem('seafood_test_unlocked', this.isTestUnlocked);
                this.updateTestButtonUI();
                alert(this.isTestUnlocked ? '🔓 【測試模式已開啟】現在可以隨時搶購現流商品！' : '🔒 【測試模式已關閉】恢復正常 12:00 開賣限制。');
            }

            updateTestButtonUI() {
                const btn = document.getElementById('test-unlock-btn');
                if (this.isTestUnlocked) {
                    btn.innerText = '🔓 測試解鎖 (開)';
                    btn.classList.add('unlocked');
                } else {
                    btn.innerText = '🔓 測試解鎖 (關)';
                    btn.classList.remove('unlocked');
                }
            }

            startCountdown() {
                setInterval(() => {
                    const now = new Date();
                    const target = new Date();
                    target.setHours(12, 0, 0, 0);
                    if (now > target) target.setDate(target.getDate() + 1);
                    const diff = target - now;
                    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const s = Math.floor((diff % (1000 * 60)) / 1000);
                    document.getElementById('cd-hours').innerText = String(h).padStart(2, '0');
                    document.getElementById('cd-mins').innerText = String(m).padStart(2, '0');
                    document.getElementById('cd-secs').innerText = String(s).padStart(2, '0');
                }, 1000);
            }

            checkUrlParameters() {
                const params = new URLSearchParams(window.location.search);
                const orderId = params.get('orderId');
                const email = params.get('email');
                if (orderId) {
                    document.getElementById('report-target-orderid').innerText = orderId;
                    if(email) document.getElementById('report-email').value = email;
                    document.getElementById('remittance-modal').classList.add('active');
                }
            }

            generateOptions(max) {
                let options = '';
                for (let i = 1; i <= max; i++) options += `<option value="${i}">+${i} 份</option>`;
                return options;
            }

            renderProducts() {
                const container = document.getElementById('fresh-products-container');
                const count = this.freshProducts.length;

                document.getElementById('fresh-section-title').innerText = `🔥 當日現流漁獲專區 (${count}項)`;

                let html = `<div class="fresh-grid">`;

                if (count === 0) {
                    html += `
                        <div class="empty-slot-card">
                            <span style="font-size: 24px;">🌊</span>
                            <span>今日海象不好，魚貨不足<br>不勉強開團</span>
                        </div>
                        <div class="empty-slot-card">
                            <span style="font-size: 24px;">🌊</span>
                            <span>今日海象不好，魚貨不足<br>不勉強開團</span>
                        </div>
                    `;
                } else if (count === 1) {
                    const p = this.freshProducts[0];
                    html += `
                        <div class="product-card">
                            <img src="${p.img}" class="product-img" alt="${p.name}">
                            <div class="product-body">
                                <div>
                                    <h3 class="product-name">${p.name}</h3>
                                    <p class="product-spec">${p.spec} | 今日 ${this.todayStr} 現流</p>
                                </div>
                                ${p.desc ? `<p style="font-size:11px; color:#cbd5e1;">💡 ${p.desc}</p>` : ''}
                                <div class="product-price-stock">
                                    <span class="price">NT$ ${p.price}</span>
                                    <span style="font-size:11px; color:#cbd5e1;">剩餘: <strong class="huge-stock">${p.stock}</strong> 份</span>
                                </div>
                                <div class="product-actions">
                                    <select id="select-qty-${p.id}">${this.generateOptions(p.stock > 0 ? p.stock : 1)}</select>
                                    <button onclick="app.buyFresh('${p.id}')" class="buy-btn">⚡ 立即搶購</button>
                                </div>
                            </div>
                        </div>
                        <div class="empty-slot-card">
                            <span style="font-size: 24px;">⚠️</span>
                            <span>找不到滿意的商品<br>只開一項，不勉強開團</span>
                        </div>
                    `;
                } else {
                    html += this.freshProducts.map(p => `
                        <div class="product-card">
                            <img src="${p.img}" class="product-img" alt="${p.name}">
                            <div class="product-body">
                                <div>
                                    <h3 class="product-name">${p.name}</h3>
                                    <p class="product-spec">${p.spec} | 今日 ${this.todayStr} 現流</p>
                                </div>
                                ${p.desc ? `<p style="font-size:11px; color:#cbd5e1;">💡 ${p.desc}</p>` : ''}
                                <div class="product-price-stock">
                                    <span class="price">NT$ ${p.price}</span>
                                    <span style="font-size:11px; color:#cbd5e1;">剩餘: <strong class="huge-stock">${p.stock}</strong> 份</span>
                                </div>
                                <div class="product-actions">
                                    <select id="select-qty-${p.id}">${this.generateOptions(p.stock > 0 ? p.stock : 1)}</select>
                                    <button onclick="app.buyFresh('${p.id}')" class="buy-btn">⚡ 立即搶購</button>
                                </div>
                            </div>
                        </div>
                    `).join('');
                }

                html += `</div>`;
                container.innerHTML = html;

                const frozenEl = document.getElementById('frozen-products-list');
                if (frozenEl) {
                    frozenEl.innerHTML = this.frozenProducts.map(p => `
                        <div class="frozen-card">
                            <div class="frozen-top">
                                <div class="frozen-info">
                                    <h4>${p.name}</h4>
                                    <p>${p.spec} | 庫存 ${p.stock}</p>
                                    <span class="frozen-price">NT$ ${p.price}</span>
                                </div>
                            </div>
                            ${p.desc ? `<div class="frozen-desc">💡 ${p.desc}</div>` : ''}
                            <div class="frozen-bottom">
                                <span style="font-size: 11px; color: #94a3b8;">常態供應</span>
                                <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                                    <select id="select-qty-${p.id}">${this.generateOptions(6)}</select>
                                    <button onclick="app.addToCartFromSelect('${p.id}', 'frozen')" class="frozen-buy-btn">加入</button>
                                </div>
                            </div>
                        </div>
                    `).join('');
                }
            }

            switchCommentTab(type) {
                this.currentCommentTab = type;
                document.getElementById('tab-pub').className = `tab-sub-btn ${type === 'public' ? 'active' : ''}`;
                document.getElementById('tab-pri').className = `tab-sub-btn ${type === 'private' ? 'active' : ''}`;
                this.renderComments();
            }

            renderComments() {
                const listEl = document.getElementById('comment-list');
                const filtered = this.comments.filter(c => c.type === this.currentCommentTab);
                
                if (filtered.length === 0) {
                    listEl.innerHTML = `<div style="color:#94a3b8; font-size:12px; padding:10px; text-align:center;">目前尚無${this.currentCommentTab === 'public' ? '公開討論' : '私人私訊'}紀錄</div>`;
                    return;
                }

                listEl.innerHTML = filtered.map(c => `
                    <div class="comment-item ${c.type === 'private' ? 'private' : ''}">
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <strong>${c.name} ${c.phone4 ? '(後4碼: ' + c.phone4 + ')' : ''}</strong>
                            <span style="color: #64748b;">${c.date}</span>
                        </div>
                        <div style="color: #cbd5e1;">${c.text}</div>
                    </div>
                `).join('');
            }

            async postComment() {
                const name = document.getElementById('comment-name').value.trim();
                const phone4 = document.getElementById('comment-phone4').value.trim();
                const text = document.getElementById('comment-text').value.trim();
                
                if (!name || !text) return alert('請填寫姓名與留言內容！');
                if (this.currentCommentTab === 'private' && (!phone4 || phone4.length !== 4)) {
                    return alert('私人私訊與改單追蹤請務必填寫手機後 4 碼，以便核對您的訂單！');
                }

                const newComment = {
                    type: this.currentCommentTab,
                    name: name,
                    phone4: phone4,
                    text: text,
                    date: new Date().toLocaleString()
                };

                this.comments.unshift(newComment);
                localStorage.setItem('seafood_comments', JSON.stringify(this.comments));
                this.renderComments();
                document.getElementById('comment-text').value = '';

                if (this.currentCommentTab === 'private') {
                    alert(`✅ 私人私訊已成功送出，並自動同步備份至 Google 試算表「對話備份」！`);
                    try {
                        await fetch(this.googleSheetsApiUrl, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'newChatBackup',
                                name: name,
                                phone4: phone4,
                                text: text,
                                date: newComment.date
                            })
                        });
                    } catch (e) { console.log('對話備份同步中', e); }
                } else {
                    alert(`✅ 公開討論發布成功！（公開討論不寫入試算表對話備份）`);
                }
            }

            buyFresh(id) {
                const currentHour = new Date().getHours();
                if (!this.isTestUnlocked && currentHour < 12) {
                    return alert('⏳ 目前尚未到中午 12:00 開賣時間！若要在非 12 點進行測試，請點擊上方導覽列的「🔓 測試解鎖」按鈕！');
                }

                const p = this.freshProducts.find(item => item.id === id);
                const qty = parseInt(document.getElementById(`select-qty-${id}`).value, 10);
                if (!p || p.stock < qty) return alert(`庫存不足！`);
                p.stock -= qty;
                localStorage.setItem('seafood_fresh', JSON.stringify(this.freshProducts));
                this.addToCartWithQty(id, 'fresh', qty, p);
                this.renderProducts();
            }

            addToCartFromSelect(id, type) {
                const p = this.frozenProducts.find(item => item.id === id);
                const qty = parseInt(document.getElementById(`select-qty-${id}`).value, 10);
                this.addToCartWithQty(id, type, qty, p);
            }

            addToCartWithQty(id, type, qty, p) {
                const exist = this.cart.find(item => item.id === id);
                if (exist) exist.qty += qty;
                else this.cart.push({ id: p.id, name: p.name, price: p.price, qty: qty, type });
                localStorage.setItem('seafood_cart', JSON.stringify(this.cart));
                this.updateCartBadge();
            }

            updateCartBadge() {
                document.getElementById('cart-badge').innerText = this.cart.reduce((sum, item) => sum + item.qty, 0);
            }

            openCartModal() {
                if (this.cart.length === 0) return alert('購物車是空的！');
                const subtotal = this.cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
                let shipping = subtotal >= 3000 ? 0 : (subtotal >= 2000 ? 60 : 130);
                let diffToFree = 3000 - subtotal;
                
                let html = `<div style="font-weight: 700; border-bottom: 1px solid #334155; padding-bottom: 4px; color: #38bdf8;">🛒 購物清單摘要</div>`;
                this.cart.forEach(i => {
                    html += `<div style="display: flex; justify-content: space-between; color: #cbd5e1;"><span>${i.name} x ${i.qty}</span><span>NT$ ${i.price * i.qty}</span></div>`;
                });
                html += `<div style="border-top: 1px solid #334155; padding-top: 6px; font-weight: 700; display: flex; justify-content: space-between; color: #f8fafc;"><span>小計 NT$ ${subtotal} | 運費 NT$ ${shipping}</span><span style="color: #fb7185; font-size: 14px;">應付總額：NT$ ${subtotal + shipping}</span></div>`;
                document.getElementById('cart-items-summary').innerHTML = html;

                let hookHtml = '';
                if (diffToFree > 0) {
                    hookHtml = `🔥 <strong>距離 $3,000 免運費還差 NT$ ${diffToFree}</strong>！建議您可以順便去右側「常態冷凍嚴選專區」挑選美味干貝或大白鯧湊滿免運！`;
                } else {
                    hookHtml = `🎉 太棒了！您的訂單已達 $3,000 以上，享<strong>免低溫運費</strong>優惠！`;
                }
                document.getElementById('shipping-hook-container').innerHTML = hookHtml;
                document.getElementById('cart-checkout-modal').classList.add('active');
            }

            closeCartModal() { document.getElementById('cart-checkout-modal').classList.remove('active'); }
            closeRemittanceModal() { document.getElementById('remittance-modal').classList.remove('active'); }

            // ⚡ 強化防重複點擊鎖定與雲端同步
            async submitInstantOrder() {
                const email = document.getElementById('checkout-email').value.trim();
                const phone4 = document.getElementById('checkout-phone4').value.trim();

                if (!email || !email.includes('@')) return alert('請填寫正確的 Email！');
                if (!phone4 || phone4.length !== 4) return alert('請填寫手機後四碼！');

                const submitBtn = document.getElementById('submit-order-btn');
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.innerText = '⏳ 正在建立訂單並同步雲端...';

                const subtotal = this.cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
                let shipping = subtotal >= 3000 ? 0 : (subtotal >= 2000 ? 60 : 130);
                const orderId = 'ORD-' + Date.now().toString().slice(-6);

                const orderData = {
                    action: 'newOrder',
                    orderId: orderId,
                    createdAt: new Date().toLocaleString(),
                    userEmail: email,
                    userPhone4: phone4,
                    items: [...this.cart],
                    subtotal: subtotal,
                    shipping: shipping,
                    grandTotal: subtotal + shipping,
                    isSettled: false
                };

                // 同步寫入本機備份
                let localOrders = JSON.parse(localStorage.getItem('seafood_orders')) || [];
                localOrders.unshift(orderData);
                localStorage.setItem('seafood_orders', JSON.stringify(localOrders));

                // 非同步傳送到 Google 試算表
                try {
                    await fetch(this.googleSheetsApiUrl, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(orderData)
                    });
                } catch (e) { console.log('雲端發送中', e); }

                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.innerText = '送出訂單並取得匯款信';

                alert(`🎉 訂單已成功建立！\n訂單編號：${orderId}\n\n系統已發送包含「一鍵對帳回報按鈕」的郵件至：${email}。\n請至 Email 收信並點擊按鈕填寫匯款資料與雙超商門市！`);

                this.cart = [];
                localStorage.removeItem('seafood_cart');
                this.updateCartBadge();
                this.closeCartModal();
            }

            async submitRemittanceReport() {
                const orderId = document.getElementById('report-target-orderid').innerText;
                const amount = document.getElementById('report-amount').value.trim();
                const last5 = document.getElementById('report-last5').value.trim();
                const name = document.getElementById('report-name').value.trim();
                const phone = document.getElementById('report-phone').value.trim();
                const store711 = document.getElementById('report-711').value.trim();
                const storeFamily = document.getElementById('report-family').value.trim();
                const shippingOption = document.getElementById('report-shipping-option').value;

                if (!amount || !last5 || last5.length !== 5) return alert('請完整填寫匯款金額與帳號後 5 碼！');
                if (!name || !phone) return alert('請填寫收件人姓名與手機！');
                if (!store711 || !storeFamily) return alert('請填寫 7-11 與全家備用門市，以防超商冷凍庫滿載退單！');

                const reportData = {
                    action: 'updateRemittance',
                    orderId: orderId,
                    remitAmount: amount,
                    remitLast5: last5,
                    recipientName: name,
                    recipientPhone: phone,
                    store711: store711,
                    storeFamily: storeFamily,
                    shippingOption: shippingOption
                };

                try {
                    await fetch(this.googleSheetsApiUrl, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(reportData)
                    });
                } catch (e) { console.log('發送中', e); }

                alert(`✅ 感謝您的回報！對帳與門市資料已成功送出，小商人將儘速為您安排出貨！`);
                document.getElementById('remittance-modal').classList.remove('active');
            }
        }

        let app;
        document.addEventListener('DOMContentLoaded', () => { app = new SeafoodIndexApp(); });
    </script>
</body>
</html>