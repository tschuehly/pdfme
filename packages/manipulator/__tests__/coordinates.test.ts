import { PDFDocument } from '@pdfme/pdf-lib';
import { insert, move, organize, remove, rotate, split } from '../src/index';

const pdfOf = async (count: number, firstWidth = 100) => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i++) doc.addPage([firstWidth + i, 200]);
  return doc.save();
};

const pages = async (buf: Uint8Array) =>
  (await PDFDocument.load(buf))
    .getPages()
    .map((page) => `${page.getWidth() - 100}@${page.getRotation().angle}`);

const RANGE = '[@pdfme/manipulator] Invalid range';
const PAGE = '[@pdfme/manipulator] Invalid page number';
const POSITION = '[@pdfme/manipulator] Invalid position';

type Run = (v: number, base: Uint8Array, a: Uint8Array) => Promise<unknown>;

const slots: [string, string, Run][] = [
  ['split start', RANGE, (v, p) => split(p, [{ start: v }])],
  ['split end', RANGE, (v, p) => split(p, [{ end: v }])],
  ['remove', PAGE, (v, p) => remove(p, [v])],
  ['insert', POSITION, (v, p, a) => insert(p, [{ pdf: a, position: v }])],
  ['rotate', PAGE, (v, p) => rotate(p, 90, [v])],
  ['move from', PAGE, (v, p) => move(p, { from: v, to: 0 })],
  ['move to', PAGE, (v, p) => move(p, { from: 0, to: v })],
  ['organize remove', PAGE, (v, p) => organize(p, [{ type: 'remove', data: { position: v } }])],
  [
    'organize insert',
    POSITION,
    (v, p, a) => organize(p, [{ type: 'insert', data: { pdf: a, position: v } }]),
  ],
  [
    'organize replace',
    PAGE,
    (v, p, a) => organize(p, [{ type: 'replace', data: { pdf: a, position: v } }]),
  ],
  [
    'organize rotate',
    PAGE,
    (v, p) => organize(p, [{ type: 'rotate', data: { position: v, degrees: 90 } }]),
  ],
  ['organize move from', PAGE, (v, p) => organize(p, [{ type: 'move', data: { from: v, to: 0 } }])],
  ['organize move to', PAGE, (v, p) => organize(p, [{ type: 'move', data: { from: 0, to: v } }])],
];
const invalid: [string, number][] = [
  ['NaN', NaN],
  ['Infinity', Infinity],
  ['-Infinity', -Infinity],
  ['1.5', 1.5],
];

describe('invalid coordinates are rejected', () => {
  test.each(
    slots.flatMap(([slot, msg, run]) =>
      invalid.map(([name, v]) => [slot, name, v, msg, run] as const),
    ),
  )('%s = %s', async (_slot, _name, v, msg, run) => {
    await expect(run(v, await pdfOf(3), await pdfOf(1, 200))).rejects.toThrow(msg);
  });

  // A fraction that vanishes when added to the offset of an earlier insertion.
  test.each([
    ['Number.MIN_VALUE', Number.MIN_VALUE],
    ['1 - Number.EPSILON / 2', 1 - Number.EPSILON / 2],
  ])('insert position %s after an earlier insertion', async (_name, v) => {
    const base = await pdfOf(3);
    const a = await pdfOf(1, 200);
    const b = await pdfOf(1, 201);
    await expect(
      insert(base, [
        { pdf: b, position: v },
        { pdf: a, position: 0 },
      ]),
    ).rejects.toThrow(POSITION);
  });
});

describe('valid coordinates keep their behavior', () => {
  const ok = (labels: string) => labels.split(',').map((l) => (l.includes('@') ? l : `${l}@0`));
  type Case = [
    string,
    (p: Uint8Array, a: Uint8Array, b: Uint8Array) => Promise<Uint8Array | Uint8Array[]>,
    string[] | string[][],
  ];
  const cases: Case[] = [
    ['split {}', (p) => split(p, [{}]), [ok('0,1,2')]],
    ['split {start:2}', (p) => split(p, [{ start: 2 }]), [ok('2')]],
    ['split {end:0}', (p) => split(p, [{ end: 0 }]), [ok('0')]],
    [
      'split two ranges',
      (p) =>
        split(p, [
          { start: 0, end: 0 },
          { start: 1, end: 2 },
        ]),
      [ok('0'), ok('1,2')],
    ],
    ['remove [0,2]', (p) => remove(p, [0, 2]), ok('1')],
    ['remove [1,1]', (p) => remove(p, [1, 1]), ok('0')],
    ['insert A@3', (p, a) => insert(p, [{ pdf: a, position: 3 }]), ok('0,1,2,100')],
    ['insert A@0', (p, a) => insert(p, [{ pdf: a, position: 0 }]), ok('100,0,1,2')],
    [
      'insert A@3,B@0',
      (p, a, b) =>
        insert(p, [
          { pdf: a, position: 3 },
          { pdf: b, position: 0 },
        ]),
      ok('101,0,1,2,100'),
    ],
    [
      'insert A@1,B@1',
      (p, a, b) =>
        insert(p, [
          { pdf: a, position: 1 },
          { pdf: b, position: 1 },
        ]),
      ok('0,100,101,1,2'),
    ],
    ['insert []', (p) => insert(p, []), ok('0,1,2')],
    ['rotate 90', (p) => rotate(p, 90), ok('0@90,1@90,2@90')],
    ['rotate 90 []', (p) => rotate(p, 90, []), ok('0,1,2')],
    ['rotate 270 [0,2]', (p) => rotate(p, 270, [0, 2]), ok('0@270,1,2@270')],
    ['rotate 180 [2,2]', (p) => rotate(p, 180, [2, 2]), ok('0,1,2@180')],
    ['rotate -90 [0]', (p) => rotate(p, -90 as 90, [0]), ok('0@270,1,2')],
    [
      'organize insert, rotate, move',
      (p, a) =>
        organize(p, [
          { type: 'insert', data: { pdf: a, position: 3 } },
          { type: 'rotate', data: { position: 3, degrees: 90 } },
          { type: 'move', data: { from: 3, to: 0 } },
        ]),
      ok('100@90,0,1,2'),
    ],
    [
      'organize replace 2',
      (p, a) => organize(p, [{ type: 'replace', data: { pdf: a, position: 2 } }]),
      ok('0,1,100'),
    ],
    [
      'organize two rotates',
      (p) =>
        organize(p, [
          { type: 'rotate', data: { position: 0, degrees: 90 } },
          { type: 'rotate', data: { position: 2, degrees: 270 } },
        ]),
      ok('0@90,1,2@270'),
    ],
  ];

  test.each(cases)('%s', async (_label, run, expected) => {
    const out = await run(await pdfOf(3), await pdfOf(1, 200), await pdfOf(1, 201));
    expect(Array.isArray(out) ? await Promise.all(out.map(pages)) : await pages(out)).toEqual(
      expected,
    );
  });
});

describe('integer bounds and angle validation stay', () => {
  test.each([
    ['split end 3', (p: Uint8Array) => split(p, [{ end: 3 }]), RANGE],
    ['split start -1', (p: Uint8Array) => split(p, [{ start: -1 }]), RANGE],
    ['rotate [3]', (p: Uint8Array) => rotate(p, 90, [3]), PAGE],
    ['rotate [-1]', (p: Uint8Array) => rotate(p, 90, [-1]), PAGE],
    [
      'organize replace 3',
      (p: Uint8Array, a: Uint8Array) =>
        organize(p, [{ type: 'replace', data: { pdf: a, position: 3 } }]),
      PAGE,
    ],
    [
      'organize remove then rotate uses current count',
      (p: Uint8Array) =>
        organize(p, [
          { type: 'remove', data: { position: 0 } },
          { type: 'rotate', data: { position: 2, degrees: 90 } },
        ]),
      `${PAGE}: pages must be between 0 and 1`,
    ],
    [
      'organize move 0->3',
      (p: Uint8Array) => organize(p, [{ type: 'move', data: { from: 0, to: 3 } }]),
      `${PAGE}: from=0, to=3, total pages=3`,
    ],
    [
      'rotate 90.5',
      (p: Uint8Array) => rotate(p, 90.5 as 90, [0]),
      '[@pdfme/manipulator] Rotation degrees must be a multiple of 90',
    ],
  ] as [string, (p: Uint8Array, a: Uint8Array) => Promise<unknown>, string][])(
    '%s',
    async (_label, run, msg) => {
      await expect(run(await pdfOf(3), await pdfOf(1, 200))).rejects.toThrow(msg);
    },
  );
});
