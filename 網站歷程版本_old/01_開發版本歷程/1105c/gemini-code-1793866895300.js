const SHEET_ID = '1pkd-D_OL_tER0X4CAEcvGACt3hJezqr3_PEXyxwy_Cc';

function doPost(e) {
  try {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);
    
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'newOrder') {
      const sheet = ss.getSheetByName('訂單記錄') || ss.getSheets()[0];
      const orderId = 'ORD-' + new Date().getTime().toString().slice(-6);
      const timestamp = new Date();
      
      data.items.forEach(item => {
        sheet.appendRow([
          orderId,
          timestamp,
          data.customer.name,
          item.name,
          item.spec,
          item.qty,
          item.price,
          item.qty * item.price,
          data.customer.paymentMethod || '線上匯款',
          '未結單',
          '未出貨',
          `後4碼:${data.customer.last5} | 711:${data.customer.store711} | 全家:${data.customer.storeFamily} | 備註:${data.customer.note}`
        ]);
      });
      
      updateCustomerDB(ss, data.customer, data.totalAmount);
      
      lock.releaseLock();
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', orderId: orderId }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action === 'newChatBackup') {
      let sheet = ss.getSheetByName('對話備份');
      if (!sheet) {
        sheet = ss.insertSheet('對話備份');
        sheet.appendRow(['時間', '用戶名稱', '訊息內容', '留言類型']);
      }
      sheet.appendRow([new Date(), data.name, data.message, data.type]);
      
      lock.releaseLock();
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    lock.releaseLock();
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const action = e.parameter.action;
  
  if (action === 'getOrders') {
    const sheet = ss.getSheetByName('訂單記錄') || ss.getSheets()[0];
    const rows = sheet.getDataRange().getValues();
    const ordersMap = {};
    
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue;
      if (!ordersMap[r[0]]) {
        ordersMap[r[0]] = {
          orderId: r[0],
          date: r[1],
          customerName: r[2],
          paymentMethod: r[8],
          status: r[9],
          shippingStatus: r[10],
          note: r[11],
          items: [],
          totalAmount: 0
        };
      }
      ordersMap[r[0]].items.push({
        name: r[3],
        spec: r[4],
        qty: r[5],
        price: r[6],
        subtotal: r[7]
      });
      ordersMap[r[0]].totalAmount += Number(r[7] || 0);
    }
    
    const ordersList = Object.values(ordersMap);
    return ContentService.createTextOutput(JSON.stringify(ordersList))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'active', message: 'API is running' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function updateCustomerDB(ss, customer, amount) {
  let sheet = ss.getSheetByName('客戶資料庫');
  if (!sheet) {
    sheet = ss.insertSheet('客戶資料庫');
    sheet.appendRow(['姓名', '電話後4碼', '711門市', '全家門市', '累積消費金額', '消費次數']);
  }
  const rows = sheet.getDataRange().getValues();
  let found = false;
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] == customer.last5 && rows[i][0] == customer.name) {
      const total = Number(rows[i][4]) + Number(amount);
      const count = Number(rows[i][5]) + 1;
      sheet.getRange(i + 1, 3).setValue(customer.store711);
      sheet.getRange(i + 1, 4).setValue(customer.storeFamily);
      sheet.getRange(i + 1, 5).setValue(total);
      sheet.getRange(i + 1, 6).setValue(count);
      found = true;
      break;
    }
  }
  
  if (!found) {
    sheet.appendRow([customer.name, customer.last5, customer.store711, customer.storeFamily, amount, 1]);
  }
}