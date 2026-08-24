// @vitest-environment node
// ============================================================
// ★一覧は「日 → 車ごと → 早い順」で並ぶ★ 2026-08-25
//
//   司さん「一覧の並びも 上から車ごとに分けて 早い順で並べて」
//
//   ★決まり★
//     ①日 … 今までどおり ★新しい日が上★
//     ②その中を ★車ごと★（事務所で決めた並び順 dk_car_no：1466=1番・4987=2番…）
//     ③車の中は ★早い順★（メーターの何本目 dk_ref の3つめ → 無ければ 入れた順 _created）
//     ④★手で入れた分は 車が無い★ので ★車の後ろにまとめる★（消さない・入れた順）
//
//   ★なぜ試験にするか★
//     並びは ★毎日 目に入る所★。崩れても「なんか違う」で終わって 原因が分からなくなる。
//     ここで ★順番そのもの★ を数える。
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'daikou-seikyu.html'), 'utf8');

// 画面の中の並べ替えと同じ物を 取り出して使う（決まりを2つ持たない）
function carNoOf(r) {
  const n = Number(r && r.dk_car_no);
  return isFinite(n) && n > 0 ? n : 9999;
}
function seqOf(r) {
  const p = String((r && r.dk_ref) || '').split(':');
  const n = Number(p[2]);
  return isFinite(n) ? n : null;
}
function sortRows(rows) {
  return rows.slice().sort((a, b) => {
    const d = (b.日付 || '').localeCompare(a.日付 || '');
    if (d !== 0) return d;
    const c = carNoOf(a) - carNoOf(b);
    if (c !== 0) return c;
    const sa = seqOf(a);
    const sb = seqOf(b);
    if (sa !== null && sb !== null && sa !== sb) return sa - sb;
    return (a._created || '').localeCompare(b._created || '');
  });
}

const mk = (id, date, car, carNo, dev, seq, created) => ({
  id,
  日付: date,
  dk_car: car,
  dk_car_no: carNo,
  dk_ref: dev ? dev + ':1756000000000:' + seq : undefined,
  _created: created,
});

describe('★一覧の並び（日 → 車ごと → 早い順）★', () => {
  it('画面の中に 並べ替えの決まりが在る（消えたら赤）', () => {
    expect(HTML, '★車の並び順を見ていない★').toContain('carNoOf');
    expect(HTML, '★早い順(何本目)を見ていない★').toContain('seqOf');
    expect(HTML, '★車の見出しが無い★').toContain('li-car');
    expect(HTML, '★手で入れた分の見出しが無い★').toContain('手で入れた分');
  });

  it('①日は 新しい日が上', () => {
    const r = sortRows([
      mk('x', '2026-08-23', '1466', 1, 'A', 1, '2026-08-23T01:00:00Z'),
      mk('y', '2026-08-24', '1466', 1, 'A', 1, '2026-08-24T01:00:00Z'),
    ]);
    expect(r.map((v) => v.id)).toEqual(['y', 'x']);
  });

  it('②③車ごと・車の中は 早い順', () => {
    const r = sortRows([
      mk('c', '2026-08-24', '4987', 2, 'B', 1, '2026-08-24T05:00:00Z'),
      mk('b', '2026-08-24', '1466', 1, 'A', 2, '2026-08-24T04:00:00Z'),
      mk('d', '2026-08-24', '4987', 2, 'B', 2, '2026-08-24T06:00:00Z'),
      mk('a', '2026-08-24', '1466', 1, 'A', 1, '2026-08-24T03:00:00Z'),
    ]);
    expect(r.map((v) => v.id), '★車ごと・早い順になっていない★').toEqual(['a', 'b', 'c', 'd']);
  });

  it('④手で入れた分は 車の後ろ・入れた順', () => {
    const r = sortRows([
      mk('te2', '2026-08-24', null, null, null, null, '2026-08-24T09:00:00Z'),
      mk('a', '2026-08-24', '1466', 1, 'A', 1, '2026-08-24T03:00:00Z'),
      mk('te1', '2026-08-24', null, null, null, null, '2026-08-24T08:00:00Z'),
    ]);
    expect(r.map((v) => v.id), '★手で入れた分が 車より前に来ている★').toEqual([
      'a',
      'te1',
      'te2',
    ]);
  });

  it('★車の番号が無い物を「0番」と読んで先頭に出さない★（境界）', () => {
    expect(carNoOf({ dk_car_no: 0 }), '0番を車として扱っている').toBe(9999);
    expect(carNoOf({}), '車なしが最後になっていない').toBe(9999);
    expect(carNoOf({ dk_car_no: '2' }), '文字の2番を読めていない').toBe(2);
  });

  it('★何本目が無い時は 入れた順（早い順）★', () => {
    const r = sortRows([
      mk('b', '2026-08-24', '1466', 1, null, null, '2026-08-24T05:00:00Z'),
      mk('a', '2026-08-24', '1466', 1, null, null, '2026-08-24T03:00:00Z'),
    ]);
    expect(r.map((v) => v.id)).toEqual(['a', 'b']);
  });
});
