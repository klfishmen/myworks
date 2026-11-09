function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // 判斷請求類型：action === 'updateRemittance' 為客戶點擊信件按鈕回報，否則為新建訂單
    if (data.action === "updateRemittance") {
      return handleRemittanceReport(spreadsheet, data);
    } else {
      return handleNewOrder(spreadsheet, data);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// 1. 處理新訂單建立與寄送包含一鍵對帳按鈕的 Email
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
    "NT$" + data.grandTotal,
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

  // 對帳專用連結 (開啟前端帶參數 index.html?orderId=xxx)
  // 請於部署後替換為您的網址，或預設連結
  var reportUrl = "https://twvisa2009.github.io/index.html?orderId=" + encodeURIComponent(data.orderId) + "&email=" + encodeURIComponent(data.userEmail);

  var emailSubject = "【基隆鮮物．崁仔頂小商人】您的訂單已成立與匯款對帳通知 (訂單編號: " + data.orderId + ")";
  
  // HTML 信件內容 (帶有超級按鈕)
  var htmlBody = 
    "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 16px; border: 1px solid #0284c7;'>" +
      "<h2 style='color: #38bdf8; text-align: center;'>⚓ 基隆鮮物．崁仔頂小商人</h2>" +
      "<p style='font-size: 14px;'>親愛的買家 您好：</p>" +
      "<p style='font-size: 14px;'>感謝您的熱情搶購！您的訂單已成功建立，現流漁獲為您<strong>限時保留 24 小時</strong>，請於時限內完成轉帳並點擊下方按鈕回報。</p>" +
      "<div style='background-color: #1e293b; padding: 16px; border-radius: 12px; margin: 16px 0; border-left: 4px solid #e11d48;'>" +
        "<p style='margin: 4px 0; font-size: 13px;'>📦 <strong>訂單編號：</strong>" + data.orderId + "</p>" +
        "<p style='margin: 4px 0; font-size: 13px;'>🛒 <strong>購買商品：</strong>" + itemsStr + "</p>" +
        "<p style='margin: 4px 0; font-size: 13px;'>💰 <strong>商品小計：</strong>NT$ " + data.subtotal + "</p>" +
        "<p style='margin: 4px 0; font-size: 13px;'>🚚 <strong>運費：</strong>NT$ " + data.shipping + "</p>" +
        "<h3 style='color: #fb7185; margin: 8px 0 0 0;'>💵 應付總額：NT$ " + data.grandTotal + "</h3>" +
      "</div>" +
      "<div style='background-color: #020617; padding: 16px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 20px;'>" +
        "<h4 style='color: #38bdf8; margin-top: 0;'>🏦 【匯款轉帳帳號】</h4>" +
        "<p style='margin: 4px 0; font-size: 13px;'>銀行名稱：中國信託 (代號 822)</p>" +
        "<p style='margin: 4px 0; font-size: 13px;'>帳號：1234-5678-9012-4005</p>" +
        "<p style='margin: 4px 0; font-size: 13px;'>戶名：連丈賢 (崁仔頂小商人)</p>" +
      "</div>" +
      "<div style='text-align: center; margin: 28px 0;'>" +
        "<a href='" + reportUrl + "' target='_blank' style='background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #ffffff; padding: 16px 28px; border-radius: 12px; font-weight: bold; font-size: 16px; text-decoration: none; display: inline-block; box-shadow: 0 4px 15px rgba(225,29,72,0.5);'>👉 按此一鍵填寫匯款與門市資料 (免複製)</a>" +
      "</div>" +
      "<p style='font-size: 11px; color: #94a3b8; text-align: center;'>若無法點擊按鈕，請複製此連結至瀏覽器開啟：<br>" + reportUrl + "</p>" +
      "<hr style='border: 0; border-top: 1px solid #334155; margin: 20px 0;'>" +
      "<p style='font-size: 11px; color: #64748b; text-align: center;'>基隆鮮物．崁仔頂小商人 敬上<br>客服信箱：twvisa2009@gmail.com</p>" +
    "</div>";

  var plainBody = "親愛的買家您好：\n您的訂單 (" + data.orderId + ") 已成立。\n請至以下連結填寫對帳與收件資訊：\n" + reportUrl;

  if (data.userEmail && data.userEmail.includes("@")) {
    MailApp.sendEmail({
      to: data.userEmail,
      subject: emailSubject,
      htmlBody: htmlBody,
      body: plainBody
    });
  }

  MailApp.sendEmail({
    to: "twvisa2009@gmail.com",
    subject: "[管理通知] 新訂單成立 - " + data.orderId,
    htmlBody: htmlBody,
    body: plainBody
  });

  return ContentService.createTextOutput(JSON.stringify({ "status": "success", "orderId": data.orderId }))
                       .setMimeType(ContentService.MimeType.JSON);
}

// 2. 處理買家點擊按鈕回報匯款與收件門市資料
function handleRemittanceReport(spreadsheet, data) {
  var sheet = spreadsheet.getSheetByName("訂單紀錄");
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "找不到訂單工作表" }))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  var rows = sheet.getDataRange().getValues();
  var found = false;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.orderId) { // 訂單編號比對
      sheet.getRange(i + 1, 6).setValue("NT$" + data.remitAmount);   // 匯款金額
      sheet.getRange(i + 1, 7).setValue("'" + data.remitLast5);     // 匯款後5碼
      sheet.getRange(i + 1, 8).setValue(data.recipientName);        // 收件人姓名
      sheet.getRange(i + 1, 9).setValue("'" + data.recipientPhone);  // 收件人手機
      sheet.getRange(i + 1, 10).setValue(data.store711);            // 7-11門市
      sheet.getRange(i + 1, 11).setValue(data.storeFamily);         // 全家門市
      sheet.getRange(i + 1, 12).setValue(data.shippingOption);       // 出貨選項 A/B/C
      found = true;
      break;
    }
  }

  // 發送管理者通知信：顧客已回報
  MailApp.sendEmail(
    "twvisa2009@gmail.com",
    "[對帳回報通知] 訂單 " + data.orderId + " 已回報匯款與門市",
    "買家已填寫對帳資訊：\n" +
    "訂單編號：" + data.orderId + "\n" +
    "匯款金額：NT$" + data.remitAmount + "\n" +
    "匯款後5碼：" + data.remitLast5 + "\n" +
    "收件人：" + data.recipientName + " (" + data.recipientPhone + ")\n" +
    "7-11門市：" + data.store711 + "\n" +
    "全家門市：" + data.storeFamily + "\n" +
    "出貨選項：" + data.shippingOption + "\n\n" +
    "請至後台確認收款並進行結單！"
  );

  return ContentService.createTextOutput(JSON.stringify({ 
    "status": found ? "success" : "not_found", 
    "message": found ? "對帳與門市資料已成功更新" : "未找到該訂單紀錄" 
  })).setMimeType(ContentService.MimeType.JSON);
}