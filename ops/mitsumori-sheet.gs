// 見積書メーカー（https://sunrise-kaitai.github.io/mitsumori/）から送られた見積書を、このシートに1行ずつ記録する。
// 合言葉（スクリプト プロパティ SAVE_TOKEN）が合わないものは捨てる。同じ見積書（ID）が来たら同じ行を上書きする。

const SHEET = '見積書一覧';
const HEAD = ['保存日時', '見積番号', '発行日', 'お客様名', '敬称', '項目', '小計', '消費税', '合計', '値引き', '備考', '明細（全部）', 'ID'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET, 0);
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold').setBackground('#17263D').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, HEAD.length, 120);
    sh.setColumnWidth(4, 200); sh.setColumnWidth(6, 260); sh.setColumnWidth(11, 220); sh.setColumnWidth(12, 360);
    sh.getRange('G:J').setNumberFormat('#,##0');
  }
  return sh;
}

function doPost(e) {
  const out = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  try {
    const d = JSON.parse(e.postData.contents);
    const token = PropertiesService.getScriptProperties().getProperty('SAVE_TOKEN');
    if (!token || d.token !== token) return out({ ok: false, error: 'token' });
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sh = sheet_();
      const s = (v, n) => String(v == null ? '' : v).slice(0, n || 500);
      const items = Array.isArray(d.items) ? d.items.slice(0, 50) : [];
      const lines = items.map((i) => [s(i.k, 50), s(i.n, 100), s(i.q, 20) + s(i.u, 10), Number(i.p) || 0, Number(i.a) || 0].join(' / '));
      const row = [
        new Date(), s(d.no, 40), s(d.date, 20), s(d.cust, 100), s(d.hon, 10),
        items.map((i) => s(i.n, 100)).filter(String).join('、'),
        Number(d.sub) || 0, Number(d.tax) || 0, Number(d.total) || 0, Number(d.disc) || 0,
        s(d.memo, 1000), lines.join('\n'), s(d.id, 40),
      ];
      const last = sh.getLastRow();
      let at = 0;
      if (last > 1 && row[12]) {
        const ids = sh.getRange(2, 13, last - 1, 1).getValues();
        const i = ids.findIndex((r) => r[0] === row[12]);
        if (i >= 0) at = i + 2;
      }
      if (at) sh.getRange(at, 1, 1, row.length).setValues([row]);
      else sh.appendRow(row);
      return out({ ok: true, updated: !!at });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return out({ ok: false, error: 'bad' });
  }
}

// 初回に1回だけ実行：シートを作る（合言葉はスクリプト プロパティに入れる）
function setup() {
  sheet_();
}
