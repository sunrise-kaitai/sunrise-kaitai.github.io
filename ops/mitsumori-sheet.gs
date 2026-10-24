// 見積書メーカー（https://sunrise-kaitai.github.io/mitsumori/）から送られた見積書を、このシートに1行ずつ記録する。
// 合言葉（スクリプト プロパティ SAVE_TOKEN）が合わないものは捨てる。「保存」「PDF」「画像」を押すたびに1行足す。

const SHEET = '見積書一覧';
const HEAD = ['保存日時', '操作', '見積番号', '発行日', 'お客様名', '敬称', '項目', '小計', '消費税', '合計', '値引き', '備考', '明細（全部）', 'ID'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) sh = ss.insertSheet(SHEET, 0);
  const now = sh.getRange(1, 1, 1, HEAD.length).getValues()[0];
  if (now.join('|') !== HEAD.join('|')) {
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold').setBackground('#17263D').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, HEAD.length, 110);
    sh.setColumnWidth(1, 150); sh.setColumnWidth(5, 200); sh.setColumnWidth(7, 260); sh.setColumnWidth(12, 220); sh.setColumnWidth(13, 360);
    sh.getRange('H:K').setNumberFormat('#,##0');
    sh.getRange('A:A').setNumberFormat('yyyy/mm/dd hh:mm');
  }
  return sh;
}

function doPost(e) {
  const out = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  try {
    const d = JSON.parse(e.postData.contents);
    const token = PropertiesService.getScriptProperties().getProperty('SAVE_TOKEN');
    if (!token || d.token !== token) return out({ ok: false, error: 'token' });
    // 同じ押し方（同じ見積書・同じ操作・同じ時刻）が2回届いたら、2回目は記録しない
    const key = [d.id, d.action, d.at].join('|').slice(0, 240);
    const cache = CacheService.getScriptCache();
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (d.at && cache.get(key)) return out({ ok: true, row: null, dup: true });
      const sh = sheet_();
      const s = (v, n) => String(v == null ? '' : v).slice(0, n || 500);
      const items = Array.isArray(d.items) ? d.items.slice(0, 50) : [];
      const lines = items.map((i) => [s(i.k, 50), s(i.n, 100), s(i.q, 20) + s(i.u, 10), Number(i.p) || 0, Number(i.a) || 0].join(' / '));
      const row = [
        new Date(), s(d.action, 10) || '保存', s(d.no, 40), s(d.date, 20), s(d.cust, 100), s(d.hon, 10),
        items.map((i) => s(i.n, 100)).filter(String).join('、'),
        Number(d.sub) || 0, Number(d.tax) || 0, Number(d.total) || 0, Number(d.disc) || 0,
        s(d.memo, 1000), lines.join('\n'), s(d.id, 40),
      ];
      sh.appendRow(row);
      if (d.at) cache.put(key, '1', 600);
      return out({ ok: true, row: sh.getLastRow() });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return out({ ok: false, error: 'bad' });
  }
}

// シートの見出しを作る・直す（合言葉はスクリプト プロパティに入れる）
function setup() {
  sheet_();
}
